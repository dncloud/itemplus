import {
  HardDrive,
  Upload,
  Link,
  Image as ImageIcon,
} from "lucide-react";

export function AttachmentUploadProgress({
  uploadInfo,
  uploadProgress,
  uploadSpeed,
}: {
  uploadInfo: string | null;
  uploadProgress: number;
  uploadSpeed: string | null;
}) {
  return (
    <div className="space-y-1.5 rounded-xl border border-gray-200 bg-white p-4 dark:border-[#374151] dark:bg-[#182131]">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 truncate">{uploadInfo}</span>
        <span className="ml-2 shrink-0 font-medium text-indigo-600 dark:text-indigo-400">{uploadProgress}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-[#242d3c]">
        <div className="h-full bg-indigo-600 transition-all dark:bg-indigo-500 duration-300" style={{ width: `${uploadProgress}%` }} />
      </div>
      {uploadSpeed && <p className="text-[10px] text-gray-400 text-right">{uploadSpeed}</p>}
    </div>
  );
}

export function AttachmentUploadActions({
  t,
  onOpenFileUpload,
  onOpenGalleryUpload,
  onOpenLinkModal,
  onOpenSftpModal,
  compact = false,
}: {
  t: (key: string) => string;
  compact?: boolean;
  onOpenFileUpload: () => void;
  onOpenGalleryUpload: () => void;
  onOpenLinkModal: () => void;
  onOpenSftpModal: () => void;
}) {
  // The four ways to add something, in the same order in both layouts.
  const actions = [
    { icon: ImageIcon, label: t("attachments.uploadImages"), hint: t("attachments.uploadImagesHint"), onClick: onOpenGalleryUpload },
    { icon: Upload, label: t("attachments.upload"), hint: t("attachments.uploadHint"), onClick: onOpenFileUpload },
    { icon: Link, label: t("attachments.addLink"), hint: t("attachments.addLinkHint"), onClick: onOpenLinkModal },
    { icon: HardDrive, label: t("attachments.addSftp"), hint: t("attachments.addSftpHint"), onClick: onOpenSftpModal },
  ];

  // Compact is for the narrower column of the item form and item page:
  // two tiles per row there, four where there is room.
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${compact ? "gap-2" : "gap-3 xl:grid-cols-4"}`}>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          className={`group flex items-center gap-3 rounded-lg bg-white text-left outline-1 -outline-offset-1 outline-gray-200 transition hover:bg-gray-50 hover:outline-indigo-500 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 dark:bg-white/5 dark:outline-white/10 dark:hover:bg-white/10 dark:hover:outline-indigo-400 dark:focus-visible:outline-indigo-500 ${compact ? "p-3" : "p-4"}`}
        >
          <span className={`flex shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition group-hover:bg-indigo-600 group-hover:text-white dark:bg-white/10 dark:text-gray-400 dark:group-hover:bg-indigo-500 ${compact ? "size-9" : "size-10"}`}>
            <action.icon aria-hidden="true" className={compact ? "size-4" : "size-5"} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gray-900 dark:text-white">{action.label}</span>
            <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{action.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
