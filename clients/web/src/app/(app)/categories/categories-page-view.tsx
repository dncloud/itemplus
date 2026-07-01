"use client";

import type { Dispatch, KeyboardEvent, RefObject, SetStateAction } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronRight, Plus, Sparkles } from "lucide-react";
import type {
  AICategoryPropertySuggestionResult,
  AIProfile,
  AIUsage,
  Category,
  Property,
} from "@/lib/api";
import type { AIChatEntry } from "@/lib/ai-chat";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import {
  AIDrawerChatMessage,
  AIDrawerTabs,
  AIRawDebugPanel,
  AIInfoDrawer,
  AIUsageBadges,
} from "@/components/ai/drawer";
import {
  CategoryAIProposalPanel,
  CategoryInlineForm,
  PropertyInlineForm,
  SortableCategory,
  SortableProperty,
} from "./categories-sections";

export function CategoriesPageView({
  realm,
  t,
  canWriteCategories,
  canDeleteCategories,
  canReadItems,
  categories,
  editCat,
  setEditCat,
  isNew,
  setIsNew,
  expanded,
  properties,
  editProp,
  setEditProp,
  setPropertyAICategory,
  isNewProp,
  setIsNewProp,
  categoryAIBusy,
  categoryAIResult,
  categoryAIInstructions,
  setCategoryAIInstructions,
  categoryAIDrawerOpen,
  setCategoryAIDrawerOpen,
  categoryAIChat,
  categoryAITab,
  setCategoryAITab,
  categoryAIRawDebug,
  categoryAIUsage,
  propertyAIBusy,
  propertyAIInstructions,
  setPropertyAIInstructions,
  propertyAIDrawerOpen,
  setPropertyAIDrawerOpen,
  propertyAIChat,
  propertyAITab,
  setPropertyAITab,
  propertyAIRawDebug,
  propertyAIUsage,
  activeAIProfile,
  aiAllowWebSearch,
  setAiAllowWebSearch,
  sensors,
  aiUserName,
  aiAssistantName,
  modelBadge,
  categoryComposerRef,
  propertyComposerRef,
  categoryMessagesRef,
  propertyMessagesRef,
  markCategoryChatEntrySeen,
  markPropertyChatEntrySeen,
  toggleExpand,
  loadProps,
  saveCat,
  saveProp,
  propertyTypes,
  openCategoryAI,
  openPropertyAI,
  endCategoryAISession,
  endPropertyAISession,
  handleCategoryComposerKeyDown,
  handlePropertyComposerKeyDown,
  runCategoryAI,
  runPropertyAI,
  applyCategoryAIProperty,
  applyAllCategoryAISuggestions,
  resolvePropertyAICategory,
  onCatDragEnd,
  onPropDragEnd,
  toggleShowInList,
  fmtDateTime,
  onShowCategoryItems,
  pendingCategoryDeleteId,
  pendingPropertyDeleteId,
  deleteCat,
  deleteProp,
  confirmDelete,
  cancelDeleteConfirm,
  confirmDeleteAction,
}: {
  realm: "archive" | "collection";
  t: (key: string, vars?: Record<string, string | number>) => string;
  canWriteCategories: boolean;
  canDeleteCategories: boolean;
  canReadItems: boolean;
  categories: Category[];
  editCat: Partial<Category> | null;
  setEditCat: Dispatch<SetStateAction<Partial<Category> | null>>;
  isNew: boolean;
  setIsNew: Dispatch<SetStateAction<boolean>>;
  expanded: number | null;
  properties: Property[];
  editProp: Partial<Property> | null;
  setEditProp: Dispatch<SetStateAction<Partial<Property> | null>>;
  setPropertyAICategory: Dispatch<SetStateAction<Pick<Category, "id" | "name" | "description"> | null>>;
  isNewProp: boolean;
  setIsNewProp: Dispatch<SetStateAction<boolean>>;
  categoryAIBusy: boolean;
  categoryAIResult: AICategoryPropertySuggestionResult | null;
  categoryAIInstructions: string;
  setCategoryAIInstructions: Dispatch<SetStateAction<string>>;
  categoryAIDrawerOpen: boolean;
  setCategoryAIDrawerOpen: Dispatch<SetStateAction<boolean>>;
  categoryAIChat: AIChatEntry[];
  categoryAITab: "chat" | "raw";
  setCategoryAITab: Dispatch<SetStateAction<"chat" | "raw">>;
  categoryAIRawDebug: string;
  categoryAIUsage: AIUsage | null;
  propertyAIBusy: boolean;
  propertyAIInstructions: string;
  setPropertyAIInstructions: Dispatch<SetStateAction<string>>;
  propertyAIDrawerOpen: boolean;
  setPropertyAIDrawerOpen: Dispatch<SetStateAction<boolean>>;
  propertyAIChat: AIChatEntry[];
  propertyAITab: "chat" | "raw";
  setPropertyAITab: Dispatch<SetStateAction<"chat" | "raw">>;
  propertyAIRawDebug: string;
  propertyAIUsage: AIUsage | null;
  activeAIProfile: AIProfile | null;
  aiAllowWebSearch: boolean;
  setAiAllowWebSearch: Dispatch<SetStateAction<boolean>>;
  sensors: ReturnType<typeof import("@dnd-kit/core").useSensors>;
  aiUserName: string;
  aiAssistantName: string;
  modelBadge: string | null;
  categoryComposerRef: RefObject<HTMLTextAreaElement | null>;
  propertyComposerRef: RefObject<HTMLTextAreaElement | null>;
  categoryMessagesRef: RefObject<HTMLDivElement | null>;
  propertyMessagesRef: RefObject<HTMLDivElement | null>;
  markCategoryChatEntrySeen: (id: string) => void;
  markPropertyChatEntrySeen: (id: string) => void;
  toggleExpand: (catId: number) => Promise<void>;
  loadProps: (catId: number) => Promise<void>;
  saveCat: () => Promise<void>;
  saveProp: () => Promise<void>;
  propertyTypes: { value: string; label: string }[];
  openCategoryAI: () => void;
  openPropertyAI: (category: Pick<Category, "id" | "name" | "description">) => void;
  endCategoryAISession: () => void;
  endPropertyAISession: () => void;
  handleCategoryComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  handlePropertyComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  runCategoryAI: () => Promise<void>;
  runPropertyAI: (category: Pick<Category, "id" | "name" | "description">) => Promise<void>;
  applyCategoryAIProperty: (proposal: import("@/lib/api").AIPropertyProposal) => Promise<void>;
  applyAllCategoryAISuggestions: () => Promise<void>;
  resolvePropertyAICategory: () => Pick<Category, "id" | "name" | "description"> | null;
  onCatDragEnd: (event: DragEndEvent) => Promise<void>;
  onPropDragEnd: (event: DragEndEvent) => Promise<void>;
  toggleShowInList: (prop: Property) => Promise<void>;
  fmtDateTime: (value: string) => string;
  onShowCategoryItems: (categoryId: number) => void;
  pendingCategoryDeleteId: number | null;
  pendingPropertyDeleteId: number | null;
  deleteCat: (categoryId: number) => void;
  deleteProp: (propertyId: number) => void;
  confirmDelete: { id: number; name: string; type: string } | null;
  cancelDeleteConfirm: () => void;
  confirmDeleteAction: () => Promise<void>;
}) {
  void activeAIProfile;

  return (
    <div className="space-y-6">
      <div className="mb-4 text-center sm:flex sm:items-center sm:justify-between sm:text-left lg:mb-8">
        <div className="space-y-1 py-3">
          <nav className="text-sm font-medium dark:text-gray-100">
            <ol className="flex items-center justify-center sm:justify-start">
              <li>
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">
                  {t("nav.dashboard")}
                </Link>
              </li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRight className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-500 dark:text-gray-400">{realm === "archive" ? t("realm.archive") : t("realm.collection")}</li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRight className="inline-block h-5 w-5" />
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
              <Plus className="h-4 w-4" />
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
              onSave={() => { void saveCat(); }}
              t={t}
            />
          </div>
        </div>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => { void onCatDragEnd(event); }}>
        <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-gray-100 bg-white shadow-xs outline outline-1 -outline-offset-1 outline-gray-900/5 sm:rounded-xl dark:divide-white/5 dark:bg-gray-800/50 dark:outline-white/10">
            {categories.map((cat) => (
              <SortableCategory
                key={cat.id}
                category={cat}
                isExpanded={expanded === cat.id}
                onToggle={() => { void toggleExpand(cat.id); }}
                onEdit={async () => {
                  if (editCat?.id === cat.id && !isNew) {
                    setEditCat(null);
                    return;
                  }
                  setEditCat({ ...cat });
                  setIsNew(false);
                  if (expanded !== cat.id) {
                    await loadProps(cat.id);
                  }
                }}
                onDelete={() => deleteCat(cat.id)}
                onShowItems={() => onShowCategoryItems(cat.id)}
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
                          onSave={() => { void saveCat(); }}
                          showAIButton
                          aiBusy={categoryAIBusy}
                          onRunAI={openCategoryAI}
                          t={t}
                        />
                      </div>
                    ) : null}

                    {expanded === cat.id ? (
                      <div className="space-y-2 border-t border-gray-100 px-4 py-4 sm:px-6 dark:border-white/10">
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-sm/6 font-medium text-gray-900 dark:text-white">{t("categories.properties")}</h4>
                          {canWriteCategories ? (
                            <button
                              onClick={() => { setEditProp({ name: "", property_type: "text", show_in_list: false }); setPropertyAICategory(null); setIsNewProp(true); }}
                              className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/10"
                              title={t("categories.addProperty")}
                            >
                              <Plus className="h-4 w-4 text-gray-400" />
                            </button>
                          ) : null}
                        </div>

                        {canWriteCategories && editProp && isNewProp ? (
                          <div className="mb-3 border-t border-gray-100 px-4 py-4 dark:border-white/10">
                            <PropertyInlineForm
                              property={editProp}
                              onChange={setEditProp}
                              onCancel={() => setEditProp(null)}
                              onSave={() => { void saveProp(); }}
                              propertyTypes={propertyTypes}
                              t={t}
                            />
                          </div>
                        ) : null}

                        {properties.length === 0 && !editProp ? <p className="text-xs text-gray-400">{t("categories.noProperties")}</p> : null}
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => { void onPropDragEnd(event); }}>
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
                                    setPropertyAICategory(null);
                                    return;
                                  }
                                  setEditProp({ ...prop });
                                  setPropertyAICategory({ id: cat.id, name: cat.name, description: cat.description || "" });
                                  setIsNewProp(false);
                                }}
                                onDelete={() => deleteProp(prop.id)}
                                onToggleVisibility={() => { void toggleShowInList(prop); }}
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
                                      onSave={() => { void saveProp(); }}
                                      propertyTypes={propertyTypes}
                                      showAIButton
                                      aiBusy={propertyAIBusy}
                                      onRunAI={() => openPropertyAI({ id: cat.id, name: cat.name, description: cat.description || "" })}
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

      {categories.length === 0 && <p className="py-10 text-center text-gray-500">{t("categories.none")}</p>}

      <AIInfoDrawer
        open={categoryAIDrawerOpen}
        onClose={() => setCategoryAIDrawerOpen(false)}
        title={t("categories.aiInfoTitle")}
        subtitle={t("categories.aiInfoSubtitle")}
        bodyClassName="mt-6 flex min-h-0 flex-1 flex-col gap-4 px-4 sm:px-6"
      >
        <AIDrawerTabs t={t} activeTab={categoryAITab} onChange={setCategoryAITab} />

        {categoryAITab === "chat" ? (
          <div ref={categoryMessagesRef} className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
            <div className="space-y-5 pb-2">
              {categoryAIChat.map((entry) => (
                <AIDrawerChatMessage
                  key={entry.id}
                  role={entry.role}
                  name={entry.role === "user" ? aiUserName : aiAssistantName}
                  content={entry.content}
                  pending={entry.pending}
                  animate={entry.animate}
                  onAnimationDone={entry.role === "assistant" ? () => markCategoryChatEntrySeen(entry.id) : undefined}
                />
              ))}

              {!categoryAIBusy && categoryAIChat.length === 0 && !(categoryAIResult?.properties.length || 0) ? (
                <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-6 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
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
                onApplyOne={(proposal) => { void applyCategoryAIProperty(proposal); }}
                onApplyAll={() => { void applyAllCategoryAISuggestions(); }}
                t={t}
              />
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
            <AIRawDebugPanel t={t} rawDebug={categoryAIRawDebug} />
          </div>
        )}

        <div className="shrink-0 rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-gray-950/20">
          <textarea
            ref={categoryComposerRef}
            value={categoryAIInstructions}
            onChange={(event) => setCategoryAIInstructions(event.target.value)}
            onKeyDown={handleCategoryComposerKeyDown}
            rows={1}
            className="min-h-[44px] w-full resize-none overflow-hidden bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-500 dark:text-white"
          />
          <div className="mt-2">
            <AIUsageBadges t={t} modelBadge={modelBadge} usage={categoryAIUsage} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              {categoryAIChat.length > 0 ? (
                <button
                  type="button"
                  onClick={endCategoryAISession}
                  className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  {t("categories.aiEndSession")}
                </button>
              ) : null}
              <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={aiAllowWebSearch}
                  onChange={(event) => setAiAllowWebSearch(event.target.checked)}
                  className="accent-blue-500"
                />
                {t("chat.allowWebSearch")}
              </label>
            </div>
            <button
              type="button"
              onClick={() => { void runCategoryAI(); }}
              disabled={categoryAIBusy}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {categoryAIBusy ? t("categories.aiRunning") : t("common.send")}
            </button>
          </div>
        </div>
      </AIInfoDrawer>

      <AIInfoDrawer
        open={propertyAIDrawerOpen}
        onClose={() => setPropertyAIDrawerOpen(false)}
        title={t("categories.aiPropertyInfoTitle")}
        subtitle={t("categories.aiPropertyInfoSubtitle")}
        bodyClassName="mt-6 flex min-h-0 flex-1 flex-col gap-4 px-4 sm:px-6"
      >
        <AIDrawerTabs t={t} activeTab={propertyAITab} onChange={setPropertyAITab} />

        {propertyAITab === "chat" ? (
          <div ref={propertyMessagesRef} className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
            <div className="space-y-5 pb-2">
              {propertyAIChat.map((entry) => (
                <AIDrawerChatMessage
                  key={entry.id}
                  role={entry.role}
                  name={entry.role === "user" ? aiUserName : aiAssistantName}
                  content={entry.content}
                  pending={entry.pending}
                  animate={entry.animate}
                  onAnimationDone={entry.role === "assistant" ? () => markPropertyChatEntrySeen(entry.id) : undefined}
                />
              ))}

              {!propertyAIBusy && propertyAIChat.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-6 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
                  {t("categories.aiInfoEmpty")}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
            <AIRawDebugPanel t={t} rawDebug={propertyAIRawDebug} />
          </div>
        )}

        <div className="shrink-0 rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-gray-950/20">
          <textarea
            ref={propertyComposerRef}
            value={propertyAIInstructions}
            onChange={(event) => setPropertyAIInstructions(event.target.value)}
            onKeyDown={handlePropertyComposerKeyDown}
            rows={1}
            className="min-h-[44px] w-full resize-none overflow-hidden bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-500 dark:text-white"
          />
          <div className="mt-2">
            <AIUsageBadges t={t} modelBadge={modelBadge} usage={propertyAIUsage} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              {propertyAIChat.length > 0 ? (
                <button
                  type="button"
                  onClick={endPropertyAISession}
                  className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  {t("categories.aiEndSession")}
                </button>
              ) : null}
              <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={aiAllowWebSearch}
                  onChange={(event) => setAiAllowWebSearch(event.target.checked)}
                  className="accent-blue-500"
                />
                {t("chat.allowWebSearch")}
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                const category = resolvePropertyAICategory();
                if (!category) return;
                void runPropertyAI(category);
              }}
              disabled={propertyAIBusy}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {propertyAIBusy ? t("categories.aiRunning") : t("common.send")}
            </button>
          </div>
        </div>
      </AIInfoDrawer>

      {canDeleteCategories && confirmDelete && (
        <ConfirmDelete
          name={confirmDelete.name}
          t={t}
          onConfirm={() => { void confirmDeleteAction(); }}
          onCancel={cancelDeleteConfirm}
        />
      )}
    </div>
  );
}
