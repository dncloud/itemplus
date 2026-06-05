"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { PlusIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useDeleteFlow, ConfirmDelete } from "@/components/confirm-delete";
import { AIInfoDrawer } from "@/components/item-create-ai-sections";
import { FloatingNotification, type FloatingNotificationState } from "@/components/floating-notification";
import {
  CategoryAIProposalPanel,
  CategoryInlineForm,
  PropertyInlineForm,
  SortableCategory,
  SortableProperty,
  getPropertyTypes,
} from "./categories-sections";
import {
  fetchCategoriesPageData,
  fetchCategoryProperties,
  persistCategoryOrder,
  persistPropertyOrder,
} from "./categories-page-utils";
import { buildPropertyOptionsPayload } from "@/lib/property-options";
import type {
  AICategoryPropertySuggestionResult,
  AIPropertyEnhancementSuggestionResult,
  AIPropertyProposal,
} from "@/lib/api";

export default function CategoriesPage() {
  const { realm, locale, fmtDateTime, t, can } = useApp();
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
  const [propertyAIBusy, setPropertyAIBusy] = useState(false);
  const [propertyAIStatus, setPropertyAIStatus] = useState<string | null>(null);
  const [propertyAIResult, setPropertyAIResult] = useState<AIPropertyEnhancementSuggestionResult | null>(null);
  const [propertyAIInstructions, setPropertyAIInstructions] = useState("");
  const [propertyAIDrawerOpen, setPropertyAIDrawerOpen] = useState(false);
  const [notification, setNotification] = useState<FloatingNotificationState>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const canWriteCategories = can("categories.write");
  const canDeleteCategories = can("categories.delete");
  const canReadItems = can("items.read");

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
  }, [editCat?.id, isNew]);

  useEffect(() => {
    setPropertyAIBusy(false);
    setPropertyAIStatus(null);
    setPropertyAIResult(null);
    setPropertyAIInstructions("");
    setPropertyAIDrawerOpen(false);
  }, [editProp?.id, isNewProp]);

  useEffect(() => {
    if (!notification) return;
    const timeout = window.setTimeout(() => setNotification(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notification]);

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
  const hasCategoryAIInfo =
    categoryAIBusy ||
    !!categoryAIStatus ||
    (categoryAIResult?.properties.length || 0) > 0 ||
    (categoryAIResult?.notes.length || 0) > 0 ||
    (categoryAIResult?.questions.length || 0) > 0 ||
    categoryAIInstructions.trim().length > 0;
  const hasPropertyAIInfo =
    propertyAIBusy ||
    !!propertyAIStatus ||
    (propertyAIResult?.notes.length || 0) > 0 ||
    (propertyAIResult?.questions.length || 0) > 0 ||
    propertyAIInstructions.trim().length > 0;

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

  const buildCategoryAIPrompt = (category: Partial<Category>, currentProperties: Property[], additionalInstructions: string) => {
    const lines = [
      `Kategorie: ${(category.name || "").trim()}`,
    ];
    if ((category.description || "").trim()) {
      lines.push(`Beschreibung: ${(category.description || "").trim()}`);
    }
    if (currentProperties.length > 0) {
      lines.push(`Bereits vorhanden: ${currentProperties.map((property) => property.name).join(", ")}`);
    }
    lines.push(
      "Schlage passende Properties fuer diese Kategorie vor. Nutze Auswahl oder Mehrfachauswahl mit konkreten Optionen, wenn Standards oder bekannte Varianten sinnvoll sind.",
    );
    if (additionalInstructions.trim()) {
      lines.push(`Zusätzliche Anweisungen: ${additionalInstructions.trim()}`);
    }
    return lines.join("\n");
  };

  const runCategoryAI = async () => {
    if (isNew || !editCat?.id || !editCat.name?.trim()) return;
    const prompt = buildCategoryAIPrompt(editCat, properties, categoryAIInstructions);
    setNotification({
      tone: "info",
      title: t("categories.aiStartingTitle"),
      message: t("categories.aiStartingMessage"),
    });
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
      setCategoryAIStatus(
        result.properties.length > 0 ? t("categories.aiSuggestionsReady") : t("categories.aiNoSuggestions"),
      );
    } catch (error) {
      setCategoryAIResult(null);
      setCategoryAIStatus(error instanceof Error ? error.message : t("categories.aiFailed"));
    } finally {
      setCategoryAIBusy(false);
    }
  };

  const buildPropertyAIPrompt = (category: Partial<Category>, property: Partial<Property>, additionalInstructions: string) => {
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
    lines.push(
      "Verbessere diese vorhandene Property fuer die Kategorie. Wenn feste Standards oder Varianten sinnvoll sind, schlage Auswahl oder Mehrfachauswahl mit konkreten Optionen vor.",
    );
    if (additionalInstructions.trim()) {
      lines.push(`Zusätzliche Anweisungen: ${additionalInstructions.trim()}`);
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
    const prompt = buildPropertyAIPrompt(category, editProp, propertyAIInstructions);
    setNotification({
      tone: "info",
      title: t("categories.aiStartingTitle"),
      message: t("categories.aiStartingMessage"),
    });
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
      setPropertyAIStatus(t("categories.aiPropertyEnhanced"));
    } catch (error) {
      setPropertyAIResult(null);
      setPropertyAIStatus(error instanceof Error ? error.message : t("categories.aiFailed"));
    } finally {
      setPropertyAIBusy(false);
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
    if (isNewProp) await api.createProperty({ ...editProp, category_id: expanded!, position: properties.length });
    else if (editProp.id) await api.updateProperty(editProp.id, editProp);
    setEditProp(null);
    if (expanded) loadProps(expanded);
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
      <FloatingNotification notification={notification} onClose={() => setNotification(null)} t={t} />
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
                          hasAIInfo={hasCategoryAIInfo}
                          onOpenAIInfo={() => setCategoryAIDrawerOpen(true)}
                          onRunAI={() => { void runCategoryAI(); }}
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
                                      hasAIInfo={hasPropertyAIInfo}
                                      onOpenAIInfo={() => setPropertyAIDrawerOpen(true)}
                                      onRunAI={() => { void runPropertyAI(cat); }}
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
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
          <label className="mb-2 block text-sm font-medium text-white">{t("categories.aiInstructionsLabel")}</label>
          <textarea
            value={categoryAIInstructions}
            onChange={(event) => setCategoryAIInstructions(event.target.value)}
            rows={4}
            placeholder={t("categories.aiInstructionsPlaceholder")}
            className="block w-full rounded-md bg-black/20 px-3 py-2 text-sm text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500"
          />
        </div>

        {!hasCategoryAIInfo ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-300">
            {t("categories.aiInfoEmpty")}
          </div>
        ) : null}

        {categoryAIBusy ? (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-4 text-sm text-blue-200">
            {t("categories.aiRunning")}
          </div>
        ) : null}

        {categoryAIStatus ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-sm font-semibold text-white">{t("categories.aiInfoStatusTitle")}</p>
            <p className="mt-1 text-sm text-gray-300">{categoryAIStatus}</p>
          </div>
        ) : null}

        {(categoryAIResult?.questions.length || 0) > 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-sm font-semibold text-white">{t("categories.aiQuestions")}</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-300">
              {(categoryAIResult?.questions || []).map((question, index) => (
                <li key={`${question}-${index}`} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                  {question}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {(categoryAIResult?.notes.length || 0) > 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-sm font-semibold text-white">{t("categories.aiNotes")}</p>
            <div className="mt-3 space-y-2 text-sm text-gray-300">
              {(categoryAIResult?.notes || []).map((note, index) => (
                <div key={`${note}-${index}`} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                  {note}
                </div>
              ))}
            </div>
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
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
          <label className="mb-2 block text-sm font-medium text-white">{t("categories.aiInstructionsLabel")}</label>
          <textarea
            value={propertyAIInstructions}
            onChange={(event) => setPropertyAIInstructions(event.target.value)}
            rows={4}
            placeholder={t("categories.aiInstructionsPlaceholder")}
            className="block w-full rounded-md bg-black/20 px-3 py-2 text-sm text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500"
          />
        </div>

        {!hasPropertyAIInfo ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-300">
            {t("categories.aiInfoEmpty")}
          </div>
        ) : null}

        {propertyAIBusy ? (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-4 text-sm text-blue-200">
            {t("categories.aiRunning")}
          </div>
        ) : null}

        {propertyAIStatus ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-sm font-semibold text-white">{t("categories.aiInfoStatusTitle")}</p>
            <p className="mt-1 text-sm text-gray-300">{propertyAIStatus}</p>
          </div>
        ) : null}

        {(propertyAIResult?.questions.length || 0) > 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-sm font-semibold text-white">{t("categories.aiQuestions")}</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-300">
              {(propertyAIResult?.questions || []).map((question, index) => (
                <li key={`${question}-${index}`} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                  {question}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {(propertyAIResult?.notes.length || 0) > 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-sm font-semibold text-white">{t("categories.aiNotes")}</p>
            <div className="mt-3 space-y-2 text-sm text-gray-300">
              {(propertyAIResult?.notes || []).map((note, index) => (
                <div key={`${note}-${index}`} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                  {note}
                </div>
              ))}
            </div>
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
