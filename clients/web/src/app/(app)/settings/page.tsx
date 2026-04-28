"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import { api, type User } from "@/lib/api";
import { LOCALES } from "@/lib/i18n";

export default function SettingsPage() {
  const { locale, setLocale, dateFormat, setDateFormat, iosDeleteConfirm, setIosDeleteConfirm, brandingLogo, brandingSubtitle, brandingWidth, refreshBranding, isAdmin, t } = useApp();
  const [locIssues, setLocIssues] = useState<{ issues: { realm: string; id: number; name: string; type: string }[]; total_checked: number } | null>(null);
  const [locFixing, setLocFixing] = useState(false);
  const [sessions, setSessions] = useState<{ id: number; device_type: string; device_name: string | null; ip_address: string | null; is_online: boolean; last_seen: string | null }[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [printer, setPrinter] = useState<{ host: string; port: number; speed: number; density: number; label_width: number; label_height: number; gap: number; reachable: boolean } | null>(null);
  const [printerStatus, setPrinterStatus] = useState<string | null>(null);
  const [testTspl, setTestTspl] = useState<string>("");
  const [testPrintStatus, setTestPrintStatus] = useState<string | null>(null);
  const [brandingStatus, setBrandingStatus] = useState<string | null>(null);
  const [subtitleDraft, setSubtitleDraft] = useState("");
  const [logoDraft, setLogoDraft] = useState<string | null>(null);
  const [widthDraft, setWidthDraft] = useState<number>(180);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    api.getMe().then((u) => {
      setMe(u);
      setProfileName(u.name || "");
      if (u.is_admin) {
        api.getPrinterStatus().then(setPrinter).catch(() => {});
      }
    }).catch(() => {});
    // Load sessions
    fetch(`${api.baseURL}/api/devices/sessions`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : { sessions: [] })
      .then((d) => setSessions(d.sessions || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSubtitleDraft(brandingSubtitle);
  }, [brandingSubtitle]);

  useEffect(() => {
    setLogoDraft(brandingLogo);
  }, [brandingLogo]);

  useEffect(() => {
    setWidthDraft(brandingWidth);
  }, [brandingWidth]);

  const saveProfile = async () => {
    setProfileStatus(null);
    try {
      await api.updateMe({ display_name: profileName });
      setProfileStatus(t("settings.profileSaved"));
      api.getMe().then(setMe);
    } catch {
      setProfileStatus(t("settings.profileFailed"));
    }
  };

  const logout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); } catch {}
    window.location.href = "/auth";
  };

  const checkLocations = async () => {
    try {
      const res = await fetch(`${api.baseURL}/api/admin/health/locations`, {
        credentials: "include",
      });
      if (res.ok) setLocIssues(await res.json());
    } catch {}
  };

  const fixLocations = async () => {
    setLocFixing(true);
    try {
      const res = await fetch(`${api.baseURL}/api/admin/health/locations/fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (res.ok) {
        await res.json();
        setLocIssues(null);
      }
    } catch {}
    setLocFixing(false);
  };

  const saveBranding = async () => {
    try {
      await api.updateBranding({ logo: logoDraft, subtitle: subtitleDraft.trim(), width: widthDraft });
      await refreshBranding();
      setBrandingStatus(t("settings.brandingSaved"));
      setTimeout(() => setBrandingStatus(null), 2500);
    } catch {
      setBrandingStatus(t("settings.brandingFailed"));
    }
  };

  const onLogoSelect = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setBrandingStatus(t("settings.brandingInvalid"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setBrandingStatus(t("settings.brandingTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoDraft(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>

      {/* Profile */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings.profile")}</h2>
        {me && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("settings.displayName")}</label>
                <input
                  value={profileName}
                  onChange={(e) => { setProfileName(e.target.value); setProfileStatus(null); }}
                  className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("settings.email")}</label>
                <input
                  type="email"
                  value={me.email || ""}
                  readOnly
                  className="w-full h-[38px] rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-gray-500 px-3 py-2 text-sm cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={saveProfile}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition"
              >
                {t("common.save")}
              </button>
              {me.is_admin ? (
                <span className="text-xs text-red-500 font-medium bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">{t("settings.administrator")}</span>
              ) : null}
              {profileStatus && (
                <span className={`text-sm ${profileStatus.includes("fehlgeschlagen") || profileStatus.toLowerCase().includes("failed") ? "text-red-500" : "text-green-600"}`}>{profileStatus}</span>
              )}
            </div>

</>
        )}
      </section>

      {/* Connected Devices — online first, max 5 */}
      {sessions.length > 0 && (() => {
        const online = sessions.filter((s) => s.is_online);
        const offline = sessions.filter((s) => !s.is_online);
        const display = [...online, ...offline.slice(0, Math.max(0, 5 - online.length))];
        return (
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-3">
          <h2 className="text-lg font-semibold">Devices</h2>
          <div className="space-y-2">
            {display.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.is_online ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.device_name || s.device_type}</p>
                  <p className="text-xs text-gray-400">
                    {[
                      s.device_type === "ios" ? "iOS App" : "Browser",
                      s.ip_address,
                      s.last_seen ? new Date(s.last_seen).toLocaleString() : null,
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button
                    onClick={async () => {
                      await fetch(`${api.baseURL}/api/devices/sessions/${s.id}`, {
                        method: "DELETE",
                        credentials: "include",
                      });
                      setSessions((prev) => prev.filter((x) => x.id !== s.id));
                    }}
                    className="text-xs text-red-500 hover:text-red-600"
                  >
                    {t("common.remove")}
                  </button>
              </div>
            ))}
          </div>
        </section>
        );
      })()}

      {/* Settings */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings.title")}</h2>

        {/* iOS Delete Confirmation */}
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-xs font-medium text-gray-500">{t("settings.iosDeleteConfirm")}</p>
            <p className="text-[10px] text-gray-400">{t("settings.iosDeleteConfirmHint")}</p>
          </div>
          <button
            onClick={() => setIosDeleteConfirm(!iosDeleteConfirm)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition shrink-0 ml-4 ${iosDeleteConfirm ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${iosDeleteConfirm ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </label>

        {/* Language */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <label className="block text-xs font-medium text-gray-500 mb-2">{t("settings.language")}</label>
          <div className="flex flex-wrap gap-2">
            {LOCALES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLocale(l.code)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition ${
                  locale === l.code
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <span className="text-base">{l.flag}</span> {l.name}
              </button>
            ))}
          </div>
        </div>

        {/* Date Format */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <label className="block text-xs font-medium text-gray-500 mb-2">{t("settings.dateFormat")}</label>
          <div className="flex flex-wrap gap-2">
            {(["DD.MM.YYYY", "MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setDateFormat(fmt)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition ${
                  dateFormat === fmt
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {isAdmin && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t("settings.branding")}</label>
            <p className="text-[11px] text-gray-400">{t("settings.brandingHint")}</p>
          </div>
          <div className="flex items-start gap-4">
            <div className="min-h-20 min-w-24 max-w-[22rem] shrink-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-hidden flex items-center justify-center px-3 py-3">
              <img src={logoDraft || "/logo.svg"} alt="Current site logo" className="max-h-20 max-w-full object-contain" />
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
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  {t("settings.chooseLogo")}
                </button>
                <button
                  onClick={() => {
                    setLogoDraft(null);
                    setBrandingStatus(null);
                  }}
                  className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  {t("common.remove")}
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("settings.logoWidth")}</label>
                <input
                  type="number"
                  min={80}
                  max={480}
                  step={10}
                  value={widthDraft}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setWidthDraft(Number.isFinite(next) ? Math.min(480, Math.max(80, next)) : 180);
                    setBrandingStatus(null);
                  }}
                  className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-[11px] text-gray-400">{t("settings.logoWidthHint")}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("settings.logoSubtitle")}</label>
                <textarea
                  value={subtitleDraft}
                  onChange={(e) => { setSubtitleDraft(e.target.value); setBrandingStatus(null); }}
                  rows={2}
                  maxLength={120}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t("settings.logoSubtitlePlaceholder")}
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={saveBranding}
                  className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition"
                >
                  {t("common.save")}
                </button>
                <button
                  onClick={async () => {
                    await api.resetBranding();
                    await refreshBranding();
                    setLogoDraft(null);
                    setSubtitleDraft("");
                    setWidthDraft(180);
                    setBrandingStatus(t("settings.brandingReset"));
                    setTimeout(() => setBrandingStatus(null), 2500);
                  }}
                  className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  {t("settings.resetBranding")}
                </button>
                {brandingStatus ? (
                  <span className={`text-sm ${brandingStatus === t("settings.brandingInvalid") || brandingStatus === t("settings.brandingTooLarge") || brandingStatus === t("settings.brandingFailed") ? "text-red-500" : "text-green-600"}`}>{brandingStatus}</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        )}
      </section>

      {/* Admin-only sections */}
      {isAdmin && (<>

      {/* Printer */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("settings.printerTitle")}</h2>
          {printer && (
            <span className={`h-2.5 w-2.5 rounded-full ${printer.reachable ? "bg-emerald-500" : "bg-gray-300"}`} />
          )}
        </div>
        {printer && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("settings.ipAddress")}</label>
                <input value={printer.host} onChange={(e) => setPrinter({ ...printer, host: e.target.value })} className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="192.168.1.100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("settings.port")}</label>
                <input type="number" value={printer.port} onChange={(e) => setPrinter({ ...printer, port: Number(e.target.value) })} className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("settings.labelWidth")}</label>
                <input type="number" value={printer.label_width} onChange={(e) => setPrinter({ ...printer, label_width: Number(e.target.value) })} className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("settings.labelHeight")}</label>
                <input type="number" value={printer.label_height} onChange={(e) => setPrinter({ ...printer, label_height: Number(e.target.value) })} className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("settings.speed")}</label>
                <input type="number" min={1} max={15} value={printer.speed} onChange={(e) => setPrinter({ ...printer, speed: Number(e.target.value) })} className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("settings.density")}</label>
                <input type="number" min={0} max={15} value={printer.density} onChange={(e) => setPrinter({ ...printer, density: Number(e.target.value) })} className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("settings.gap")}</label>
                <input type="number" step={0.1} value={printer.gap} onChange={(e) => setPrinter({ ...printer, gap: Number(e.target.value) })} className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await api.updatePrinterConfig(printer);
                  const updated = await api.getPrinterStatus();
                  setPrinter(updated);
                  setPrinterStatus(updated.reachable ? t("settings.printerConnected") : t("settings.printerNotReachable"));
                  setTimeout(() => setPrinterStatus(null), 3000);
                }}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition"
              >
                {t("common.save")}
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${api.baseURL}/api/print/calibrate`, {
                      method: "POST",
                      credentials: "include",
                    });
                    setPrinterStatus(res.ok ? t("settings.calibrated") : t("settings.error"));
                  } catch {
                    setPrinterStatus(t("settings.connectionError"));
                  }
                  setTimeout(() => setPrinterStatus(null), 3000);
                }}
                className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                {t("settings.calibrate")}
              </button>
              {printerStatus && (
                <span className={`self-center text-sm ${printerStatus === t("settings.printerConnected") || printerStatus === t("settings.calibrated") ? "text-green-600" : "text-red-500"}`}>{printerStatus}</span>
              )}
            </div>

            {/* Test Print */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t("settings.testPrint")}</h3>
                <button
                  onClick={async () => {
                    const res = await fetch(`${api.baseURL}/api/print/test/preview`, {
                      credentials: "include",
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setTestTspl(data.tspl);
                    }
                  }}
                  className="text-xs text-blue-500 hover:underline"
                >Standard-TSPL laden</button>
              </div>
              <textarea
                value={testTspl}
                onChange={(e) => setTestTspl(e.target.value)}
                placeholder="TSPL-Befehle hier eingeben oder Standard laden..."
                rows={10}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    setTestPrintStatus(null);
                    try {
                      const res = await fetch(`${api.baseURL}/api/print/test`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ tspl: testTspl || null }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setTestPrintStatus("Gedruckt");
                        if (!testTspl) setTestTspl(data.tspl);
                      } else {
                        const err = await res.json().catch(() => ({}));
                        setTestPrintStatus(err.detail || t("settings.error"));
                      }
                    } catch {
                      setTestPrintStatus(t("settings.connectionError"));
                    }
                    setTimeout(() => setTestPrintStatus(null), 3000);
                  }}
                  className="rounded-lg bg-gray-800 dark:bg-gray-200 dark:text-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:hover:bg-gray-300 transition"
                >
                  Drucken
                </button>
                {testPrintStatus && (
                  <span className={`text-sm ${testPrintStatus === "Gedruckt" ? "text-green-600" : "text-red-500"}`}>{testPrintStatus}</span>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Health Check */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings.healthCheck")}</h2>
        <p className="text-xs text-gray-500">{t("settings.healthCheckHint")}</p>
        <button
          onClick={checkLocations}
          className="rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-2 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        >
          {t("settings.checkLocations")}
        </button>
        {locIssues && (
          <div className="space-y-2">
            <p className="text-sm">
              {t("settings.locationsChecked", { n: locIssues.total_checked })} —{" "}
              {locIssues.issues.length === 0 ? (
                <span className="text-green-600 font-medium">{t("settings.noProblems")}</span>
              ) : (
                <span className="text-red-500 font-medium">{t("settings.problems", { n: locIssues.issues.length })}</span>
              )}
            </p>
            {locIssues.issues.length > 0 && (
              <>
                <div className="rounded-lg bg-red-50 dark:bg-red-900/10 p-3 space-y-1">
                  {locIssues.issues.map((iss) => (
                    <p key={`${iss.realm}-${iss.id}`} className="text-xs text-red-600 dark:text-red-400">
                      [{iss.realm}] {iss.name} — {iss.type === "self_parent" ? "Self-Parenting" : t("locations.circularError")}
                    </p>
                  ))}
                </div>
                <button
                  onClick={fixLocations}
                  disabled={locFixing}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 transition"
                >
                  {locFixing ? t("settings.fixing") : t("settings.fix", { n: locIssues.issues.length })}
                </button>
              </>
            )}
          </div>
        )}
      </section>
      </>)}

      {/* Account */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings.account")}</h2>
        <button
          onClick={logout}
          className="rounded-lg border border-red-300 dark:border-red-800 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
        >
          {t("nav.logout")}
        </button>
      </section>

      {/* About */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">item<span className="text-red-400">+</span></h2>
          <p className="text-sm text-gray-500">{t("settings.aboutText").replace("item+ — ", "")}</p>
        </div>
        <ul className="text-xs text-gray-500 space-y-1.5 list-none">
          {t("settings.aboutFeatures").split(". ").filter(Boolean).map((f, i) => (
            <li key={i} className="flex gap-2"><span className="text-gray-300 shrink-0">—</span> {f.replace(/\.$/, "")}</li>
          ))}
        </ul>
        <hr className="border-gray-100 dark:border-gray-800" />
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{t("settings.aboutCopyright")} · {t("settings.aboutLicense")}</span>
          <div className="flex gap-3">
            <a href={t("settings.aboutGithub")} target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition">GitHub</a>
            <a href={t("settings.aboutWebsite")} target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition">Website</a>
          </div>
        </div>
      </section>
    </div>
  );
}
