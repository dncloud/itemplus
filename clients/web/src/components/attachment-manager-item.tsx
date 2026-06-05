"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Bars3Icon,
  DocumentIcon,
  MusicalNoteIcon,
  PencilIcon,
  PhotoIcon,
  TrashIcon,
  VideoCameraIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { HLSPlayer } from "@/components/hls-player";
import { MarkdownView } from "@/components/markdown";
import type { Attachment } from "@/lib/api";
import { isSafeUrl } from "@/lib/api";
import {
  attachmentExternalURL,
  attachmentFilename,
  attType,
  fmtSize,
  IMAGE_EXTS,
  TYPE_STYLES,
} from "@/components/attachment-manager-utils";
import {
  classifyAttachmentPreview,
  formatMediaDuration,
  loadAttachmentTextPreview,
} from "@/components/attachment-manager-preview";

export function SortableAttachment({
  attachment: att,
  url,
  t,
  onEdit,
  onDelete,
  pendingDelete = false,
  readOnly = false,
}: {
  attachment: Attachment;
  url: string;
  t: (key: string) => string;
  onEdit: () => void;
  onDelete: () => void;
  pendingDelete?: boolean;
  readOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: att.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const type = attType(att);
  const { icon: Icon, bg, color, label } = TYPE_STYLES[type];
  const filename = attachmentFilename(att);
  const externalURL = attachmentExternalURL(att);
  const isExternal = !!externalURL || att.storage_backend === "external_sftp";
  const isRemoteLink = att.storage_backend === "external_url" || !!externalURL;
  const displayName = att.description || filename || externalURL.split("/").pop()?.split("?")[0] || "Datei";
  const fileUrl = externalURL || url;
  const fn = String(filename || externalURL || "").toLowerCase();
  const isImgFile = IMAGE_EXTS.test(fn);
  const preview = classifyAttachmentPreview(fn, isImgFile);
  const isHLS = preview.kind === "hls";
  const isVideo = preview.kind === "video" || isHLS;
  const isAudio = preview.kind === "audio";
  const isPDF = preview.kind === "pdf";
  const isMarkdown = preview.kind === "markdown";
  const isText = preview.kind === "text";
  const isSVG = preview.kind === "svg";
  const isPreviewable = preview.isPreviewable;
  const [showPlayer, setShowPlayer] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [mediaMeta, setMediaMeta] = useState<Record<string, string> | null>(null);

  return (
    <div ref={setNodeRef} style={style} className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-gray-800/50 dark:hover:bg-white/2.5">
      <div className="flex items-center gap-2 px-4 py-4">
        {!readOnly ? (
          <button {...attributes} {...listeners} className="cursor-grab p-0.5 active:cursor-grabbing">
            <Bars3Icon className="h-3.5 w-3.5 text-gray-400" />
          </button>
        ) : null}
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg outline -outline-offset-1 outline-white/10 ${bg}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <a
          href={isSafeUrl(url) ? url : "#"}
          target="_blank"
          rel="noopener noreferrer"
          download={!isExternal ? filename || undefined : undefined}
          className="min-w-0 flex-1"
        >
          <div className="truncate text-sm font-semibold text-gray-900 hover:underline dark:text-white">
            {displayName}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{label}</span>
            {att.size != null ? <span>· {fmtSize(att.size)}</span> : null}
            {isExternal ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium dark:bg-white/5">extern</span> : null}
            {!isExternal && filename && att.description ? <span>· {filename}</span> : null}
          </div>
        </a>
        {isPreviewable ? (
          <button
            onClick={() => {
              const next = !showPlayer;
              setShowPlayer(next);
              if (!next) setMediaMeta(null);
              if (next && (isText || isMarkdown) && textContent === null && !textLoading) {
                setTextLoading(true);
                loadAttachmentTextPreview(fileUrl)
                  .then((text) => setTextContent(text))
                  .catch(() => setTextContent("Fehler beim Laden"))
                  .finally(() => setTextLoading(false));
              }
            }}
            className={`inline-flex items-center justify-center rounded-lg border p-2 text-sm transition-colors ${showPlayer ? "border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400" : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"}`}
            title={showPlayer ? "Vorschau schließen" : "Vorschau"}
          >
            {showPlayer ? <XMarkIcon className="h-4 w-4" /> : isImgFile ? <PhotoIcon className="h-4 w-4" /> : isAudio ? <MusicalNoteIcon className="h-4 w-4" /> : (isVideo || isHLS) ? <VideoCameraIcon className="h-4 w-4" /> : <DocumentIcon className="h-4 w-4" />}
          </button>
        ) : null}
        {!readOnly ? (
          <>
            <button onClick={onEdit} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              <PencilIcon className="h-4 w-4 text-gray-400" />
            </button>
            <button
              onClick={onDelete}
              disabled={pendingDelete}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {pendingDelete ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
              ) : (
                <TrashIcon className="h-4 w-4 text-red-400" />
              )}
            </button>
          </>
        ) : null}
      </div>

      {isPreviewable && showPlayer ? (
        <div className="border-t border-gray-100 dark:border-white/10">
          <div className={
            isAudio ? "bg-gray-50 p-3 dark:bg-gray-800/50"
            : isPDF ? ""
            : (isText || isMarkdown) ? "bg-gray-50 p-4 dark:bg-gray-800/50"
            : isImgFile ? "flex justify-center bg-gray-50 p-4 dark:bg-gray-800/50"
            : isSVG ? "flex items-center justify-center bg-white p-4 dark:bg-gray-800"
            : "bg-black"
          }>
            {isHLS ? (
              <HLSPlayer src={fileUrl} className="w-full" />
            ) : isImgFile ? (
              <img
                src={fileUrl}
                alt={filename || ""}
                className="max-h-[500px] max-w-full rounded-lg"
                onLoad={(event) => {
                  const img = event.currentTarget;
                  setMediaMeta({ "Auflösung": `${img.naturalWidth} × ${img.naturalHeight} px` });
                }}
              />
            ) : isAudio ? (
              <audio
                controls
                src={fileUrl}
                className="w-full"
                onLoadedMetadata={(event) => {
                  const audio = event.currentTarget;
                  const duration = formatMediaDuration(audio.duration);
                  if (duration) {
                    setMediaMeta({ "Dauer": duration });
                  }
                }}
              />
            ) : isPDF ? (
              isRemoteLink ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 bg-gray-50 px-6 py-10 text-center dark:bg-gray-800/50">
                  <DocumentIcon className="h-10 w-10 text-gray-400" />
                  <p className="max-w-md text-sm text-gray-500">{t("attachments.externalPreviewBlocked")}</p>
                  <a
                    href={isSafeUrl(fileUrl) ? fileUrl : "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
                  >
                    {t("common.open")}
                  </a>
                </div>
              ) : (
                <iframe src={fileUrl} className="w-full border-0" style={{ height: "600px" }} />
              )
            ) : isSVG ? (
              <img src={fileUrl} alt={filename || "SVG"} className="max-h-[500px] max-w-full" />
            ) : isMarkdown ? (
              textLoading ? (
                <p className="text-xs text-gray-400">Laden…</p>
              ) : textContent != null ? (
                <div className="max-h-[500px] overflow-auto">
                  <MarkdownView content={textContent} />
                </div>
              ) : null
            ) : isText ? (
              textLoading ? (
                <p className="text-xs text-gray-400">Laden…</p>
              ) : textContent != null ? (
                <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-gray-700 dark:text-gray-300">{textContent}</pre>
              ) : null
            ) : (
              <video
                controls
                playsInline
                src={fileUrl}
                className="w-full"
                style={{ maxHeight: "500px" }}
                onLoadedMetadata={(event) => {
                  const video = event.currentTarget;
                  const meta: Record<string, string> = {};
                  if (video.videoWidth > 0) meta["Auflösung"] = `${video.videoWidth} × ${video.videoHeight} px`;
                  const duration = formatMediaDuration(video.duration);
                  if (duration) meta["Dauer"] = duration;
                  if (Object.keys(meta).length > 0) setMediaMeta(meta);
                }}
              />
            )}
          </div>
          {mediaMeta && Object.keys(mediaMeta).length > 0 ? (
            <div className="flex items-center gap-4 border-t border-gray-100 bg-gray-50 px-3 py-1.5 text-[11px] text-gray-400 dark:border-white/10 dark:bg-gray-800/50">
              {Object.entries(mediaMeta).map(([key, value]) => (
                <span key={key}>{key}: <span className="text-gray-600 dark:text-gray-300">{value}</span></span>
              ))}
              {att.size != null ? <span>Größe: <span className="text-gray-600 dark:text-gray-300">{fmtSize(att.size)}</span></span> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
