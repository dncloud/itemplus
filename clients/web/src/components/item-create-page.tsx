"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  api,
  type AIParseItemIntentResult,
  type AIParseStreamEvent,
  type Attachment,
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
  formatItemSuggestionValue as formatSuggestionValue,
  resolvePhotoLookupPrompt,
} from "@/components/item-create-helpers";
import { extractPartialAIOutput } from "@/components/item-create-ai-utils";
import { buildAIViewState, deriveAISuggestions } from "@/components/item-create-ai-state";
import { InventorySection, PropertiesSection } from "@/components/item-create-form-sections";
import { ItemCreateBasicsSection } from "@/components/item-create-basics-section";
import { ImageSection, VendorsSection } from "@/components/item-create-media-sections";
import {
  fetchCategoryProperties,
  fetchEditItemData,
  fetchItemCreateReferenceData,
  findFirstImageAttachment,
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

export default function ItemCreatePage({ mode = "create", itemId }: ItemCreatePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { realm, locale, serverURL, t } = useApp();
  const isEditMode = mode === "edit";
  const initialBarcode = searchParams.get("barcode") || "";
  const initialSymbology = searchParams.get("symbology") || "";

  const [editItem, setEditItem] = useState<Partial<Item>>({ name: "", quantity: 1, item_status: "active" });
  const [sourceItem, setSourceItem] = useState<Item | null>(null);
  const [itemLoaded, setItemLoaded] = useState(!isEditMode);
  const [itemLoadFailed, setItemLoadFailed] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [barcodeDraft, setBarcodeDraft] = useState<{ code: string; symbology?: string | null } | null>(
    initialBarcode ? { code: initialBarcode, symbology: initialSymbology || null } : null,
  );
  const [aiAssistBusy, setAiAssistBusy] = useState(false);
  const [aiAssistStatus, setAiAssistStatus] = useState<string | null>(null);
  const [aiAssistResult, setAiAssistResult] = useState<AIParseItemIntentResult | null>(null);
  const [aiSuggestedItem, setAiSuggestedItem] = useState<Partial<Item>>({});
  const [aiSuggestedPropValues, setAiSuggestedPropValues] = useState<Record<string, unknown>>({});
  const [aiLastRequest, setAiLastRequest] = useState("");
  const [aiLiveText, setAiLiveText] = useState("");
  const [aiProgressMessages, setAiProgressMessages] = useState<string[]>([]);
  const [aiThinkingMessages, setAiThinkingMessages] = useState<string[]>([]);
  const [barcodeCapturePending, setBarcodeCapturePending] = useState(false);
  const [lastBarcodeLookupCode, setLastBarcodeLookupCode] = useState<string | null>(null);
  const [photoLookupPending, setPhotoLookupPending] = useState(false);

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

  const getAttachmentPreviewUrl = useCallback(
    (attachment: Attachment) =>
      attachment.download_url
        ? `${serverURL}${attachment.download_url}`
        : attachment.url || `${serverURL}/uploads/${attachment.file_path}`,
    [serverURL],
  );

  const loadSourceItem = useCallback(async () => {
    if (!isEditMode || !itemId) return;
    const loaded = await fetchEditItemData(itemId);
    setSourceItem(loaded);
    setEditItem(loaded);
    setPropValues(loaded.properties || {});

    try {
      const firstImage = findFirstImageAttachment(loaded.attachments || []);
      setImagePreview(firstImage ? getAttachmentPreviewUrl(firstImage) : null);
    } catch {
      setImagePreview(null);
    }
    setPendingImage(null);
  }, [getAttachmentPreviewUrl, isEditMode, itemId]);

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

  const runAIAssist = useCallback(async (promptOverride?: string, allowWebSearch = true, tempImageID?: string) => {
    const promptText = (promptOverride ?? buildAIAssistPrompt()).trim();
    if (!promptText) {
      setAiAssistStatus(t("items.aiAssistNeedsBasics"));
      return;
    }
    setAiLastRequest(promptText);
    setAiAssistBusy(true);
    setAiAssistStatus(null);
    setAiAssistResult(null);
    setAiSuggestedItem({});
    setAiSuggestedPropValues({});
    setAiLiveText("");
    setAiProgressMessages([]);
    setAiThinkingMessages([]);

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
            typeof editItem?.category_id === "number" ? editItem.category_id : undefined,
          allow_web_search: allowWebSearch,
        },
        (event: AIParseStreamEvent) => {
          if (event.type === "status" && event.message) {
            setAiProgressMessages((prev) => [...prev, event.message!]);
          }
          if (event.type === "note" && event.message) {
            setAiThinkingMessages((prev) => [...prev, event.message!]);
          }
          if (event.type === "request" && event.message) setAiLastRequest(event.message);
          if (event.type === "delta" && event.delta) setAiLiveText((prev) => prev + event.delta);
          if (event.type === "result" && event.result) {
            streamedResult = event.result;
            setAiAssistResult(event.result);
            collectAISuggestions(event.result);
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
    } finally {
      setAiAssistBusy(false);
    }
  }, [barcodeDraft?.code, buildAIAssistPrompt, collectAISuggestions, editItem?.category_id, locale, realm, t]);

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
        pendingImage,
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
        setAiAssistStatus(t("items.aiPhotoReceived"));
        const prompt = resolvePhotoLookupPrompt({
          itemName: editItem.name,
          categoryId: editItem.category_id,
          barcodeCode: barcodeDraft?.code,
          buildAIAssistPrompt,
          buildBarcodeLookupPrompt,
        });
        void runAIAssist(prompt, true, tempImageID);
      },
    });
  }, [barcodeDraft?.code, buildAIAssistPrompt, buildBarcodeLookupPrompt, editItem.category_id, editItem.name, runAIAssist, t]);

  useEffect(() => {
    const code = barcodeDraft?.code?.trim();
    if (!code) return;
    if ((editItem.name || "").trim()) return;
    if (lastBarcodeLookupCode === code) return;
    setLastBarcodeLookupCode(code);
    void runAIAssist(buildBarcodeLookupPrompt(code), true);
  }, [barcodeDraft?.code, buildBarcodeLookupPrompt, editItem.name, lastBarcodeLookupCode, runAIAssist]);

  const { suggestedCategoryName, hasVisibleSuggestions, aiStatusDetails, aiErrorInsights } = useMemo(
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

  const pageTitle = isEditMode ? t("common.edit") : t("items.new");
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
        canRunAI={!!editItem.name?.trim() && typeof editItem.category_id === "number"}
        runAIAssist={() => {
          void runAIAssist();
        }}
      />

      <ItemCreateAIPanel
        t={t}
        barcodeDraft={barcodeDraft}
        clearBarcodeDraft={() => setBarcodeDraft(null)}
        hasVisibleSuggestions={hasVisibleSuggestions}
        applyAllAISuggestions={applyAllAISuggestions}
        aiAssistBusy={aiAssistBusy}
        aiAssistStatus={aiAssistStatus}
        aiStatusDetails={aiStatusDetails}
        aiErrorInsights={aiErrorInsights}
        aiAssistResultQuestions={aiAssistResult?.questions || []}
        aiAssistResultNotes={aiAssistResult?.notes || []}
        aiLastRequest={aiLastRequest}
        aiLiveText={aiLiveText}
        aiProgressMessages={aiProgressMessages}
        aiThinkingMessages={aiThinkingMessages}
        photoLookupPending={photoLookupPending}
        requestPhotoLookup={requestPhotoLookup}
      />

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
        aiAssistBusy={aiAssistBusy}
        runAIAssist={() => {
          void runAIAssist();
        }}
      />

      <ImageSection
        t={t}
        imagePreview={imagePreview}
        pendingImage={pendingImage}
        sourceItem={sourceItem}
        getAttachmentPreviewUrl={getAttachmentPreviewUrl}
        setPendingImage={setPendingImage}
        setImagePreview={setImagePreview}
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
    </div>
  );
}
