"use client";

import clsx from "clsx";
import Link from "next/link";
import { ChevronRightIcon, InformationCircleIcon, QrCodeIcon, SparklesIcon } from "@heroicons/react/24/outline";
import {
  AIInfoDrawer,
  AIDebugPanel,
  AIStatusNotice,
  BarcodeDraftNotice,
  type AIErrorInsights,
  type AIStatusDetails,
} from "@/components/item-create-ai-sections";
import type { AIPropertyReviewHint } from "@/components/item-create-ai-utils";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

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
  openAIInfo,
  hasAIInfo,
}: {
  t: TranslateFn;
  realm: "archive" | "collection";
  pageTitle: string;
  cancelHref: string;
  barcodeCapturePending: boolean;
  requestBarcodeCapture: () => void;
  aiAssistBusy: boolean;
  canRunAI: boolean;
  runAIAssist: () => void;
  openAIInfo: () => void;
  hasAIInfo: boolean;
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
        <button
          type="button"
          onClick={openAIInfo}
          className={clsx(
            "inline-flex items-center justify-center rounded-lg border p-2 text-sm transition",
            hasAIInfo
              ? "border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/10"
              : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800",
          )}
          title={t("items.aiInfoButton")}
        >
          <InformationCircleIcon className="h-4 w-4" />
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
  aiPropertyReviewHints,
  aiLastRequest,
  aiLiveText,
  aiProgressMessages,
  aiThinkingMessages,
  photoLookupPending,
  requestPhotoLookup,
  aiDrawerOpen,
  closeAIDrawer,
}: {
  t: TranslateFn;
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
  aiPropertyReviewHints: AIPropertyReviewHint[];
  aiLastRequest: string;
  aiLiveText: string;
  aiProgressMessages: string[];
  aiThinkingMessages: string[];
  photoLookupPending: boolean;
  requestPhotoLookup: () => void;
  aiDrawerOpen: boolean;
  closeAIDrawer: () => void;
}) {
  const hasAIInfo =
    hasVisibleSuggestions ||
    aiAssistBusy ||
    !!aiLastRequest ||
    !!aiLiveText ||
    aiProgressMessages.length > 0 ||
    aiThinkingMessages.length > 0 ||
    aiAssistResultNotes.length > 0 ||
    aiPropertyReviewHints.length > 0 ||
    aiAssistResultQuestions.length > 0 ||
    !!aiAssistStatus;

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
        {hasVisibleSuggestions ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{t("items.aiSuggestionsReady")}</p>
                <p className="mt-1 text-sm text-emerald-200">{t("items.aiSuggestionsHint")}</p>
              </div>
              <button
                type="button"
                onClick={applyAllAISuggestions}
                className="inline-flex items-center rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-emerald-100 ring-1 ring-inset ring-white/10 hover:bg-white/20"
              >
                {t("items.aiApplyAll")}
              </button>
            </div>
          </div>
        ) : null}

        {!hasAIInfo ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-300">
            {t("items.aiInfoEmpty")}
          </div>
        ) : null}

        {aiAssistBusy ? (
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-4">
            <p className="text-sm font-semibold text-white">{t("items.aiInfoStatusTitle")}</p>
            <p className="mt-1 text-sm text-indigo-200">{t("items.aiAssistRunning")}</p>
          </div>
        ) : null}

        {aiAssistStatus ? (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-4">
            <p className="text-sm font-semibold text-white">{t("items.aiInfoStatusTitle")}</p>
            <p className="mt-1 text-sm text-blue-200">{aiAssistStatus}</p>
          </div>
        ) : null}

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

        {aiPropertyReviewHints.length > 0 ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-4">
            <p className="text-sm font-semibold text-white">{t("items.aiPropertyReviewTitle")}</p>
            <p className="mt-1 text-sm text-amber-200">{t("items.aiPropertyReviewHint")}</p>
            <ul className="mt-3 space-y-2 text-sm text-amber-100">
              {aiPropertyReviewHints.map((hint, index) => (
                <li key={`${hint.propertyName}-${hint.foundValues.join(",")}-${index}`} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                  <p className="font-medium">{t("items.aiPropertyReviewEntry", { property: hint.propertyName })}</p>
                  <p className="mt-1 text-amber-200">{t("items.aiPropertyReviewFound", { value: hint.foundValues.join(", ") })}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {aiAssistResultQuestions.length > 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-sm font-semibold text-white">{t("items.aiQuestions")}</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-300">
              {aiAssistResultQuestions.map((question, index) => (
                <li key={`${question}-${index}`} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                  {question}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {aiAssistResultNotes.length > 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-sm font-semibold text-white">{t("categories.aiNotes")}</p>
            <div className="mt-3 space-y-2 text-sm text-gray-300">
              {aiAssistResultNotes.map((note, index) => (
                <div key={`${note}-${index}`} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                  {note}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!!aiLastRequest || !!aiLiveText || aiProgressMessages.length > 0 || aiThinkingMessages.length > 0 ? (
          <AIDebugPanel
            t={t}
            title={t("items.aiInfoActivityTitle")}
            aiLastRequest={aiLastRequest}
            aiLiveText={aiLiveText}
            aiProgressMessages={aiProgressMessages}
            aiThinkingMessages={aiThinkingMessages}
            aiAssistResultNotes={[]}
            aiAssistBusy={aiAssistBusy}
          />
        ) : null}
      </AIInfoDrawer>
    </>
  );
}
