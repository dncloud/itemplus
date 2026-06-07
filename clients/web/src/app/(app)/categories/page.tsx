"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { api, type Category, type Property } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { PlusIcon, ChevronRightIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useDeleteFlow, ConfirmDelete } from "@/components/confirm-delete";
import { AIInfoDrawer } from "@/components/item-create-ai-sections";
import {
  CategoryAIProposalPanel,
  CategoryInlineForm,
  PropertyInlineForm,
  SortableCategory,
  SortableProperty,
  getPropertyTypes,
} from "./categories-sections";
import {
  buildEditablePropertyPayload,
  fetchCategoriesPageData,
  fetchCategoryProperties,
  persistCategoryOrder,
  persistPropertyOrder,
  sortProperties,
} from "./categories-page-utils";
import { buildPropertyOptionsPayload } from "@/lib/property-options";
import type {
  AICategoryPropertySuggestionResult,
  AIPropertyEnhancementSuggestionResult,
  AIPropertyProposal,
} from "@/lib/api";

type AIChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  animate?: boolean;
};

function createChatId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function AnimatedAIText({
  content,
  animate = false,
  pending = false,
  onAnimationDone,
}: {
  content: string;
  animate?: boolean;
  pending?: boolean;
  onAnimationDone?: () => void;
}) {
  const [visibleLength, setVisibleLength] = useState(animate ? 0 : content.length);

  useEffect(() => {
    if (pending) {
      setVisibleLength(0);
      return;
    }
    if (!animate) {
      setVisibleLength(content.length);
      return;
    }

    setVisibleLength(0);
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleLength(Math.min(index, content.length));
      if (index >= content.length) {
        window.clearInterval(timer);
        onAnimationDone?.();
      }
    }, 12);
    return () => window.clearInterval(timer);
  }, [animate, content, onAnimationDone, pending]);

  if (pending) {
    return (
      <span className="ai-thinking-text">
        {content}
      </span>
    );
  }

  const visibleText = content.slice(0, visibleLength);
  return (
    <p
      className={`whitespace-pre-wrap ${animate ? "text-white [text-shadow:0_0_10px_rgba(96,165,250,0.2)]" : ""}`}
    >
      {visibleText}
      {animate && visibleLength < content.length ? <span className="ml-0.5 inline-block h-4 w-[1px] animate-pulse bg-blue-300 align-middle" /> : null}
    </p>
  );
}

