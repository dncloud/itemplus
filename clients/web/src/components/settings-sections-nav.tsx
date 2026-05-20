"use client";

import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

export type SettingsSectionNavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function SettingsPageHeader({ t }: { t: (key: string) => string }) {
  return (
    <div className="text-center sm:border-b sm:border-gray-200 sm:text-left dark:border-gray-700">
      <div className="space-y-1">
        <nav className="text-sm font-medium dark:text-gray-100">
          <ol className="flex items-center justify-center sm:justify-start">
            <li>
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">{t("nav.dashboard")}</Link>
            </li>
            <li className="flex items-center px-1 opacity-30">
              <ChevronRightIcon className="h-4 w-4" />
            </li>
            <li>{t("settings.title")}</li>
          </ol>
        </nav>
        <div className="py-3 sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t("settings.title")}
            </h1>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsSectionsNav({
  sections,
  activeSection,
  setActiveSection,
}: {
  sections: SettingsSectionNavItem[];
  activeSection: string;
  setActiveSection: (id: string) => void;
}) {
  return (
    <>
      <aside className="hidden lg:block">
        <div className="rounded-xl bg-white px-4 py-5 text-gray-900 outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:text-white dark:outline-white/10">
          <nav className="flex flex-col">
            <ul role="list" className="-mx-2 space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const active = activeSection === section.id;
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      className={`group flex w-full items-center gap-x-3 rounded-md p-2 text-sm/6 font-semibold transition ${
                        active
                          ? "bg-gray-50 text-indigo-600 dark:bg-white/5 dark:text-white"
                          : "text-gray-700 hover:bg-gray-50 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                      }`}
                    >
                      <Icon className={`size-5 shrink-0 ${active ? "text-indigo-600 dark:text-white" : "text-gray-400 group-hover:text-indigo-600 dark:text-gray-500 dark:group-hover:text-white"}`} />
                      <span className="truncate">{section.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>

      <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {sections.map((section) => {
          const active = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`shrink-0 rounded-md px-3 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-gray-900 text-white dark:bg-white/10 dark:text-white"
                  : "bg-white text-gray-700 outline outline-1 -outline-offset-1 outline-gray-300 hover:bg-gray-50 dark:bg-white/5 dark:text-gray-300 dark:outline-white/10 dark:hover:bg-white/10"
              }`}
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
