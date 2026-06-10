"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import clsx from "clsx";
import Link from "next/link";
import { CameraIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, QrCodeIcon, SparklesIcon } from "@heroicons/react/24/outline";
import {
  AIDrawerTabs,
  AIDrawerChatMessage,
  AIRawDebugPanel,
  AIUsageBadges,
  AIInfoDrawer,
  BarcodeDraftNotice,
} from "@/components/item-create-ai-sections";
import type { AIUsage, Category, Item } from "@/lib/api";
import { Field, TWPSelect } from "@/components/item-create-ui";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

type AIChatMessageEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  pending?: boolean;
  animate?: boolean;
};

type AIContextSuggestion = {
  id: string;
  label: string;
  value: string;
  onApply: () => void;
};

export function ItemCreateHeader({
  t,
  realm,
  pageTitle,
  cancelHref,
  barcodeCapturePending,
  requestBarcodeCapture,
  aiAssistBusy,
  openAIPanel,
  hasAIInfo,
  aiPanelOpen,
}: {
  t: TranslateFn;
  realm: "archive" | "collection";
  pageTitle: string;
  cancelHref: string;
  barcodeCapturePending: boolean;
  requestBarcodeCapture: () => void;
  aiAssistBusy: boolean;
  openAIPanel: () => void;
  hasAIInfo: boolean;
  aiPanelOpen: boolean;
}) {
  return (
    <div className="mb-4 text-center sm:flex sm:items-center sm:justify-between sm:border-b sm:border-gray-200 sm:text-left lg:mb-8 dark:border-white/10">
      <div className="space-y-1 py-3">
        <nav className="text-sm font-medium text-gray-500 dark:text-gray-400">
          <ol className="flex items-center justify-center sm:justify-start">
            <li>
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">
                {t("nav.dashboard")}
              </Link>
            </li>
            <li className="flex items-center px-1 opacity-25">
              <ChevronRightIcon className="inline-block h-5 w-5" />
            </li>
            <li className="text-gray-500 dark:text-gray-400">
              {realm === "archive" ? t("realm.archive") : t("realm.collection")}
            </li>
            <li className="flex items-center px-1 opacity-25">
              <ChevronRightIcon className="inline-block h-5 w-5" />
            </li>
            <li>
              <Link href="/items" className="hover:text-gray-900 dark:hover:text-white">
                {t("items.title")}
              </Link>
            </li>
            <li className="flex items-center px-1 opacity-25">
              <ChevronRightIcon className="inline-block h-5 w-5" />
            </li>
            <li className="text-gray-900 dark:text-white">{pageTitle}</li>
          </ol>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{pageTitle}</h1>
      </div>
      <div className="flex items-center justify-center gap-2 rounded-sm px-2 py-3 sm:justify-end sm:bg-transparent sm:px-0">
        <button
          type="button"
          onClick={requestBarcodeCapture}
          disabled={barcodeCapturePending}
          className={clsx(
            "inline-flex items-center justify-center rounded-lg border p-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-60",
            barcodeCapturePending
              ? "border-green-300 text-green-600 dark:border-green-700 dark:text-green-500"
              : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800",
          )}
          title={barcodeCapturePending ? t("items.barcodeWaiting") : t("items.scanBarcode")}
        >
          <QrCodeIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={clsx(
            "inline-flex items-center justify-center rounded-lg border p-2 text-sm transition",
            aiPanelOpen || hasAIInfo
              ? "border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/10"
              : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20",
          )}
          onClick={openAIPanel}
          title={aiAssistBusy ? t("items.aiAssistRunning") : t("common.openAiSession")}
        >
          <SparklesIcon className={clsx("h-4 w-4", aiAssistBusy ? "animate-pulse" : "")} />
        </button>
        <Link
          href={cancelHref}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:inset-ring-white/5 dark:hover:bg-white/20"
        >
          {t("common.cancel")}
        </Link>
      </div>
    </div>
  );
}