function AIChatMessage({
  role,
  name,
  content,
  pending = false,
  animate = false,
  onAnimationDone,
}: {
  role: "user" | "assistant";
  name: string;
  content: string;
  pending?: boolean;
  animate?: boolean;
  onAnimationDone?: () => void;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[88%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-2`}>
        <p className="px-1 text-xs font-medium uppercase tracking-[0.08em] text-gray-400">{name}</p>
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            isUser
              ? "bg-blue-500 text-white"
              : "border border-white/10 bg-white/5 text-gray-200"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <AnimatedAIText content={content} animate={animate} pending={pending} onAnimationDone={onAnimationDone} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const { realm, locale, fmtDateTime, t, can, currentUserLabel, setAiAssistantBusy, setAiAssistantPanelController } = useApp();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [editCat, setEditCat] = useState<Partial<Category> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [editProp, setEditProp] = useState<Partial<Property> | null>(null);
  const [isNewProp, setIsNewProp] = useState(false);
  const [categoryAIBusy, setCategoryAIBusy] = useState(false);
  const [categoryAIStatus, setCategoryAIStatus] = useState<string | null>(null);
  const [categoryAIResult, setCategoryAIResult] = useState<AICategoryPropertySuggestionResult | null>(null);
  const [categoryAIInstructions, setCategoryAIInstructions] = useState("");
  const [categoryAIDrawerOpen, setCategoryAIDrawerOpen] = useState(false);
  const [categoryAIChat, setCategoryAIChat] = useState<AIChatEntry[]>([]);
  const [propertyAIBusy, setPropertyAIBusy] = useState(false);
  const [propertyAIStatus, setPropertyAIStatus] = useState<string | null>(null);
  const [propertyAIResult, setPropertyAIResult] = useState<AIPropertyEnhancementSuggestionResult | null>(null);
  const [propertyAIInstructions, setPropertyAIInstructions] = useState("");
  const [propertyAIDrawerOpen, setPropertyAIDrawerOpen] = useState(false);
  const [propertyAIChat, setPropertyAIChat] = useState<AIChatEntry[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const canWriteCategories = can("categories.write");
  const canDeleteCategories = can("categories.delete");
  const canReadItems = can("items.read");
  const aiUserName = currentUserLabel || t("categories.aiUserFallback");
  const aiAssistantName = t("categories.aiAssistantName");

  const markCategoryChatEntrySeen = useCallback((id: string) => {
    setCategoryAIChat((current) => current.map((entry) => (entry.id === id && entry.animate ? { ...entry, animate: false } : entry)));
  }, []);

  const markPropertyChatEntrySeen = useCallback((id: string) => {
    setPropertyAIChat((current) => current.map((entry) => (entry.id === id && entry.animate ? { ...entry, animate: false } : entry)));
  }, []);

  const loadingRef = useRef(false);
  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      setCategories(await fetchCategoriesPageData());
    } catch {}
    loadingRef.current = false;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        const cats = await fetchCategoriesPageData();
        if (!cancelled) {
          setCategories(cats);
        }
      } catch {}
    };

    void loadInitial();
    return () => { cancelled = true; };
  }, [realm]);

  useEffect(() => {
    setCategoryAIBusy(false);
    setCategoryAIStatus(null);
    setCategoryAIResult(null);
    setCategoryAIInstructions("");
    setCategoryAIDrawerOpen(false);
    setCategoryAIChat([]);
  }, [editCat?.id, isNew]);

  useEffect(() => {
    setPropertyAIBusy(false);
    setPropertyAIStatus(null);
    setPropertyAIResult(null);
    setPropertyAIInstructions("");
    setPropertyAIDrawerOpen(false);
    setPropertyAIChat([]);
  }, [editProp?.id, isNewProp]);

  useEffect(() => {
    setAiAssistantBusy(categoryAIBusy || propertyAIBusy);
    return () => setAiAssistantBusy(false);
  }, [categoryAIBusy, propertyAIBusy, setAiAssistantBusy]);

  const endCategoryAISession = useCallback(() => {
    setCategoryAIBusy(false);
    setCategoryAIStatus(null);
    setCategoryAIResult(null);
    setCategoryAIInstructions("");
    setCategoryAIChat([]);
    setCategoryAIDrawerOpen(false);
  }, []);

  const endPropertyAISession = useCallback(() => {
    setPropertyAIBusy(false);
    setPropertyAIStatus(null);
    setPropertyAIResult(null);
    setPropertyAIInstructions("");
    setPropertyAIChat([]);
    setPropertyAIDrawerOpen(false);
  }, []);

  useEffect(() => {
    const propertySessionAvailable = propertyAIDrawerOpen || propertyAIBusy || propertyAIChat.length > 0;
    const categorySessionAvailable = categoryAIDrawerOpen || categoryAIBusy || categoryAIChat.length > 0;

    if (propertySessionAvailable) {
      setAiAssistantPanelController({
        available: true,
        open: propertyAIDrawerOpen,
        toggle: () => setPropertyAIDrawerOpen((open) => !open),
      });
      return;
    }

    if (categorySessionAvailable) {
      setAiAssistantPanelController({
        available: true,
        open: categoryAIDrawerOpen,
        toggle: () => setCategoryAIDrawerOpen((open) => !open),
      });
      return;
    }

    setAiAssistantPanelController(null);
  }, [
    categoryAIBusy,
    categoryAIDrawerOpen,
    categoryAIChat.length,
    propertyAIBusy,
    propertyAIDrawerOpen,
    propertyAIChat.length,
    setAiAssistantPanelController,
  ]);

  useEffect(() => {
    return () => setAiAssistantPanelController(null);
  }, [setAiAssistantPanelController]);

  const loadProps = async (catId: number) => {
    setProperties(await fetchCategoryProperties(catId));
  };

  const deleteFlow = useDeleteFlow({
    realm,
    onDeleted: useCallback(() => {
      load();
    }, [load]),
  });

  const propertyTypes = getPropertyTypes(t);
  const pendingCategoryDeleteId = deleteFlow.pending?.type === "category" ? deleteFlow.pending.id : null;
  const pendingPropertyDeleteId = deleteFlow.pending?.type === "property" ? deleteFlow.pending.id : null;
  const toggleExpand = async (catId: number) => {
    if (expanded === catId) { setExpanded(null); return; }
    setExpanded(catId);
    await loadProps(catId);
  };

  const saveCat = async () => {
    if (!canWriteCategories) return;
    if (!editCat?.name) return;
    if (isNew) await api.createCategory({ ...editCat, position: categories.length });
    else if (editCat.id) await api.updateCategory(editCat.id, editCat);
    setEditCat(null);
    load();
  };

  const buildConversationContext = (history: AIChatEntry[], nextUserMessage: string) => {
    const lines = history
      .filter((entry) => !entry.pending && entry.content.trim())
      .map((entry) => `${entry.role === "user" ? "User" : "Ina"}: ${entry.content.trim()}`);

    if (nextUserMessage.trim()) {
      lines.push(`User: ${nextUserMessage.trim()}`);
    }

    if (lines.length === 0) {
      return "";
    }

    return `Conversation so far:\n${lines.join("\n\n")}`;
  };

  const buildCategoryAIPrompt = (
    category: Partial<Category>,
    currentProperties: Property[],
    history: AIChatEntry[],
    additionalInstructions: string,
  ) => {
    const lines = [
      `Kategorie: ${(category.name || "").trim()}`,
    ];
    if ((category.description || "").trim()) {
      lines.push(`Beschreibung: ${(category.description || "").trim()}`);
    }
    if (currentProperties.length > 0) {
      lines.push(`Bereits vorhanden: ${currentProperties.map((property) => property.name).join(", ")}`);
    }
    const conversationContext = buildConversationContext(history, additionalInstructions);
    if (conversationContext) {
      lines.push(conversationContext);
    }
    lines.push("Nutze den Gesprächsverlauf als Kontext. Reagiere auf den letzten User-Teil als eigentlichen nächsten Schritt.");
    lines.push("Führe nur den beschriebenen Auftrag für diese Kategorie aus. Erweitere die Kategorie nicht allgemein und schlage nichts Unverlangtes vor.");
    if (additionalInstructions.trim()) {
      lines.push(`Letzte User-Nachricht: ${additionalInstructions.trim()}`);
    }
    return lines.join("\n");
  };

  const resolveCategoryAIReply = (result: AICategoryPropertySuggestionResult | null, status: string) => {
    const assistantMessage = result?.assistant_message?.trim();
    if (assistantMessage) {
      return assistantMessage;
    }
    const questions = result?.questions || [];
    if (questions.length > 0) {
      return questions.join("\n\n");
    }
    const notes = result?.notes || [];
    if (notes.length > 0) {
      return notes.join("\n\n");
    }
    return status;
  };

  const resolvePropertyAIReply = (result: AIPropertyEnhancementSuggestionResult | null, status: string) => {
    const assistantMessage = result?.assistant_message?.trim();
    if (assistantMessage) {
      return assistantMessage;
    }
    const questions = result?.questions || [];
    if (questions.length > 0) {
      return questions.join("\n\n");
    }
    const notes = result?.notes || [];
    if (notes.length > 0) {
      return notes.join("\n\n");
    }
    return status;
  };

  const runCategoryAI = async () => {
    if (isNew || !editCat?.id || !editCat.name?.trim()) return;
    const task = categoryAIInstructions.trim();
    const prompt = buildCategoryAIPrompt(editCat, properties, categoryAIChat, task);
    const assistantMessageId = createChatId("category-ai-assistant");
    if (task) {
      setCategoryAIChat((current) => [
        ...current,
        { id: createChatId("category-ai-user"), role: "user", content: task },
        { id: assistantMessageId, role: "assistant", content: t("categories.aiThinking"), pending: true },
      ]);
      setCategoryAIInstructions("");
    } else {
      setCategoryAIChat((current) => [
        ...current,
        { id: assistantMessageId, role: "assistant", content: t("categories.aiThinking"), pending: true },
      ]);
    }
    setCategoryAIBusy(true);
    setCategoryAIStatus(null);
    setCategoryAIDrawerOpen(true);
    try {
      const result = await api.suggestCategoryProperties({
        realm,
        category_id: editCat.id,
        locale,
        prompt,
        allow_web_search: true,
      });
      setCategoryAIResult(result);
      const nextStatus =
        result.properties.length > 0 ? t("categories.aiSuggestionsReady") : t("categories.aiNoSuggestions");
      setCategoryAIStatus(nextStatus);
      const reply = resolveCategoryAIReply(result, nextStatus);
      setCategoryAIChat((current) =>
        current.map((entry) =>
          entry.id === assistantMessageId ? { ...entry, content: reply, pending: false, animate: true } : entry,
        ),
      );
    } catch (error) {
      setCategoryAIResult(null);
      const failure = error instanceof Error ? error.message : t("categories.aiFailed");
      setCategoryAIStatus(failure);
      setCategoryAIChat((current) =>
        current.map((entry) =>
          entry.id === assistantMessageId ? { ...entry, content: failure, pending: false, animate: true } : entry,
        ),
      );
    } finally {
      setCategoryAIBusy(false);
    }
  };

  const openCategoryAI = () => {
    if (isNew || !editCat?.id || !editCat.name?.trim()) return;
    setCategoryAIDrawerOpen(true);
  };

  const handleCategoryComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (categoryAIBusy) return;
      void runCategoryAI();
    }
  };

  const buildPropertyAIPrompt = (
    category: Partial<Category>,
    property: Partial<Property>,
    history: AIChatEntry[],
    additionalInstructions: string,
  ) => {
    const lines = [
      `Kategorie: ${(category.name || "").trim()}`,
      `Property: ${(property.name || "").trim()}`,
      `Aktueller Typ: ${(property.property_type || "text").trim()}`,
    ];
    if ((category.description || "").trim()) {
      lines.push(`Kategorie-Beschreibung: ${(category.description || "").trim()}`);
    }
    if ((property.unit || "").trim()) {
      lines.push(`Einheit: ${(property.unit || "").trim()}`);
    }
    const choices = ((property.options as Record<string, unknown> | undefined)?.choices as string[] | undefined) || [];
    if (choices.length > 0) {
      lines.push(`Vorhandene Optionen: ${choices.join(", ")}`);
    }
    const conversationContext = buildConversationContext(history, additionalInstructions);
    if (conversationContext) {
      lines.push(conversationContext);
    }
    lines.push("Nutze den Gesprächsverlauf als Kontext. Reagiere auf den letzten User-Teil als eigentlichen nächsten Schritt.");
    lines.push("Führe nur den beschriebenen Auftrag für diese Property aus. Nimm keine allgemeinen Verbesserungen an der ganzen Kategorie oder an anderen Properties vor.");
    if (additionalInstructions.trim()) {
      lines.push(`Letzte User-Nachricht: ${additionalInstructions.trim()}`);
    }
    return lines.join("\n");
  };

  const applyPropertyAIResult = (result: AIPropertyEnhancementSuggestionResult) => {
    setEditProp((current) => {
      if (!current) return current;
      const nextType = result.property.property_type || current.property_type || "text";
      const currentChoices = ((current.options as Record<string, unknown> | undefined)?.choices as string[] | undefined) || [];
      const nextChoices =
        nextType === "select" || nextType === "multiselect"
          ? buildPropertyOptionsPayload(
              result.property.options?.length ? result.property.options : currentChoices,
              locale,
              current.options as Record<string, unknown> | undefined,
            )
          : undefined;
      return {
        ...current,
        name: result.property.name?.trim() || current.name,
        property_type: nextType,
        unit: result.property.unit?.trim() || current.unit || undefined,
        required: result.property.required ?? current.required,
        show_in_list: result.property.show_in_list ?? current.show_in_list,
        display_width: result.property.display_width || current.display_width || "third",
        options: nextChoices,
      };
    });
  };

  const runPropertyAI = async (category: Pick<Category, "id" | "name" | "description">) => {
    if (isNewProp || !editProp?.id || !editProp.name?.trim()) return;
    const task = propertyAIInstructions.trim();
    const prompt = buildPropertyAIPrompt(category, editProp, propertyAIChat, task);
    const assistantMessageId = createChatId("property-ai-assistant");
    if (task) {
      setPropertyAIChat((current) => [
        ...current,
        { id: createChatId("property-ai-user"), role: "user", content: task },
        { id: assistantMessageId, role: "assistant", content: t("categories.aiThinking"), pending: true },
      ]);
      setPropertyAIInstructions("");
    } else {
      setPropertyAIChat((current) => [
        ...current,
        { id: assistantMessageId, role: "assistant", content: t("categories.aiThinking"), pending: true },
      ]);
    }
    setPropertyAIBusy(true);
    setPropertyAIStatus(null);
    setPropertyAIDrawerOpen(true);
    try {
      const result = await api.suggestPropertyEnhancement({
        realm,
        category_id: category.id,
        property_id: editProp.id,
        locale,
        prompt,
        allow_web_search: true,
      });
      setPropertyAIResult(result);
      applyPropertyAIResult(result);
      const nextStatus = t("categories.aiPropertyEnhanced");
      setPropertyAIStatus(nextStatus);
      const reply = resolvePropertyAIReply(result, nextStatus);
      setPropertyAIChat((current) =>
        current.map((entry) =>
          entry.id === assistantMessageId ? { ...entry, content: reply, pending: false, animate: true } : entry,
        ),
      );
    } catch (error) {
      setPropertyAIResult(null);
      const failure = error instanceof Error ? error.message : t("categories.aiFailed");
      setPropertyAIStatus(failure);
      setPropertyAIChat((current) =>
        current.map((entry) =>
          entry.id === assistantMessageId ? { ...entry, content: failure, pending: false, animate: true } : entry,
        ),
      );
    } finally {
      setPropertyAIBusy(false);
    }
  };

  const openPropertyAI = () => {
    if (isNewProp || !editProp?.id || !editCat?.id) return;
    setPropertyAIDrawerOpen(true);
  };

  const handlePropertyComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (propertyAIBusy) return;
      if (!editCat?.id || !editCat.name?.trim()) return;
      void runPropertyAI({
        id: editCat.id,
        name: editCat.name,
        description: editCat.description || "",
      });
    }
  };

  const createPropertyFromSuggestion = async (proposal: AIPropertyProposal, position: number) => {
    if (!expanded || !editCat?.id) return false;
    const normalizedName = proposal.name.trim().toLowerCase();
    if (!normalizedName) return false;
    if (properties.some((property) => property.name.trim().toLowerCase() === normalizedName)) {
      return false;
    }

    await api.createProperty({
      category_id: editCat.id,
      name: proposal.name.trim(),
      property_type: proposal.property_type,
      unit: proposal.unit?.trim() || undefined,
      required: !!proposal.required,
      show_in_list: proposal.show_in_list ?? true,
      display_width: proposal.display_width || "third",
      options:
        proposal.property_type === "select" || proposal.property_type === "multiselect"
          ? buildPropertyOptionsPayload(proposal.options || [], locale)
          : undefined,
      position,
    });
    return true;
  };

  const applyCategoryAIProperty = async (proposal: AIPropertyProposal) => {
    try {
      const created = await createPropertyFromSuggestion(proposal, properties.length);
      if (!created) {
        setCategoryAIStatus(t("categories.aiPropertySkippedDuplicate", { name: proposal.name }));
        return;
      }
      if (expanded) {
        await loadProps(expanded);
      }
      setCategoryAIResult((current) =>
        current
          ? {
              ...current,
              properties: current.properties.filter((entry) => entry.name.trim().toLowerCase() !== proposal.name.trim().toLowerCase()),
            }
          : current,
      );
      setCategoryAIStatus(t("categories.aiPropertyApplied", { name: proposal.name }));
    } catch (error) {
      setCategoryAIStatus(error instanceof Error ? error.message : t("categories.aiFailed"));
    }
  };

  const applyAllCategoryAISuggestions = async () => {
    if (!categoryAIResult?.properties.length) return;
    let appliedCount = 0;
    const existingNames = new Set(properties.map((property) => property.name.trim().toLowerCase()));
    let nextPosition = properties.length;

    try {
      for (const proposal of categoryAIResult.properties) {
        const normalizedName = proposal.name.trim().toLowerCase();
        if (!normalizedName || existingNames.has(normalizedName)) {
          continue;
        }
        const created = await createPropertyFromSuggestion(proposal, nextPosition);
        if (created) {
          existingNames.add(normalizedName);
          appliedCount += 1;
          nextPosition += 1;
        }
      }
      if (expanded) {
        await loadProps(expanded);
      }
      setCategoryAIResult((current) => (current ? { ...current, properties: [] } : current));
      setCategoryAIStatus(
        appliedCount > 0
          ? t("categories.aiAppliedCount", { count: appliedCount })
          : t("categories.aiNoSuggestions"),
      );
    } catch (error) {
      setCategoryAIStatus(error instanceof Error ? error.message : t("categories.aiFailed"));
    }
  };

  const deleteCat = (id: number) => {
    if (!canDeleteCategories) return;
    const cat = categories.find((c) => c.id === id);
    deleteFlow.requestDelete(id, cat?.name || `#${id}`, "category");
  };

  const onCatDragEnd = async (event: DragEndEvent) => {
    if (!canWriteCategories) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = categories.findIndex((c) => c.id === active.id);
    const newIdx = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIdx, newIdx);
    setCategories(reordered);
    await persistCategoryOrder(reordered);
  };

  const onPropDragEnd = async (event: DragEndEvent) => {
    if (!canWriteCategories) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = properties.findIndex((p) => p.id === active.id);
    const newIdx = properties.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(properties, oldIdx, newIdx);
    setProperties(reordered);
    await persistPropertyOrder(reordered);
  };

  const saveProp = async () => {
    if (!canWriteCategories) return;
    if (!editProp?.name || !editProp?.property_type) return;
    const payload = buildEditablePropertyPayload({
      ...editProp,
      category_id: editProp.category_id ?? expanded ?? undefined,
      position: editProp.position ?? (isNewProp ? properties.length : undefined),
    });
    let saved: Property | null = null;
    if (isNewProp) {
      saved = await api.createProperty(payload);
    } else if (editProp.id) {
      saved = await api.updateProperty(editProp.id, payload);
    }
    setEditProp(null);
    setIsNewProp(false);
    if (saved) {
      setProperties((current) => {
        if (isNewProp) {
          return sortProperties([...current, saved!]);
        }
        return sortProperties(current.map((property) => (property.id === saved!.id ? saved! : property)));
      });
    } else if (expanded) {
      await loadProps(expanded);
    }
  };

  const deleteProp = (id: number) => {
    if (!canDeleteCategories) return;
    const prop = properties.find((p) => p.id === id);
    deleteFlow.requestDelete(id, prop?.name || `#${id}`, "property");
  };

  const toggleShowInList = async (prop: Property) => {
    if (!canWriteCategories) return;
    await api.updateProperty(prop.id, { show_in_list: !prop.show_in_list });
    if (expanded) loadProps(expanded);
  };

  return (
    <div className="space-y-6">
      <div className="mb-4 text-center sm:flex sm:items-center sm:justify-between sm:border-b sm:border-gray-200 sm:text-left lg:mb-8 dark:border-white/10">
        <div className="space-y-1 py-3">
          <nav className="text-sm font-medium dark:text-gray-100">
            <ol className="flex items-center justify-center sm:justify-start">
              <li>
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">
                  {t("nav.dashboard")}
                </Link>
              </li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRightIcon className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-500 dark:text-gray-400">{realm === "archive" ? t("realm.archive") : t("realm.collection")}</li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRightIcon className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-900 dark:text-white">{t("categories.title")}</li>
            </ol>
          </nav>
          <h2 className="text-2xl font-bold">{t("categories.title")}</h2>
        </div>

        {canWriteCategories ? (
          <div className="flex items-center justify-center gap-2 rounded-sm px-2 py-3 sm:justify-end sm:bg-transparent sm:px-0">
            <button
              onClick={() => { setEditCat({ name: "" }); setIsNew(true); }}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-sm transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              title={t("common.new")}
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {canWriteCategories && editCat && isNew ? (
        <div className="overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-900/5 dark:bg-gray-800/50 dark:outline-white/10">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-white/10">
            <h3 className="font-semibold text-gray-900 dark:text-white">{t("common.new")}</h3>
          </div>
          <div className="px-4 py-4 sm:px-6">
            <CategoryInlineForm
              category={editCat}
              onChange={setEditCat}
              onCancel={() => setEditCat(null)}
              onSave={saveCat}
              t={t}
            />
          </div>
        </div>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onCatDragEnd}>
        <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-gray-100 bg-white shadow-xs outline outline-1 -outline-offset-1 outline-gray-900/5 sm:rounded-xl dark:divide-white/5 dark:bg-gray-800/50 dark:outline-white/10">
            {categories.map((cat) => (
              <SortableCategory
                key={cat.id}
                category={cat}
                isExpanded={expanded === cat.id}
                onToggle={() => toggleExpand(cat.id)}
                onEdit={async () => {
                  if (editCat?.id === cat.id && !isNew) {
                    setEditCat(null);
                    if (expanded === cat.id) {
                      setExpanded(null);
                    }
                    return;
                  }
                  setEditCat({ ...cat });
                  setIsNew(false);
                  if (expanded !== cat.id) {
                    setExpanded(cat.id);
                    await loadProps(cat.id);
                  }
                }}
                onDelete={() => deleteCat(cat.id)}
                onShowItems={() => router.push(`/items?category=${cat.id}`)}
                canReorder={canWriteCategories}
                canEdit={canWriteCategories}
                canDelete={canDeleteCategories}
                pendingDelete={pendingCategoryDeleteId === cat.id}
                canShowItems={canReadItems}
                fmtDateTime={fmtDateTime}
                t={t}
              >
                {(editCat?.id === cat.id && !isNew) || expanded === cat.id ? (
                  <div>
                    {canWriteCategories && editCat?.id === cat.id && !isNew ? (
                      <div className="border-t border-gray-100 px-4 py-4 sm:px-6 dark:border-white/10">
                        <CategoryInlineForm
                          category={editCat}
                          onChange={setEditCat}
                          onCancel={() => setEditCat(null)}
                          onSave={saveCat}
                          showAIButton
                          aiBusy={categoryAIBusy}
                          onRunAI={openCategoryAI}
                          t={t}
                        />
                      </div>
                    ) : null}

                    {expanded === cat.id ? (
                      <div className="border-t border-gray-100 px-4 py-4 sm:px-6 dark:border-white/10 space-y-2">
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-sm/6 font-medium text-gray-900 dark:text-white">{t("categories.properties")}</h4>
                          {canWriteCategories ? (
                            <button
                              onClick={() => { setEditProp({ name: "", property_type: "text", show_in_list: false }); setIsNewProp(true); }}
                              className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/10"
                              title={t("categories.addProperty")}
                            >
                              <PlusIcon className="h-4 w-4 text-gray-400" />
                            </button>
                          ) : null}
                        </div>

                        {canWriteCategories && editProp && isNewProp ? (
                          <div className="mb-3 border-t border-gray-100 px-4 py-4 dark:border-white/10">
                            <PropertyInlineForm
                              property={editProp}
                              onChange={setEditProp}
                              onCancel={() => setEditProp(null)}
                              onSave={saveProp}
                              propertyTypes={propertyTypes}
                              t={t}
                            />
                          </div>
                        ) : null}

                        {properties.length === 0 && !editProp ? <p className="text-xs text-gray-400">{t("categories.noProperties")}</p> : null}
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onPropDragEnd}>
                          <SortableContext items={properties.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                            {properties.map((prop) => (
                              <SortableProperty
                                key={prop.id}
                                property={prop}
                                propertyTypeLabel={propertyTypes.find((type) => type.value === prop.property_type)?.label || prop.property_type}
                                fmtDateTime={fmtDateTime}
                                onEdit={() => {
                                  if (editProp?.id === prop.id && !isNewProp) {
                                    setEditProp(null);
                                    return;
                                  }
                                  setEditProp({ ...prop });
                                  setIsNewProp(false);
                                }}
                                onDelete={() => deleteProp(prop.id)}
                                onToggleVisibility={() => toggleShowInList(prop)}
                                canReorder={canWriteCategories}
                                canEdit={canWriteCategories}
                                canDelete={canDeleteCategories}
                                pendingDelete={pendingPropertyDeleteId === prop.id}
                                canToggleVisibility={canWriteCategories}
                                t={t}
                              >
                                {canWriteCategories && editProp?.id === prop.id && !isNewProp ? (
                                  <div className="border-t border-gray-100 px-3 py-4 dark:border-white/10">
                                    <PropertyInlineForm
                                      property={editProp}
                                      onChange={setEditProp}
                                      onCancel={() => setEditProp(null)}
                                      onSave={saveProp}
                                      propertyTypes={propertyTypes}
                                      showAIButton
                                      aiBusy={propertyAIBusy}
                                      onRunAI={openPropertyAI}
                                      t={t}
                                    />
                                  </div>
                                ) : null}
                              </SortableProperty>
                            ))}
                          </SortableContext>
                        </DndContext>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </SortableCategory>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {categories.length === 0 && <p className="text-center text-gray-500 py-10">{t("categories.none")}</p>}

      <AIInfoDrawer
        open={categoryAIDrawerOpen}
        onClose={() => setCategoryAIDrawerOpen(false)}
        title={t("categories.aiInfoTitle")}
        subtitle={t("categories.aiInfoSubtitle")}
      >
        <div className="space-y-4">
          {categoryAIChat.map((entry) => (
            <AIChatMessage
              key={entry.id}
              role={entry.role}
              name={entry.role === "user" ? aiUserName : aiAssistantName}
              content={entry.content}
              pending={entry.pending}
              animate={entry.animate}
              onAnimationDone={entry.role === "assistant" ? () => markCategoryChatEntrySeen(entry.id) : undefined}
            />
          ))}

          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <label className="mb-2 block text-sm font-medium text-white">{t("categories.aiMessageLabel")}</label>
            <textarea
              value={categoryAIInstructions}
              onChange={(event) => setCategoryAIInstructions(event.target.value)}
              onKeyDown={handleCategoryComposerKeyDown}
              rows={2}
              placeholder={categoryAIChat.length > 0 ? t("categories.aiReplyPlaceholder") : t("categories.aiInstructionsPlaceholder")}
              className="block min-h-[84px] w-full resize-none rounded-2xl bg-black/20 px-4 py-2.5 text-sm text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500"
            />
            <div className="mt-4 flex justify-end">
              {categoryAIChat.length > 0 ? (
                <button
                  type="button"
                  onClick={endCategoryAISession}
                  className="mr-auto inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/5 hover:text-white"
                >
                  {t("categories.aiEndSession")}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => { void runCategoryAI(); }}
                disabled={categoryAIBusy}
                className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <SparklesIcon className="h-4 w-4" />
                {categoryAIBusy
                  ? t("categories.aiRunning")
                  : t("categories.aiSend")}
              </button>
            </div>
          </div>
        </div>

        {!categoryAIBusy && categoryAIChat.length === 0 && !(categoryAIResult?.properties.length || 0) ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-300">
            {t("categories.aiInfoEmpty")}
          </div>
        ) : null}

        <CategoryAIProposalPanel
          proposals={categoryAIResult?.properties || []}
          busy={false}
          status={null}
          notes={[]}
          questions={[]}
          propertyTypes={propertyTypes}
          onApplyOne={(proposal) => {
            void applyCategoryAIProperty(proposal);
          }}
          onApplyAll={() => {
            void applyAllCategoryAISuggestions();
          }}
          t={t}
        />
      </AIInfoDrawer>

      <AIInfoDrawer
        open={propertyAIDrawerOpen}
        onClose={() => setPropertyAIDrawerOpen(false)}
        title={t("categories.aiPropertyInfoTitle")}
        subtitle={t("categories.aiPropertyInfoSubtitle")}
      >
        <div className="space-y-4">
          {propertyAIChat.map((entry) => (
            <AIChatMessage
              key={entry.id}
              role={entry.role}
              name={entry.role === "user" ? aiUserName : aiAssistantName}
              content={entry.content}
              pending={entry.pending}
              animate={entry.animate}
              onAnimationDone={entry.role === "assistant" ? () => markPropertyChatEntrySeen(entry.id) : undefined}
            />
          ))}

          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <label className="mb-2 block text-sm font-medium text-white">{t("categories.aiMessageLabel")}</label>
            <textarea
              value={propertyAIInstructions}
              onChange={(event) => setPropertyAIInstructions(event.target.value)}
              onKeyDown={handlePropertyComposerKeyDown}
              rows={2}
              className="block min-h-[84px] w-full resize-none rounded-2xl bg-black/20 px-4 py-2.5 text-sm text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500"
            />
            <div className="mt-4 flex justify-end">
              {propertyAIChat.length > 0 ? (
                <button
                  type="button"
                  onClick={endPropertyAISession}
                  className="mr-auto inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/5 hover:text-white"
                >
                  {t("categories.aiEndSession")}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (!editCat?.id || !editCat.name?.trim()) return;
                  void runPropertyAI({
                    id: editCat.id,
                    name: editCat.name,
                    description: editCat.description || "",
                  });
                }}
                disabled={propertyAIBusy}
                className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <SparklesIcon className="h-4 w-4" />
                {propertyAIBusy
                  ? t("categories.aiRunning")
                  : propertyAIResult?.needs_confirmation
                    ? t("categories.aiAnswerAndRerun")
                    : t("categories.aiSend")}
              </button>
            </div>
          </div>
        </div>

        {!propertyAIBusy && propertyAIChat.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-300">
            {t("categories.aiInfoEmpty")}
          </div>
        ) : null}
      </AIInfoDrawer>

      {/* Confirm Delete */}
      {canDeleteCategories && deleteFlow.confirm && (
        <ConfirmDelete
          name={deleteFlow.confirm.name}
          t={t}
          onConfirm={async () => {
            if (deleteFlow.confirm!.type === "category") {
              await api.deleteCategory(deleteFlow.confirm!.id);
              if (expanded === deleteFlow.confirm!.id) setExpanded(null);
              load();
            } else {
              await api.deleteProperty(deleteFlow.confirm!.id);
              if (expanded) loadProps(expanded);
            }
            deleteFlow.cancelConfirm();
          }}
          onCancel={() => deleteFlow.cancelConfirm()}
        />
      )}

    </div>
  );
}
