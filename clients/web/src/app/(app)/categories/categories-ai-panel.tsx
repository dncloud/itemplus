"use client";

import type { AIPropertyProposal } from "@/lib/api";

export function CategoryAIProposalPanel({
  proposals,
  busy,
  status,
  notes,
  questions,
  propertyTypes,
  onApplyOne,
  onApplyAll,
  t,
}: {
  proposals: AIPropertyProposal[];
  busy: boolean;
  status: string | null;
  notes: string[];
  questions: string[];
  propertyTypes: { value: string; label: string }[];
  onApplyOne: (proposal: AIPropertyProposal) => void;
  onApplyAll: () => void;
  t: (k: string) => string;
}) {
  const showPanel = busy || !!status || notes.length > 0 || questions.length > 0 || proposals.length > 0;
  if (!showPanel) return null;

  const typeLabel = (value: string) => propertyTypes.find((entry) => entry.value === value)?.label || value;

  return (
    <div className="border-t border-gray-100 pt-4 dark:border-white/10">
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{t("categories.aiTitle")}</p>
        {proposals.length > 1 ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={onApplyAll}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              {t("categories.aiApplyAll")}
            </button>
          </div>
        ) : null}

        {busy ? <p className="mt-3 text-sm text-blue-700 dark:text-blue-200">{t("categories.aiRunning")}</p> : null}
        {status ? <p className="mt-3 text-sm text-blue-700 dark:text-blue-200">{status}</p> : null}

        {questions.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{t("categories.aiQuestions")}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-300">
              {questions.map((question, index) => (
                <li key={`${question}-${index}`}>{question}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {notes.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{t("categories.aiNotes")}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-300">
              {notes.map((note, index) => (
                <li key={`${note}-${index}`}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {proposals.length > 0 ? (
          <div className="mt-4 space-y-3">
            {proposals.map((proposal, index) => (
              <div key={`${proposal.name}-${index}`} className="rounded-xl border border-gray-200 bg-white/80 p-4 dark:border-white/10 dark:bg-gray-900/40">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{proposal.name}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-md bg-gray-100 px-2 py-1 text-gray-700 dark:bg-white/10 dark:text-gray-200">
                        {typeLabel(proposal.property_type)}
                      </span>
                      {proposal.unit ? (
                        <span className="rounded-md bg-gray-100 px-2 py-1 text-gray-700 dark:bg-white/10 dark:text-gray-200">
                          {t("categories.unit")}: {proposal.unit}
                        </span>
                      ) : null}
                      <span className="rounded-md bg-gray-100 px-2 py-1 text-gray-700 dark:bg-white/10 dark:text-gray-200">
                        {t("categories.displayWidth")}: {proposal.display_width || "third"}
                      </span>
                      {proposal.required ? (
                        <span className="rounded-md bg-red-50 px-2 py-1 text-red-700 dark:bg-red-500/10 dark:text-red-200">
                          {t("categories.requiredField")}
                        </span>
                      ) : null}
                      {proposal.show_in_list ? (
                        <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                          {t("categories.showInList")}
                        </span>
                      ) : null}
                    </div>
                    {proposal.options?.length ? (
                      <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{proposal.options.join(", ")}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => onApplyOne(proposal)}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
                  >
                    {t("common.apply")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
