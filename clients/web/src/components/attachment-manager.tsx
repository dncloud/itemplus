"use client";

import { useCallback, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import { api, isSafeUrl, type Attachment } from "@/lib/api";
import { HLSPlayer } from "@/components/hls-player";
import { MarkdownView } from "@/components/markdown";
// note: t() is used inside the AttachmentManager component below
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowUpTrayIcon,
  XMarkIcon,
  TrashIcon,
  LinkIcon,
  PhotoIcon,
  DocumentIcon,
  ArchiveBoxIcon,
  CodeBracketIcon,
  VideoCameraIcon,
  MusicalNoteIcon,
  PencilIcon,
  StarIcon,
  Bars3Icon,
} from "@heroicons/react/24/outline";
import { useDeleteFlow, ConfirmDelete } from "@/components/confirm-delete";

function fmtSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|svg|bmp|heic|heif|avif|tiff?)$/i;

// Modern + retro archive formats (Amiga, Atari, classic Mac, DOS, etc.)
const ARCHIVE_EXTS = /\.(zip|tar|gz|tgz|bz2|tbz|xz|txz|rar|7z|arj|lha|lzh|ace|sit|sea|hqx|cab|dms|msa|adf|adz|st|stx|d64|d81|t64|nrg|iso|img|cue|bin)$/i;

const CODE_EXTS = /\.(py|swift|js|jsx|ts|tsx|rs|go|java|kt|kts|cpp|cc|cxx|c|h|hpp|cs|rb|php|lua|sh|zsh|bash|fish|pl|pm|r|sql|html?|css|scss|sass|less|xml|yaml|yml|toml|ini|conf|cfg|json|jsonl|md|markdown|tex|m|mm|asm|s|vb|fs|ex|exs|erl|hrl|clj|cljs|hs|elm|dart|svelte|vue|astro|gradle|cmake|dockerfile|makefile|txt|log|env)$/i;

const VIDEO_EXTS = /\.(mp4|mov|avi|mkv|webm|flv|wmv|m4v|mpg|mpeg|3gp)$/i;
const AUDIO_EXTS = /\.(mp3|wav|flac|ogg|m4a|aac|wma|opus|aiff?|mid|midi|mod|s3m|xm|it)$/i;
function detectType(filename: string): string {
  if (IMAGE_EXTS.test(filename)) return "image";
  if (ARCHIVE_EXTS.test(filename)) return "archive";
  if (CODE_EXTS.test(filename)) return "code";
  if (VIDEO_EXTS.test(filename)) return "video";
  if (AUDIO_EXTS.test(filename)) return "audio";
  return "document";
}

/** Gallery images are shown in the hero/gallery section. Non-gallery images go to the file list. */
function isGalleryImage(att: Attachment): boolean {
  return !!att.gallery && IMAGE_EXTS.test(att.filename || "");
}

function attType(att: Attachment): "image" | "archive" | "code" | "video" | "audio" | "link" | "document" {
  if (att.attachment_type === "link") return "link";
  if (!att.filename) {
    const t = att.attachment_type;
    if (t === "image" || t === "archive") return t;
    return "document";
  }
  if (IMAGE_EXTS.test(att.filename)) return "image";
  if (ARCHIVE_EXTS.test(att.filename)) return "archive";
  if (CODE_EXTS.test(att.filename)) return "code";
  if (VIDEO_EXTS.test(att.filename)) return "video";
  if (AUDIO_EXTS.test(att.filename)) return "audio";
  return "document";
}

