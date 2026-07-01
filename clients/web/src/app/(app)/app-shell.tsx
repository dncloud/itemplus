"use client";

import { useState, type ComponentType } from "react";
import clsx from "clsx";
import { Command, Menu, Smartphone, Search, Printer, Sparkles, X } from "lucide-react";
import type { UpdateStatus } from "@/lib/api";
import { useApp } from "@/lib/app-context";

const UPDATE_BANNER_DISMISSED_KEY = "itemplus.updateBanner.dismissed";
const UPDATE_BANNER_IGNORED_KEY = "itemplus.updateBanner.ignored";

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
  printerBridgeStatus,
  aiAssistantBusy,
  aiAssistantPanelAvailable,
  aiAssistantPanelOpen,
  onToggleAiAssistant,
  showPrinterStatus,
  onOpenSidebar,
  onOpenSearch,
  updateStatus,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  iosBridgeStatus: "connected" | "disconnected";
  printerBridgeStatus: "connected" | "disconnected";
  aiAssistantBusy: boolean;
  aiAssistantPanelAvailable: boolean;
  aiAssistantPanelOpen: boolean;
  onToggleAiAssistant: () => void;
  showPrinterStatus: boolean;
  onOpenSidebar: () => void;
  onOpenSearch: () => void;
  updateStatus: UpdateStatus | null;
}) {
  const [dismissedUpdateKey, setDismissedUpdateKey] = useState(() => readSessionStorage(UPDATE_BANNER_DISMISSED_KEY));
  const [ignoredUpdateKey, setIgnoredUpdateKey] = useState(() => readLocalStorage(UPDATE_BANNER_IGNORED_KEY));
  const updateAvailable = !!updateStatus && (updateStatus.available || updateStatus.release_update_available || updateStatus.commit_update_available);
  const installed = updateStatus?.installed_version
    ? `${updateStatus.installed_version}${updateStatus.installed_build ? ` build ${updateStatus.installed_build}` : ""}`
    : "";
  const latestRelease = updateStatus?.latest_release_version
    ? `${updateStatus.latest_release_version}${updateStatus.latest_release_build ? ` build ${updateStatus.latest_release_build}` : ""}`
    : "";
  const latest = latestRelease || updateStatus?.latest_commit || "";
  const updateKey = `${installed}|${latest}`;
  const showUpdateBanner = updateAvailable && ignoredUpdateKey !== updateKey && dismissedUpdateKey !== updateKey;

  const dismissUpdateBanner = () => {
    setDismissedUpdateKey(updateKey);
    writeSessionStorage(UPDATE_BANNER_DISMISSED_KEY, updateKey);
  };

  const ignoreUpdateBanner = () => {
    setIgnoredUpdateKey(updateKey);
    writeLocalStorage(UPDATE_BANNER_IGNORED_KEY, updateKey);
  };

  return (
    <header id="page-header" className="sticky top-0 z-40">
      {showUpdateBanner ? (
        <div className="bg-blue-50 px-4 py-2 text-sm text-blue-950 dark:bg-[#0f2137] dark:text-blue-100 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 font-medium">
              {t("update.available")}
              {latest ? <span className="ml-2 font-normal opacity-90">{latest}</span> : null}
              {installed ? <span className="ml-2 text-xs font-normal opacity-70">{t("update.installed", { version: installed })}</span> : null}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {updateStatus?.latest_release_url ? (
                <a href={updateStatus.latest_release_url} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
                  {t("update.releaseNotes")}
                </a>
              ) : null}
              <button type="button" onClick={ignoreUpdateBanner} className="rounded-md px-2 py-1 font-medium opacity-80 transition hover:bg-blue-100 hover:opacity-100 dark:hover:bg-blue-400/10">
                {t("update.never")}
              </button>
              <button type="button" onClick={dismissUpdateBanner} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium opacity-80 transition hover:bg-blue-100 hover:opacity-100 dark:hover:bg-blue-400/10">
                <X className="size-3.5" />
                {t("update.dismiss")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 sm:gap-x-6 sm:px-6 dark:border-white/10 dark:bg-gray-900 lg:px-8">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="-m-2.5 p-2.5 text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div aria-hidden="true" className="h-6 w-px bg-gray-200 dark:bg-white/10 lg:hidden" />

        <div className="flex flex-1 items-center justify-between gap-x-4 self-stretch lg:gap-x-6">
          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex items-center gap-x-3 self-center rounded-md px-2 py-1.5 text-left text-sm/6 text-gray-500 outline-hidden hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
            aria-label={t("common.search")}
          >
            <Search className="size-5 shrink-0 text-gray-400" />
            <span>{t("common.search")}</span>
            <span className="hidden items-center gap-x-1 lg:flex">
              <kbd className="flex h-5 min-w-5 items-center justify-center rounded border border-gray-200 bg-white px-1 text-[11px] font-semibold text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-500">
                <Command className="size-3" />
              </kbd>
              <kbd className="flex h-5 min-w-5 items-center justify-center rounded border border-gray-200 bg-white px-1 text-[11px] font-semibold text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-500">
                K
              </kbd>
            </span>
          </button>

          <div className="flex items-center gap-2">
            {aiAssistantBusy || aiAssistantPanelAvailable ? (
              <button
                type="button"
                onClick={onToggleAiAssistant}
                title={aiAssistantBusy ? t("common.aiWorking") : aiAssistantPanelOpen ? t("common.closeAiSession") : t("common.openAiSession")}
                aria-label={aiAssistantBusy ? t("common.aiWorking") : aiAssistantPanelOpen ? t("common.closeAiSession") : t("common.openAiSession")}
                className={clsx(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full border transition",
                  aiAssistantPanelOpen || aiAssistantBusy
                    ? "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300"
                    : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white",
                )}
              >
                <Sparkles className={clsx("size-4 shrink-0", aiAssistantBusy ? "animate-pulse" : "")} />
              </button>
            ) : null}
            <ConnectionStatusIcon
              label="iPhone"
              status={iosBridgeStatus}
              icon={Smartphone}
              t={t}
            />
            {showPrinterStatus ? (
              <ConnectionStatusIcon
                label={t("settings.printerTitle")}
                status={printerBridgeStatus}
                icon={Printer}
                t={t}
              />
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function readLocalStorage(key: string) {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(key) ?? "";
}

function writeLocalStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function readSessionStorage(key: string) {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(key) ?? "";
}

function writeSessionStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, value);
}

function ConnectionStatusIcon({
  label,
  status,
  icon: Icon,
  t,
}: {
  label: string;
  status: "connected" | "disconnected";
  icon: ComponentType<{ className?: string }>;
  t: (key: string) => string;
}) {
  const isConnected = status === "connected";
  const stateLabel = isConnected ? t("settings.connected") : t("settings.disconnected");

  return (
    <div
      title={`${label}: ${stateLabel}`}
      aria-label={`${label}: ${stateLabel}`}
      className={clsx(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border transition",
        isConnected
          ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
          : "border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400",
      )}
    >
      <Icon className="size-4 shrink-0" />
    </div>
  );
}

export function AppShellFooter() {
  const { brandingFooterText } = useApp();

  return (
    <footer className="flex min-h-[60px] flex-none items-center bg-white dark:bg-gray-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center gap-y-2 px-4 py-3 text-center lg:px-8">
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
        </div>
      </div>
    </footer>
  );
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
