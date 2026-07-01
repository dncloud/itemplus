"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { api, type AIProfile, type AIUsage, type Category, type Property } from "@/lib/api";
import { type AIChatEntry, createAIChatId } from "@/lib/ai-chat";
import { useApp } from "@/lib/app-context";
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { useDeleteFlow } from "@/components/ui/confirm-delete";
import { getPropertyTypes } from "./categories-sections";
import { CategoriesPageView } from "./categories-page-view";
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

export default function CategoriesPageContent() {
  const { realm, locale, fmtDateTime, t, can, currentUserLabel, setAiAssistantBusy, setAiAssistantPanelController } = useApp();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [editCat, setEditCat] = useState<Partial<Category> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [editProp, setEditProp] = useState<Partial<Property> | null>(null);
  const [propertyAICategory, setPropertyAICategory] = useState<Pick<Category, "id" | "name" | "description"> | null>(null);
  const [isNewProp, setIsNewProp] = useState(false);
  const [categoryAIBusy, setCategoryAIBusy] = useState(false);
  const [, setCategoryAIStatus] = useState<string | null>(null);
  const [categoryAIResult, setCategoryAIResult] = useState<AICategoryPropertySuggestionResult | null>(null);
  const [categoryAIInstructions, setCategoryAIInstructions] = useState("");
  const [categoryAIDrawerOpen, setCategoryAIDrawerOpen] = useState(false);
  const [categoryAIChat, setCategoryAIChat] = useState<AIChatEntry[]>([]);
  const [categoryAITab, setCategoryAITab] = useState<"chat" | "raw">("chat");
  const [categoryAIRawDebug, setCategoryAIRawDebug] = useState("");
  const [categoryAIUsage, setCategoryAIUsage] = useState<AIUsage | null>(null);
  const [propertyAIBusy, setPropertyAIBusy] = useState(false);
  const [, setPropertyAIStatus] = useState<string | null>(null);
  const [, setPropertyAIResult] = useState<AIPropertyEnhancementSuggestionResult | null>(null);
  const [propertyAIInstructions, setPropertyAIInstructions] = useState("");
  const [propertyAIDrawerOpen, setPropertyAIDrawerOpen] = useState(false);
  const [propertyAIChat, setPropertyAIChat] = useState<AIChatEntry[]>([]);
  const [propertyAITab, setPropertyAITab] = useState<"chat" | "raw">("chat");
  const [propertyAIRawDebug, setPropertyAIRawDebug] = useState("");
  const [propertyAIUsage, setPropertyAIUsage] = useState<AIUsage | null>(null);
  const [activeAIProfile, setActiveAIProfile] = useState<AIProfile | null>(null);
  const [aiAllowWebSearch, setAiAllowWebSearch] = useState(true);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const canWriteCategories = can("categories.write");
  const canDeleteCategories = can("categories.delete");
  const canReadItems = can("items.read");
  const aiUserName = currentUserLabel || t("categories.aiUserFallback");
  const aiAssistantName = t("categories.aiAssistantName");
  const modelBadge = activeAIProfile ? `${activeAIProfile.provider === "ollama" ? "Ollama" : "OpenAI"} · ${activeAIProfile.model}` : null;
  const categoryComposerRef = useRef<HTMLTextAreaElement | null>(null);
  const propertyComposerRef = useRef<HTMLTextAreaElement | null>(null);
  const categoryMessagesRef = useRef<HTMLDivElement | null>(null);
  const propertyMessagesRef = useRef<HTMLDivElement | null>(null);

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
    void api.getAISettings()
      .then((settings) => {
        const profile = settings.profiles.find((entry) => entry.id === settings.active_profile_id) || settings.profiles[0] || null;
        setActiveAIProfile(profile);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void load();
  }, [load, realm]);

  useEffect(() => {
    setCategoryAIBusy(false);
    setCategoryAIStatus(null);
    setCategoryAIResult(null);
    setCategoryAIInstructions("");
    setCategoryAIDrawerOpen(false);
    setCategoryAIChat([]);
    setCategoryAITab("chat");
    setCategoryAIRawDebug("");
    setCategoryAIUsage(null);
  }, [editCat?.id, isNew]);

  useEffect(() => {
    setPropertyAIBusy(false);
    setPropertyAIStatus(null);
    setPropertyAIResult(null);
    setPropertyAIInstructions("");
    setPropertyAIDrawerOpen(false);
    setPropertyAIChat([]);
    setPropertyAITab("chat");
    setPropertyAIRawDebug("");
    setPropertyAIUsage(null);
    if (!editProp?.id) setPropertyAICategory(null);
  }, [editProp?.id, isNewProp]);

  useEffect(() => {
    setAiAssistantBusy(categoryAIBusy || propertyAIBusy);
    return () => setAiAssistantBusy(false);
  }, [categoryAIBusy, propertyAIBusy, setAiAssistantBusy]);

  useEffect(() => {
    const textarea = categoryComposerRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [categoryAIInstructions]);

  useEffect(() => {
    const textarea = propertyComposerRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [propertyAIInstructions]);

  useEffect(() => {
    const container = categoryMessagesRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [categoryAIChat, categoryAIResult]);

  useEffect(() => {
    const container = propertyMessagesRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [propertyAIChat]);

  const endCategoryAISession = useCallback(() => {
    setCategoryAIBusy(false);
    setCategoryAIStatus(null);
    setCategoryAIResult(null);
    setCategoryAIInstructions("");
    setCategoryAIChat([]);
    setCategoryAIDrawerOpen(false);
    setCategoryAITab("chat");
    setCategoryAIRawDebug("");
    setCategoryAIUsage(null);
  }, []);

  const endPropertyAISession = useCallback(() => {
    setPropertyAIBusy(false);
    setPropertyAIStatus(null);
    setPropertyAIResult(null);
    setPropertyAIInstructions("");
    setPropertyAIChat([]);
    setPropertyAIDrawerOpen(false);
    setPropertyAITab("chat");
    setPropertyAIRawDebug("");
    setPropertyAIUsage(null);
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

  const loadProps = useCallback(async (catId: number) => {
    setProperties(await fetchCategoryProperties(catId));
  }, []);

  const deleteFlow = useDeleteFlow({
    realm,
    onDeleted: useCallback((entityId: number, entityType: string) => {
      if (entityType === "property") {
        setProperties((current) => current.filter((property) => property.id !== entityId));
        setEditProp((current) => (current?.id === entityId ? null : current));
        setIsNewProp(false);
        if (expanded) void loadProps(expanded);
        return;
      }
      if (entityType === "category") {
        if (expanded === entityId) {
          setExpanded(null);
          setProperties([]);
        }
        setCategories((current) => current.filter((category) => category.id !== entityId));
        setEditCat((current) => (current?.id === entityId ? null : current));
        void load();
        return;
      }
      void load();
    }, [expanded, load, loadProps]),
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
      .map((entry) => `${entry.role === "user" ? "User" : "Assistant"}: ${entry.content.trim()}`);

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
    const assistantMessageId = createAIChatId("category-ai-assistant");
    if (task) {
      setCategoryAIChat((current) => [
        ...current,
        { id: createAIChatId("category-ai-user"), role: "user", content: task },
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
    setCategoryAIRawDebug("");
    setCategoryAIUsage(null);
    setCategoryAIDrawerOpen(true);
    try {
      const result = await api.suggestCategoryProperties({
        realm,
        category_id: editCat.id,
        locale,
        prompt,
        allow_web_search: aiAllowWebSearch,
      });
      setCategoryAIResult(result);
      setCategoryAIRawDebug(result.raw_debug || "");
      setCategoryAIUsage(result.usage || null);
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
      const aiError = error as Error & { raw_debug?: string; usage?: AIUsage | null };
      if (typeof aiError.raw_debug === "string") setCategoryAIRawDebug(aiError.raw_debug);
      if (aiError.usage) setCategoryAIUsage(aiError.usage);
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
    const assistantMessageId = createAIChatId("property-ai-assistant");
    if (task) {
      setPropertyAIChat((current) => [
        ...current,
        { id: createAIChatId("property-ai-user"), role: "user", content: task },
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
    setPropertyAIRawDebug("");
    setPropertyAIUsage(null);
    setPropertyAIDrawerOpen(true);
    try {
      const result = await api.suggestPropertyEnhancement({
        realm,
        category_id: category.id,
        property_id: editProp.id,
        locale,
        prompt,
        allow_web_search: aiAllowWebSearch,
      });
      setPropertyAIResult(result);
      setPropertyAIRawDebug(result.raw_debug || "");
      setPropertyAIUsage(result.usage || null);
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
      const aiError = error as Error & { raw_debug?: string; usage?: AIUsage | null };
      if (typeof aiError.raw_debug === "string") setPropertyAIRawDebug(aiError.raw_debug);
      if (aiError.usage) setPropertyAIUsage(aiError.usage);
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

  const resolvePropertyAICategory = () => (
    propertyAICategory || (editCat?.id && editCat.name?.trim()
      ? { id: editCat.id, name: editCat.name, description: editCat.description || "" }
      : null)
  );

  const openPropertyAI = (category: Pick<Category, "id" | "name" | "description">) => {
    if (isNewProp || !editProp?.id || !category.id || !category.name?.trim()) return;
    setPropertyAICategory(category);
    setPropertyAIDrawerOpen(true);
    window.setTimeout(() => propertyComposerRef.current?.focus(), 0);
  };

  const handlePropertyComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (propertyAIBusy) return;
      const category = resolvePropertyAICategory();
      if (!category) return;
      void runPropertyAI(category);
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
    <CategoriesPageView
      realm={realm}
      t={t}
      canWriteCategories={canWriteCategories}
      canDeleteCategories={canDeleteCategories}
      canReadItems={canReadItems}
      categories={categories}
      editCat={editCat}
      setEditCat={setEditCat}
      isNew={isNew}
      setIsNew={setIsNew}
      expanded={expanded}
      properties={properties}
      editProp={editProp}
      setEditProp={setEditProp}
      setPropertyAICategory={setPropertyAICategory}
      isNewProp={isNewProp}
      setIsNewProp={setIsNewProp}
      categoryAIBusy={categoryAIBusy}
      categoryAIResult={categoryAIResult}
      categoryAIInstructions={categoryAIInstructions}
      setCategoryAIInstructions={setCategoryAIInstructions}
      categoryAIDrawerOpen={categoryAIDrawerOpen}
      setCategoryAIDrawerOpen={setCategoryAIDrawerOpen}
      categoryAIChat={categoryAIChat}
      categoryAITab={categoryAITab}
      setCategoryAITab={setCategoryAITab}
      categoryAIRawDebug={categoryAIRawDebug}
      categoryAIUsage={categoryAIUsage}
      propertyAIBusy={propertyAIBusy}
      propertyAIInstructions={propertyAIInstructions}
      setPropertyAIInstructions={setPropertyAIInstructions}
      propertyAIDrawerOpen={propertyAIDrawerOpen}
      setPropertyAIDrawerOpen={setPropertyAIDrawerOpen}
      propertyAIChat={propertyAIChat}
      propertyAITab={propertyAITab}
      setPropertyAITab={setPropertyAITab}
      propertyAIRawDebug={propertyAIRawDebug}
      propertyAIUsage={propertyAIUsage}
      activeAIProfile={activeAIProfile}
      aiAllowWebSearch={aiAllowWebSearch}
      setAiAllowWebSearch={setAiAllowWebSearch}
      sensors={sensors}
      aiUserName={aiUserName}
      aiAssistantName={aiAssistantName}
      modelBadge={modelBadge}
      categoryComposerRef={categoryComposerRef}
      propertyComposerRef={propertyComposerRef}
      categoryMessagesRef={categoryMessagesRef}
      propertyMessagesRef={propertyMessagesRef}
      markCategoryChatEntrySeen={markCategoryChatEntrySeen}
      markPropertyChatEntrySeen={markPropertyChatEntrySeen}
      toggleExpand={toggleExpand}
      loadProps={loadProps}
      saveCat={saveCat}
      saveProp={saveProp}
      propertyTypes={propertyTypes}
      openCategoryAI={openCategoryAI}
      openPropertyAI={openPropertyAI}
      endCategoryAISession={endCategoryAISession}
      endPropertyAISession={endPropertyAISession}
      handleCategoryComposerKeyDown={handleCategoryComposerKeyDown}
      handlePropertyComposerKeyDown={handlePropertyComposerKeyDown}
      runCategoryAI={runCategoryAI}
      runPropertyAI={runPropertyAI}
      applyCategoryAIProperty={applyCategoryAIProperty}
      applyAllCategoryAISuggestions={applyAllCategoryAISuggestions}
      resolvePropertyAICategory={resolvePropertyAICategory}
      onCatDragEnd={onCatDragEnd}
      onPropDragEnd={onPropDragEnd}
      toggleShowInList={toggleShowInList}
      fmtDateTime={fmtDateTime}
      onShowCategoryItems={(categoryId) => router.push(`/items?category=${categoryId}`)}
      pendingCategoryDeleteId={pendingCategoryDeleteId}
      pendingPropertyDeleteId={pendingPropertyDeleteId}
      deleteCat={deleteCat}
      deleteProp={deleteProp}
      confirmDelete={deleteFlow.confirm}
      cancelDeleteConfirm={() => deleteFlow.cancelConfirm()}
      confirmDeleteAction={async () => {
        if (!deleteFlow.confirm) return;
        if (deleteFlow.confirm.type === "category") {
          await api.deleteCategory(deleteFlow.confirm.id);
          if (expanded === deleteFlow.confirm.id) setExpanded(null);
          await load();
        } else {
          await api.deleteProperty(deleteFlow.confirm.id);
          if (expanded) await loadProps(expanded);
        }
        deleteFlow.cancelConfirm();
      }}
    />
  );
}
