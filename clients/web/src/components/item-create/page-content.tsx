"use client";

import Link from "next/link";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { api, type GameCatalogProfile, type GameCatalogSearchResult } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { Gamepad2, LoaderCircle } from "lucide-react";
import SelectPicker from "@/components/ui/select-picker";
import type {
  AIUsage,
  Category,
  Item,
  ItemComponent,
  Location,
  Property,
  Vendor,
} from "@/lib/api";
import type { AIChatEntry, AIChatSuggestion } from "@/components/item-create/ai-chat";
import { ItemCreateAIPanel, ItemCreateHeader } from "@/components/item-create/ai-panel";
import { formatItemSuggestionValue as formatSuggestionValue } from "@/components/item-create/helpers";
import { InventorySection, PropertiesSection } from "@/components/item-create/form-sections";
import { ItemCreateBasicsSection } from "@/components/item-create/basics-section";
import { VendorsSection } from "@/components/item-create/media-sections";
import { ModalSection } from "@/components/item-create/ui";
import { GameCatalogSection } from "@/components/item-create/game-catalog-section";
import AttachmentManager from "@/components/attachments/attachment-manager";

const NO_GLOBAL_SEARCH: { query: string; results: GameCatalogSearchResult[]; error: string; busy: boolean } = { query: "", results: [], error: "", busy: false };

