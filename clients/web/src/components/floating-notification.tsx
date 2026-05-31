"use client";

import { CheckCircleIcon, InformationCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

export type FloatingNotificationState = {
  title: string;
  message?: string;
  tone: "success" | "error" | "info";
} | null;

export function FloatingNotification({
  notification,
  onClose,
  t,
}: {
  notification: FloatingNotificationState;
  onClose: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div aria-live="assertive" className="pointer-events-none fixed inset-0 z-[70] flex items-end px-4 py-6 sm:items-start sm:p-6">
      <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
        {notification ? (
          <div className="pointer-events-auto w-full max-w-sm translate-y-0 transform rounded-lg bg-gray-800 opacity-100 shadow-lg outline outline-1 -outline-offset-1 outline-white/10 transition duration-300 ease-out sm:translate-x-0 [@starting-style]:translate-y-2 [@starting-style]:opacity-0 [@starting-style]:sm:translate-x-2 [@starting-style]:sm:translate-y-0">
            <div className="p-4">
              <div className="flex items-start">
                <div className="shrink-0">
                  {notification.tone === "error" ? (
                    <XMarkIcon className="size-6 text-red-400" />
                  ) : notification.tone === "success" ? (
                    <CheckCircleIcon className="size-6 text-green-400" />
                  ) : (
                    <InformationCircleIcon className="size-6 text-blue-400" />
                  )}
                </div>
                <div className="ml-3 w-0 flex-1 pt-0.5">
                  <p className="text-sm font-medium text-white">{notification.title}</p>
                  {notification.message ? <p className="mt-1 text-sm text-gray-400">{notification.message}</p> : null}
                </div>
                <div className="ml-4 flex shrink-0">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex rounded-md text-gray-400 hover:text-white focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-indigo-500"
                  >
                    <span className="sr-only">{t("common.close")}</span>
                    <XMarkIcon className="size-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
