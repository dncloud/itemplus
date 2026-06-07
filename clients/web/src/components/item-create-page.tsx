"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  api,
  type AIParseItemIntentResult,
  type AIParseStreamEvent,
  type Category,
  type Item,
  type ItemComponent,
  type Location,
  type Property,
  type Vendor,
} from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { ItemCreateAIPanel, ItemCreateHeader } from "@/components/item-create-ai-panel";
import {
  countVisibleSuggestedFields,
  countVisibleSuggestedProperties,
  formatItemSuggestionValue as formatSuggestionValue,
  resolvePhotoLookupPrompt,
} from "@/components/item-create-helpers";
import { extractPartialAIOutput } from "@/components/item-create-ai-utils";
import { buildAIViewState, deriveAISuggestions } from "@/components/item-create-ai-state";
import { InventorySection, PropertiesSection } from "@/components/item-create-form-sections";
import { ItemCreateBasicsSection } from "@/components/item-create-basics-section";
import { VendorsSection } from "@/components/item-create-media-sections";
import {
  fetchCategoryProperties,
  fetchEditItemData,
  fetchItemCreateReferenceData,
} from "@/components/item-create-data";
import {
  requestItemBarcodeCapture,
  requestItemPhotoLookup,
  subscribeItemCreateDeviceEvents,
} from "@/components/item-create-device";
import {
  applyAllSuggestedValues,
  applySuggestedItemField as applySuggestedItemFieldState,
  applySuggestedPropertyValue as applySuggestedPropertyValueState,
  persistItemWithUploads,
} from "@/components/item-create-actions";
import { ModalSection } from "@/components/item-create-ui";
import { ItemCreateErrorView, ItemCreateLoadingView } from "@/components/item-create-view";
import AttachmentManager from "@/components/attachment-manager";

type ItemCreatePageProps = {
  mode?: "create" | "edit";
  itemId?: number;
};

type AIChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  pending?: boolean;
  animate?: boolean;
};

type AIChatSuggestion = {
  id: string;
  label: string;
  value: string;
  onApply: () => void;
};

