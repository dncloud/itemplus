import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { api, type Attachment } from "@/lib/api";
import { attachmentFilename, isGalleryImage } from "@/components/attachments/attachment-manager-utils";

export function buildAttachmentDeleteName(att: Attachment | undefined, id: number) {
  return (att ? attachmentFilename(att) : "") || att?.description || `#${id}`;
}

export async function setAttachmentAsHeroImage(itemId: number, att: Attachment) {
  if (!isGalleryImage(att)) return;
  await api.reorderAttachments(itemId, [att.id]);
}

export async function updateAttachmentMetadata(att: Attachment, data: Partial<Attachment>) {
  await api.updateAttachment(att.id, data);
}

// The new order of a group (the images, or the files) after one of them was
// dragged onto another; null when nothing moved.
export function orderAfterDrag(event: DragEndEvent, group: Attachment[]) {
  const { active, over } = event;
  if (!over || active.id === over.id) return null;
  const oldIndex = group.findIndex((attachment) => attachment.id === active.id);
  const newIndex = group.findIndex((attachment) => attachment.id === over.id);
  if (oldIndex < 0 || newIndex < 0) return null;
  return arrayMove(group, oldIndex, newIndex);
}
