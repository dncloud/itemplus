"use client";

import { useMemo, useState } from "react";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import type { AIVendorProposal, VendorLogoPreviewResult } from "@/lib/api";
import type { EntityType, VendorLogoSuggestion, VendorSuggestionEntry } from "./vendors-types";

export function VendorAIProposalPanel({
  tab,
  proposal,
  logoSuggestion,
  suggestionEntries,
  onApplyLogo,
  onApplySuggestion,
  onApplyAll,
  t,
}: {
  tab: EntityType;
  proposal?: AIVendorProposal | null;
  logoSuggestion?: VendorLogoSuggestion | null;
  suggestionEntries: VendorSuggestionEntry[];
  onApplyLogo?: (logoUrl: string) => void;
  onApplySuggestion: (key: string) => void;
  onApplyAll: () => void;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const showSuggestions = suggestionEntries.length > 0;
  const emptyMessage = proposal && !showSuggestions && !logoSuggestion ? t("vendors.aiNoSuggestions") : null;

  return (
    <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
      {logoSuggestion ? <VendorLogoSuggestionCard suggestion={logoSuggestion} onApply={onApplyLogo} t={t} /> : null}
      {showSuggestions ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
              {tab === "manufacturers" ? t("vendors.manufacturers") : tab === "suppliers" ? t("vendors.suppliers") : tab === "vendors" ? t("vendors.vendors") : t("vendors.salesPlatforms")}
            </p>
            <button type="button" onClick={onApplyAll} className="inline-flex items-center rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 shadow-xs ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100 dark:bg-white/10 dark:text-emerald-200 dark:ring-white/10 dark:hover:bg-white/20">
              {t("vendors.aiApplyAll")}
            </button>
          </div>
          <div className="space-y-2">
            {suggestionEntries.map((entry) => (
              <div key={entry.key} className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-gray-900/40 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">{entry.label}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900 dark:text-white">{entry.value}</p>
                </div>
                <button type="button" onClick={() => onApplySuggestion(entry.key)} className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/10">
                  {t("common.apply")}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : emptyMessage ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
      ) : null}
    </div>
  );
}

function VendorLogoSuggestionCard({
  suggestion,
  onApply,
  t,
}: {
  suggestion: VendorLogoSuggestion;
  onApply?: (logoUrl: string) => void;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const previewCandidates = useMemo(
    () => (suggestion.candidates || []).filter((entry) => String(entry.data_url || "").trim()),
    [suggestion.candidates],
  );
  const previewKey = previewCandidates.map((entry) => `${entry.source_url || ""}|${entry.data_url || ""}`).join("||");

  return (
    <div className="rounded-xl border border-emerald-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-gray-900/40">
      <VendorLogoSuggestionPreview key={previewKey} suggestion={suggestion} previewCandidates={previewCandidates} onApply={onApply} t={t} />
    </div>
  );
}

function VendorLogoSuggestionPreview({
  suggestion,
  previewCandidates,
  onApply,
  t,
}: {
  suggestion: VendorLogoPreviewResult;
  previewCandidates: NonNullable<VendorLogoPreviewResult["candidates"]>;
  onApply?: (logoUrl: string) => void;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCandidate = previewCandidates[activeIndex] || null;
  const activeUrl = activeCandidate?.data_url || "";
  const hasMultipleCandidates = previewCandidates.length > 1;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-emerald-200 bg-white dark:border-white/10 dark:bg-white/5">
          {activeUrl ? (
            <img
              src={activeUrl}
              alt=""
              className="h-full w-full object-contain p-2"
              onError={() => {
                setActiveIndex((current) => (current < previewCandidates.length - 1 ? current + 1 : current));
              }}
            />
          ) : (
            <Building2 className="h-6 w-6 text-emerald-400 dark:text-emerald-300" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">{t("vendors.logo")}</p>
          <p className="mt-1 text-sm text-gray-900 dark:text-white">{t("vendors.aiLogoSource", { domain: suggestion.domain })}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("vendors.aiLogoHint")}</p>
          {activeCandidate?.source_url ? <p className="mt-1 break-all text-xs text-gray-500 dark:text-gray-400">{activeCandidate.source_url}</p> : null}
          {activeCandidate ? (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {`${activeIndex + 1}/${previewCandidates.length}`}
              {activeCandidate.kind ? ` · ${activeCandidate.kind.replace("image/", "").toUpperCase()}` : ""}
              {activeCandidate.width && activeCandidate.height ? ` · ${activeCandidate.width}×${activeCandidate.height}` : ""}
            </p>
          ) : null}
          {hasMultipleCandidates ? (
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={() => setActiveIndex((current) => Math.max(0, current - 1))} disabled={activeIndex === 0} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/10" title={t("common.previous")}><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={() => setActiveIndex((current) => Math.min(previewCandidates.length - 1, current + 1))} disabled={activeIndex >= previewCandidates.length - 1} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/10" title={t("common.next")}><ChevronRight className="h-4 w-4" /></button>
            </div>
          ) : null}
        </div>
      </div>
      <button type="button" onClick={() => { if (activeUrl) onApply?.(activeUrl); }} disabled={!activeUrl} className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/10">
        {t("vendors.aiApplyLogo")}
      </button>
    </div>
  );
}
