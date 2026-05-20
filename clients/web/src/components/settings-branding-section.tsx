"use client";

import { type RefObject } from "react";
import { HomeIcon } from "@heroicons/react/24/outline";
import { SettingsCard, StatusMessage } from "@/components/settings-ui";

export function SettingsBrandingSection({
  t,
  logoDraft,
  subtitleDraft,
  footerTextDraft,
  widthDraft,
  brandingStatus,
  logoInputRef,
  setSubtitleDraft,
  setFooterTextDraft,
  setWidthDraft,
  setLogoDraft,
  setBrandingStatus,
  onLogoSelect,
  saveBranding,
  resetBranding,
  primaryButtonClass,
  secondaryButtonClass,
}: {
  t: (key: string) => string;
  logoDraft: string | null;
  subtitleDraft: string;
  footerTextDraft: string;
  widthDraft: number;
  brandingStatus: string | null;
  logoInputRef: RefObject<HTMLInputElement | null>;
  setSubtitleDraft: (value: string) => void;
  setFooterTextDraft: (value: string) => void;
  setWidthDraft: (value: number) => void;
  setLogoDraft: (value: string | null) => void;
  setBrandingStatus: (value: string | null) => void;
  onLogoSelect: (file?: File | null) => void;
  saveBranding: () => void;
  resetBranding: () => void;
  primaryButtonClass: string;
  secondaryButtonClass: string;
}) {
  const isErrorStatus =
    brandingStatus === t("settings.brandingInvalid") ||
    brandingStatus === t("settings.brandingTooLarge") ||
    brandingStatus === t("settings.brandingFailed");

  return (
    <SettingsCard
      sectionId="branding"
      icon={HomeIcon}
      title={t("settings.branding")}
      description={t("settings.brandingHint")}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.preview")}</div>
          <div className="mt-3 flex min-h-28 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white px-4 py-4 dark:border-white/10 dark:bg-white/5">
            <img src={logoDraft || "/logo.svg"} alt="Current site logo" className="block max-h-24 max-w-full object-contain" />
          </div>
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onLogoSelect(e.target.files?.[0] || null)}
            />
            <button onClick={() => logoInputRef.current?.click()} className={secondaryButtonClass}>
              {t("settings.chooseLogo")}
            </button>
            <button
              onClick={() => {
                setLogoDraft(null);
                setBrandingStatus(null);
              }}
              className={secondaryButtonClass}
            >
              {t("common.remove")}
            </button>
          </div>
          <div>
            <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.logoWidth")}</label>
            <input
              type="number"
              min={1}
              step={1}
              value={widthDraft}
              onChange={(e) => {
                const next = Number(e.target.value);
                setWidthDraft(Number.isFinite(next) ? Math.max(1, next) : 180);
                setBrandingStatus(null);
              }}
              className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
            />
            <p className="mt-2 text-sm/6 text-gray-500 dark:text-gray-400">{t("settings.logoWidthHint")}</p>
          </div>
          <div>
            <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.logoSubtitle")}</label>
            <textarea
              value={subtitleDraft}
              onChange={(e) => {
                setSubtitleDraft(e.target.value);
                setBrandingStatus(null);
              }}
              rows={2}
              maxLength={120}
              className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
              placeholder={t("settings.logoSubtitlePlaceholder")}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.footerText")}</label>
            <textarea
              value={footerTextDraft}
              onChange={(e) => {
                setFooterTextDraft(e.target.value);
                setBrandingStatus(null);
              }}
              rows={2}
              maxLength={200}
              className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
              placeholder={t("settings.footerTextPlaceholder")}
            />
            <p className="mt-2 text-sm/6 text-gray-500 dark:text-gray-400">{t("settings.footerTextHint")}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={saveBranding} className={primaryButtonClass}>
              {t("common.save")}
            </button>
            <button onClick={resetBranding} className={secondaryButtonClass}>
              {t("settings.resetBranding")}
            </button>
            {brandingStatus ? <StatusMessage tone={isErrorStatus ? "error" : "success"}>{brandingStatus}</StatusMessage> : null}
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}