export function ItemCreatePageContent({
  t,
  realm,
  pageTitle,
  cancelHref,
  barcodeCapturePending,
  requestBarcodeCapture,
  aiAssistBusy,
  hasAISession,
  aiDrawerOpen,
  setAiDrawerOpen,
  sendAIMessage,
  editItem,
  setEditItem,
  categories,
  locations,
  manufacturers,
  suppliers,
  vendors,
  developers,
  publishers,
  salesPlatforms,
  itemComponents,
  catProperties,
  propValues,
  setPropValues,
  barcodeDraft,
  setBarcodeDraft,
  hasVisibleSuggestions,
  applyAllAISuggestions,
  iosBridgeStatus,
  photoLookupPending,
  requestPhotoLookup,
  aiUserName,
  aiChat,
  aiSuggestionAnchorMessageId,
  aiChatSuggestions,
  markAssistantMessageSeen,
  modelBadge,
  aiAllowWebSearch,
  setAiAllowWebSearch,
  aiRawDebugLog,
  aiLastUsage,
  clearAiSession,
  isEditMode,
  itemId,
  sourceItem,
  loadSourceItem,
  aiSuggestedItem,
  suggestedCategoryName,
  valuesEqual,
  applySuggestedField,
  aiSuggestedPropValues,
  applySuggestedProperty,
  onGameCatalogPropertiesCreated,
  applyGameCatalogGame,
  save,
  saveError,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  realm: "archive" | "collection";
  pageTitle: string;
  cancelHref: string;
  barcodeCapturePending: boolean;
  requestBarcodeCapture: () => void;
  aiAssistBusy: boolean;
  hasAISession: boolean;
  aiDrawerOpen: boolean;
  setAiDrawerOpen: Dispatch<SetStateAction<boolean>>;
  sendAIMessage: (message: string) => Promise<void>;
  editItem: Partial<Item>;
  setEditItem: Dispatch<SetStateAction<Partial<Item>>>;
  categories: Category[];
  locations: Location[];
  manufacturers: Vendor[];
  suppliers: Vendor[];
  vendors: Vendor[];
  developers: Vendor[];
  publishers: Vendor[];
  salesPlatforms: Vendor[];
  itemComponents: ItemComponent[];
  catProperties: Property[];
  propValues: Record<string, unknown>;
  setPropValues: Dispatch<SetStateAction<Record<string, unknown>>>;
  barcodeDraft: { code: string; symbology?: string | null } | null;
  setBarcodeDraft: Dispatch<SetStateAction<{ code: string; symbology?: string | null } | null>>;
  hasVisibleSuggestions: boolean;
  applyAllAISuggestions: () => void;
  iosBridgeStatus: "connected" | "disconnected" | "connecting";
  photoLookupPending: boolean;
  requestPhotoLookup: () => void;
  aiUserName: string;
  aiChat: AIChatEntry[];
  aiSuggestionAnchorMessageId: string | null;
  aiChatSuggestions: AIChatSuggestion[];
  markAssistantMessageSeen: (id: string) => void;
  modelBadge: string | null;
  aiAllowWebSearch: boolean;
  setAiAllowWebSearch: Dispatch<SetStateAction<boolean>>;
  aiRawDebugLog: string;
  aiLastUsage: AIUsage | null;
  clearAiSession: () => void;
  isEditMode: boolean;
  itemId?: number;
  sourceItem: Item | null;
  loadSourceItem: () => Promise<void>;
  aiSuggestedItem: Partial<Item>;
  suggestedCategoryName: string;
  valuesEqual: (left: unknown, right: unknown) => boolean;
  applySuggestedField: <K extends keyof Item>(field: K) => void;
  aiSuggestedPropValues: Record<string, unknown>;
  applySuggestedProperty: (propertyId: string) => void;
  onGameCatalogPropertiesCreated: (properties: Property[]) => void;
  applyGameCatalogGame: (game: import("@/lib/api").GameCatalogGame, values: Record<string, unknown>, assets: import("@/lib/api").GameCatalogAsset[], itemPatch: Partial<import("@/lib/api").Item>) => void;
  save: () => Promise<void>;
  saveError: string;
}) {
  const [catalogProfiles, setCatalogProfiles] = useState<GameCatalogProfile[]>([]);
  const { locale } = useApp();
  const [shortcuts, setShortcuts] = useState<string[]>([]);
  // Results belong to the query they were fetched for; a changed name hides them without an extra render.
  const [globalSearchState, setGlobalSearchState] = useState(NO_GLOBAL_SEARCH);
  const [initialResult, setInitialResult] = useState<GameCatalogSearchResult>();
  const prefix = (editItem.name || "").match(/^([\w-]+):\s*/)?.[1]?.toLowerCase();
  const globalSearch = realm === "collection" && Boolean(prefix && shortcuts.includes(prefix));
  const { results: globalResults, error: globalError, busy: globalBusy } = globalSearch && globalSearchState.query === (editItem.name || "") ? globalSearchState : NO_GLOBAL_SEARCH;
  useEffect(() => {
    if (!globalSearch) return;
    const query = editItem.name || "";
    let active = true;
    const timer = window.setTimeout(() => {
      setGlobalSearchState({ query, results: [], error: "", busy: true });
      api.searchGlobalGameCatalog(query).then((page) => {
        if (active) setGlobalSearchState({ query, results: page.items, error: "", busy: false });
      }).catch(() => { if (active) setGlobalSearchState({ query, results: [], error: t("gameCatalog.unavailable"), busy: false }); });
    }, 260);
    return () => { active = false; window.clearTimeout(timer); };
  }, [globalSearch, editItem.name, t]);
  const selectGlobalResult = async (result: GameCatalogSearchResult) => {
    const profile = catalogProfiles.find((entry) => entry.key === result.profile_key);
    if (!profile) return;
    const names = [profile.category.name, ...Object.values(profile.category.translations || {}).map((entry) => entry.name)].map((name) => name.trim().toLowerCase());
    const category = categories.find((entry) => names.includes(entry.name.trim().toLowerCase()));
    if (!category) {
      setGlobalSearchState((state) => ({ ...state, error: locale.startsWith("de") ? "Bitte lege diese Katalog-Kategorie zuerst unter Einstellungen > App an." : "Please create this catalog category in Settings > App first." }));
      return;
    }
    setCatalogPlatform({ profileKey: profile.key, categoryId: category.id, key: result.platform_key || "" });
    setInitialResult(result);
    setEditItem({ ...editItem, category_id: category.id, name: result.matched_title || result.canonical_title });
    setGlobalSearchState(NO_GLOBAL_SEARCH);
  };
  const [catalogPlatform, setCatalogPlatform] = useState<{ profileKey: string; categoryId: number; key: string } | null>(null);
  useEffect(() => {
    if (realm !== "collection") return;
    let active = true;
    api.getGameCatalogProfiles().then((contract) => { if (active) { setCatalogProfiles(contract.profiles); setShortcuts(Object.keys(contract.global_search?.shortcuts || {})); } }).catch(() => {});
    return () => { active = false; };
  }, [realm]);
  const catalogProfileKey = (initialResult && catalogPlatform && catalogPlatform.categoryId === editItem.category_id ? catalogPlatform.profileKey : undefined) || catProperties.map((property) => (property.options?.game_catalog as { profile_key?: string } | undefined)?.profile_key).find(Boolean);
  const categoryName = categories.find((category) => category.id === editItem.category_id)?.name.trim().toLocaleLowerCase();
  const catalogProfile = catalogProfiles.find((profile) => profile.key === catalogProfileKey) || catalogProfiles.find((profile) => [profile.category.name, ...Object.values(profile.category.translations || {}).map((translation) => translation.name)].some((name) => name.trim().toLocaleLowerCase() === categoryName));
  const platformKey = catalogPlatform && catalogPlatform.profileKey === catalogProfile?.key && catalogPlatform.categoryId === editItem.category_id ? catalogPlatform.key : "";
  return (
    <div className="space-y-8">
      <ItemCreateHeader
        t={t}
        realm={realm}
        pageTitle={pageTitle}
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
        modelBadge={modelBadge}
        allowWebSearch={aiAllowWebSearch}
        onAllowWebSearchChange={setAiAllowWebSearch}
        rawDebugLog={aiRawDebugLog}
        lastUsage={aiLastUsage}
        endAIDrawerSession={clearAiSession}
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
        catalogPicker={realm === "collection" ? (
          <div className="relative">
          {globalSearch && globalBusy ? <LoaderCircle className="absolute right-3 top-[-24px] size-4 animate-spin text-gray-400" /> : null}
          {globalSearch && globalResults.length > 0 ? <div className="mt-2 overflow-hidden rounded-md bg-white shadow-lg outline outline-1 outline-black/5 dark:bg-gray-900 dark:outline-white/10">
            {globalResults.map((result) => <button key={result.id} type="button" onClick={() => void selectGlobalResult(result)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5">
              <Gamepad2 className="mt-0.5 size-4 shrink-0 text-indigo-500" />
              <span><span className="block text-sm font-medium text-gray-900 dark:text-white">{result.matched_title || result.canonical_title}</span><span className="block text-xs text-gray-500 dark:text-gray-400">{[result.first_release_year, result.platforms?.join(", ")].filter(Boolean).join(" · ")}</span></span>
            </button>)}
          </div> : null}
          {globalError ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{globalError}</p> : null}
          {!globalSearch ? <GameCatalogSection
            key={`${editItem.category_id}:${platformKey}`}
            initialResult={initialResult?.profile_key === catalogProfile?.key && initialResult?.platform_key === platformKey ? initialResult : undefined}
            profile={catalogProfile}
            platform={platformKey}
            t={t}
            categoryId={editItem.category_id}
            categoryProperties={catProperties}
            query={editItem.name || ""}
            onQueryChange={(name) => setEditItem({ ...editItem, name })}
            onPropertiesCreated={onGameCatalogPropertiesCreated}
            onApply={applyGameCatalogGame}
            onSave={save}
          /> : null}
          </div>
        ) : null}
        catalogPlatformPicker={realm === "collection" && catalogProfile?.platform_selection ? (
          <SelectPicker
            label={t("gameCatalog.platform")}
            value={platformKey || null}
            allowClear={false}
            searchable={false}
            placeholder={t("gameCatalog.selectPlatform")}
            options={catalogProfile.platform_selection.choices.map((choice) => ({ id: choice.key, name: choice.name }))}
            onChange={(value) => { if (typeof value === "string" && editItem.category_id) setCatalogPlatform({ profileKey: catalogProfile.key, categoryId: editItem.category_id, key: value }); }}
          />
        ) : null}
      />

      <VendorsSection
        t={t}
        editItem={editItem}
        manufacturers={manufacturers}
        suppliers={suppliers}
        vendors={vendors}
        developers={developers}
        publishers={publishers}
        salesPlatforms={salesPlatforms}
        category={categories.find((category) => category.id === editItem.category_id)}
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
        realm={realm}
      />

      <PropertiesSection
        t={t}
        collapseEmpty={isEditMode}
        catProperties={catProperties}
        propValues={propValues}
        aiSuggestedPropValues={aiSuggestedPropValues}
        valuesEqual={valuesEqual}
        formatSuggestionValue={formatSuggestionValue}
        applySuggestedProperty={applySuggestedProperty}
        setPropValues={setPropValues}
      />

      {isEditMode && itemId && sourceItem ? (
        <ModalSection id="item-attachments" title={t("attachments.title")}>
          {realm === "collection" ? (
            <div className="flex justify-end">
              <a href="#item-catalog-name" className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5">
                {t("gameCatalog.title")}
              </a>
            </div>
          ) : null}
          <AttachmentManager
            itemId={itemId}
            attachments={sourceItem.attachments || []}
            onChange={() => {
              void loadSourceItem();
            }}
            compact
          />
        </ModalSection>
      ) : null}

      {/* Always in reach: where you are in the form, what went wrong, and saving. */}
      <div className="sticky bottom-0 z-30 -mx-4 flex items-center gap-x-4 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 dark:border-white/10 dark:bg-gray-900/95">
        <nav aria-label={t("items.jumpTo")} className="hidden min-w-0 flex-1 items-center gap-x-4 overflow-x-auto text-sm font-medium text-gray-500 lg:flex dark:text-gray-400">
          {[
            { href: "#item-basics", label: t("items.modalBasicsTitle") },
            { href: "#item-vendors", label: t("items.modalVendorsTitle") },
            { href: "#item-stock", label: t("items.modalInventoryTitle") },
            { href: "#item-properties", label: t("items.properties") },
            ...(isEditMode ? [{ href: "#item-attachments", label: t("attachments.title") }] : []),
          ].map((link) => (
            <a key={link.href} href={link.href} className="whitespace-nowrap hover:text-gray-900 dark:hover:text-white">
              {link.label}
            </a>
          ))}
        </nav>
        {saveError ? (
          <p role="alert" className="min-w-0 flex-1 text-sm font-medium text-red-600 lg:flex-none dark:text-red-400">{saveError}</p>
        ) : null}
        <div className="ml-auto flex flex-none items-center gap-2">
        <Link
            href={cancelHref}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:inset-ring-white/5 dark:hover:bg-white/20"
          >
            {t("common.cancel")}
          </Link>
          <button
            type="button"
            onClick={() => {
              void save();
            }}
            disabled={!editItem?.name?.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
