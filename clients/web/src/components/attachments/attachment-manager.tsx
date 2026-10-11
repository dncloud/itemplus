"use client";

import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import { api, type Attachment, type ExternalSource } from "@/lib/api";
import {
  attachmentUrl,
  isImageAttachment,
  isGalleryImage,
} from "@/components/attachments/attachment-manager-utils";
import {
  formatAttachmentTooLargeError,
  formatAttachmentUploadInfo,
  MAX_ATTACHMENT_FILE_SIZE,
  uploadAttachmentWithProgress,
} from "@/components/attachments/attachment-manager-upload";
import {
  buildAttachmentDeleteName,
  orderAfterDrag,
  setAttachmentAsHeroImage,
  updateAttachmentMetadata,
} from "@/components/attachments/attachment-manager-actions";
import {
  activeAttachmentExternalSources,
  addExternalAttachmentAndRefresh,
  addLinkAttachmentAndRefresh,
  loadAttachmentExternalSources,
} from "@/components/attachments/attachment-manager-handlers";
import { AttachmentUploadActions, AttachmentUploadProgress } from "@/components/attachments/attachment-manager-view";
import {
  AddLinkModal,
  AddExternalSourceAttachmentModal,
  EditAttachmentModal,
  FileUploadModal,
} from "@/components/attachments/attachment-manager-modals";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Star,
  X,
} from "lucide-react";
import { useDeleteFlow, ConfirmDelete } from "@/components/ui/confirm-delete";
import { SortableAttachment, SortableImageTile } from "@/components/attachments/attachment-manager-item";

