import { api, type ExternalSource } from "@/lib/api";

export async function loadAttachmentExternalSources() {
  return api.getAttachmentExternalSources().catch(() => [] as ExternalSource[]);
}

export function activeAttachmentExternalSources(sources: ExternalSource[]) {
  return sources.filter((source) => source.is_active);
}

export async function addLinkAttachmentAndRefresh(
  itemId: number,
  order: number,
  data: { url: string; description?: string; gallery?: boolean; type?: string },
  onDone: () => void,
) {
  await api.addLinkAttachment(itemId, { ...data, order });
  onDone();
}

export async function addExternalAttachmentAndRefresh(
  itemId: number,
  order: number,
  data: { external_source_id: number; external_path: string; filename?: string; description?: string; gallery?: boolean },
  onDone: () => void,
) {
  await api.addExternalSFTPAttachment(itemId, { ...data, order });
  onDone();
}
