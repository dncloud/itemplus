"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function SettingsPageHeader({
  t,
  activeSectionLabel,
}: {
  t: (key: string) => string;
  activeSectionLabel?: string;
}) {
  return (
    <div className="mb-4 text-center sm:text-left lg:mb-8">
      <div className="space-y-1 py-3">
        <nav className="text-sm font-medium dark:text-gray-100">
          <ol className="flex items-center justify-center sm:justify-start">
            <li>
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">{t("nav.dashboard")}</Link>
            </li>
            <li className="flex items-center px-1 opacity-25">
              <ChevronRight className="inline-block h-5 w-5" />
            </li>
            <li>{t("settings.title")}</li>
            {activeSectionLabel ? (
              <>
                <li className="flex items-center px-1 opacity-25">
                  <ChevronRight className="inline-block h-5 w-5" />
                </li>
                <li className="text-gray-900 dark:text-white">{activeSectionLabel}</li>
              </>
            ) : null}
          </ol>
        </nav>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t("settings.title")}
        </h2>
      </div>
    </div>
  );
}