export function ItemCreateAIPanel({
  t,
  editItem,
  setEditItem,
  aiUserName,
  categories,
  clearPropValues,
  barcodeDraft,
  clearBarcodeDraft,
  hasVisibleSuggestions,
  applyAllAISuggestions,
  runAIAssist,
  aiAssistBusy,
  canPhotoLookup,
  photoLookupPending,
  requestPhotoLookup,
  aiDrawerOpen,
  closeAIDrawer,
  aiChat,
  aiSuggestionAnchorMessageId,
  aiChatSuggestions,
  markAssistantMessageSeen,
  endAIDrawerSession,
  modelBadge,
  allowWebSearch,
  onAllowWebSearchChange,
  rawDebugLog,
  lastUsage,
}: {
  t: TranslateFn;
  editItem: Partial<Item>;
  setEditItem: (value: Partial<Item>) => void;
  aiUserName: string;
  categories: Category[];
  clearPropValues: () => void;
  barcodeDraft: { code: string; symbology?: string | null } | null;
  clearBarcodeDraft: () => void;
  hasVisibleSuggestions: boolean;
  applyAllAISuggestions: () => void;
  runAIAssist: (message: string) => void;
  aiAssistBusy: boolean;
  canPhotoLookup: boolean;
  photoLookupPending: boolean;
  requestPhotoLookup: () => void;
  aiDrawerOpen: boolean;
  closeAIDrawer: () => void;
  aiChat: AIChatMessageEntry[];
  aiSuggestionAnchorMessageId: string | null;
  aiChatSuggestions: AIContextSuggestion[];
  markAssistantMessageSeen: (id: string) => void;
  endAIDrawerSession: () => void;
  modelBadge: string | null;
  allowWebSearch: boolean;
  onAllowWebSearchChange: (value: boolean) => void;
  rawDebugLog: string;
  lastUsage: AIUsage | null;
}) {
  const [messageDraft, setMessageDraft] = useState("");
  const [basicsExpandedOverride, setBasicsExpandedOverride] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "raw">("chat");
  const hasAIInfo = hasVisibleSuggestions || aiAssistBusy || aiChat.length > 0;
  const aiAssistantName = t("items.aiAssistantName");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const categoryName = categories.find((category) => category.id === editItem.category_id)?.name || "";
  const basicsSummary = [editItem.name?.trim(), categoryName].filter(Boolean).join(" • ") || t("items.aiInfoTitle");
  const basicsExpanded = !hasAIInfo || basicsExpandedOverride;

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [messageDraft]);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [aiChat, aiChatSuggestions, hasVisibleSuggestions]);

  const handleSend = () => {
    const nextMessage = messageDraft;
    setMessageDraft("");
    runAIAssist(nextMessage);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (aiAssistBusy) return;
      handleSend();
    }
  };

  return (
    <>
      {barcodeDraft ? (
        <BarcodeDraftNotice t={t} barcodeDraft={barcodeDraft} clearBarcodeDraft={clearBarcodeDraft} />
      ) : null}

      <AIInfoDrawer
        open={aiDrawerOpen}
        onClose={closeAIDrawer}
        title={t("items.aiInfoTitle")}
        bodyClassName="mt-6 flex min-h-0 flex-1 flex-col gap-4 px-4 sm:px-6"
      >
        <div className="shrink-0 rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
          {hasAIInfo ? (
            <button
              type="button"
              onClick={() => setBasicsExpandedOverride((current) => !current)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">{t("items.modalBasicsTitle")}</p>
                <p className="truncate text-sm text-gray-900 dark:text-white">{basicsSummary}</p>
              </div>
              {basicsExpanded ? (
                <ChevronUpIcon className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
              )}
            </button>
          ) : null}
          <div className={clsx("space-y-4 px-4 py-4", hasAIInfo && !basicsExpanded && "hidden")}>
            <Field
              label={t("items.name")}
              value={editItem.name || ""}
              onChange={(value) => setEditItem({ ...editItem, name: value })}
            />
            <TWPSelect
              label={t("items.category")}
              value={editItem.category_id}
              onChange={(value) => {
                setEditItem({ ...editItem, category_id: value });
                if (!value) clearPropValues();
              }}
              options={categories.map((category) => ({ id: category.id, name: category.name }))}
            />
            {barcodeDraft ? (
              <div>
                <label className="block text-sm/6 font-medium text-gray-900 dark:text-white">{t("items.barcodeCaptured")}</label>
                <div className="mt-2 rounded-md bg-white px-3 py-2 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 dark:bg-white/5 dark:text-white dark:outline-white/10">
                  <div className="break-all">{barcodeDraft.code}</div>
                  {barcodeDraft.symbology ? (
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{barcodeDraft.symbology}</div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <AIDrawerTabs t={t} activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "chat" ? (
          <div ref={messagesRef} className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
            <div className="space-y-5 pb-2">
              {aiChat.length > 0 ? (
                <>
                  {aiChat.map((message) => (
                    <div key={message.id} className="space-y-3">
                      <AIDrawerChatMessage
                        role={message.role}
                        name={message.role === "user" ? aiUserName : aiAssistantName}
                        content={message.content}
                        imageUrl={message.imageUrl}
                        pending={message.pending}
                        animate={message.animate}
                        onAnimationDone={message.role === "assistant" ? () => markAssistantMessageSeen(message.id) : undefined}
                      />
                      {message.role === "assistant" && aiSuggestionAnchorMessageId === message.id && aiChatSuggestions.length > 0 ? (
                        <div className="flex justify-start">
                          <div className="flex w-full max-w-[88%] flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-emerald-900 dark:text-white">{t("categories.aiTitle")}</p>
                              <button
                                type="button"
                                onClick={applyAllAISuggestions}
                                className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100 dark:bg-white/10 dark:text-emerald-100 dark:ring-white/10 dark:hover:bg-white/20"
                              >
                                {t("items.aiApplyAll")}
                              </button>
                            </div>
                            <div className="space-y-2">
                              {aiChatSuggestions.map((suggestion) => (
                                <div
                                  key={suggestion.id}
                                  className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-black/10"
                                >
                                  <div className="min-w-0 space-y-1">
                                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-emerald-700/80 dark:text-emerald-200/80">
                                      {suggestion.label}
                                    </p>
                                    <p className="whitespace-pre-wrap text-sm text-emerald-900 dark:text-emerald-50">{suggestion.value}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={suggestion.onApply}
                                    className="shrink-0 rounded-md bg-emerald-100 px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-200 dark:bg-white/10 dark:text-emerald-100 dark:hover:bg-white/20"
                                  >
                                    {t("common.apply")}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-6 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
                  {t("items.aiInfoEmpty")}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
            <AIRawDebugPanel t={t} rawDebug={rawDebugLog} />
          </div>
        )}

        <div className="shrink-0 rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-gray-950/20">
          <textarea
            ref={composerRef}
            value={messageDraft}
            onChange={(event) => setMessageDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            rows={1}
            className="min-h-[44px] w-full resize-none overflow-hidden bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-500 dark:text-white"
          />
          <div className="mt-2">
            <AIUsageBadges t={t} modelBadge={modelBadge} usage={lastUsage} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              {hasAIInfo ? (
                <button
                  type="button"
                  onClick={() => {
                    setMessageDraft("");
                    endAIDrawerSession();
                  }}
                  className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  {t("categories.aiEndSession")}
                </button>
              ) : null}
              <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={allowWebSearch}
                  onChange={(event) => onAllowWebSearchChange(event.target.checked)}
                  className="accent-blue-500"
                />
                {t("chat.allowWebSearch")}
              </label>
              {canPhotoLookup ? (
                <button
                  type="button"
                  onClick={requestPhotoLookup}
                  disabled={photoLookupPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  <CameraIcon className="h-4 w-4" />
                  {photoLookupPending ? t("items.aiPhotoSending") : t("items.aiPhotoAction")}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={aiAssistBusy}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <SparklesIcon className="h-4 w-4" />
              {aiAssistBusy ? t("items.aiAssistRunning") : t("common.send")}
            </button>
          </div>
        </div>

      </AIInfoDrawer>
    </>
  );
}
