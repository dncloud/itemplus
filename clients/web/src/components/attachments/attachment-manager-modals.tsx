"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Attachment, ExternalSource, ExternalSourceBrowseEntry } from "@/lib/api";
import { api } from "@/lib/api";
import { Check, ChevronRight, FileText, Folder, HardDrive, Image as ImageIcon, RefreshCw, Search, Upload, X } from "lucide-react";
import { cancelButtonClass, saveButtonClass } from "@/components/ui/list-controls";
import { attachmentFilename, fmtSize, IMAGE_EXTS } from "@/components/attachments/attachment-manager-utils";

const modalPanelClass =
  "w-full space-y-4 rounded-xl border border-gray-200 bg-white p-6 text-gray-900 shadow-2xl dark:border-[#374151] dark:bg-[#182131] dark:text-white";
const labelClass = "mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400";
const inputClass =
  "h-[38px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-[#374151] dark:bg-[#242d3c] dark:text-white dark:placeholder:text-gray-500";
const secondaryButtonClass =
  "rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-[#374151] dark:bg-[#242d3c] dark:text-gray-100 dark:hover:bg-[#2b3546]";
const primaryButtonClass =
  "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50";

export function EditAttachmentModal({
  attachment,
  t,
  onClose,
  onSave,
}: {
  attachment: Attachment;
  t: (k: string) => string;
  onClose: () => void;
  onSave: (data: Partial<Attachment>) => void;
}) {
  const [description, setDescription] = useState(attachment.description || "");
  const filename = attachmentFilename(attachment);
  const isImg = IMAGE_EXTS.test(filename);
  const [gallery, setGallery] = useState(!!attachment.gallery);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`${modalPanelClass} max-w-sm`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("common.edit")}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div>
          <label className={labelClass}>{t("attachments.description")}</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={filename}
            className={inputClass}
          />
        </div>
        {isImg ? (
          <label className="flex cursor-pointer items-center gap-3">
            <div className={`relative h-5 w-9 rounded-full transition ${gallery ? "bg-indigo-600 dark:bg-indigo-500" : "bg-gray-300 dark:bg-gray-600"}`}>
              <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${gallery ? "translate-x-4" : ""}`} />
            </div>
            <input type="checkbox" checked={gallery} onChange={(e) => setGallery(e.target.checked)} className="sr-only" />
            <span className="text-sm">{t("attachments.showInGallery")}</span>
          </label>
        ) : null}
        <div className="text-xs text-gray-400">
          {t("attachments.file")}: {filename || "—"} {attachment.size != null ? `(${fmtSize(attachment.size)})` : ""}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className={secondaryButtonClass}>{t("common.cancel")}</button>
          <button
            onClick={() => onSave({ description: description || undefined, ...(isImg ? { gallery } : {}) })}
            className={primaryButtonClass}
          >
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FileUploadModal({
  t,
  onClose,
  onUpload,
}: {
  t: (k: string) => string;
  onClose: () => void;
  onUpload: (file: File, description?: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className={`${modalPanelClass} max-w-sm`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("attachments.upload")}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div>
          <input ref={inputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-center transition hover:border-blue-400 hover:bg-white dark:border-[#374151] dark:bg-[#242d3c] dark:hover:border-blue-500 dark:hover:bg-[#2b3546]"
          >
            {file ? (
              <div className="text-sm">
                <p className="truncate font-medium">{file.name}</p>
                <p className="text-xs text-gray-400">{fmtSize(file.size)}</p>
              </div>
            ) : (
              <>
                <Upload className="mx-auto mb-1 h-6 w-6 text-gray-400" />
                <p className="text-xs text-gray-500">{t("attachments.selectFile")}</p>
              </>
            )}
          </button>
        </div>
        <div>
          <label className={labelClass}>{t("attachments.description")} ({t("common.optional")})</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("attachments.descriptionPlaceholder")}
            className={inputClass}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className={secondaryButtonClass}>{t("common.cancel")}</button>
          <button
            onClick={() => file && onUpload(file, description || undefined)}
            disabled={!file}
            className={primaryButtonClass}
          >
            {t("attachments.upload")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddLinkModal({
  t,
  onClose,
  onAdd,
}: {
  t: (k: string) => string;
  onClose: () => void;
  onAdd: (data: { url: string; filename?: string; description?: string }) => void;
}) {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`${modalPanelClass} max-w-sm`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("attachments.addLink")}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div>
          <label className={labelClass}>{t("attachments.linkUrl")} *</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className={inputClass}
            autoFocus
          />
        </div>
        <div>
          <label className={labelClass}>{t("attachments.linkDescription")}</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("attachments.linkPlaceholder")}
            className={inputClass}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className={secondaryButtonClass}>{t("common.cancel")}</button>
          <button
            onClick={() => url && onAdd({ url, description: description || undefined })}
            disabled={!url}
            className={primaryButtonClass}
          >
            {t("common.add")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddSFTPAttachmentModal({
  t,
  sources,
  onClose,
  onAdd,
}: {
  t: (k: string) => string;
  sources: ExternalSource[];
  onClose: () => void;
  onAdd: (data: { external_source_id: number; external_path: string; filename?: string; description?: string; gallery?: boolean }) => Promise<void>;
}) {
  return <AddExternalSourceAttachmentModal t={t} sources={sources} onClose={onClose} onAdd={onAdd} />;
}

function summarizeExternalSource(source: ExternalSource) {
  if (source.source_type === "filesystem") {
    return source.base_path || "/";
  }
  if (source.source_type === "smb") {
    const shareName = source.share_name?.trim() || "";
    const sharePath = shareName ? `/${shareName}` : "";
    const basePath = source.base_path?.trim() ? ` · ${source.base_path}` : "";
    return `${source.username}@${source.host}:${source.port}${sharePath}${basePath}`;
  }
  const basePath = source.base_path?.trim() ? ` · ${source.base_path}` : "";
  return `${source.username}@${source.host}:${source.port}${basePath}`;
}

/**
 * Picks a file from a storage source as an attachment. It works like a file
 * dialog: choose the source, walk through the folders, click a file. Name,
 * description and the gallery switch only appear once a file is chosen.
 */
export function AddExternalSourceAttachmentModal({
  t,
  sources,
  onClose,
  onAdd,
}: {
  t: (k: string) => string;
  sources: ExternalSource[];
  onClose: () => void;
  onAdd: (data: { external_source_id: number; external_path: string; filename?: string; description?: string; gallery?: boolean }) => Promise<void>;
}) {
  const [sourceId, setSourceId] = useState<number | null>(sources[0]?.id ?? null);
  const [externalPath, setExternalPath] = useState("");
  const [filename, setFilename] = useState("");
  const [description, setDescription] = useState("");
  const [gallery, setGallery] = useState(false);
  const [browseEntries, setBrowseEntries] = useState<ExternalSourceBrowseEntry[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [browseLoading, setBrowseLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [manualPath, setManualPath] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadBrowse = useCallback(async (nextSourceId: number, nextPath = "") => {
    setError(null);
    setBrowseLoading(true);
    setFilter("");
    try {
      const result = await api.browseAttachmentExternalSource(nextSourceId, nextPath);
      setBrowseEntries(result.entries);
      setCurrentPath(result.current_path || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("attachments.sftpBrowseFailed"));
      setBrowseEntries([]);
      setCurrentPath(nextPath);
    } finally {
      setBrowseLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!sourceId) return;
    void loadBrowse(sourceId, "");
  }, [sourceId, loadBrowse]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const choose = (entry: ExternalSourceBrowseEntry) => {
    setError(null);
    if (entry.is_dir) {
      void loadBrowse(sourceId!, entry.path);
      return;
    }
    setExternalPath(entry.path);
    setFilename(entry.name);
    setGallery(IMAGE_EXTS.test(entry.name));
  };

  const submit = async () => {
    if (!sourceId || !externalPath.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await onAdd({
        external_source_id: sourceId,
        external_path: externalPath.trim(),
        filename: filename.trim() || undefined,
        description: description || undefined,
        gallery,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("attachments.sftpAddFailed"));
    } finally {
      setSaving(false);
    }
  };

  // Folders first, then files, each by name; names starting with a dot stay
  // out unless asked for, and the filter narrows what is left.
  const needle = filter.trim().toLowerCase();
  const hiddenCount = browseEntries.filter((entry) => entry.name.startsWith(".")).length;
  const shownEntries = browseEntries
    .filter((entry) => (showHidden || !entry.name.startsWith(".")) && (!needle || entry.name.toLowerCase().includes(needle)))
    .sort((a, b) => Number(b.is_dir) - Number(a.is_dir) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

  const segments = currentPath.split("/").filter(Boolean);
  const selectedIsImage = IMAGE_EXTS.test(externalPath);
  const currentSource = sources.find((source) => source.id === sourceId);
  const toolButtonClass =
    "inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("attachments.addSftp")}
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white text-gray-900 shadow-2xl outline-1 outline-black/5 dark:bg-gray-800 dark:text-white dark:-outline-offset-1 dark:outline-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-white/10">
          <h2 className="text-base font-semibold">{t("attachments.addSftp")}</h2>
          <button type="button" onClick={onClose} title={t("common.close")} aria-label={t("common.close")} className={toolButtonClass}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {sources.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">{t("attachments.noSftpSources")}</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {sources.length > 1 ? (
              <div role="tablist" aria-label={t("attachments.sftpSource")} className="flex flex-wrap gap-2 border-b border-gray-200 px-5 py-3 dark:border-white/10">
                {sources.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    role="tab"
                    aria-selected={sourceId === source.id}
                    title={summarizeExternalSource(source)}
                    onClick={() => {
                      setSourceId(source.id);
                      setExternalPath("");
                      setFilename("");
                    }}
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      sourceId === source.id
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                  >
                    <HardDrive aria-hidden="true" className="h-4 w-4" />
                    {source.name}
                  </button>
                ))}
              </div>
            ) : null}

            {/* Where you are, as a path you can click back along. */}
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-5 py-2.5 dark:border-white/10 dark:bg-white/2.5">
              <nav aria-label={t("attachments.sftpPath")} className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm">
                <button
                  type="button"
                  onClick={() => sourceId && loadBrowse(sourceId, "")}
                  className={`rounded px-1.5 py-0.5 font-medium hover:bg-gray-200 dark:hover:bg-white/10 ${segments.length === 0 ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
                >
                  {currentSource?.name || "/"}
                </button>
                {segments.map((segment, index) => (
                  <span key={`${segment}-${index}`} className="flex items-center gap-1">
                    <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-gray-400" />
                    <button
                      type="button"
                      onClick={() => sourceId && loadBrowse(sourceId, segments.slice(0, index + 1).join("/"))}
                      className={`rounded px-1.5 py-0.5 font-medium hover:bg-gray-200 dark:hover:bg-white/10 ${index === segments.length - 1 ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
                    >
                      {segment}
                    </button>
                  </span>
                ))}
              </nav>
              <div className="grid w-48 max-w-full grid-cols-1">
                <input
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder={t("attachments.browseFilter")}
                  aria-label={t("attachments.browseFilter")}
                  className="col-start-1 row-start-1 block w-full rounded-md bg-white py-1 pr-2 pl-8 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                />
                <Search aria-hidden="true" className="pointer-events-none col-start-1 row-start-1 ml-2.5 size-4 self-center text-gray-400" />
              </div>
              <button type="button" onClick={() => sourceId && loadBrowse(sourceId, currentPath)} disabled={!sourceId || browseLoading} title={t("common.refresh")} aria-label={t("common.refresh")} className={toolButtonClass}>
                <RefreshCw className={`h-4 w-4 ${browseLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="h-72 overflow-y-auto">
              {browseLoading ? (
                <p className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">{t("attachments.sftpLoading")}</p>
              ) : shownEntries.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">{needle ? t("attachments.browseNoMatch") : t("attachments.sftpEmpty")}</p>
              ) : (
                <ul role="list" className="divide-y divide-gray-100 dark:divide-white/5">
                  {shownEntries.map((entry) => {
                    const selected = !entry.is_dir && externalPath.trim() === entry.path;
                    const Icon = entry.is_dir ? Folder : IMAGE_EXTS.test(entry.name) ? ImageIcon : FileText;
                    return (
                      <li key={`${entry.path}:${entry.is_dir ? "d" : "f"}`}>
                        <button
                          type="button"
                          onClick={() => choose(entry)}
                          aria-pressed={entry.is_dir ? undefined : selected}
                          className={`flex w-full items-center gap-3 px-5 py-2 text-left text-sm transition ${selected ? "bg-indigo-50 dark:bg-indigo-500/10" : "hover:bg-gray-50 dark:hover:bg-white/5"}`}
                        >
                          <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${entry.is_dir ? "text-indigo-500 dark:text-indigo-400" : "text-gray-400"}`} />
                          <span className={`min-w-0 flex-1 truncate ${selected ? "font-semibold text-indigo-700 dark:text-indigo-300" : entry.is_dir ? "font-medium" : ""}`}>{entry.name}</span>
                          <span className="hidden shrink-0 text-xs text-gray-400 sm:inline">
                            {entry.modified_at ? new Date(entry.modified_at).toLocaleDateString() : ""}
                          </span>
                          <span className="w-20 shrink-0 text-right text-xs text-gray-400">
                            {entry.is_dir ? t("attachments.sftpFolder") : fmtSize(entry.size)}
                          </span>
                          {entry.is_dir ? <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" /> : <Check aria-hidden="true" className={`h-4 w-4 shrink-0 ${selected ? "text-indigo-600 dark:text-indigo-400" : "invisible"}`} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-gray-200 px-5 py-2 text-xs text-gray-500 dark:border-white/10 dark:text-gray-400">
              {hiddenCount > 0 ? (
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} className="accent-indigo-600" />
                  {t("attachments.browseShowHidden")} ({hiddenCount})
                </label>
              ) : <span />}
              <button type="button" onClick={() => setManualPath(!manualPath)} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                {t("attachments.browseManualPath")}
              </button>
            </div>

            <div className="space-y-4 border-t border-gray-200 px-5 py-4 dark:border-white/10">
              {manualPath ? (
                <div>
                  <label className={labelClass}>{t("attachments.sftpPath")}</label>
                  <input
                    value={externalPath}
                    onChange={(e) => {
                      setExternalPath(e.target.value);
                      setError(null);
                    }}
                    placeholder="photos/box-12/front.jpg"
                    className={inputClass}
                  />
                </div>
              ) : null}

              {externalPath.trim() ? (
                <>
                  {!manualPath ? (
                    <p className="flex items-center gap-2 text-sm">
                      <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                      <span className="min-w-0 truncate font-medium">{externalPath}</span>
                    </p>
                  ) : null}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>{t("attachments.fileName")} ({t("common.optional")})</label>
                      <input
                        value={filename}
                        onChange={(e) => {
                          setFilename(e.target.value);
                          setError(null);
                        }}
                        placeholder={t("attachments.sftpFilenamePlaceholder")}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t("attachments.linkDescription")} ({t("common.optional")})</label>
                      <input
                        value={description}
                        onChange={(e) => {
                          setDescription(e.target.value);
                          setError(null);
                        }}
                        placeholder={t("attachments.linkPlaceholder")}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  {selectedIsImage ? (
                    <label className="flex cursor-pointer items-center gap-3">
                      <div className={`relative h-5 w-9 rounded-full transition ${gallery ? "bg-indigo-600 dark:bg-indigo-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                        <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${gallery ? "translate-x-4" : ""}`} />
                      </div>
                      <input type="checkbox" checked={gallery} onChange={(e) => setGallery(e.target.checked)} className="sr-only" />
                      <span className="text-sm">{t("attachments.showInGallery")}</span>
                    </label>
                  ) : null}
                </>
              ) : !manualPath ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("attachments.browsePickHint")}</p>
              ) : null}
            </div>
          </div>
        )}

        <div className="space-y-2 border-t border-gray-200 px-5 py-4 dark:border-white/10">
          {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className={cancelButtonClass}>{t("common.cancel")}</button>
            <button
              type="button"
              onClick={submit}
              disabled={!sourceId || !externalPath.trim() || sources.length === 0 || saving}
              className={`disabled:cursor-not-allowed disabled:opacity-50 ${saveButtonClass}`}
            >
              {saving ? t("attachments.uploading") : t("common.add")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
