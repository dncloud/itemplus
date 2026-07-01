"use client";

import type { ExternalSource } from "@/lib/api";
import type { ExternalSourceDraft } from "@/components/settings/drafts";
import { ChoiceTile, ToggleRow } from "@/components/settings/ui";

const storagePrimaryButtonClass =
  "inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500";

export function SettingsStorageSection({
  t,
  externalSources,
  selectedExternalSourceId,
  setSelectedExternalSourceId,
  externalSourceDraft,
  setExternalSourceDraft,
  selectedExternalSource,
  createNewExternalSource,
  fetchExternalSourceHostKey,
  testExternalSource,
  saveExternalSource,
  deleteExternalSource,
  externalSourceBusy,
  inputClass,
  monoTextareaClass,
  secondaryButtonClass,
  dangerButtonClass,
}: {
  t: (key: string) => string;
  externalSources: ExternalSource[];
  selectedExternalSourceId: number | "new" | null;
  setSelectedExternalSourceId: (value: number | "new" | null) => void;
  externalSourceDraft: ExternalSourceDraft;
  setExternalSourceDraft: (value: ExternalSourceDraft) => void;
  selectedExternalSource: ExternalSource | null;
  createNewExternalSource: () => void;
  fetchExternalSourceHostKey: () => void;
  testExternalSource: () => void;
  saveExternalSource: () => void;
  deleteExternalSource: () => void;
  externalSourceBusy: "hostkey" | "test" | null;
  inputClass: string;
  monoTextareaClass: string;
  secondaryButtonClass: string;
  dangerButtonClass: string;
}) {
  return (
    <section id="storage" className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[16rem_minmax(0,1fr)]">
      <div>
        <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">{t("settings.externalSources")}</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("settings.externalSourcesHint")}</p>
      </div>

      <div className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
        <div className="space-y-8 px-4 py-6 sm:p-8 md:max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.externalSources")}</p>
              <p className="mt-1 text-sm/6 text-gray-500 dark:text-gray-400">{t("settings.externalSourcesHint")}</p>
            </div>
            <button onClick={createNewExternalSource} className={secondaryButtonClass}>
              {t("settings.newExternalSource")}
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {externalSources.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700">
                {t("settings.noExternalSources")}
              </div>
            ) : (
              externalSources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => setSelectedExternalSourceId(source.id)}
                  className={`w-full rounded-lg border p-4 text-left transition ${selectedExternalSourceId === source.id ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200 dark:border-emerald-500 dark:bg-emerald-500/10 dark:ring-emerald-500/20" : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{source.name}</div>
                      <div className="truncate text-xs text-gray-500">{source.username}@{source.host}:{source.port}</div>
                    </div>
                    {source.is_active ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        {t("settings.activeExternalSource")}
                      </span>
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="space-y-6 border-t border-gray-200 pt-8 dark:border-white/10">
            {selectedExternalSourceId === null && externalSources.length === 0 ? (
              <div className="text-sm text-gray-500">{t("settings.noExternalSources")}</div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.externalSourceName")}</label>
                    <input value={externalSourceDraft.name} onChange={(e) => setExternalSourceDraft({ ...externalSourceDraft, name: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.externalSourceDescription")}</label>
                    <input value={externalSourceDraft.description || ""} onChange={(e) => setExternalSourceDraft({ ...externalSourceDraft, description: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.externalSourceHost")}</label>
                    <input value={externalSourceDraft.host} onChange={(e) => setExternalSourceDraft({ ...externalSourceDraft, host: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.externalSourcePort")}</label>
                    <input type="number" value={externalSourceDraft.port} onChange={(e) => setExternalSourceDraft({ ...externalSourceDraft, port: Number(e.target.value) || 22 })} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.externalSourceUsername")}</label>
                    <input value={externalSourceDraft.username} onChange={(e) => setExternalSourceDraft({ ...externalSourceDraft, username: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.externalSourceBasePath")}</label>
                    <input value={externalSourceDraft.base_path} onChange={(e) => setExternalSourceDraft({ ...externalSourceDraft, base_path: e.target.value })} className={inputClass} />
                  </div>
                </div>

                <div className="space-y-3 border-t border-gray-200 pt-8 dark:border-white/10">
                  <label className="block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.externalSourceAuthType")}</label>
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                    <ChoiceTile
                      active={externalSourceDraft.auth_type === "password"}
                      onClick={() => setExternalSourceDraft({ ...externalSourceDraft, auth_type: "password", private_key: "" })}
                      title={t("settings.externalSourceAuthPassword")}
                      accent="emerald"
                    />
                    <ChoiceTile
                      active={externalSourceDraft.auth_type === "ssh_key"}
                      onClick={() => setExternalSourceDraft({ ...externalSourceDraft, auth_type: "ssh_key", password: "" })}
                      title={t("settings.externalSourceAuthKey")}
                      accent="emerald"
                    />
                  </div>
                </div>

                {externalSourceDraft.auth_type === "password" ? (
                  <div>
                    <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.externalSourcePassword")}</label>
                    <input
                      type="password"
                      value={externalSourceDraft.password || ""}
                      onChange={(e) => setExternalSourceDraft({ ...externalSourceDraft, password: e.target.value })}
                      placeholder={selectedExternalSource?.has_password ? t("settings.externalSourcePasswordPlaceholder") : ""}
                      className={inputClass}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.externalSourcePrivateKey")}</label>
                    <textarea
                      value={externalSourceDraft.private_key || ""}
                      onChange={(e) => setExternalSourceDraft({ ...externalSourceDraft, private_key: e.target.value })}
                      rows={6}
                      placeholder={selectedExternalSource?.has_private_key ? t("settings.externalSourcePrivateKeyPlaceholder") : ""}
                      className={monoTextareaClass}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.externalSourceKnownHostKey")}</label>
                  <textarea
                    value={externalSourceDraft.known_host_key}
                    onChange={(e) => setExternalSourceDraft({ ...externalSourceDraft, known_host_key: e.target.value })}
                    rows={3}
                    className={monoTextareaClass}
                  />
                  <p className="text-sm/6 text-gray-500 dark:text-gray-400">{t("settings.externalSourceKnownHostKeyHint")}</p>
                </div>

                <div className="border-t border-gray-200 pt-8 dark:border-white/10">
                  <ToggleRow
                    title={t("settings.externalSourceActive")}
                    description={t("settings.externalSourceActiveHint")}
                    checked={!!externalSourceDraft.is_active}
                    onToggle={() => setExternalSourceDraft({ ...externalSourceDraft, is_active: !externalSourceDraft.is_active })}
                    accent="emerald"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-8 dark:border-white/10">
                  <button onClick={fetchExternalSourceHostKey} disabled={!externalSourceDraft.host.trim() || !!externalSourceBusy} className={`${secondaryButtonClass} disabled:opacity-50`}>
                    {externalSourceBusy === "hostkey" ? t("settings.externalSourceFetchingHostKey") : t("settings.externalSourceFetchHostKey")}
                  </button>
                  <button onClick={testExternalSource} disabled={!!externalSourceBusy} className={`${secondaryButtonClass} disabled:opacity-50`}>
                    {externalSourceBusy === "test" ? t("settings.externalSourceTesting") : t("settings.externalSourceTestConnection")}
                  </button>
                  <button onClick={saveExternalSource} className={storagePrimaryButtonClass}>
                    {selectedExternalSourceId === "new" ? t("settings.createExternalSource") : t("common.save")}
                  </button>
                  {selectedExternalSource ? <button onClick={deleteExternalSource} className={dangerButtonClass}>{t("common.delete")}</button> : null}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