export default function AttachmentManager({ itemId, attachments, onChange, readOnly = false }: {
  itemId: number;
  attachments: Attachment[];
  onChange: () => void;
  readOnly?: boolean;
}) {
  const { realm, serverURL, t } = useApp();
  const galleryInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editAtt, setEditAtt] = useState<Attachment | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const deleteFlow = useDeleteFlow({
    realm,
    onDeleted: useCallback(() => {
      onChange();
    }, [onChange]),
  });

  const sorted = [...attachments].sort((a, b) => a.order - b.order || a.id - b.id);
  const images = sorted.filter(isGalleryImage);
  const others = sorted.filter((a) => !isGalleryImage(a));
  const hero = images[0];

  const attachmentUrl = (att: Attachment) =>
    att.url || `${serverURL}/uploads/${att.file_path}`;

  const [uploadProgress, setUploadProgress] = useState<number | null>(null); // 0-100
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);
  const [uploadSpeed, setUploadSpeed] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB

  const upload = (file: File, options?: { gallery?: boolean; description?: string }) => {
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`Datei zu groß (max ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB)`);
      return;
    }
    setUploadError(null);
    setUploading(true);
    setUploadProgress(0);
    setUploadSpeed(null);
    setShowFileUpload(false);

    setUploadInfo(`${file.name} (${fmtSize(file.size)})`);

    const type = detectType(file.name);
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    form.append("order", String(attachments.length));
    if (options?.gallery) form.append("gallery", "true");
    if (options?.description) form.append("description", options.description);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${api.baseURL}/api/${api.realm}/items/${itemId}/attachments`);
    xhr.withCredentials = true;

    const startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(pct);

        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        if (elapsed >= 0.5) {
          const bytes = e.loaded - lastLoaded;
          const speed = bytes / elapsed;
          lastLoaded = e.loaded;
          lastTime = now;

          setUploadSpeed(`${fmtSize(speed)}/s`);
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onChange();
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          setUploadError(err.detail || `Upload fehlgeschlagen (${xhr.status})`);
        } catch {
          setUploadError(`Upload fehlgeschlagen (${xhr.status})`);
        }
      }
      setUploading(false);
      setUploadProgress(null);
      setUploadInfo(null);
      setUploadSpeed(null);
    };

    xhr.onerror = () => {
      setUploadError("Verbindungsfehler beim Upload");
      setUploading(false);
      setUploadProgress(null);
      setUploadInfo(null);
      setUploadSpeed(null);
    };

    xhr.send(form);
  };

  const remove = (id: number) => {
    const att = sorted.find((a) => a.id === id);
    deleteFlow.requestDelete(id, att?.filename || att?.description || `#${id}`, "attachment");
  };

  const setAsHero = async (att: Attachment) => {
    if (!isGalleryImage(att)) return;
    // Make this the first image — set order to lowest
    const minOrder = Math.min(...images.map((i) => i.order)) - 1;
    await api.updateAttachment(att.id, { order: minOrder });
    onChange();
  };

  const updateMeta = async (att: Attachment, data: Partial<Attachment>) => {
    await api.updateAttachment(att.id, data);
    setEditAtt(null);
    onChange();
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sorted.findIndex((a) => a.id === active.id);
    const newIdx = sorted.findIndex((a) => a.id === over.id);
    const reordered = arrayMove(sorted, oldIdx, newIdx);
    // Update all orders
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].order !== i) {
        await api.updateAttachment(reordered[i].id, { order: i });
      }
    }
    onChange();
  };

  return (
    <>
      {/* Hero + Gallery */}
      {images.length > 0 && (
        <div className="space-y-3">
          <div className="group relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
            <a href={attachmentUrl(hero)} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
              <img src={attachmentUrl(hero)} alt={hero.description || hero.filename} className="w-full h-full object-cover" />
            </a>
            {hero.description && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent text-white text-sm p-3 pointer-events-none">
                {hero.description}
              </div>
            )}
            {!readOnly && (
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => setEditAtt(hero)} className="p-1.5 bg-black/50 rounded-full">
                  <PencilIcon className="h-4 w-4 text-white" />
                </button>
                <button onClick={() => remove(hero.id)} className="p-1.5 bg-black/50 rounded-full">
                  <XMarkIcon className="h-4 w-4 text-white" />
                </button>
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {images.slice(1).map((att) => (
                <div key={att.id} className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                  <a href={attachmentUrl(att)} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                    <img src={attachmentUrl(att)} alt={att.description || att.filename} className="w-full h-full object-cover" />
                  </a>
                  {!readOnly && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1 pointer-events-none">
                      <button onClick={() => setAsHero(att)} title={t("attachments.setAsMain")} className="p-1.5 bg-white/20 rounded-full pointer-events-auto">
                        <StarIcon className="h-3.5 w-3.5 text-white" />
                      </button>
                      <button onClick={() => setEditAtt(att)} className="p-1.5 bg-white/20 rounded-full pointer-events-auto">
                        <PencilIcon className="h-3.5 w-3.5 text-white" />
                      </button>
                      <button onClick={() => remove(att.id)} className="p-1.5 bg-white/20 rounded-full pointer-events-auto">
                        <XMarkIcon className="h-3.5 w-3.5 text-white" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload area */}
      {!readOnly && (
        <>
          {/* Upload progress bar */}
          {uploading && uploadProgress != null && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 truncate">{uploadInfo}</span>
                <span className="text-blue-500 font-medium shrink-0 ml-2">{uploadProgress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
              {uploadSpeed && <p className="text-[10px] text-gray-400 text-right">{uploadSpeed}</p>}
            </div>
          )}
          {/* Three buttons */}
          {!uploading && (
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setShowFileUpload(true)}
                className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-4 text-center hover:border-blue-400 transition"
              >
                <ArrowUpTrayIcon className="h-6 w-6 mx-auto text-gray-400 mb-1" />
                <p className="text-xs text-gray-500">{t("attachments.upload")}</p>
              </button>
              <button
                onClick={() => galleryInput.current?.click()}
                className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-4 text-center hover:border-blue-400 transition"
              >
                <input ref={galleryInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                  const files = e.target.files;
                  if (files) { for (const f of files) upload(f, { gallery: true }); }
                  e.target.value = "";
                }} />
                <PhotoIcon className="h-6 w-6 mx-auto text-gray-400 mb-1" />
                <p className="text-xs text-gray-500">{t("attachments.uploadImages")}</p>
              </button>
              <button
                onClick={() => setShowLinkModal(true)}
                className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-4 text-center hover:border-blue-400 transition"
              >
                <LinkIcon className="h-6 w-6 mx-auto text-gray-400 mb-1" />
                <p className="text-xs text-gray-500">{t("attachments.addLink")}</p>
              </button>
            </div>
          )}
        </>
      )}
      {uploadError && (
        <p className="text-xs text-red-500 px-1">{uploadError}</p>
      )}

      {/* File / link list with DnD */}
      {others.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase">{t("attachments.title")}</h3>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={others.map((a) => a.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {others.map((att) => (
                  <SortableAttachment
                    key={att.id}
                    attachment={att}
                    url={attachmentUrl(att)}
                    onEdit={() => setEditAtt(att)}
                    onDelete={() => remove(att.id)}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Edit modal */}
      {editAtt && (
        <EditModal
          attachment={editAtt}
          t={t}
          onClose={() => setEditAtt(null)}
          onSave={(data) => updateMeta(editAtt, data)}
        />
      )}

      {/* File upload modal with description */}
      {showFileUpload && (
        <FileUploadModal
          t={t}
          onClose={() => setShowFileUpload(false)}
          onUpload={(file, description) => upload(file, { gallery: false, description })}
        />
      )}

      {/* Add link modal */}
      {showLinkModal && (
        <AddLinkModal
          t={t}
          onClose={() => setShowLinkModal(false)}
          onAdd={async (data) => {
            await api.addLinkAttachment(itemId, { ...data, order: attachments.length });
            setShowLinkModal(false);
            onChange();
          }}
        />
      )}

      {/* Confirm Delete */}
      {deleteFlow.confirm && (
        <ConfirmDelete
          name={deleteFlow.confirm.name}
          t={t}
          onConfirm={async () => {
            await api.deleteAttachment(deleteFlow.confirm!.id);
            deleteFlow.cancelConfirm();
            onChange();
          }}
          onCancel={() => deleteFlow.cancelConfirm()}
        />
      )}
    </>
  );
}

const TYPE_STYLES: Record<string, { icon: React.ElementType; bg: string; color: string; label: string }> = {
  link:     { icon: LinkIcon,         bg: "bg-blue-100 dark:bg-blue-900/20",     color: "text-blue-500",   label: "Link" },
  archive:  { icon: ArchiveBoxIcon,   bg: "bg-amber-100 dark:bg-amber-900/20",   color: "text-amber-500",  label: "Archive" },
  code:     { icon: CodeBracketIcon,  bg: "bg-purple-100 dark:bg-purple-900/20", color: "text-purple-500", label: "Code" },
  video:    { icon: VideoCameraIcon,  bg: "bg-pink-100 dark:bg-pink-900/20",     color: "text-pink-500",   label: "Video" },
  audio:    { icon: MusicalNoteIcon,  bg: "bg-green-100 dark:bg-green-900/20",   color: "text-green-500",  label: "Audio" },
  document: { icon: DocumentIcon,     bg: "bg-gray-100 dark:bg-gray-800",        color: "text-gray-400",   label: "Datei" },
  image:    { icon: PhotoIcon,        bg: "bg-gray-100 dark:bg-gray-800",        color: "text-gray-400",   label: "Bild" },
};

function SortableAttachment({ attachment: att, url, onEdit, onDelete, readOnly = false }: {
  attachment: Attachment; url: string; onEdit: () => void; onDelete: () => void; readOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: att.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const type = attType(att);
  const { icon: Icon, bg, color, label } = TYPE_STYLES[type];
  const isExternal = !!att.url;
  const displayName = att.description || att.filename || att.url?.split("/").pop()?.split("?")[0] || "Datei";
  const fileUrl = att.url || url;
  const fn = (att.filename || att.url || "").toLowerCase();
  const isHLS = fn.endsWith(".m3u8");
  const isVideo = isHLS || /\.(mp4|mov|webm|m4v|ogv)$/.test(fn);
  const isAudio = /\.(mp3|wav|flac|ogg|m4a|aac|wma|opus|aiff?)$/.test(fn);
  const isImgFile = IMAGE_EXTS.test(fn);
  const isPDF = fn.endsWith(".pdf");
  const isMarkdown = fn.endsWith(".md");
  const isText = /\.(txt|log|csv|json|xml|yaml|yml|ini|conf|cfg|env|sh|bash|py|js|ts|go|rs|c|cpp|h|java|sql|html?|css)$/.test(fn);
  const isSVG = fn.endsWith(".svg");
  const isPreviewable = isVideo || isAudio || isImgFile || isPDF || isMarkdown || isText || isSVG;
  const [showPlayer, setShowPlayer] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [mediaMeta, setMediaMeta] = useState<Record<string, string> | null>(null);

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        {!readOnly && (
          <button {...attributes} {...listeners} className="p-0.5 cursor-grab active:cursor-grabbing">
            <Bars3Icon className="h-3.5 w-3.5 text-gray-400" />
          </button>
        )}
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${bg}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <a
          href={isSafeUrl(url) ? url : "#"}
          target="_blank"
          rel="noopener noreferrer"
          download={!isExternal ? att.filename : undefined}
          className="flex-1 min-w-0"
        >
          <div className="text-sm font-medium text-blue-600 hover:underline truncate">
            {displayName}
          </div>
          <div className="text-xs text-gray-400 flex items-center gap-2">
            <span>{label}</span>
            {att.size != null && <span>· {fmtSize(att.size)}</span>}
            {isExternal && <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-medium">extern</span>}
            {!isExternal && att.filename && att.description && <span>· {att.filename}</span>}
          </div>
        </a>
        {isPreviewable && (
          <button
            onClick={() => {
              const next = !showPlayer;
              setShowPlayer(next);
              if (!next) setMediaMeta(null);
              if (next && (isText || isMarkdown) && textContent === null && !textLoading) {
                setTextLoading(true);
                fetch(fileUrl)
                  .then((r) => r.text())
                  .then((t) => setTextContent(t))
                  .catch(() => setTextContent("Fehler beim Laden"))
                  .finally(() => setTextLoading(false));
              }
            }}
            className={`p-1.5 rounded transition ${showPlayer ? "bg-blue-100 dark:bg-blue-900/20 text-blue-500" : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"}`}
            title={showPlayer ? "Vorschau schließen" : "Vorschau"}
          >
            {showPlayer ? <XMarkIcon className="h-4 w-4" /> : isImgFile ? <PhotoIcon className="h-4 w-4" /> : isAudio ? <MusicalNoteIcon className="h-4 w-4" /> : (isVideo || isHLS) ? <VideoCameraIcon className="h-4 w-4" /> : <DocumentIcon className="h-4 w-4" />}
          </button>
        )}
        {!readOnly && (
          <>
            <button onClick={onEdit} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <PencilIcon className="h-4 w-4 text-gray-400" />
            </button>
            <button onClick={onDelete} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
              <TrashIcon className="h-4 w-4 text-red-400" />
            </button>
          </>
        )}
      </div>
      {/* Media Player / Preview */}
      {isPreviewable && showPlayer && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          {/* Preview content */}
          <div className={
            isAudio ? "p-3 bg-gray-50 dark:bg-gray-800/50"
            : isPDF ? ""
            : (isText || isMarkdown) ? "p-4 bg-gray-50 dark:bg-gray-800/50"
            : isImgFile ? "bg-gray-50 dark:bg-gray-800/50 p-4 flex justify-center"
            : isSVG ? "p-4 bg-white dark:bg-gray-800 flex items-center justify-center"
            : "bg-black"
          }>
            {isHLS ? (
              <HLSPlayer src={fileUrl} className="w-full" />
            ) : isImgFile ? (
              <img
                src={fileUrl}
                alt={att.filename || ""}
                className="max-w-full max-h-[500px] rounded-lg"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setMediaMeta({ "Auflösung": `${img.naturalWidth} × ${img.naturalHeight} px` });
                }}
              />
            ) : isAudio ? (
              <audio
                controls
                src={fileUrl}
                className="w-full"
                onLoadedMetadata={(e) => {
                  const a = e.currentTarget;
                  const dur = a.duration;
                  if (dur && isFinite(dur)) {
                    const m = Math.floor(dur / 60);
                    const s = Math.floor(dur % 60);
                    setMediaMeta({ "Dauer": `${m}:${s.toString().padStart(2, "0")}` });
                  }
                }}
              />
            ) : isPDF ? (
              <iframe src={fileUrl} className="w-full border-0" style={{ height: "600px" }} />
            ) : isSVG ? (
              <img src={fileUrl} alt={att.filename || "SVG"} className="max-w-full max-h-[500px]" />
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
                <pre className="text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap break-words max-h-[500px] overflow-auto">{textContent}</pre>
              ) : null
            ) : (
              <video
                controls
                playsInline
                src={fileUrl}
                className="w-full"
                style={{ maxHeight: "500px" }}
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  const dur = v.duration;
                  const meta: Record<string, string> = {};
                  if (v.videoWidth > 0) meta["Auflösung"] = `${v.videoWidth} × ${v.videoHeight} px`;
                  if (dur && isFinite(dur)) {
                    const m = Math.floor(dur / 60);
                    const s = Math.floor(dur % 60);
                    meta["Dauer"] = `${m}:${s.toString().padStart(2, "0")}`;
                  }
                  if (Object.keys(meta).length > 0) setMediaMeta(meta);
                }}
              />
            )}
          </div>
          {/* Metadata bar */}
          {mediaMeta && Object.keys(mediaMeta).length > 0 && (
            <div className="flex items-center gap-4 px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-400">
              {Object.entries(mediaMeta).map(([k, v]) => (
                <span key={k}>{k}: <span className="text-gray-600 dark:text-gray-300">{v}</span></span>
              ))}
              {att.size != null && <span>Größe: <span className="text-gray-600 dark:text-gray-300">{fmtSize(att.size)}</span></span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditModal({ attachment, t, onClose, onSave }: {
  attachment: Attachment; t: (k: string) => string; onClose: () => void; onSave: (data: Partial<Attachment>) => void;
}) {
  const [description, setDescription] = useState(attachment.description || "");
  const [order, setOrder] = useState(attachment.order);
  const isImg = IMAGE_EXTS.test(attachment.filename || "");
  const [gallery, setGallery] = useState(!!attachment.gallery);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("common.edit")}</h2>
          <button onClick={onClose}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t("attachments.description")}</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={attachment.filename}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {isImg && (
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`relative w-9 h-5 rounded-full transition ${gallery ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}>
              <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${gallery ? "translate-x-4" : ""}`} />
            </div>
            <input type="checkbox" checked={gallery} onChange={(e) => setGallery(e.target.checked)} className="sr-only" />
            <span className="text-sm">{t("attachments.showInGallery")}</span>
          </label>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t("attachments.order")}</label>
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="text-xs text-gray-400">
          {t("attachments.file")}: {attachment.filename || "—"} {attachment.size != null && `(${fmtSize(attachment.size)})`}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">{t("common.cancel")}</button>
          <button onClick={() => onSave({ description: description || undefined, order, ...(isImg ? { gallery } : {}) })} className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600">
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function FileUploadModal({ t, onClose, onUpload }: {
  t: (k: string) => string;
  onClose: () => void;
  onUpload: (file: File, description?: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("attachments.upload")}</h2>
          <button onClick={onClose}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div>
          <input ref={inputRef} type="file" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); }} />
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 p-4 text-center hover:border-blue-400 transition"
          >
            {file ? (
              <div className="text-sm">
                <p className="font-medium truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{fmtSize(file.size)}</p>
              </div>
            ) : (
              <>
                <ArrowUpTrayIcon className="h-6 w-6 mx-auto text-gray-400 mb-1" />
                <p className="text-xs text-gray-500">{t("attachments.selectFile")}</p>
              </>
            )}
          </button>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t("attachments.description")} ({t("common.optional")})</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("attachments.descriptionPlaceholder")}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">{t("common.cancel")}</button>
          <button
            onClick={() => file && onUpload(file, description || undefined)}
            disabled={!file}
            className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            {t("attachments.upload")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddLinkModal({ t, onClose, onAdd }: {
  t: (k: string) => string;
  onClose: () => void;
  onAdd: (data: { url: string; filename?: string; description?: string }) => void;
}) {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("attachments.addLink")}</h2>
          <button onClick={onClose}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t("attachments.linkUrl")} *</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t("attachments.linkDescription")}</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("attachments.linkPlaceholder")}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">{t("common.cancel")}</button>
          <button
            onClick={() => url && onAdd({ url, description: description || undefined })}
            disabled={!url}
            className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            {t("common.add")}
          </button>
        </div>
      </div>
    </div>
  );
}
