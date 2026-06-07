"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import clsx from "clsx";
import Link from "next/link";
import { CameraIcon, ChevronRightIcon, QrCodeIcon, SparklesIcon } from "@heroicons/react/24/outline";
import {
  AIInfoDrawer,
  BarcodeDraftNotice,
} from "@/components/item-create-ai-sections";
import type { Category, Item } from "@/lib/api";
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
    <p className={`whitespace-pre-wrap ${animate ? "text-white [text-shadow:0_0_10px_rgba(96,165,250,0.2)]" : ""}`}>
      {visibleText}
      {animate && visibleLength < content.length ? <span className="ml-0.5 inline-block h-4 w-[1px] animate-pulse bg-blue-300 align-middle" /> : null}
    </p>
  );
}

function AIChatMessage({
  role,
  name,
  content,
  imageUrl,
  pending = false,
  animate = false,
  onAnimationDone,
}: {
  role: "user" | "assistant";
  name: string;
  content: string;
  imageUrl?: string;
  pending?: boolean;
  animate?: boolean;
  onAnimationDone?: () => void;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[88%] flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
        <p className="px-1 text-xs font-medium uppercase tracking-[0.08em] text-gray-400">{name}</p>
        <div className={clsx("rounded-2xl px-4 py-3 text-sm", isUser ? "bg-blue-500 text-white" : "border border-white/10 bg-white/5 text-gray-200")}>
          {isUser ? (
            <div className="space-y-3">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  className="max-h-56 w-auto rounded-xl border border-white/10 object-cover"
                />
              ) : null}
              {content ? <p className="whitespace-pre-wrap">{content}</p> : null}
            </div>
          ) : (
            <AnimatedAIText content={content} animate={animate} pending={pending} onAnimationDone={onAnimationDone} />
          )}
        </div>
      </div>
    </div>
  );
}

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
}) {
  const [messageDraft, setMessageDraft] = useState("");
  const hasAIInfo = hasVisibleSuggestions || aiAssistBusy || aiChat.length > 0;
  const aiAssistantName = t("items.aiAssistantName");

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
        subtitle={t("items.aiInfoSubtitle")}
      >
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="space-y-4">
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

        {aiChat.length > 0 ? (
          <div className="space-y-5">
            {aiChat.map((message) => (
              <div key={message.id} className="space-y-3">
                <AIChatMessage
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
                    <div className="flex w-full max-w-[88%] flex-col gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{t("categories.aiTitle")}</p>
                        <button
                          type="button"
                          onClick={applyAllAISuggestions}
                          className="inline-flex items-center rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-emerald-100 ring-1 ring-inset ring-white/10 hover:bg-white/20"
                        >
                          {t("items.aiApplyAll")}
                        </button>
                      </div>
                      <div className="space-y-2">
                        {aiChatSuggestions.map((suggestion) => (
                          <div
                            key={suggestion.id}
                            className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-3"
                          >
                            <div className="min-w-0 space-y-1">
                              <p className="text-xs font-medium uppercase tracking-[0.08em] text-emerald-200/80">
                                {suggestion.label}
                              </p>
                              <p className="whitespace-pre-wrap text-sm text-emerald-50">{suggestion.value}</p>
                            </div>
                            <button
                              type="button"
                              onClick={suggestion.onApply}
                              className="shrink-0 rounded-md bg-white/10 px-3 py-2 text-xs font-medium text-emerald-100 ring-1 ring-inset ring-white/10 hover:bg-white/20"
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
          </div>
        ) : null}

        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
          <label className="mb-2 block text-sm font-medium text-white">{t("items.aiMessageLabel")}</label>
          <textarea
            value={messageDraft}
            onChange={(event) => setMessageDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            rows={2}
            className="block min-h-[84px] w-full resize-none rounded-2xl bg-black/20 px-4 py-2.5 text-sm text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500"
          />
          <div className="mt-4 flex justify-end gap-3">
            {hasAIInfo ? (
              <button
                type="button"
                onClick={() => {
                  setMessageDraft("");
                  endAIDrawerSession();
                }}
                className="mr-auto inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/5 hover:text-white"
              >
                {t("categories.aiEndSession")}
              </button>
            ) : null}
            {canPhotoLookup ? (
              <button
                type="button"
                onClick={requestPhotoLookup}
                disabled={photoLookupPending}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CameraIcon className="h-4 w-4" />
                {photoLookupPending ? t("items.aiPhotoSending") : t("items.aiPhotoAction")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleSend}
              disabled={aiAssistBusy}
              className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <SparklesIcon className="h-4 w-4" />
              {aiAssistBusy ? t("items.aiAssistRunning") : t("categories.aiSend")}
            </button>
          </div>
        </div>

      </AIInfoDrawer>
    </>
  );
}
