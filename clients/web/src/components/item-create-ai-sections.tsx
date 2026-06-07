"use client";

import type { ReactNode } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { BarcodePreview } from "@/components/item-create-ui";

export type AIStatusDetails = {
  title: string;
  body?: string;
  actionLabel?: string;
} | null;

export type AIErrorInsights = {
  reason: string;
  description: string;
  questions: string[];
  notes: string[];
} | null;

export function BarcodeDraftNotice({
  t,
  barcodeDraft,
  clearBarcodeDraft,
}: {
  t: (key: string) => string;
  barcodeDraft: { code: string; symbology?: string | null };
  clearBarcodeDraft: () => void;
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{t("items.barcodeCaptured")}</p>
          <p className="mt-1 break-all text-xs text-gray-500 dark:text-gray-400">
            {barcodeDraft.code}
            {barcodeDraft.symbology ? ` · ${barcodeDraft.symbology}` : ""}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <BarcodePreview code={barcodeDraft.code} symbology={barcodeDraft.symbology} />
          <button
            type="button"
            onClick={clearBarcodeDraft}
            className="inline-flex items-center justify-center rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-white"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AISuggestionsBanner({
  t,
  applyAllAISuggestions,
}: {
  t: (key: string) => string;
  applyAllAISuggestions: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
      <span>{t("items.aiSuggestionsHint")}</span>
      <button
        type="button"
        onClick={applyAllAISuggestions}
        className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 font-medium text-emerald-700 shadow-xs ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100 dark:bg-white/10 dark:text-emerald-200 dark:ring-white/10 dark:hover:bg-white/20"
      >
        {t("items.aiApplyAll")}
      </button>
    </div>
  );
}

export function AIBusyStatus({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 dark:border-indigo-400/30 dark:border-t-indigo-300" />
      <span>{t("items.aiAssistRunning")}</span>
    </div>
  );
}

export function AIStatusNotice({
  t,
  aiStatusDetails,
  aiErrorInsights,
  aiAssistResultQuestions,
  photoLookupPending,
  requestPhotoLookup,
}: {
  t: (key: string) => string;
  aiStatusDetails: Exclude<AIStatusDetails, null>;
  aiErrorInsights: AIErrorInsights;
  aiAssistResultQuestions: string[];
  photoLookupPending: boolean;
  requestPhotoLookup: () => void;
}) {
  const questions = aiErrorInsights?.questions?.length ? aiErrorInsights.questions : aiAssistResultQuestions;

  return (
    <div className="rounded-md bg-blue-500/10 p-4 outline outline-1 -outline-offset-1 outline-blue-500/20">
      <div className="flex">
        <div className="shrink-0">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-5 text-blue-400">
            <path
              d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
              clipRule="evenodd"
              fillRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1 md:flex md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-blue-200">{aiStatusDetails.title}</p>
            {aiStatusDetails.body ? <p className="text-sm text-blue-300">{aiStatusDetails.body}</p> : null}
            {aiErrorInsights?.reason ? <p className="text-sm text-blue-300">{aiErrorInsights.reason}</p> : null}
            {aiErrorInsights?.description ? <p className="text-sm text-blue-300">{aiErrorInsights.description}</p> : null}
            {questions.length ? (
              <ul className="space-y-1 text-sm text-blue-300">
                {questions.map((question, index) => (
                  <li key={`${question}-${index}`}>- {question}</li>
                ))}
              </ul>
            ) : null}
            {aiErrorInsights?.notes?.length ? (
              <ul className="space-y-1 text-sm text-blue-300">
                {aiErrorInsights.notes.map((note, index) => (
                  <li key={`${note}-${index}`}>- {note}</li>
                ))}
              </ul>
            ) : null}
          </div>
          {aiStatusDetails.actionLabel ? (
            <p className="mt-3 text-sm md:mt-0 md:ml-6">
              <span className="whitespace-nowrap font-medium text-blue-300">{aiStatusDetails.actionLabel}</span>
            </p>
          ) : null}
        </div>
      </div>
      {(aiErrorInsights || aiAssistResultQuestions.length) ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={requestPhotoLookup}
            disabled={photoLookupPending}
            className="inline-flex items-center rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-blue-200 ring-1 ring-inset ring-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {photoLookupPending ? t("items.aiPhotoSending") : t("items.aiPhotoAction")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AIDebugPanel({
  t,
  title,
  aiLastRequest,
  aiLiveText,
  aiProgressMessages,
  aiThinkingMessages,
  aiAssistResultNotes,
  aiAssistBusy,
}: {
  t: (key: string) => string;
  title?: string;
  aiLastRequest: string;
  aiLiveText: string;
  aiProgressMessages: string[];
  aiThinkingMessages: string[];
  aiAssistResultNotes: string[];
  aiAssistBusy: boolean;
}) {
  const showStream = aiProgressMessages.length > 0 || aiThinkingMessages.length > 0 || !!aiLiveText;

  return (
    <details className="rounded-md border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">{title || "KI-Debug"}</summary>
      <div className="space-y-3 border-t border-gray-200 px-3 py-3 dark:border-white/10">
        {aiLastRequest ? (
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{t("items.aiRequestTitle")}</p>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-md bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600 ring-1 ring-inset ring-gray-200 dark:bg-black/20 dark:text-gray-300 dark:ring-white/10">
              {aiLastRequest}
            </div>
          </div>
        ) : null}
        {showStream ? (
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{t("items.aiStreamTitle")}</p>
            {aiProgressMessages.length > 0 ? (
              <div className="mt-2 space-y-1">
                {aiProgressMessages.map((message, index) => (
                  <div key={`${message}-${index}`} className="text-xs text-gray-500 dark:text-gray-400">
                    {message}
                  </div>
                ))}
              </div>
            ) : null}
            {aiThinkingMessages.length > 0 ? (
              <div className="mt-2 space-y-2">
                {aiThinkingMessages.map((message, index) => (
                  <div
                    key={`${message}-${index}`}
                    className="max-w-[90%] rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                  >
                    {message}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-2 max-h-56 overflow-y-auto rounded-md bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600 ring-1 ring-inset ring-gray-200 dark:bg-black/20 dark:text-gray-300 dark:ring-white/10">
              {aiLiveText || (aiAssistBusy ? t("items.aiStreamWaiting") : t("items.aiStreamEmpty"))}
            </div>
          </div>
        ) : null}
        {aiAssistResultNotes.length ? (
          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
            {aiAssistResultNotes.map((note, index) => (
              <p key={`${note}-${index}`}>{note}</p>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function AIInfoDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="pointer-events-none absolute inset-0 pl-10 focus:outline-none sm:pl-16">
        <div className="ml-auto flex h-full w-full max-w-2xl">
          <div className="pointer-events-auto relative flex h-full w-full flex-col overflow-y-auto bg-gray-800 py-6 shadow-2xl ring-1 ring-white/10">
            <div className="px-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-white">{title}</h2>
                  {subtitle ? <p className="mt-1 text-sm text-gray-400">{subtitle}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="relative rounded-md text-gray-400 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  <span className="absolute -inset-2.5" />
                  <span className="sr-only">Close panel</span>
                  <XMarkIcon className="size-6" />
                </button>
              </div>
            </div>
            <div className="relative mt-6 flex-1 space-y-6 px-4 sm:px-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
