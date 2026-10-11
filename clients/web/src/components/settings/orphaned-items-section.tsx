"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleCheck, RefreshCw, Unlink } from "lucide-react";
import { api, type OrphanAssignment, type OrphanGroup } from "@/lib/api";
import { SelectField } from "@/components/settings/ui";

type Translate = (key: string, vars?: Record<string, string | number>) => string;
type Target = { id: number; name: string };

const groupKey = (group: OrphanGroup) => `${group.realm}:${group.kind}:${group.ref_id ?? "none"}`;

/**
 * Admin view of items whose category is missing, or whose category or
 * location was deleted by an older version. Nothing is repaired
 * automatically: the administrator restores what was deleted or moves the
 * items to something that exists. An item is never left without a category.
 */
export function SettingsOrphanedItemsSection({ t, inputClass, primaryButtonClass, secondaryButtonClass, dangerButtonClass }: {
  t: Translate;
  inputClass: string;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  dangerButtonClass: string;
}) {
  const [groups, setGroups] = useState<OrphanGroup[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const load = useCallback(async () => {
    try {
      setGroups((await api.getOrphanedItems()).groups);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.getOrphanedItems()
      .then((result) => {
        if (!active) return;
        setGroups(result.groups);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const total = groups.reduce((sum, group) => sum + group.item_count, 0);

  return (
    <section id="orphaned-items" className="mt-10 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[16rem_minmax(0,1fr)]">
      <div>
        <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">{t("settings.orphans")}</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("settings.orphansHint")}</p>
      </div>

      <div className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
        <div className="space-y-5 px-4 py-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {state === "ready" && total > 0 ? t("settings.orphansSummary", { count: total }) : null}
              {state === "loading" ? t("common.loading") : null}
              {state === "error" ? <span className="text-rose-600 dark:text-rose-400">{t("settings.orphansLoadFailed")}</span> : null}
            </p>
            <button type="button" onClick={() => { setState("loading"); setMessage(null); void load(); }} className={secondaryButtonClass}>
              <RefreshCw className="h-4 w-4" />
              {t("common.refresh")}
            </button>
          </div>

          {message ? (
            <p role="status" className={message.tone === "error" ? "text-sm text-rose-600 dark:text-rose-400" : "text-sm text-gray-600 dark:text-gray-300"}>{message.text}</p>
          ) : null}

          {state === "ready" && groups.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-6 text-sm text-gray-500 dark:bg-white/5 dark:text-gray-400">
              <CircleCheck className="h-5 w-5 shrink-0 text-green-500 dark:text-green-400" />
              {t("settings.orphansEmpty")}
            </div>
          ) : null}

          {groups.map((group) => (
            <OrphanGroupCard
              key={groupKey(group)}
              group={group}
              t={t}
              inputClass={inputClass}
              primaryButtonClass={primaryButtonClass}
              secondaryButtonClass={secondaryButtonClass}
              dangerButtonClass={dangerButtonClass}
              onDone={(text) => {
                setMessage({ text, tone: "ok" });
                void load();
              }}
              onFailed={() => setMessage({ text: t("settings.orphansFailed"), tone: "error" })}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function OrphanGroupCard({ group, t, inputClass, primaryButtonClass, secondaryButtonClass, dangerButtonClass, onDone, onFailed }: {
  group: OrphanGroup;
  t: Translate;
  inputClass: string;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  dangerButtonClass: string;
  onDone: (message: string) => void;
  onFailed: () => void;
}) {
  const isLocation = group.kind === "location_deleted";
  const canRestore = group.kind !== "category_missing" && group.ref_id !== null;
  const [name, setName] = useState(() =>
    t(isLocation ? "settings.orphansRestoredLocationName" : "settings.orphansRestoredCategoryName", { id: group.ref_id ?? 0 }));
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetId, setTargetId] = useState(0);
  const [preview, setPreview] = useState<OrphanAssignment | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (isLocation ? api.getLocationsOf(group.realm) : api.getCategoriesOf(group.realm))
      .then((list) => {
        if (active) setTargets(list.map((entry) => ({ id: entry.id, name: entry.name })).sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [group.realm, isLocation]);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    try {
      onDone(await action());
    } catch {
      onFailed();
    } finally {
      setBusy(false);
    }
  };

  const title =
    group.kind === "category_missing"
      ? t("settings.orphansKindCategoryMissing")
      : t(isLocation ? "settings.orphansKindLocationDeleted" : "settings.orphansKindCategoryDeleted", { id: group.ref_id ?? 0 });
  const hidden = group.item_count - group.items.length;

  return (
    <div className="rounded-lg outline outline-1 -outline-offset-1 outline-gray-200 dark:outline-white/10">
      <div className="flex items-start gap-3 border-b border-gray-200 bg-gray-50 px-4 py-4 sm:rounded-t-lg dark:border-white/10 dark:bg-white/5">
        <Unlink className="mt-0.5 h-5 w-5 shrink-0 text-amber-500 dark:text-amber-400" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t(`realm.${group.realm}`)} · {title}
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium">{t("settings.orphansItems", { count: group.item_count })}:</span>{" "}
            {group.items.map((item) => item.name).join(", ")}
            {hidden > 0 ? ` ${t("settings.orphansMore", { count: hidden })}` : ""}
          </p>
          {group.properties > 0 ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("settings.orphansProperties", { count: group.properties })}</p> : null}
          {group.profile_key ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("settings.orphansProfile", { profile: group.profile_key })}</p> : null}
        </div>
      </div>

      <div className={canRestore ? "grid grid-cols-1 divide-y divide-gray-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0 dark:divide-white/10" : ""}>
        {canRestore ? (
          <div className="space-y-3 px-4 py-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{t("settings.orphansRestoreTitle")}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t(isLocation ? "settings.orphansRestoreHintLocation" : "settings.orphansRestoreHintCategory")}</p>
            <div>
              <label htmlFor={`orphan-name-${groupKey(group)}`} className="block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.orphansRestoreName")}</label>
              <input id={`orphan-name-${groupKey(group)}`} value={name} onChange={(event) => setName(event.target.value)} className={`mt-2 ${inputClass}`} />
            </div>
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={() => void run(async () => {
                await api.restoreOrphanTarget(group, name.trim());
                return t("settings.orphansRestored");
              })}
              className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {t("settings.orphansRestore")}
            </button>
          </div>
        ) : null}

        <div className="space-y-3 px-4 py-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{t("settings.orphansAssignTitle")}</h4>
          <SelectField
            label={t(isLocation ? "settings.orphansAssignTargetLocation" : "settings.orphansAssignTargetCategory")}
            value={targetId}
            onChange={(value) => {
              setTargetId(Number(value) || 0);
              setPreview(null);
            }}
            options={[{ value: 0, label: t("settings.orphansAssignChoose") }, ...targets.map((target) => ({ value: target.id, label: target.name }))]}
          />
          {preview ? (
            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
              <p>{t("settings.orphansPreviewItems", { count: preview.items })}</p>
              {preview.values_moved > 0 ? <p>{t("settings.orphansPreviewMoved", { count: preview.values_moved })}</p> : null}
              {preview.values_dropped > 0 ? (
                <p className="font-medium text-rose-600 dark:text-rose-400">
                  {t("settings.orphansPreviewDropped", { count: preview.values_dropped, properties: preview.dropped_properties.join(", ") })}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {/* The first click only says what would happen; nothing is moved before that was shown. */}
            {preview ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(async () => {
                  const result = await api.assignOrphans(group, targetId, false);
                  return t("settings.orphansAssigned", { count: result.items });
                })}
                className={`${preview.values_dropped > 0 ? dangerButtonClass : primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {t("settings.orphansAssignConfirm", { count: preview.items })}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || targetId === 0}
                onClick={async () => {
                  setBusy(true);
                  try {
                    setPreview(await api.assignOrphans(group, targetId, true));
                  } catch {
                    onFailed();
                  } finally {
                    setBusy(false);
                  }
                }}
                className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {t("settings.orphansAssignCheck")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
