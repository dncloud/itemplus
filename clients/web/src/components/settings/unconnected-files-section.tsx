"use client";

import { useCallback, useEffect, useState } from "react";
import { FileQuestion, RefreshCw, Trash2 } from "lucide-react";
import { api, type UnconnectedFile } from "@/lib/api";
import { useApp } from "@/lib/app-context";

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|bmp|avif)$/i;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Admin view of uploaded files that no existing item uses any more, for
 * example the attachments of deleted items. Nothing is removed automatically;
 * the administrator selects what to delete.
 */
export function SettingsUnconnectedFilesSection({ t, secondaryButtonClass, dangerButtonClass }: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  secondaryButtonClass: string;
  dangerButtonClass: string;
}) {
  const { fmtDateTime } = useApp();
  const [files, setFiles] = useState<UnconnectedFile[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await api.getUnconnectedFiles();
      setFiles(result.files);
      setTotalSize(result.total_size);
      setSelected((current) => new Set(result.files.map((file) => file.path).filter((path) => current.has(path))));
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.getUnconnectedFiles().then((result) => {
      if (!active) return;
      setFiles(result.files);
      setTotalSize(result.total_size);
      setState("ready");
    }).catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, []);

  const toggle = (path: string) => {
    setConfirming(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };
  const allSelected = files.length > 0 && selected.size === files.length;
  const toggleAll = () => {
    setConfirming(false);
    setSelected(allSelected ? new Set() : new Set(files.map((file) => file.path)));
  };

  const deleteSelected = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await api.deleteUnconnectedFiles([...selected]);
      setMessage(result.skipped.length > 0
        ? t("settings.unconnectedFilesDeletedSkipped", { deleted: result.deleted.length, skipped: result.skipped.length })
        : t("settings.unconnectedFilesDeleted", { count: result.deleted.length }));
      setSelected(new Set());
      await load();
    } catch {
      setMessage(t("settings.unconnectedFilesDeleteFailed"));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const selectedSize = files.filter((file) => selected.has(file.path)).reduce((sum, file) => sum + file.size, 0);

  return (
    <section id="unconnected-files" className="mt-10 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[16rem_minmax(0,1fr)]">
      <div>
        <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">{t("settings.unconnectedFiles")}</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("settings.unconnectedFilesHint")}</p>
      </div>

      <div className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
        <div className="space-y-5 px-4 py-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {state === "ready" ? t("settings.unconnectedFilesSummary", { count: files.length, size: formatSize(totalSize) }) : null}
              {state === "loading" ? t("common.loading") : null}
              {state === "error" ? <span className="text-rose-600 dark:text-rose-400">{t("settings.unconnectedFilesLoadFailed")}</span> : null}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => { setState("loading"); void load(); }} disabled={busy} className={secondaryButtonClass}>
                <RefreshCw className="h-4 w-4" />
                {t("common.refresh")}
              </button>
              {confirming ? (
                <>
                  <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={secondaryButtonClass}>{t("common.cancel")}</button>
                  <button type="button" onClick={() => void deleteSelected()} disabled={busy} className={dangerButtonClass}>
                    <Trash2 className="h-4 w-4" />
                    {busy ? t("common.loading") : t("settings.unconnectedFilesConfirm", { count: selected.size, size: formatSize(selectedSize) })}
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirming(true)} disabled={selected.size === 0 || busy} className={`${dangerButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}>
                  <Trash2 className="h-4 w-4" />
                  {t("settings.unconnectedFilesDelete", { count: selected.size })}
                </button>
              )}
            </div>
          </div>

          {message ? <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p> : null}

          {state === "ready" && files.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-6 text-sm text-gray-500 dark:bg-white/5 dark:text-gray-400">
              <FileQuestion className="h-5 w-5 shrink-0" />
              {t("settings.unconnectedFilesEmpty")}
            </div>
          ) : null}

          {files.length > 0 ? (
            <div className="overflow-x-auto rounded-lg outline outline-1 -outline-offset-1 outline-gray-200 dark:outline-white/10">
              <table className="w-full min-w-[40rem] table-fixed divide-y divide-gray-200 text-[13px] dark:divide-white/10">
                <thead className="bg-gray-50 dark:bg-white/5">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label={t("settings.unconnectedFilesSelectAll")} className="h-4 w-4 rounded border-gray-300 dark:border-white/20" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("settings.unconnectedFilesFile")}</th>
                    <th className="w-44 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("settings.unconnectedFilesOrigin")}</th>
                    <th className="w-24 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("settings.unconnectedFilesSize")}</th>
                    <th className="w-40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("settings.unconnectedFilesModified")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {files.map((file) => {
                    const storedName = file.path.split("/").pop() || file.path;
                    const href = `/uploads/${file.path.split("/").map(encodeURIComponent).join("/")}`;
                    return (
                      <tr key={file.path} className={selected.has(file.path) ? "bg-rose-50/60 dark:bg-rose-500/10" : undefined}>
                        <td className="px-4 py-3 align-top">
                          <input type="checkbox" checked={selected.has(file.path)} onChange={() => toggle(file.path)} aria-label={file.original_name || storedName} className="h-4 w-4 rounded border-gray-300 dark:border-white/20" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {IMAGE_EXTENSIONS.test(file.path) ? (
                              <img src={href} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-md bg-gray-100 object-cover dark:bg-white/10" />
                            ) : (
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-400 dark:bg-white/10"><FileQuestion className="h-5 w-5" /></span>
                            )}
                            <div className="min-w-0">
                              <a href={href} target="_blank" rel="noopener noreferrer" title={file.original_name || storedName} className="block truncate font-medium text-gray-900 hover:underline dark:text-white">
                                {file.original_name || storedName}
                              </a>
                              <span title={file.path} className="block truncate font-mono text-[11px] text-gray-400">{file.path}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-gray-600 dark:text-gray-300">
                          {file.reason === "item_deleted"
                            ? t("settings.unconnectedFilesReasonDeleted", { realm: t(`realm.${file.realm}`), id: file.item_id })
                            : t("settings.unconnectedFilesReasonUnreferenced", { realm: t(`realm.${file.realm}`), id: file.item_id })}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right align-top tabular-nums text-gray-600 dark:text-gray-300">{formatSize(file.size)}</td>
                        <td className="whitespace-nowrap px-4 py-3 align-top text-gray-600 dark:text-gray-300">{fmtDateTime(file.modified_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
