import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { api, type Attachment } from "@/lib/api";
import { attachmentFilename, isGalleryImage } from "@/components/attachments/attachment-manager-utils";

export function buildAttachmentDeleteName(att: Attachment | undefined, id: number) {
  return (att ? attachmentFilename(att) : "") || att?.description || `#${id}`;
}

export async function setAttachmentAsHeroImage(att: Attachment, images: Attachment[]) {
  if (!isGalleryImage(att)) return;
  const minOrder = Math.min(...images.map((image) => image.order)) - 1;
  await api.updateAttachment(att.id, { order: minOrder });
}

export async function updateAttachmentMetadata(att: Attachment, data: Partial<Attachment>) {
  await api.updateAttachment(att.id, data);
}

export async function reorderAttachmentsByDrag(event: DragEndEvent, sorted: Attachment[]) {
  const { active, over } = event;
  if (!over || active.id === over.id) return false;

  const oldIndex = sorted.findIndex((attachment) => attachment.id === active.id);
  const newIndex = sorted.findIndex((attachment) => attachment.id === over.id);
  const reordered = arrayMove(sorted, oldIndex, newIndex);

  for (let index = 0; index < reordered.length; index++) {
    if (reordered[index].order !== index) {
      await api.updateAttachment(reordered[index].id, { order: index });
    }
  }

  return true;
}
