"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Attachment, ExternalSource, ExternalSourceBrowseEntry } from "@/lib/api";
import { api } from "@/lib/api";
import { ArrowLeftIcon, ArrowUpTrayIcon, DocumentIcon, FolderIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { attachmentFilename, fmtSize, IMAGE_EXTS } from "@/components/attachment-manager-utils";

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
  const [order, setOrder] = useState(attachment.order);
  const filename = attachmentFilename(attachment);
  const isImg = IMAGE_EXTS.test(filename);
  const [gallery, setGallery] = useState(!!attachment.gallery);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("common.edit")}</h2>
          <button onClick={onClose}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t("attachments.description")}</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={filename}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
        {isImg ? (
          <label className="flex cursor-pointer items-center gap-3">
            <div className={`relative h-5 w-9 rounded-full transition ${gallery ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}>
              <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${gallery ? "translate-x-4" : ""}`} />
            </div>
            <input type="checkbox" checked={gallery} onChange={(e) => setGallery(e.target.checked)} className="sr-only" />
            <span className="text-sm">{t("attachments.showInGallery")}</span>
          </label>
        ) : null}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t("attachments.order")}</label>
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
        <div className="text-xs text-gray-400">
          {t("attachments.file")}: {filename || "—"} {attachment.size != null ? `(${fmtSize(attachment.size)})` : ""}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">{t("common.cancel")}</button>
          <button
            onClick={() => onSave({ description: description || undefined, order, ...(isImg ? { gallery } : {}) })}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
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
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("attachments.upload")}</h2>
          <button onClick={onClose}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div>
          <input ref={inputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 p-4 text-center transition hover:border-blue-400 dark:border-gray-700"
          >
            {file ? (
              <div className="text-sm">
                <p className="truncate font-medium">{file.name}</p>
                <p className="text-xs text-gray-400">{fmtSize(file.size)}</p>
              </div>
            ) : (
              <>
                <ArrowUpTrayIcon className="mx-auto mb-1 h-6 w-6 text-gray-400" />
                <p className="text-xs text-gray-500">{t("attachments.selectFile")}</p>
              </>
            )}
          </button>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t("attachments.description")} ({t("common.optional")})</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("attachments.descriptionPlaceholder")}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">{t("common.cancel")}</button>
          <button
            onClick={() => file && onUpload(file, description || undefined)}
            disabled={!file}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
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
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("attachments.addLink")}</h2>
          <button onClick={onClose}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t("attachments.linkUrl")} *</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t("attachments.linkDescription")}</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("attachments.linkPlaceholder")}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">{t("common.cancel")}</button>
          <button
            onClick={() => url && onAdd({ url, description: description || undefined })}
            disabled={!url}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
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
  const [sourceId, setSourceId] = useState<number | null>(sources[0]?.id ?? null);
  const [externalPath, setExternalPath] = useState("");
  const [filename, setFilename] = useState("");
  const [description, setDescription] = useState("");
  const [gallery, setGallery] = useState(false);
  const [browseEntries, setBrowseEntries] = useState<ExternalSourceBrowseEntry[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [parentPath, setParentPath] = useState("");
  const [browseLoading, setBrowseLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadBrowse = useCallback(async (nextSourceId: number, nextPath = "") => {
    setError(null);
    setBrowseLoading(true);
    try {
      const result = await api.browseAttachmentExternalSource(nextSourceId, nextPath);
      setBrowseEntries(result.entries);
      setCurrentPath(result.current_path || "");
      setParentPath(result.parent_path || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("attachments.sftpBrowseFailed"));
      setBrowseEntries([]);
      setCurrentPath(nextPath);
      setParentPath("");
    } finally {
      setBrowseLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!sourceId) return;
    void loadBrowse(sourceId, "");
  }, [sourceId, loadBrowse]);

  const selectBrowseEntry = (entry: ExternalSourceBrowseEntry) => {
    setError(null);
    if (entry.is_dir) {
      void loadBrowse(sourceId!, entry.path);
      return;
    }
    setExternalPath(entry.path);
    if (!filename.trim()) setFilename(entry.name);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("attachments.addSftp")}</h2>
          <button onClick={onClose}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
        </div>

        {sources.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700">
            {t("attachments.noSftpSources")}
          </div>
        ) : (
          <>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-500">{t("attachments.sftpSource")} *</label>
              <div className="space-y-2">
                {sources.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => {
                      setSourceId(source.id);
                      setExternalPath("");
                      setFilename("");
                    }}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition ${sourceId === source.id ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"}`}
                  >
                    <div className="text-sm font-medium">{source.name}</div>
                    <div className="text-xs text-gray-500">{source.username}@{source.host}:{source.port} · {source.base_path}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t("attachments.sftpPath")} *</label>
              <input
                value={externalPath}
                onChange={(e) => {
                  setExternalPath(e.target.value);
                  setError(null);
                }}
                placeholder="photos/box-12/front.jpg"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
                autoFocus
              />
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500">{t("attachments.sftpBrowser")}</p>
                  <p className="truncate text-xs text-gray-400">{currentPath ? `/${currentPath}` : "/"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => sourceId && loadBrowse(sourceId, parentPath)}
                    disabled={!sourceId || (!currentPath && !parentPath) || browseLoading}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-white disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    <ArrowLeftIcon className="h-3.5 w-3.5" />
                    {t("common.back")}
                  </button>
                  <button
                    type="button"
                    onClick={() => sourceId && loadBrowse(sourceId, currentPath)}
                    disabled={!sourceId || browseLoading}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-white disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    {browseLoading ? t("attachments.sftpLoading") : t("common.refresh")}
                  </button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto bg-white dark:bg-gray-900/30">
                {browseLoading ? (
                  <div className="px-3 py-8 text-center text-sm text-gray-500">{t("attachments.sftpLoading")}</div>
                ) : browseEntries.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-gray-500">{t("attachments.sftpEmpty")}</div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {browseEntries.map((entry) => (
                      <button
                        key={`${entry.path}:${entry.is_dir ? "d" : "f"}`}
                        type="button"
                        onClick={() => selectBrowseEntry(entry)}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800/60 ${!entry.is_dir && externalPath.trim() === entry.path ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {entry.is_dir ? <FolderIcon className="h-4 w-4 shrink-0 text-blue-500" /> : <DocumentIcon className="h-4 w-4 shrink-0 text-gray-400" />}
                          <div className="min-w-0">
                            <p className="truncate text-sm">{entry.name}</p>
                            <p className="truncate text-[11px] text-gray-400">{entry.path}</p>
                          </div>
                        </div>
                        <div className="shrink-0 text-[11px] text-gray-400">
                          {entry.is_dir ? t("attachments.sftpFolder") : fmtSize(entry.size)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t("attachments.fileName")} ({t("common.optional")})</label>
              <input
                value={filename}
                onChange={(e) => {
                  setFilename(e.target.value);
                  setError(null);
                }}
                placeholder={t("attachments.sftpFilenamePlaceholder")}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t("attachments.linkDescription")}</label>
              <input
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setError(null);
                }}
                placeholder={t("attachments.linkPlaceholder")}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-3">
              <div className={`relative h-5 w-9 rounded-full transition ${gallery ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${gallery ? "translate-x-4" : ""}`} />
              </div>
              <input type="checkbox" checked={gallery} onChange={(e) => setGallery(e.target.checked)} className="sr-only" />
              <span className="text-sm">{t("attachments.showInGallery")}</span>
            </label>
          </>
        )}

        <div className="space-y-2 pt-2">
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">{t("common.cancel")}</button>
            <button
              onClick={submit}
              disabled={!sourceId || !externalPath.trim() || sources.length === 0 || saving}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? t("attachments.uploading") : t("common.add")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
