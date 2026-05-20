"use client";

import clsx from "clsx";
import { Bars3Icon, DevicePhoneMobileIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useApp } from "@/lib/app-context";

export function AppShellLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-900 px-6 text-center text-gray-100">
      <div className="space-y-5">
        <div className="mx-auto flex items-center justify-center">
          <div className="rounded-2xl border border-white/10 bg-gray-800/80 px-6 py-5 shadow-2xl shadow-black/20">
            <div className="mx-auto flex w-fit flex-col items-center gap-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <p className="text-sm text-gray-400">Loading item+</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShellHeader({
  t,
  iosBridgeStatus,
  onOpenSidebar,
  onOpenSearch,
}: {
  t: (key: string) => string;
  iosBridgeStatus: "connected" | "offline" | "none";
  onOpenSidebar: () => void;
  onOpenSearch: () => void;
}) {
  return (
    <header id="page-header" className="sticky top-0 z-40">
      <div className="flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 sm:gap-x-6 sm:px-6 dark:border-white/10 dark:bg-gray-900 lg:px-8">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="-m-2.5 p-2.5 text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white lg:hidden"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>

        <div aria-hidden="true" className="h-6 w-px bg-gray-200 dark:bg-white/10 lg:hidden" />

        <div className="flex flex-1 items-center justify-between gap-x-4 self-stretch lg:gap-x-6">
          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex items-center gap-x-3 self-center rounded-md px-2 py-1.5 text-left text-sm/6 text-gray-500 outline-hidden hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
            aria-label={t("common.search")}
          >
            <MagnifyingGlassIcon className="size-5 shrink-0 text-gray-400" />
            <span>{t("common.search")}</span>
            <span className="hidden items-center gap-x-1 lg:flex">
              <kbd className="flex h-5 min-w-5 items-center justify-center rounded border border-gray-200 bg-white px-1 text-[11px] font-semibold text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-500">
                ⌘
              </kbd>
              <kbd className="flex h-5 min-w-5 items-center justify-center rounded border border-gray-200 bg-white px-1 text-[11px] font-semibold text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-500">
                K
              </kbd>
            </span>
          </button>

          <div className="flex items-center gap-2">
            {iosBridgeStatus !== "none" ? (
              <div
                className={clsx(
                  "inline-flex items-center gap-x-2 rounded-full px-3 py-1.5 text-xs font-medium border",
                  iosBridgeStatus === "connected"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
                )}
              >
                <DevicePhoneMobileIcon className="size-4 shrink-0" />
                <span className="hidden sm:inline">{iosBridgeStatus === "connected" ? "iPhone verbunden" : "iPhone offline"}</span>
                <span className="sm:hidden">iPhone</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

export function AppShellFooter() {
  const { brandingFooterText } = useApp();

  return (
    <footer className="flex flex-none items-center border-t border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center gap-y-2 px-4 py-4 text-center lg:px-8">
        {brandingFooterText.trim() ? (
          <p className="max-w-3xl text-xs text-gray-500 dark:text-gray-400">{brandingFooterText}</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-gray-400 dark:text-gray-600">
          <span>&copy; 2025–2026 Oliver Cermann</span>
          <span>·</span>
          <a href="https://itemplus.app/imprint" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500">
            Impressum
          </a>
          <span>·</span>
          <span>MIT License</span>
          <span>·</span>
          <a href="https://github.com/dncloud/itemplus" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500">
            GitHub
          </a>
          <span>·</span>
          <a href="https://itemplus.app" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500">
            itemplus.app
          </a>
          <span>.</span>
        </div>
      </div>
    </footer>
  );
}

export function AppSidebarOverlay({
  sidebarOpen,
  onClose,
}: {
  sidebarOpen: boolean;
  onClose: () => void;
}) {
  if (!sidebarOpen) return null;
  return <div className="fixed inset-0 z-40 bg-gray-900/40 dark:bg-black/30 lg:hidden" onClick={onClose} />;
}

export function AppShellContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="page-container"
      className={clsx(
        "mx-auto flex min-h-dvh w-full min-w-80 flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100",
        "lg:pl-72",
      )}
    >
      {children}
    </div>
  );
}