export default function AttachmentManager({ itemId, attachments, onChange, readOnly = false, showUploadActions, showGallery = true, showFiles = true, galleryPresentation = "standard", galleryPart = "all", compact = false }: {
  itemId: number;
  attachments: Attachment[];
  onChange: () => void;
  readOnly?: boolean;
  showUploadActions?: boolean;
  showGallery?: boolean;
  showFiles?: boolean;
  galleryPresentation?: "standard" | "catalog-cover";
  // Everything, only the main picture, or only the pictures after it
  // (collapsed to one row until asked for). A catalog cover is shown whole;
  // an ordinary photo fills its frame.
  galleryPart?: "all" | "cover" | "rest";
  // Takes less room, for use inside a form: no large main picture, every
  // picture a tile shown whole, and the upload actions as plain buttons.
  compact?: boolean;
}) {
  const { realm, serverURL, t } = useApp();
  const allowUploadActions = showUploadActions ?? !readOnly;
  const galleryInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editAtt, setEditAtt] = useState<Attachment | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showExternalSourceModal, setShowExternalSourceModal] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [externalSources, setExternalSources] = useState<ExternalSource[]>([]);
  const [previewImage, setPreviewImage] = useState<Attachment | null>(null);
  const [galleryExpanded, setGalleryExpanded] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const deleteFlow = useDeleteFlow({
    realm,
    onDeleted: useCallback(() => {
      onChange();
    }, [onChange]),
  });

  // The order just arranged by dragging, shown until the server's answer is
  // loaded; it belongs to the list it was made from and ends with it.
  const [arranged, setArranged] = useState<{ of: Attachment[]; ids: number[] } | null>(null);
  const arrangedIds = arranged?.of === attachments ? arranged.ids : null;
  const place = (attachment: Attachment) => (arrangedIds ? arrangedIds.indexOf(attachment.id) : attachment.order);
  const sorted = [...attachments].sort((a, b) => place(a) - place(b) || a.id - b.id);
  const images = sorted.filter(galleryPresentation === "catalog-cover" ? isImageAttachment : isGalleryImage);
  if (galleryPresentation === "catalog-cover") {
    const isScreenshot = (attachment: Attachment) => /screenshot|bildschirmfoto|bildschirmaufnahme|in[ -]?game|gameplay/i.test(`${attachment.description || ""} ${attachment.filename}`);
    images.sort((left, right) => Number(isScreenshot(left)) - Number(isScreenshot(right)));
  }
  const others = sorted.filter((attachment) => !images.includes(attachment));
  const listedAttachments = others;
  const hero = images[0];
  const previewIndex = previewImage ? images.findIndex((attachment) => attachment.id === previewImage.id) : -1;
  const showPreviousImage = () => {
    if (previewIndex < 0) return;
    setPreviewImage(images[(previewIndex - 1 + images.length) % images.length]);
  };
  const showNextImage = () => {
    if (previewIndex < 0) return;
    setPreviewImage(images[(previewIndex + 1) % images.length]);
  };
  const pendingDeleteAttachmentId = deleteFlow.pending?.type === "attachment" ? deleteFlow.pending.id : null;

  useEffect(() => {
    loadAttachmentExternalSources().then(setExternalSources);
  }, []);

  useEffect(() => {
    if (!previewImage) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewImage(null);
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      if (previewIndex < 0) return;
      const step = event.key === "ArrowLeft" ? -1 : 1;
      setPreviewImage(images[(previewIndex + step + images.length) % images.length]);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewImage, previewIndex, images]);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null); // 0-100
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);
  const [uploadSpeed, setUploadSpeed] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const resetUploadState = useCallback(() => {
    setUploading(false);
    setUploadProgress(null);
    setUploadInfo(null);
    setUploadSpeed(null);
  }, []);

  const upload = (file: File, options?: { gallery?: boolean; description?: string }) => {
    if (file.size > MAX_ATTACHMENT_FILE_SIZE) {
      setUploadError(formatAttachmentTooLargeError(MAX_ATTACHMENT_FILE_SIZE));
      return;
    }
    setUploadError(null);
    setUploading(true);
    setUploadProgress(0);
    setUploadSpeed(null);
    setShowFileUpload(false);
    setUploadInfo(formatAttachmentUploadInfo(file));

    uploadAttachmentWithProgress(itemId, file, attachments.length, options, {
      onProgress: (progress, speed) => {
        setUploadProgress(progress);
        if (speed) setUploadSpeed(speed);
      },
      onSuccess: () => {
        onChange();
      },
      onError: (message) => {
        setUploadError(message);
      },
      onComplete: resetUploadState,
    });
  };

  const remove = (id: number) => {
    const att = sorted.find((a) => a.id === id);
    deleteFlow.requestDelete(id, buildAttachmentDeleteName(att, id), "attachment");
  };

  const setAsHero = async (att: Attachment) => {
    await setAttachmentAsHeroImage(itemId, att);
    onChange();
  };

  const updateMeta = async (att: Attachment, data: Partial<Attachment>) => {
    await updateAttachmentMetadata(att, data);
    setEditAtt(null);
    onChange();
  };

  // Images and files are dragged within their own group; the images stand
  // before the files in the stored order.
  const storeOrder = async (nextImages: Attachment[], nextOthers: Attachment[]) => {
    const ids = [...nextImages, ...nextOthers].map((attachment) => attachment.id);
    setArranged({ of: attachments, ids });
    try {
      await api.reorderAttachments(itemId, ids);
    } catch {
      setArranged(null);
    }
    onChange();
  };
  const onDragEnd = (event: DragEndEvent) => {
    const next = orderAfterDrag(event, others);
    if (next) void storeOrder(images, next);
  };
  const onImageDragEnd = (event: DragEndEvent) => {
    const next = orderAfterDrag(event, images);
    if (next) void storeOrder(next, others);
  };

  return (
    <>
      {/* Hero + Gallery */}
      {showGallery && images.length > 0 && (
        galleryPart === "cover" ? (
          <div className={clsx("group relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800", galleryPresentation === "catalog-cover" ? "aspect-[3/4]" : "aspect-[4/3]")}>
            <button type="button" onClick={() => setPreviewImage(hero)} className="block h-full w-full" aria-label={hero.description || hero.filename}>
              <img src={attachmentUrl(hero, serverURL)} alt={hero.description || hero.filename} className={clsx("h-full w-full", galleryPresentation === "catalog-cover" ? "object-contain" : "object-cover")} />
            </button>
            {hero.description ? <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-md bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">{hero.description}</div> : null}
          </div>
        ) : galleryPart === "rest" ? (
          images.length > 1 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {(galleryExpanded ? images.slice(1) : images.slice(1, 6)).map((att) => (
                  <div key={att.id} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                    <button type="button" onClick={() => setPreviewImage(att)} className="block h-full w-full" aria-label={att.description || att.filename}>
                      <img src={attachmentUrl(att, serverURL)} alt={att.description || att.filename} loading="lazy" className={clsx("h-full w-full", galleryPresentation === "catalog-cover" ? "object-contain" : "object-cover")} />
                    </button>
                    {att.description ? <div className="pointer-events-none absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-md bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">{att.description}</div> : null}
                  </div>
                ))}
              </div>
              {images.length > 6 ? (
                <button
                  type="button"
                  onClick={() => setGalleryExpanded(!galleryExpanded)}
                  className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-1 -outline-offset-1 outline-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:outline-gray-700 dark:hover:bg-white/20"
                >
                  {galleryExpanded ? t("attachments.showFewerImages") : t("attachments.showAllImages", { count: images.length })}
                </button>
              ) : null}
            </div>
          ) : null
        ) : galleryPresentation === "catalog-cover" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
              <button type="button" onClick={() => setPreviewImage(hero)} className="block h-full w-full" aria-label={hero.description || hero.filename}>
                <img src={attachmentUrl(hero, serverURL)} alt={hero.description || hero.filename} className="h-full w-full object-contain" />
              </button>
              {hero.description ? <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-md bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">{hero.description}</div> : null}
            </div>
            {images.length > 1 ? (
              <div className="grid grid-cols-2 grid-rows-2 gap-3">
                {images.slice(1, 5).map((att) => (
                  <div key={att.id} className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                    <button type="button" onClick={() => setPreviewImage(att)} className="block h-full w-full" aria-label={att.description || att.filename}>
                      <img src={attachmentUrl(att, serverURL)} alt={att.description || att.filename} className="h-full w-full object-contain" />
                    </button>
                    {att.description ? <div className="pointer-events-none absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-md bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">{att.description}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}
            {images.length > 5 ? (
              <div className="col-span-full grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {images.slice(5).map((att) => (
                  <div key={att.id} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                    <button type="button" onClick={() => setPreviewImage(att)} className="block h-full w-full" aria-label={att.description || att.filename}>
                      <img src={attachmentUrl(att, serverURL)} alt={att.description || att.filename} loading="lazy" className="h-full w-full object-contain" />
                    </button>
                    {att.description ? <div className="pointer-events-none absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-md bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">{att.description}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
        <div className="space-y-3">
          <div className={clsx("group relative w-full aspect-[16/9] overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800", compact && "hidden")}>
            <a href={attachmentUrl(hero, serverURL)} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
              <img src={attachmentUrl(hero, serverURL)} alt={hero.description || hero.filename} className="h-full w-full object-cover" />
            </a>
            {hero.description && (
              <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-5rem)] rounded-md bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {hero.description}
              </div>
            )}
            {!readOnly && (
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => setEditAtt(hero)} className="p-1.5 bg-black/50 rounded-full">
                  <Pencil className="h-4 w-4 text-white" />
                </button>
                <button
                  onClick={() => remove(hero.id)}
                  disabled={pendingDeleteAttachmentId === hero.id}
                  className="p-1.5 bg-black/50 rounded-full disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {pendingDeleteAttachmentId === hero.id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <X className="h-4 w-4 text-white" />
                  )}
                </button>
              </div>
            )}
          </div>

          {(compact ? images.length > 0 : images.length > 1) && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onImageDragEnd}>
            <SortableContext items={(compact ? images : images.slice(1)).map((att) => att.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {(compact ? images : images.slice(1)).map((att) => (
                <SortableImageTile key={att.id} id={att.id} canMove={!readOnly && images.length > 1} moveLabel={t("attachments.moveImage")} className={clsx("group relative aspect-square rounded-lg overflow-hidden border bg-gray-100 dark:bg-gray-800", compact && att.id === hero.id ? "border-indigo-500 dark:border-indigo-400" : "border-gray-200 dark:border-gray-700")}>
                  <a href={attachmentUrl(att, serverURL)} target="_blank" rel="noopener noreferrer" draggable={false} className="block w-full h-full">
                    <img src={attachmentUrl(att, serverURL)} alt={att.description || att.filename} loading="lazy" draggable={false} className={compact ? "w-full h-full object-contain" : "w-full h-full object-cover"} />
                  </a>
                  {att.description ? (
                    <div className="pointer-events-none absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-md bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                      {att.description}
                    </div>
                  ) : null}
                  {!readOnly && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1 pointer-events-none">
                      {att.id !== hero.id ? (
                        <button onClick={() => setAsHero(att)} title={t("attachments.setAsMain")} aria-label={t("attachments.setAsMain")} className="p-1.5 bg-white/20 rounded-full pointer-events-auto">
                          <Star className="h-3.5 w-3.5 text-white" />
                        </button>
                      ) : null}
                      <button onClick={() => setEditAtt(att)} title={t("common.edit")} aria-label={t("common.edit")} className="p-1.5 bg-white/20 rounded-full pointer-events-auto">
                        <Pencil className="h-3.5 w-3.5 text-white" />
                      </button>
                      <button
                        onClick={() => remove(att.id)}
                        disabled={pendingDeleteAttachmentId === att.id}
                        title={t("common.delete")}
                        aria-label={t("common.delete")}
                        className="p-1.5 bg-white/20 rounded-full pointer-events-auto disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {pendingDeleteAttachmentId === att.id ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-white" />
                        )}
                      </button>
                    </div>
                  )}
                </SortableImageTile>
              ))}
            </div>
            </SortableContext>
            </DndContext>
          )}
        </div>
        )
      )}

      {/* Upload area */}
      {allowUploadActions && (
        <>
          {/* Upload progress bar */}
          {uploading && uploadProgress != null && (
            <AttachmentUploadProgress
              uploadInfo={uploadInfo}
              uploadProgress={uploadProgress}
              uploadSpeed={uploadSpeed}
            />
          )}
          {/* Upload actions */}
          {!uploading && (
            <>
              <input
                ref={galleryInput}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) {
                    for (const file of files) upload(file, { gallery: true });
                  }
                  e.target.value = "";
                }}
              />
              <AttachmentUploadActions
                t={t}
                compact={compact}
                onOpenFileUpload={() => setShowFileUpload(true)}
                onOpenGalleryUpload={() => galleryInput.current?.click()}
                onOpenLinkModal={() => setShowLinkModal(true)}
                onOpenSftpModal={() => setShowExternalSourceModal(true)}
              />
            </>
          )}
        </>
      )}
      {uploadError && (
        <p className="text-xs text-red-500 px-1">{uploadError}</p>
      )}

      {/* File / link list with DnD */}
      {showFiles && listedAttachments.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">{t("attachments.title")}</h3>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={listedAttachments.map((a) => a.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {listedAttachments.map((att) => (
                  <SortableAttachment
                    key={att.id}
                    attachment={att}
                    url={attachmentUrl(att, serverURL)}
                    t={t}
                    onEdit={() => setEditAtt(att)}
                    onDelete={() => remove(att.id)}
                    pendingDelete={pendingDeleteAttachmentId === att.id}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
          <div className="flex h-[min(85vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#182131]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-3 dark:border-white/10">
              <p className="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-white">{previewImage.description || previewImage.filename}</p>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">{previewIndex + 1} / {images.length}</span>
                <button type="button" onClick={() => setPreviewImage(null)} className="inline-flex size-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5" aria-label="Schließen">
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-gray-50 p-5 dark:bg-[#101827]">
              <img src={attachmentUrl(previewImage, serverURL)} alt={previewImage.description || previewImage.filename} className="max-h-full max-w-full object-contain" />
              {images.length > 1 ? <>
                <button type="button" onClick={showPreviousImage} className="absolute left-4 inline-flex size-10 items-center justify-center rounded-md border border-gray-300 bg-white/90 text-gray-700 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-[#242d3c]/90 dark:text-gray-200 dark:hover:bg-[#2b3546]" aria-label="Vorheriges Bild">
                  <ChevronLeft className="size-5" />
                </button>
                <button type="button" onClick={showNextImage} className="absolute right-4 inline-flex size-10 items-center justify-center rounded-md border border-gray-300 bg-white/90 text-gray-700 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-[#242d3c]/90 dark:text-gray-200 dark:hover:bg-[#2b3546]" aria-label="Nächstes Bild">
                  <ChevronRight className="size-5" />
                </button>
              </> : null}
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editAtt && (
        <EditAttachmentModal
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
            await addLinkAttachmentAndRefresh(itemId, attachments.length, data, () => {
              setShowLinkModal(false);
              onChange();
            });
          }}
        />
      )}

      {showExternalSourceModal && (
        <AddExternalSourceAttachmentModal
          t={t}
          sources={activeAttachmentExternalSources(externalSources)}
          onClose={() => setShowExternalSourceModal(false)}
          onAdd={async (data) => {
            await addExternalAttachmentAndRefresh(itemId, attachments.length, data, () => {
              setShowExternalSourceModal(false);
              onChange();
            });
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
