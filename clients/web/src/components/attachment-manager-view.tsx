import {
  ArchiveBoxIcon,
  ArrowUpTrayIcon,
  LinkIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";

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
        <span className="text-blue-500 font-medium shrink-0 ml-2">{uploadProgress}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-[#242d3c]">
        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
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
}: {
  t: (key: string) => string;
  onOpenFileUpload: () => void;
  onOpenGalleryUpload: () => void;
  onOpenLinkModal: () => void;
  onOpenSftpModal: () => void;
}) {
  const buttonClassName =
    "rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center transition hover:border-blue-400 hover:bg-white dark:border-[#374151] dark:bg-[#242d3c] dark:hover:border-blue-500 dark:hover:bg-[#2b3546]";

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <button onClick={onOpenFileUpload} className={buttonClassName}>
        <ArrowUpTrayIcon className="mx-auto mb-3 h-8 w-8 text-gray-400 dark:text-gray-500" />
        <p className="text-sm font-medium text-gray-700 dark:text-white">{t("attachments.upload")}</p>
      </button>
      <button onClick={onOpenGalleryUpload} className={buttonClassName}>
        <PhotoIcon className="mx-auto mb-3 h-8 w-8 text-gray-400 dark:text-gray-500" />
        <p className="text-sm font-medium text-gray-700 dark:text-white">{t("attachments.uploadImages")}</p>
      </button>
      <button onClick={onOpenLinkModal} className={buttonClassName}>
        <LinkIcon className="mx-auto mb-3 h-8 w-8 text-gray-400 dark:text-gray-500" />
        <p className="text-sm font-medium text-gray-700 dark:text-white">{t("attachments.addLink")}</p>
      </button>
      <button onClick={onOpenSftpModal} className={buttonClassName}>
        <ArchiveBoxIcon className="mx-auto mb-3 h-8 w-8 text-gray-400 dark:text-gray-500" />
        <p className="text-sm font-medium text-gray-700 dark:text-white">{t("attachments.addSftp")}</p>
      </button>
    </div>
  );
}
