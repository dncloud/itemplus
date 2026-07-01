"use client";

import { type RefObject } from "react";

type RecoverSelection = {
  database: boolean;
  attachments: boolean;
  config: boolean;
};

type LocationIssues = {
  issues: { realm: string; id: number; name: string; type: string }[];
  total_checked: number;
};

export function SettingsSystemSection({
  t,
  backupBusy,
  recoverFile,
  recoverInputRef,
  recoverSelection,
  setRecoverFile,
  setRecoverSelection,
  exportBackupBundle,
  recoverBackupBundle,
  checkLocations,
  locIssues,
  locFixing,
  fixLocations,
  primaryButtonClass,
  secondaryButtonClass,
  dangerButtonClass,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
  backupBusy: "export" | "recover" | null;
  recoverFile: File | null;
  recoverInputRef: RefObject<HTMLInputElement | null>;
  recoverSelection: RecoverSelection;
  setRecoverFile: (file: File | null) => void;
  setRecoverSelection: (updater: (prev: RecoverSelection) => RecoverSelection) => void;
  exportBackupBundle: () => void;
  recoverBackupBundle: () => void;
  checkLocations: () => void;
  locIssues: LocationIssues | null;
  locFixing: boolean;
  fixLocations: () => void;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  dangerButtonClass: string;
}) {
  const restoreOptions = [
    { key: "database" as const, label: t("settings.recoverDatabase"), description: t("settings.recoverDatabaseHint") },
    { key: "attachments" as const, label: t("settings.recoverAttachments"), description: t("settings.recoverAttachmentsHint") },
    { key: "config" as const, label: t("settings.recoverConfig"), description: t("settings.recoverConfigHint") },
  ];
  const canRecover =
    !!recoverFile &&
    backupBusy === null &&
    (recoverSelection.database || recoverSelection.attachments || recoverSelection.config);

  return (
    <section id="backup" className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[16rem_minmax(0,1fr)]">
      <div>
        <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">{t("settings.sectionSystem")}</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("settings.databaseHint")}</p>
      </div>

      <div className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
        <div className="space-y-8 px-4 py-6 sm:p-8 md:max-w-4xl">
          <div className="space-y-3">
            <h3 className="text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.database")}</h3>
            <p className="text-sm/6 text-gray-500 dark:text-gray-400">{t("settings.exportIncludes")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={exportBackupBundle}
                disabled={backupBusy !== null}
                className={`${primaryButtonClass} disabled:opacity-50`}
              >
                {backupBusy === "export" ? t("common.loading") : t("settings.export")}
              </button>
            </div>
          </div>

          <div className="space-y-5 border-t border-gray-200 pt-8 dark:border-white/10">
            <div>
              <h3 className="text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.recover")}</h3>
              <p className="mt-1 text-sm/6 text-gray-500 dark:text-gray-400">{t("settings.recoverHint")}</p>
            </div>

            <input
              ref={recoverInputRef}
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => setRecoverFile(e.target.files?.[0] || null)}
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => recoverInputRef.current?.click()} className={secondaryButtonClass}>
                {t("settings.recoverChoose")}
              </button>
              {recoverFile ? (
                <span className="text-sm/6 text-gray-500 dark:text-gray-400">
                  {t("settings.recoverSelected", { name: recoverFile.name })}
                </span>
              ) : null}
            </div>

            <div className="space-y-3">
              <p className="text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.recoverWhat")}</p>
              <div className="space-y-3">
                {restoreOptions.map((option) => (
                  <label key={option.key} className="flex gap-3">
                    <span className="flex h-6 shrink-0 items-center">
                      <span className="group grid size-4 grid-cols-1">
                        <input
                          type="checkbox"
                          checked={recoverSelection[option.key]}
                          onChange={(e) => setRecoverSelection((prev) => ({ ...prev, [option.key]: e.target.checked }))}
                          className="col-start-1 row-start-1 appearance-none rounded-sm border border-gray-300 bg-white checked:border-indigo-600 checked:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-white/10 dark:bg-white/5 dark:checked:border-indigo-500 dark:checked:bg-indigo-500 dark:focus-visible:outline-indigo-500"
                        />
                        <svg viewBox="0 0 14 14" fill="none" className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white">
                          <path d="M3 8L6 11L11 3.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-has-[:checked]:opacity-100" />
                        </svg>
                      </span>
                    </span>
                    <span className="text-sm/6">
                      <span className="font-medium text-gray-900 dark:text-white">{option.label}</span>
                      <span className="mt-1 block text-gray-500 dark:text-gray-400">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={recoverBackupBundle}
                disabled={!canRecover}
                className={`${dangerButtonClass} disabled:opacity-50`}
              >
                {backupBusy === "recover" ? t("common.loading") : t("settings.recover")}
              </button>
            </div>
          </div>

          <div className="space-y-5 border-t border-gray-200 pt-8 dark:border-white/10">
            <div>
              <h3 className="text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.checkLocations")}</h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={checkLocations} className={primaryButtonClass}>
                {t("settings.checkLocations")}
              </button>
            </div>

            {locIssues ? (
              <div className="space-y-4 rounded-lg border border-gray-200 bg-white/50 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-sm/6 text-gray-700 dark:text-gray-300">
                  {t("settings.locationsChecked", { n: locIssues.total_checked })}{" "}
                  {locIssues.issues.length === 0 ? (
                    <span className="font-medium text-green-600 dark:text-green-300">- {t("settings.noProblems")}</span>
                  ) : (
                    <span className="font-medium text-red-500 dark:text-red-300">- {t("settings.problems", { n: locIssues.issues.length })}</span>
                  )}
                </p>

                {locIssues.issues.length > 0 ? (
                  <>
                    <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/70 p-3 dark:border-red-500/20 dark:bg-red-500/10">
                      {locIssues.issues.map((issue) => (
                        <p key={`${issue.realm}-${issue.id}`} className="text-xs text-red-600 dark:text-red-300">
                          [{issue.realm}] {issue.name} - {issue.type === "self_parent" ? "Self-Parenting" : t("locations.circularError")}
                        </p>
                      ))}
                    </div>
                    <button
                      onClick={fixLocations}
                      disabled={locFixing}
                      className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
                    >
                      {locFixing ? t("settings.fixing") : t("settings.fix", { n: locIssues.issues.length })}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
