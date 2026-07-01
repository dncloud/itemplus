"use client";

import { type RefObject } from "react";

export function SettingsBrandingSection({
  t,
  titleDraft,
  titleSizeDraft,
  titlePositionDraft,
  subtitleDraft,
  footerTextDraft,
  widthDraft,
  logoBackgroundDraft,
  logoPaddingDraft,
  logoRadiusDraft,
  brandingStatus,
  logoInputRef,
  setTitleDraft,
  setTitleSizeDraft,
  setTitlePositionDraft,
  setSubtitleDraft,
  setFooterTextDraft,
  setWidthDraft,
  setLogoBackgroundDraft,
  setLogoPaddingDraft,
  setLogoRadiusDraft,
  setLogoDraft,
  setBrandingStatus,
  onLogoSelect,
  saveBranding,
  resetBranding,
  primaryButtonClass,
  secondaryButtonClass,
}: {
  t: (key: string) => string;
  titleDraft: string;
  titleSizeDraft: number;
  titlePositionDraft: "right" | "below";
  subtitleDraft: string;
  footerTextDraft: string;
  widthDraft: number;
  logoBackgroundDraft: string;
  logoPaddingDraft: number;
  logoRadiusDraft: number;
  brandingStatus: string | null;
  logoInputRef: RefObject<HTMLInputElement | null>;
  setTitleDraft: (value: string) => void;
  setTitleSizeDraft: (value: number) => void;
  setTitlePositionDraft: (value: "right" | "below") => void;
  setSubtitleDraft: (value: string) => void;
  setFooterTextDraft: (value: string) => void;
  setWidthDraft: (value: number) => void;
  setLogoBackgroundDraft: (value: string) => void;
  setLogoPaddingDraft: (value: number) => void;
  setLogoRadiusDraft: (value: number) => void;
  setLogoDraft: (value: string | null) => void;
  setBrandingStatus: (value: string | null) => void;
  onLogoSelect: (file?: File | null) => void;
  saveBranding: () => void;
  resetBranding: () => void;
  primaryButtonClass: string;
  secondaryButtonClass: string;
}) {
  const inputClass =
    "block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500";
  const panelClass =
    "rounded-xl bg-gray-50/50 p-5 outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-900/20 dark:outline-white/10";

  const handleLogoBackgroundReset = () => {
    setLogoBackgroundDraft("");
    setBrandingStatus(null);
  };

  return (
    <section id="branding" className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[16rem_minmax(0,1fr)]">
      <div>
        <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">{t("settings.branding")}</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("settings.brandingHint")}</p>
      </div>

      <div className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
        <div className="space-y-8 px-4 py-6 sm:p-8">
          <div className={panelClass}>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="xl:col-span-2">
                <div className="space-y-5">
                  <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.brandTitle")}</label>
                  <input
                    value={titleDraft}
                    onChange={(e) => {
                      setTitleDraft(e.target.value);
                      setBrandingStatus(null);
                    }}
                    maxLength={80}
                    className={inputClass}
                    placeholder={t("settings.brandTitlePlaceholder")}
                  />
                  <p className="mt-2 text-sm/6 text-gray-500 dark:text-gray-400">{t("settings.brandTitleHint")}</p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.brandTitleSize")}</label>
                      <input
                        type="number"
                        min={12}
                        max={72}
                        step={1}
                        value={titleSizeDraft}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          setTitleSizeDraft(Number.isFinite(next) ? Math.min(72, Math.max(12, next)) : 17);
                          setBrandingStatus(null);
                        }}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.brandTitlePosition")}</label>
                      <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1 dark:bg-white/5">
                        {(["right", "below"] as const).map((value) => {
                          const active = titlePositionDraft === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {
                                setTitlePositionDraft(value);
                                setBrandingStatus(null);
                              }}
                              className={`rounded-md px-3 py-2 text-sm/6 font-medium transition ${
                                active
                                  ? "bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white"
                                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                              }`}
                            >
                              {t(value === "right" ? "settings.brandTitlePositionRight" : "settings.brandTitlePositionBelow")}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.logoSubtitle")}</label>
                  <textarea
                    value={subtitleDraft}
                    onChange={(e) => {
                      setSubtitleDraft(e.target.value);
                      setBrandingStatus(null);
                    }}
                    rows={3}
                    maxLength={120}
                    className={inputClass}
                    placeholder={t("settings.logoSubtitlePlaceholder")}
                  />
                </div>
              </div>

              <div className="space-y-6">
                <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.footerText")}</label>
                <textarea
                  value={footerTextDraft}
                  onChange={(e) => {
                    setFooterTextDraft(e.target.value);
                    setBrandingStatus(null);
                  }}
                  rows={6}
                  maxLength={200}
                  className={inputClass}
                  placeholder={t("settings.footerTextPlaceholder")}
                />
                <p className="mt-2 text-sm/6 text-gray-500 dark:text-gray-400">{t("settings.footerTextHint")}</p>
              </div>
            </div>
          </div>

          <div className={panelClass}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm/6 font-medium text-gray-900 dark:text-white">Logo</div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onLogoSelect(e.target.files?.[0] || null)}
                />
                <button type="button" onClick={() => logoInputRef.current?.click()} className={secondaryButtonClass}>
                  {t("settings.chooseLogo")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLogoDraft(null);
                    setBrandingStatus(null);
                  }}
                  className={secondaryButtonClass}
                >
                  {t("common.remove")}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.logoWidth")}</label>
                <input
                  type="number"
                  min={20}
                  max={480}
                  step={1}
                  value={widthDraft}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setWidthDraft(Number.isFinite(next) ? Math.min(480, Math.max(20, next)) : 180);
                    setBrandingStatus(null);
                  }}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.logoPadding")}</label>
                <input
                  type="number"
                  min={0}
                  max={64}
                  step={1}
                  value={logoPaddingDraft}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setLogoPaddingDraft(Number.isFinite(next) ? Math.min(64, Math.max(0, next)) : 0);
                    setBrandingStatus(null);
                  }}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.logoRadius")}</label>
                <input
                  type="number"
                  min={0}
                  max={64}
                  step={1}
                  value={logoRadiusDraft}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setLogoRadiusDraft(Number.isFinite(next) ? Math.min(64, Math.max(0, next)) : 16);
                    setBrandingStatus(null);
                  }}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-4 border-t border-gray-200 pt-4 dark:border-white/10">
              <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.logoBackground")}</label>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[auto_auto_minmax(0,1fr)] xl:items-center">
                <input
                  type="color"
                  value={logoBackgroundDraft || "#ffffff"}
                  onChange={(e) => {
                    setLogoBackgroundDraft(e.target.value);
                    setBrandingStatus(null);
                  }}
                  className="h-10 w-14 cursor-pointer rounded-md border border-gray-300 bg-white px-1 py-1 dark:border-white/10 dark:bg-white/5"
                />
                <button type="button" onClick={handleLogoBackgroundReset} className={secondaryButtonClass}>
                  {t("settings.logoBackgroundReset")}
                </button>
                <input
                  value={logoBackgroundDraft}
                  onChange={(e) => {
                    setLogoBackgroundDraft(e.target.value);
                    setBrandingStatus(null);
                  }}
                  className={inputClass}
                  placeholder={t("settings.logoBackgroundPlaceholder")}
                />
              </div>
              <p className="mt-3 text-sm/6 text-gray-500 dark:text-gray-400">{t("settings.logoBackgroundHint")}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-8 dark:border-white/10">
            <button onClick={saveBranding} className={primaryButtonClass}>
              {t("common.save")}
            </button>
            <button onClick={resetBranding} className={secondaryButtonClass}>
              {t("settings.resetBranding")}
            </button>
            {brandingStatus ? <span className="text-sm text-red-500">{brandingStatus}</span> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
