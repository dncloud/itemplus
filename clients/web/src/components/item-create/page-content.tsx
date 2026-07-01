"use client";

import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
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
import AttachmentManager from "@/components/attachments/attachment-manager";

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
  save,
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
  save: () => Promise<void>;
}) {
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
        modelBadge={modelBadge}
        allowWebSearch={aiAllowWebSearch}
        onAllowWebSearchChange={setAiAllowWebSearch}
        rawDebugLog={aiRawDebugLog}
        lastUsage={aiLastUsage}
        endAIDrawerSession={clearAiSession}
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
  );
}
