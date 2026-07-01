export type AttachmentPreviewKind =
  | "hls"
  | "video"
  | "audio"
  | "image"
  | "pdf"
  | "markdown"
  | "text"
  | "svg"
  | "none";

export type AttachmentPreviewState = {
  kind: AttachmentPreviewKind;
  isPreviewable: boolean;
};

const AUDIO_EXTS = /\.(mp3|wav|flac|ogg|m4a|aac|wma|opus|aiff?)$/;
const TEXT_EXTS = /\.(txt|log|csv|json|xml|yaml|yml|ini|conf|cfg|env|sh|bash|py|js|ts|go|rs|c|cpp|h|java|sql|html?|css)$/;
const VIDEO_EXTS = /\.(mp4|mov|webm|m4v|ogv)$/;

export function classifyAttachmentPreview(filenameOrUrl: string, isImageFile: boolean): AttachmentPreviewState {
  const name = filenameOrUrl.toLowerCase();
  if (name.endsWith(".m3u8")) return { kind: "hls", isPreviewable: true };
  if (VIDEO_EXTS.test(name)) return { kind: "video", isPreviewable: true };
  if (AUDIO_EXTS.test(name)) return { kind: "audio", isPreviewable: true };
  if (name.endsWith(".pdf")) return { kind: "pdf", isPreviewable: true };
  if (name.endsWith(".svg")) return { kind: "svg", isPreviewable: true };
  if (name.endsWith(".md")) return { kind: "markdown", isPreviewable: true };
  if (TEXT_EXTS.test(name)) return { kind: "text", isPreviewable: true };
  if (isImageFile) return { kind: "image", isPreviewable: true };
  return { kind: "none", isPreviewable: false };
}

export function formatMediaDuration(seconds: number): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export async function loadAttachmentTextPreview(url: string): Promise<string> {
  const response = await fetch(url);
  return response.text();
}
