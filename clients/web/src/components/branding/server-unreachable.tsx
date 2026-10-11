"use client";

import { ServerOff } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { BrandTitle, LogoIcon } from "@/components/branding/logo";

// ServerUnreachableNotice is the content of the card shown while the server
// does not answer: on the sign-in page and in front of the app.
export function ServerUnreachableNotice() {
  const { t } = useApp();

  return (
    <div className="space-y-3 pt-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
        <ServerOff className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>
      <p className="text-sm font-medium text-gray-900 dark:text-white">{t("auth.serverNotReachable")}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t("auth.serverRetryHint")}</p>
    </div>
  );
}

// ServerUnreachableScreen covers the whole app: without the server there is
// nothing to work with. The app reloads once the server answers again.
export function ServerUnreachableScreen() {
  const { brandingTitle, brandingSubtitle } = useApp();

  return (
    <div role="alert" className="fixed inset-0 z-[100] flex flex-col justify-center overflow-y-auto bg-gray-50 py-12 sm:px-6 lg:px-8 dark:bg-gray-900">
      <div className="space-y-3 text-center sm:mx-auto sm:w-full sm:max-w-md">
        <LogoIcon size={80} className="mx-auto" />
        <BrandTitle title={brandingTitle.trim() || "item+"} className="block text-3xl font-bold" />
        <p className="text-sm text-gray-500 dark:text-gray-400">{brandingSubtitle.trim() || "Inventory & Collection Management"}</p>
      </div>
      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
        <div className="bg-white px-6 pt-2 pb-10 shadow-sm sm:rounded-lg sm:px-12 dark:bg-gray-800/50 dark:shadow-none dark:outline dark:-outline-offset-1 dark:outline-white/10">
          <ServerUnreachableNotice />
        </div>
      </div>
    </div>
  );
}
