import type { ComponentType } from "react";
import type { Attachment } from "@/lib/api";
import {
  ArchiveBoxIcon,
  CodeBracketIcon,
  DocumentIcon,
  LinkIcon,
  MusicalNoteIcon,
  PhotoIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline";

export function fmtSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

export const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|svg|bmp|heic|heif|avif|tiff?)$/i;
const ARCHIVE_EXTS = /\.(zip|tar|gz|tgz|bz2|tbz|xz|txz|rar|7z|arj|lha|lzh|ace|sit|sea|hqx|cab|dms|msa|adf|adz|st|stx|d64|d81|t64|nrg|iso|img|cue|bin)$/i;
const CODE_EXTS = /\.(py|swift|js|jsx|ts|tsx|rs|go|java|kt|kts|cpp|cc|cxx|c|h|hpp|cs|rb|php|lua|sh|zsh|bash|fish|pl|pm|r|sql|html?|css|scss|sass|less|xml|yaml|yml|toml|ini|conf|cfg|json|jsonl|md|markdown|tex|m|mm|asm|s|vb|fs|ex|exs|erl|hrl|clj|cljs|hs|elm|dart|svelte|vue|astro|gradle|cmake|dockerfile|makefile|txt|log|env)$/i;
const VIDEO_EXTS = /\.(mp4|mov|avi|mkv|webm|flv|wmv|m4v|mpg|mpeg|3gp)$/i;
const AUDIO_EXTS = /\.(mp3|wav|flac|ogg|m4a|aac|wma|opus|aiff?|mid|midi|mod|s3m|xm|it)$/i;

export function detectType(filename: string): string {
  if (IMAGE_EXTS.test(filename)) return "image";
  if (ARCHIVE_EXTS.test(filename)) return "archive";
  if (CODE_EXTS.test(filename)) return "code";
  if (VIDEO_EXTS.test(filename)) return "video";
  if (AUDIO_EXTS.test(filename)) return "audio";
  return "document";
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function attachmentFilename(att: Attachment): string {
  return stringOrEmpty(att.filename);
}

export function attachmentExternalURL(att: Attachment): string {
  return stringOrEmpty(att.url);
}

export function isGalleryImage(att: Attachment): boolean {
  return !!att.gallery && IMAGE_EXTS.test(attachmentFilename(att));
}

export function attType(att: Attachment): "image" | "archive" | "code" | "video" | "audio" | "link" | "document" {
  if (att.attachment_type === "link") return "link";
  const filename = attachmentFilename(att);
  if (!filename) {
    const type = att.attachment_type;
    if (type === "image" || type === "archive") return type;
    return "document";
  }
  if (IMAGE_EXTS.test(filename)) return "image";
  if (ARCHIVE_EXTS.test(filename)) return "archive";
  if (CODE_EXTS.test(filename)) return "code";
  if (VIDEO_EXTS.test(filename)) return "video";
  if (AUDIO_EXTS.test(filename)) return "audio";
  return "document";
}

export function attachmentUrl(att: Attachment, serverURL: string) {
  return att.download_url
    ? `${serverURL}${att.download_url}`
    : att.url || `${serverURL}/uploads/${att.file_path}`;
}

export const TYPE_STYLES: Record<
  string,
  { icon: ComponentType<{ className?: string }>; bg: string; color: string; label: string }
> = {
  link: { icon: LinkIcon, bg: "bg-blue-100 dark:bg-blue-900/20", color: "text-blue-500", label: "Link" },
  archive: { icon: ArchiveBoxIcon, bg: "bg-amber-100 dark:bg-amber-900/20", color: "text-amber-500", label: "Archive" },
  code: { icon: CodeBracketIcon, bg: "bg-purple-100 dark:bg-purple-900/20", color: "text-purple-500", label: "Code" },
  video: { icon: VideoCameraIcon, bg: "bg-pink-100 dark:bg-pink-900/20", color: "text-pink-500", label: "Video" },
  audio: { icon: MusicalNoteIcon, bg: "bg-green-100 dark:bg-green-900/20", color: "text-green-500", label: "Audio" },
  document: { icon: DocumentIcon, bg: "bg-gray-100 dark:bg-gray-800", color: "text-gray-400", label: "Datei" },
  image: { icon: PhotoIcon, bg: "bg-gray-100 dark:bg-gray-800", color: "text-gray-400", label: "Bild" },
};