function createChatId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function loadTempImagePreview(tempImageID: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/ai/temp-image/${tempImageID}`, { credentials: "include" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }
        reject(new Error("Could not convert temp image"));
      };
      reader.onerror = () => reject(reader.error || new Error("Could not read temp image"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function ItemCreatePage({ mode = "create", itemId }: ItemCreatePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { realm, locale, t, iosBridgeStatus, currentUserLabel, setAiAssistantBusy, setAiAssistantPanelController } = useApp();
  const isEditMode = mode === "edit";
  const initialBarcode = searchParams.get("barcode") || "";
  const initialSymbology = searchParams.get("symbology") || "";

  const [editItem, setEditItem] = useState<Partial<Item>>({ name: "", quantity: 1, item_status: "active" });
  const [sourceItem, setSourceItem] = useState<Item | null>(null);
  const [itemLoaded, setItemLoaded] = useState(!isEditMode);
  const [itemLoadFailed, setItemLoadFailed] = useState(false);
  const [barcodeDraft, setBarcodeDraft] = useState<{ code: string; symbology?: string | null } | null>(
    initialBarcode ? { code: initialBarcode, symbology: initialSymbology || null } : null,
  );
  const [aiAssistBusy, setAiAssistBusy] = useState(false);
  const [aiAssistStatus, setAiAssistStatus] = useState<string | null>(null);
  const [aiSuggestedItem, setAiSuggestedItem] = useState<Partial<Item>>({});
  const [aiSuggestedPropValues, setAiSuggestedPropValues] = useState<Record<string, unknown>>({});
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiChat, setAiChat] = useState<AIChatEntry[]>([]);
  const [aiSuggestionAnchorMessageId, setAiSuggestionAnchorMessageId] = useState<string | null>(null);
  const [aiLiveText, setAiLiveText] = useState("");
  const [barcodeCapturePending, setBarcodeCapturePending] = useState(false);
  const [photoLookupPending, setPhotoLookupPending] = useState(false);
  const [lastBarcodeLookupCode, setLastBarcodeLookupCode] = useState<string | null>(null);
  const consumedInitialBarcodeRef = useRef(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [manufacturers, setManufacturers] = useState<Vendor[]>([]);
  const [suppliers, setSuppliers] = useState<Vendor[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [salesPlatforms, setSalesPlatforms] = useState<Vendor[]>([]);
  const [itemComponents, setItemComponents] = useState<ItemComponent[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [catProperties, setCatProperties] = useState<Property[]>([]);
  const [propValues, setPropValues] = useState<Record<string, unknown>>({});
  const markAssistantMessageSeen = useCallback((id: string) => {
    setAiChat((current) =>
      current.map((entry) => (entry.id === id && entry.animate ? { ...entry, animate: false } : entry)),
    );
  }, []);
  const aiUserName = currentUserLabel || t("items.aiUserFallback");

  const loadSourceItem = useCallback(async () => {
    if (!isEditMode || !itemId) return;
    const loaded = await fetchEditItemData(itemId);
    setSourceItem(loaded);
    setEditItem(loaded);
    setPropValues(loaded.properties || {});
  }, [isEditMode, itemId]);

  useEffect(() => {
    fetchItemCreateReferenceData(itemId).then((data) => {
      setCategories(data.categories);
      setLocations(data.locations);
      setAllProperties(data.allProperties);
      setManufacturers(data.manufacturers);
      setSuppliers(data.suppliers);
      setVendors(data.vendors);
      setSalesPlatforms(data.salesPlatforms);
      setItemComponents(data.itemComponents);
    });
  }, [itemId, realm]);

  useEffect(() => {
    if (!isEditMode || !itemId) return;
    let cancelled = false;
    setItemLoaded(false);
    setItemLoadFailed(false);
    loadSourceItem()
      .catch(() => {
        if (!cancelled) setItemLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setItemLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isEditMode, itemId, loadSourceItem]);

  useEffect(() => {
    if (isEditMode || consumedInitialBarcodeRef.current) return;
    if (!initialBarcode && !initialSymbology) return;
    consumedInitialBarcodeRef.current = true;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("barcode");
    params.delete("symbology");
    const nextQuery = params.toString();
    router.replace(nextQuery ? `/items/new?${nextQuery}` : "/items/new");
  }, [consumedInitialBarcodeRef, initialBarcode, initialSymbology, isEditMode, router, searchParams]);

  useEffect(() => {
    setAiAssistantBusy(aiAssistBusy);
    return () => setAiAssistantBusy(false);
  }, [aiAssistBusy, setAiAssistantBusy]);

  const selectedCategoryId = editItem.category_id;
  useEffect(() => {
    if (!selectedCategoryId) {
      setCatProperties([]);
      return;
    }
    fetchCategoryProperties(selectedCategoryId)
      .then((props) => setCatProperties(props.sort((a, b) => a.position - b.position)))
      .catch(() => setCatProperties([]));
  }, [selectedCategoryId]);

  const valuesEqual = useCallback((left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right), []);

  const collectAISuggestions = useCallback(
    (result: AIParseItemIntentResult) => {
      const nextState = deriveAISuggestions({
        result,
        categories,
        allProperties,
        barcodeCode: barcodeDraft?.code,
        itemName: editItem.name,
        itemCategoryId: editItem.category_id,
        realm,
        t,
      });
      setAiSuggestedItem(nextState.suggestedItem);
      setAiSuggestedPropValues(nextState.suggestedPropValues);
      setAiAssistStatus(nextState.status);
      return nextState;
    },
    [allProperties, barcodeDraft?.code, categories, editItem.category_id, editItem.name, realm, t],
  );

  const buildAIAssistPrompt = useCallback(
    (extraContext?: string) => {
      const itemName = (editItem.name || "").trim();
      const categoryName =
        categories.find((category) => category.id === editItem.category_id)?.name?.trim() || "";
      if (!itemName || !categoryName) return "";

      const parts = [`Name: ${itemName}`, `Kategorie: ${categoryName}`];
      if (barcodeDraft?.code) parts.push(`Barcode: ${barcodeDraft.code}`);
      if (extraContext && extraContext.trim()) {
        parts.push(extraContext.trim());
      } else {
        parts.push(
          "Hole passende Informationen zu diesem Item und ordne sie als Vorschläge den vorhandenen Formularfeldern und Properties zu.",
        );
      }
      return parts.join("\n");
    },
    [barcodeDraft?.code, categories, editItem.category_id, editItem.name],
  );

  const buildBarcodeLookupPrompt = useCallback(
    (code: string) => {
      const trimmedCode = code.trim();
      if (!trimmedCode) return "";
      return [
        `Barcode/EAN: ${trimmedCode}`,
        "Identify the most likely product or title for this barcode.",
        "Prioritize fields.name and a factual description.",
        "Only suggest a category if the product itself is confidently identified.",
        "If the code cannot be clearly identified, do not guess a category.",
      ].join("\n");
    },
    [],
  );

  const buildConversationContext = useCallback((history: AIChatEntry[], nextUserMessage: string) => {
    const lines = history
      .filter((entry) => !entry.pending && entry.content.trim())
      .map((entry) => `${entry.role === "user" ? "User" : "Ina"}: ${entry.content.trim()}`);
    if (nextUserMessage.trim()) {
      lines.push(`User: ${nextUserMessage.trim()}`);
    }
    return lines.join("\n");
  }, []);

  const runAIAssist = useCallback(async (
    promptOverride?: string,
    allowWebSearch = true,
    tempImageID?: string,
    options?: { identifyOnly?: boolean },
  ) => {
    const promptText = (promptOverride ?? buildAIAssistPrompt()).trim();
    if (!promptText) {
      setAiDrawerOpen(true);
      setAiChat((current) => [
        ...current,
        { id: createChatId("item-ai-assistant"), role: "assistant", content: t("items.aiAssistNeedsBasics"), animate: true },
      ]);
      setAiAssistStatus(t("items.aiAssistNeedsBasics"));
      return;
    }
    const identifyOnly = options?.identifyOnly === true;
    const assistantMessageId = createChatId("item-ai-assistant");
    setAiAssistBusy(true);
    setAiAssistStatus(null);
    setAiSuggestedItem({});
    setAiSuggestedPropValues({});
    setAiLiveText("");
    setAiDrawerOpen(true);
    setAiChat((current) => [
      ...current,
      { id: assistantMessageId, role: "assistant", content: t("categories.aiThinking"), pending: true },
    ]);

    try {
      let streamedResult: AIParseItemIntentResult | null = null;
      let streamedError: string | null = null;
      await api.parseItemIntentStream(
        {
          realm,
          prompt: promptText,
          barcode: barcodeDraft?.code,
          temp_image_id: tempImageID,
          locale,
          selected_category_id:
            identifyOnly ? undefined : typeof editItem?.category_id === "number" ? editItem.category_id : undefined,
          allow_web_search: allowWebSearch,
          identify_only: identifyOnly,
        },
        (event: AIParseStreamEvent) => {
          if (event.type === "delta" && event.delta) setAiLiveText((prev) => prev + event.delta);
          if (event.type === "result" && event.result) {
            streamedResult = event.result;
            const nextState = collectAISuggestions(event.result);
            const visibleSuggestionCount =
              countVisibleSuggestedFields(nextState.suggestedItem, editItem, valuesEqual) +
              countVisibleSuggestedProperties(nextState.suggestedPropValues, propValues, valuesEqual);
            if (visibleSuggestionCount > 0) {
              setAiSuggestionAnchorMessageId(assistantMessageId);
            }
            const reply = event.result.assistant_message?.trim() || t("items.aiSuggestionsReady");
            setAiChat((current) =>
              current.map((entry) =>
                entry.id === assistantMessageId ? { ...entry, content: reply, pending: false, animate: true } : entry,
              ),
            );
          }
          if (event.type === "error" && event.message) {
            streamedError = event.message;
            throw new Error(event.message);
          }
        },
      );
      if (!streamedResult) throw new Error(streamedError || t("items.aiFailed"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("items.aiFailed");
      const partialOutput = extractPartialAIOutput(message);
      if (partialOutput) setAiLiveText((prev) => prev || partialOutput);
      setAiAssistStatus(message);
      setAiChat((current) =>
        current.map((entry) =>
          entry.id === assistantMessageId ? { ...entry, content: message, pending: false, animate: true } : entry,
        ),
      );
    } finally {
      setAiAssistBusy(false);
    }
  }, [barcodeDraft?.code, buildAIAssistPrompt, collectAISuggestions, editItem, locale, propValues, realm, t, valuesEqual]);

  const sendAIMessage = useCallback(
    async (message: string) => {
      const trimmedMessage = message.trim();
      if (!trimmedMessage) {
        await runAIAssist();
        return;
      }
      setAiChat((current) => [...current, { id: createChatId("item-ai-user"), role: "user", content: trimmedMessage }]);
      const conversationContext = buildConversationContext(aiChat, trimmedMessage);
      await runAIAssist(buildAIAssistPrompt(conversationContext));
    },
    [aiChat, buildAIAssistPrompt, buildConversationContext, runAIAssist],
  );

  const applySuggestedField = <K extends keyof Item>(field: K) => {
    const result = applySuggestedItemFieldState(editItem, aiSuggestedItem, field);
    if (!result.changed) return;
    setEditItem(result.nextItem);
    setAiSuggestedItem(result.nextSuggestedItem);
  };

  const applySuggestedProperty = (propertyId: string) => {
    const result = applySuggestedPropertyValueState(propValues, aiSuggestedPropValues, propertyId);
    if (!result.changed) return;
    setPropValues(result.nextPropValues);
    setAiSuggestedPropValues(result.nextSuggestedPropValues);
  };

  const applyAllAISuggestions = () => {
    const result = applyAllSuggestedValues(editItem, propValues, aiSuggestedItem, aiSuggestedPropValues);
    setEditItem(result.nextItem);
    setPropValues(result.nextPropValues);
    setAiSuggestedItem({});
    setAiSuggestedPropValues({});
    setAiSuggestionAnchorMessageId(null);
    setAiAssistStatus(t("items.aiApplied"));
  };

  const save = async () => {
    if (!editItem?.name) return;
    try {
      const savedItemId = await persistItemWithUploads({
        isEditMode,
        itemId,
        item: editItem,
        propValues,
      });

      if (isEditMode && itemId) {
        await loadSourceItem();
        router.push(`/items/${itemId}`);
        return;
      }

      router.push(`/items/${savedItemId}`);
    } catch {}
  };

  const requestBarcodeCapture = () => {
    setBarcodeCapturePending(true);
    requestItemBarcodeCapture(realm);
  };

  const requestPhotoLookup = () => {
    setPhotoLookupPending(true);
    requestItemPhotoLookup(realm, editItem.name || "", barcodeDraft?.code);
  };

  useEffect(() => {
    return subscribeItemCreateDeviceEvents({
      onBarcodeScanned: ({ code, symbology }) => {
        setBarcodeCapturePending(false);
        setBarcodeDraft({ code, symbology });
      },
      onBarcodeUnavailable: () => {
        setBarcodeCapturePending(false);
      },
      onPhotoUploaded: (tempImageID) => {
        setPhotoLookupPending(false);
        void loadTempImagePreview(tempImageID).then((imageUrl) => {
          setAiChat((current) => [
            ...current,
            {
              id: createChatId("item-ai-user-photo"),
              role: "user",
              content: imageUrl ? "" : t("items.aiPhotoAction"),
              imageUrl: imageUrl || undefined,
            },
          ]);
        });
        setAiAssistStatus(t("items.aiPhotoReceived"));
        const prompt = resolvePhotoLookupPrompt({
          itemName: editItem.name,
          categoryId: editItem.category_id,
          barcodeCode: barcodeDraft?.code,
          buildAIAssistPrompt,
          buildBarcodeLookupPrompt,
        });
        void runAIAssist(prompt, true, tempImageID, {
          identifyOnly: !(editItem.name?.trim() && typeof editItem.category_id === "number"),
        });
      },
    });
  }, [barcodeDraft?.code, buildAIAssistPrompt, buildBarcodeLookupPrompt, editItem.category_id, editItem.name, runAIAssist, t]);

  useEffect(() => {
    const code = barcodeDraft?.code?.trim();
    if (!code) return;
    if ((editItem.name || "").trim()) return;
    if (lastBarcodeLookupCode === code) return;
    setLastBarcodeLookupCode(code);
    void runAIAssist(buildBarcodeLookupPrompt(code), true, undefined, { identifyOnly: true });
  }, [barcodeDraft?.code, buildBarcodeLookupPrompt, editItem.name, lastBarcodeLookupCode, runAIAssist]);

  const { suggestedCategoryName, hasVisibleSuggestions } = useMemo(
    () =>
      buildAIViewState({
        aiSuggestedItem,
        editItem,
        aiSuggestedPropValues,
        propValues,
        aiAssistStatus,
        aiLiveText,
        categories,
        valuesEqual,
        t,
      }),
    [aiSuggestedItem, editItem, aiSuggestedPropValues, propValues, aiAssistStatus, aiLiveText, categories, valuesEqual, t],
  );
  const hasAISession =
    aiDrawerOpen ||
    aiAssistBusy ||
    hasVisibleSuggestions ||
    aiChat.length > 0;

  const aiChatSuggestions = useMemo<AIChatSuggestion[]>(() => {
    const entries: AIChatSuggestion[] = [];

    if (typeof aiSuggestedItem.name === "string" && aiSuggestedItem.name.trim() && !valuesEqual(editItem.name, aiSuggestedItem.name)) {
      entries.push({
        id: "field:name",
        label: t("items.name"),
        value: aiSuggestedItem.name,
        onApply: () => applySuggestedField("name"),
      });
    }

    if (typeof aiSuggestedItem.description === "string" && !valuesEqual(editItem.description, aiSuggestedItem.description)) {
      entries.push({
        id: "field:description",
        label: t("items.description"),
        value: aiSuggestedItem.description,
        onApply: () => applySuggestedField("description"),
      });
    }

    if (typeof aiSuggestedItem.category_id === "number" && suggestedCategoryName && !valuesEqual(editItem.category_id, aiSuggestedItem.category_id)) {
      entries.push({
        id: "field:category_id",
        label: t("items.category"),
        value: suggestedCategoryName,
        onApply: () => applySuggestedField("category_id"),
      });
    }

    if (typeof aiSuggestedItem.purchase_price === "number" && !valuesEqual(editItem.purchase_price, aiSuggestedItem.purchase_price)) {
      entries.push({
        id: "field:purchase_price",
        label: t("items.purchasePrice"),
        value: String(aiSuggestedItem.purchase_price),
        onApply: () => applySuggestedField("purchase_price"),
      });
    }

    if (typeof aiSuggestedItem.purchase_currency === "string" && !valuesEqual(editItem.purchase_currency, aiSuggestedItem.purchase_currency)) {
      entries.push({
        id: "field:purchase_currency",
        label: t("items.currency"),
        value: aiSuggestedItem.purchase_currency,
        onApply: () => applySuggestedField("purchase_currency"),
      });
    }

    if (typeof aiSuggestedItem.quantity === "number" && !valuesEqual(editItem.quantity, aiSuggestedItem.quantity)) {
      entries.push({
        id: "field:quantity",
        label: t("items.quantity"),
        value: String(aiSuggestedItem.quantity),
        onApply: () => applySuggestedField("quantity"),
      });
    }

    for (const prop of catProperties) {
      const suggestion = aiSuggestedPropValues[String(prop.id)];
      if (typeof suggestion === "undefined" || valuesEqual(propValues[String(prop.id)], suggestion)) continue;
      entries.push({
        id: `property:${prop.id}`,
        label: prop.name,
        value: formatSuggestionValue(suggestion, prop),
        onApply: () => applySuggestedProperty(String(prop.id)),
      });
    }

    return entries;
  }, [
    aiSuggestedItem,
    suggestedCategoryName,
    editItem,
    catProperties,
    aiSuggestedPropValues,
    propValues,
    valuesEqual,
    applySuggestedField,
    applySuggestedProperty,
    formatSuggestionValue,
    t,
  ]);

  useEffect(() => {
    if (!hasAISession) {
      setAiAssistantPanelController(null);
      return;
    }
    setAiAssistantPanelController({
      available: true,
      open: aiDrawerOpen,
      toggle: () => setAiDrawerOpen((open) => !open),
    });
  }, [aiDrawerOpen, hasAISession, setAiAssistantPanelController]);

  useEffect(() => {
    return () => setAiAssistantPanelController(null);
  }, [setAiAssistantPanelController]);

  const pageTitle = isEditMode && editItem.name?.trim() ? `${t("common.edit")} - ${editItem.name.trim()}` : isEditMode ? t("common.edit") : t("items.new");
  const cancelHref = isEditMode && itemId ? `/items/${itemId}` : "/items";

  if (!itemLoaded) {
    return <ItemCreateLoadingView />;
  }

  if (itemLoadFailed) {
    return (
      <ItemCreateErrorView title={t("common.error")} backHref="/items" backLabel={t("items.title")} />
    );
  }

  return (
    <div className="space-y-8">
      <ItemCreateHeader
        t={t}
        realm={realm}
        pageTitle={pageTitle}
        cancelHref={cancelHref}
        barcodeCapturePending={barcodeCapturePending}
        requestBarcodeCapture={requestBarcodeCapture}
        aiAssistBusy={aiAssistBusy}
        openAIPanel={() => setAiDrawerOpen((open) => !open)}
        hasAIInfo={hasAISession}
        aiPanelOpen={aiDrawerOpen}
      />

      <ItemCreateAIPanel
        t={t}
        editItem={editItem}
        setEditItem={setEditItem}
        categories={categories}
        clearPropValues={() => setPropValues({})}
        barcodeDraft={barcodeDraft}
        clearBarcodeDraft={() => setBarcodeDraft(null)}
        hasVisibleSuggestions={hasVisibleSuggestions}
        applyAllAISuggestions={applyAllAISuggestions}
        runAIAssist={(message) => {
          void sendAIMessage(message);
        }}
        aiAssistBusy={aiAssistBusy}
        canPhotoLookup={iosBridgeStatus === "connected"}
        photoLookupPending={photoLookupPending}
        requestPhotoLookup={requestPhotoLookup}
        aiDrawerOpen={aiDrawerOpen}
        closeAIDrawer={() => setAiDrawerOpen(false)}
        aiUserName={aiUserName}
        aiChat={aiChat}
        aiSuggestionAnchorMessageId={aiSuggestionAnchorMessageId}
        aiChatSuggestions={aiChatSuggestions}
        markAssistantMessageSeen={markAssistantMessageSeen}
        endAIDrawerSession={() => {
          setAiDrawerOpen(false);
          setAiAssistStatus(null);
          setAiSuggestedItem({});
          setAiSuggestedPropValues({});
          setAiSuggestionAnchorMessageId(null);
          setAiChat([]);
          setAiLiveText("");
        }}
      />

      {isEditMode && itemId && sourceItem ? (
        <ModalSection title={t("attachments.title")}>
          <AttachmentManager
            itemId={itemId}
            attachments={sourceItem.attachments || []}
            onChange={() => {
              void loadSourceItem();
            }}
          />
        </ModalSection>
      ) : null}

      <ItemCreateBasicsSection
        t={t}
        editItem={editItem}
        setEditItem={setEditItem}
        aiSuggestedItem={aiSuggestedItem}
        suggestedCategoryName={suggestedCategoryName}
        valuesEqual={valuesEqual}
        applySuggestedField={applySuggestedField}
        categories={categories}
        locations={locations}
        clearPropValues={() => setPropValues({})}
      />

      <VendorsSection
        t={t}
        editItem={editItem}
        manufacturers={manufacturers}
        suppliers={suppliers}
        vendors={vendors}
        salesPlatforms={salesPlatforms}
        setEditItem={setEditItem}
      />

      <InventorySection
        t={t}
        editItem={editItem}
        itemComponents={itemComponents}
        aiSuggestedItem={aiSuggestedItem}
        valuesEqual={valuesEqual}
        applySuggestedField={applySuggestedField}
        setEditItem={setEditItem}
      />

      <PropertiesSection
        t={t}
        catProperties={catProperties}
        propValues={propValues}
        aiSuggestedPropValues={aiSuggestedPropValues}
        valuesEqual={valuesEqual}
        formatSuggestionValue={formatSuggestionValue}
        applySuggestedProperty={applySuggestedProperty}
        setPropValues={setPropValues}
      />

      <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-6 dark:border-white/10">
        <Link
          href={cancelHref}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:inset-ring-white/5 dark:hover:bg-white/20"
        >
          {t("common.cancel")}
        </Link>
        <button
          type="button"
          onClick={save}
          disabled={!editItem?.name?.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t("common.save")}
        </button>
      </div>

    </div>
  );
}
