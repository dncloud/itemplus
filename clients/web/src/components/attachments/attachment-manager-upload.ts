import { api } from "@/lib/api";
import { detectType, fmtSize } from "@/components/attachments/attachment-manager-utils";

export const MAX_ATTACHMENT_FILE_SIZE = 200 * 1024 * 1024;

export function formatAttachmentTooLargeError(fileSizeLimit: number) {
  return `Datei zu groß (max ${Math.round(fileSizeLimit / 1024 / 1024)} MB)`;
}

export function formatAttachmentUploadInfo(file: File) {
  return `${file.name} (${fmtSize(file.size)})`;
}

export function createAttachmentUploadForm(
  file: File,
  order: number,
  options?: { gallery?: boolean; description?: string },
) {
  const form = new FormData();
  form.append("file", file);
  form.append("type", detectType(file.name));
  form.append("order", String(order));
  if (options?.gallery) form.append("gallery", "true");
  if (options?.description) form.append("description", options.description);
  return form;
}

type UploadCallbacks = {
  onProgress: (progress: number, speed: string | null) => void;
  onSuccess: () => void;
  onError: (message: string) => void;
  onComplete: () => void;
};

export function uploadAttachmentWithProgress(
  itemId: number,
  file: File,
  order: number,
  options: { gallery?: boolean; description?: string } | undefined,
  callbacks: UploadCallbacks,
) {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${api.baseURL}/api/${api.realm}/items/${itemId}/attachments`);
  xhr.withCredentials = true;

  const form = createAttachmentUploadForm(file, order, options);
  let lastLoaded = 0;
  let lastTime = Date.now();

  xhr.upload.onprogress = (event) => {
    if (!event.lengthComputable) return;
    const progress = Math.round((event.loaded / event.total) * 100);
    const now = Date.now();
    const elapsed = (now - lastTime) / 1000;
    let speed: string | null = null;

    if (elapsed >= 0.5) {
      const bytes = event.loaded - lastLoaded;
      speed = `${fmtSize(bytes / elapsed)}/s`;
      lastLoaded = event.loaded;
      lastTime = now;
    }

    callbacks.onProgress(progress, speed);
  };

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      callbacks.onSuccess();
    } else {
      try {
        const error = JSON.parse(xhr.responseText);
        callbacks.onError(error.detail || `Upload fehlgeschlagen (${xhr.status})`);
      } catch {
        callbacks.onError(`Upload fehlgeschlagen (${xhr.status})`);
      }
    }
    callbacks.onComplete();
  };

  xhr.onerror = () => {
    callbacks.onError("Verbindungsfehler beim Upload");
    callbacks.onComplete();
  };

  xhr.send(form);
}
