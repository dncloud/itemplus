"use client";

import type { ExternalSource } from "@/lib/api";
import { CircleStackIcon } from "@heroicons/react/24/outline";
import type { ExternalSourceDraft } from "@/components/settings-drafts";
import { ChoiceTile, SettingsCard, StatusMessage, ToggleRow } from "@/components/settings-ui";

export function SettingsStorageSection({
  t,
  externalSources,
  selectedExternalSourceId,
  setSelectedExternalSourceId,
  externalSourceDraft,
  setExternalSourceDraft,
  selectedExternalSource,
  externalSourceStatus,
  externalSourceBusy,
  createNewExternalSource,
  fetchExternalSourceHostKey,
  testExternalSource,
  saveExternalSource,
  deleteExternalSource,
  inputClass,
  monoTextareaClass,
  primaryButtonClass,
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
  externalSourceStatus: string | null;
  externalSourceBusy: "hostkey" | "test" | null;
  createNewExternalSource: () => void;
  fetchExternalSourceHostKey: () => void;
  testExternalSource: () => void;
  saveExternalSource: () => void;
  deleteExternalSource: () => void;
  inputClass: string;
  monoTextareaClass: string;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  dangerButtonClass: string;
}) {
  return (
    <SettingsCard
      sectionId="storage"
      icon={CircleStackIcon}
      title={t("settings.externalSources")}
      description={t("settings.externalSourcesHint")}
      fullWidth
      actions={
        <button onClick={createNewExternalSource} className={secondaryButtonClass}>
          {t("settings.newExternalSource")}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {externalSources.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700">
              {t("settings.noExternalSources")}
            </div>
          ) : (
            externalSources.map((source) => (
              <button
                key={source.id}
                onClick={() => {
                  setSelectedExternalSourceId(source.id);
                }}
                className={`w-full rounded-lg border p-4 text-left transition ${selectedExternalSourceId === source.id ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200 dark:border-blue-600 dark:bg-blue-900/20 dark:ring-blue-900" : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{source.name}</div>
                    <div className="truncate text-xs text-gray-500">{source.username}@{source.host}:{source.port}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {source.is_active ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{t("settings.activeExternalSource")}</span> : null}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="space-y-6 border-t border-gray-200 pt-6 dark:border-gray-700">
          {selectedExternalSourceId === null && externalSources.length === 0 ? (
            <div className="text-sm text-gray-500">{t("settings.noExternalSources")}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

              <div className="space-y-3 border-t border-gray-200 pt-6 dark:border-gray-700">
                <label className="block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.externalSourceAuthType")}</label>
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  <ChoiceTile
                    active={externalSourceDraft.auth_type === "password"}
                    onClick={() => setExternalSourceDraft({ ...externalSourceDraft, auth_type: "password", private_key: "" })}
                    title={t("settings.externalSourceAuthPassword")}
                  />
                  <ChoiceTile
                    active={externalSourceDraft.auth_type === "ssh_key"}
                    onClick={() => setExternalSourceDraft({ ...externalSourceDraft, auth_type: "ssh_key", password: "" })}
                    title={t("settings.externalSourceAuthKey")}
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

              <div>
                <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.externalSourceKnownHostKey")}</label>
                <textarea
                  value={externalSourceDraft.known_host_key}
                  onChange={(e) => setExternalSourceDraft({ ...externalSourceDraft, known_host_key: e.target.value })}
                  rows={3}
                  className={monoTextareaClass}
                />
                <p className="mt-2 text-sm/6 text-gray-500 dark:text-gray-400">{t("settings.externalSourceKnownHostKeyHint")}</p>
              </div>

              <ToggleRow
                title={t("settings.externalSourceActive")}
                description={t("settings.externalSourceActiveHint")}
                checked={!!externalSourceDraft.is_active}
                onToggle={() => setExternalSourceDraft({ ...externalSourceDraft, is_active: !externalSourceDraft.is_active })}
              />

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={fetchExternalSourceHostKey} disabled={!externalSourceDraft.host.trim() || !!externalSourceBusy} className={`${secondaryButtonClass} disabled:opacity-50`}>
                  {externalSourceBusy === "hostkey" ? t("settings.externalSourceFetchingHostKey") : t("settings.externalSourceFetchHostKey")}
                </button>
                <button onClick={testExternalSource} disabled={!!externalSourceBusy} className={`${secondaryButtonClass} disabled:opacity-50`}>
                  {externalSourceBusy === "test" ? t("settings.externalSourceTesting") : t("settings.externalSourceTestConnection")}
                </button>
                <button onClick={saveExternalSource} className={primaryButtonClass}>
                  {selectedExternalSourceId === "new" ? t("settings.createExternalSource") : t("common.save")}
                </button>
                {selectedExternalSource ? <button onClick={deleteExternalSource} className={dangerButtonClass}>{t("common.delete")}</button> : null}
                {externalSourceStatus ? (
                  <StatusMessage tone={externalSourceStatus === t("settings.externalSourceSaved") || externalSourceStatus === t("settings.externalSourceDeleted") ? "success" : "error"}>
                    {externalSourceStatus}
                  </StatusMessage>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </SettingsCard>
  );
}
