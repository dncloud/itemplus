"use client";

import clsx from "clsx";
import Link from "next/link";
import { ChevronRightIcon, QrCodeIcon, SparklesIcon } from "@heroicons/react/24/outline";
import {
  AIBusyStatus,
  AIDebugPanel,
  AIStatusNotice,
  AISuggestionsBanner,
  BarcodeDraftNotice,
  type AIErrorInsights,
  type AIStatusDetails,
} from "@/components/item-create-ai-sections";

export { InlineAIHint } from "@/components/item-create-ai-sections";

export function ItemCreateHeader({
  t,
  realm,
  pageTitle,
  cancelHref,
  barcodeCapturePending,
  requestBarcodeCapture,
  aiAssistBusy,
  canRunAI,
  runAIAssist,
}: {
  t: (key: string) => string;
  realm: "archive" | "collection";
  pageTitle: string;
  cancelHref: string;
  barcodeCapturePending: boolean;
  requestBarcodeCapture: () => void;
  aiAssistBusy: boolean;
  canRunAI: boolean;
  runAIAssist: () => void;
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
          onClick={runAIAssist}
          disabled={aiAssistBusy || !canRunAI}
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          title={aiAssistBusy ? t("items.aiAssistRunning") : t("items.aiAssistApply")}
        >
          <SparklesIcon className="h-4 w-4" />
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
  barcodeDraft,
  clearBarcodeDraft,
  hasVisibleSuggestions,
  applyAllAISuggestions,
  aiAssistBusy,
  aiAssistStatus,
  aiStatusDetails,
  aiErrorInsights,
  aiAssistResultQuestions,
  aiAssistResultNotes,
  aiLastRequest,
  aiLiveText,
  aiProgressMessages,
  aiThinkingMessages,
  photoLookupPending,
  requestPhotoLookup,
}: {
  t: (key: string) => string;
  barcodeDraft: { code: string; symbology?: string | null } | null;
  clearBarcodeDraft: () => void;
  hasVisibleSuggestions: boolean;
  applyAllAISuggestions: () => void;
  aiAssistBusy: boolean;
  aiAssistStatus: string | null;
  aiStatusDetails: AIStatusDetails;
  aiErrorInsights: AIErrorInsights;
  aiAssistResultQuestions: string[];
  aiAssistResultNotes: string[];
  aiLastRequest: string;
  aiLiveText: string;
  aiProgressMessages: string[];
  aiThinkingMessages: string[];
  photoLookupPending: boolean;
  requestPhotoLookup: () => void;
}) {
  const showSuccessStatus =
    aiAssistStatus &&
    (aiAssistStatus === t("items.aiApplied") || aiAssistStatus === t("items.aiSuggestionsReady"));
  const showDebug =
    !!aiLastRequest ||
    !!aiLiveText ||
    aiProgressMessages.length > 0 ||
    aiThinkingMessages.length > 0 ||
    aiAssistResultNotes.length > 0;

  return (
    <>
      {barcodeDraft ? (
        <BarcodeDraftNotice t={t} barcodeDraft={barcodeDraft} clearBarcodeDraft={clearBarcodeDraft} />
      ) : null}

      {hasVisibleSuggestions ? <AISuggestionsBanner t={t} applyAllAISuggestions={applyAllAISuggestions} /> : null}

      {aiAssistBusy ? <AIBusyStatus t={t} /> : null}

      {showSuccessStatus ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{aiAssistStatus}</p> : null}

      {aiStatusDetails ? (
        <AIStatusNotice
          t={t}
          aiStatusDetails={aiStatusDetails}
          aiErrorInsights={aiErrorInsights}
          aiAssistResultQuestions={aiAssistResultQuestions}
          photoLookupPending={photoLookupPending}
          requestPhotoLookup={requestPhotoLookup}
        />
      ) : null}

      {showDebug ? (
        <AIDebugPanel
          t={t}
          aiLastRequest={aiLastRequest}
          aiLiveText={aiLiveText}
          aiProgressMessages={aiProgressMessages}
          aiThinkingMessages={aiThinkingMessages}
          aiAssistResultNotes={aiAssistResultNotes}
          aiAssistBusy={aiAssistBusy}
        />
      ) : null}
    </>
  );
}
