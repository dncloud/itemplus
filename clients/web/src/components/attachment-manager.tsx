"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import { api, type Attachment, type ExternalSource } from "@/lib/api";
import {
  attachmentUrl,
  isGalleryImage,
} from "@/components/attachment-manager-utils";
import {
  formatAttachmentTooLargeError,
  formatAttachmentUploadInfo,
  MAX_ATTACHMENT_FILE_SIZE,
  uploadAttachmentWithProgress,
} from "@/components/attachment-manager-upload";
import {
  buildAttachmentDeleteName,
  reorderAttachmentsByDrag,
  setAttachmentAsHeroImage,
  updateAttachmentMetadata,
} from "@/components/attachment-manager-actions";
import {
  activeAttachmentExternalSources,
  addExternalAttachmentAndRefresh,
  addLinkAttachmentAndRefresh,
  loadAttachmentExternalSources,
} from "@/components/attachment-manager-handlers";
import { AttachmentUploadActions, AttachmentUploadProgress } from "@/components/attachment-manager-view";
import {
  AddLinkModal,
  AddSFTPAttachmentModal,
  EditAttachmentModal,
  FileUploadModal,
} from "@/components/attachment-manager-modals";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  PencilIcon,
  StarIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useDeleteFlow, ConfirmDelete } from "@/components/confirm-delete";
import { SortableAttachment } from "@/components/attachment-manager-item";

export default function AttachmentManager({ itemId, attachments, onChange, readOnly = false, showUploadActions, showGallery = true, showFiles = true }: {
  itemId: number;
  attachments: Attachment[];
  onChange: () => void;
  readOnly?: boolean;
  showUploadActions?: boolean;
  showGallery?: boolean;
  showFiles?: boolean;
}) {
  const { realm, serverURL, t } = useApp();
  const allowUploadActions = showUploadActions ?? !readOnly;
  const galleryInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editAtt, setEditAtt] = useState<Attachment | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showSFTPModal, setShowSFTPModal] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [externalSources, setExternalSources] = useState<ExternalSource[]>([]);
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
  const pendingDeleteAttachmentId = deleteFlow.pending?.type === "attachment" ? deleteFlow.pending.id : null;

  useEffect(() => {
    loadAttachmentExternalSources().then(setExternalSources);
  }, []);

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
    await setAttachmentAsHeroImage(att, images);
    onChange();
  };

  const updateMeta = async (att: Attachment, data: Partial<Attachment>) => {
    await updateAttachmentMetadata(att, data);
    setEditAtt(null);
    onChange();
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const reordered = await reorderAttachmentsByDrag(event, sorted);
    if (!reordered) return;
    onChange();
  };

  return (
    <>
      {/* Hero + Gallery */}
      {showGallery && images.length > 0 && (
        <div className="space-y-3">
          <div className="group relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
            <a href={attachmentUrl(hero, serverURL)} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
              <img src={attachmentUrl(hero, serverURL)} alt={hero.description || hero.filename} className="w-full h-full object-cover" />
            </a>
            {hero.description && (
              <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-5rem)] rounded-md bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {hero.description}
              </div>
            )}
            {!readOnly && (
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => setEditAtt(hero)} className="p-1.5 bg-black/50 rounded-full">
                  <PencilIcon className="h-4 w-4 text-white" />
                </button>
                <button
                  onClick={() => remove(hero.id)}
                  disabled={pendingDeleteAttachmentId === hero.id}
                  className="p-1.5 bg-black/50 rounded-full disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {pendingDeleteAttachmentId === hero.id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <XMarkIcon className="h-4 w-4 text-white" />
                  )}
                </button>
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {images.slice(1).map((att) => (
                <div key={att.id} className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                  <a href={attachmentUrl(att, serverURL)} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                    <img src={attachmentUrl(att, serverURL)} alt={att.description || att.filename} className="w-full h-full object-cover" />
                  </a>
                  {att.description ? (
                    <div className="pointer-events-none absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-md bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                      {att.description}
                    </div>
                  ) : null}
                  {!readOnly && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1 pointer-events-none">
                      <button onClick={() => setAsHero(att)} title={t("attachments.setAsMain")} className="p-1.5 bg-white/20 rounded-full pointer-events-auto">
                        <StarIcon className="h-3.5 w-3.5 text-white" />
                      </button>
                      <button onClick={() => setEditAtt(att)} className="p-1.5 bg-white/20 rounded-full pointer-events-auto">
                        <PencilIcon className="h-3.5 w-3.5 text-white" />
                      </button>
                      <button
                        onClick={() => remove(att.id)}
                        disabled={pendingDeleteAttachmentId === att.id}
                        className="p-1.5 bg-white/20 rounded-full pointer-events-auto disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {pendingDeleteAttachmentId === att.id ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <XMarkIcon className="h-3.5 w-3.5 text-white" />
                        )}
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
                onOpenFileUpload={() => setShowFileUpload(true)}
                onOpenGalleryUpload={() => galleryInput.current?.click()}
                onOpenLinkModal={() => setShowLinkModal(true)}
                onOpenSftpModal={() => setShowSFTPModal(true)}
              />
            </>
          )}
        </>
      )}
      {uploadError && (
        <p className="text-xs text-red-500 px-1">{uploadError}</p>
      )}

      {/* File / link list with DnD */}
      {showFiles && others.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-white">{t("attachments.title")}</h3>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={others.map((a) => a.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {others.map((att) => (
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

      {showSFTPModal && (
        <AddSFTPAttachmentModal
          t={t}
          sources={activeAttachmentExternalSources(externalSources)}
          onClose={() => setShowSFTPModal(false)}
          onAdd={async (data) => {
            await addExternalAttachmentAndRefresh(itemId, attachments.length, data, () => {
              setShowSFTPModal(false);
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
