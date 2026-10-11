"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, ChevronRight, CircleCheck, ClipboardCheck, FileText, LoaderCircle, MapPin, RefreshCw, ScanLine, Search, TriangleAlert } from "lucide-react";
import { FloatingNotification, type FloatingNotificationState } from "@/components/ui/floating-notification";
import SelectPicker from "@/components/ui/select-picker";
import { cancelButtonClass, saveButtonClass } from "@/components/ui/list-controls";
import {
  api,
  type InventoryCheckDetail,
  type InventoryCheckEntry,
  type InventoryCheckSummary,
  type Location,
} from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { wsClient } from "@/lib/ws";

export default function InventoryChecksPage() {
  const { realm, t, fmtDateTime, can, iosBridgeStatus } = useApp();
  const [activeSession, setActiveSession] = useState<InventoryCheckDetail | null>(null);
  const [recentSessions, setRecentSessions] = useState<InventoryCheckSummary[]>([]);
  const [reportDetail, setReportDetail] = useState<InventoryCheckDetail | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scanPending, setScanPending] = useState(false);
  const [selectedReportID, setSelectedReportID] = useState<number | null>(null);
  const [notification, setNotification] = useState<FloatingNotificationState>(null);
  const [search, setSearch] = useState("");
  const canReadInventory = can("inventory.read");
  const canWriteInventory = can("inventory.write");

  const showNotification = useCallback((titleText: string, tone: "success" | "error" | "info" = "success", message?: string) => {
    setNotification({ title: titleText, tone, message });
  }, []);

  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => setNotification(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notification]);

  useEffect(() => {
    if (!scanPending) return;
    const timer = window.setTimeout(() => setScanPending(false), 12000);
    return () => window.clearTimeout(timer);
  }, [scanPending]);

  useEffect(() => {
    if (iosBridgeStatus !== "connected") {
      setScanPending(false);
    }
  }, [iosBridgeStatus]);

  const loadOverview = useCallback(async (reportID?: number | null) => {
    setLoading(true);
    try {
      const [overview, locationList] = await Promise.all([
        api.getInventoryChecks({ realm }),
        api.getLocations().catch(() => [] as Location[]),
      ]);
      setActiveSession(overview.active_session || null);
      setRecentSessions(overview.recent_sessions || []);
      setLocations(locationList);

      if (reportID && (!overview.active_session || overview.active_session.session.id !== reportID)) {
        const detail = await api.getInventoryCheck(reportID).catch(() => null);
        setReportDetail(detail);
      } else {
        setReportDetail(null);
      }
    } finally {
      setLoading(false);
    }
  }, [realm]);

  useEffect(() => {
    void loadOverview(null);
    setSelectedReportID(null);
    setTitle("");
    setSelectedLocation(null);
  }, [loadOverview, realm]);

  const refreshActiveSession = useCallback(async (sessionID: number) => {
    const detail = await api.getInventoryCheck(sessionID);
    setActiveSession(detail);
    setRecentSessions((current) =>
      current.map((session) => (session.session.id === sessionID ? { session: detail.session, counts: detail.counts } : session)),
    );
  }, []);

  useEffect(() => {
    const handleBarcode = async (data: Record<string, unknown>) => {
      if (!activeSession) return;
      const nextRealm = typeof data.realm === "string" ? data.realm : realm;
      if (nextRealm !== realm) return;
      setScanPending(false);
      const code = typeof data.code === "string" ? data.code : "";
      const symbology = typeof data.symbology === "string" ? data.symbology : "";
      try {
        const result = await api.scanInventoryCheck(activeSession.session.id, { code, symbology, found_via: "scan" });
        await refreshActiveSession(activeSession.session.id);
        if (result.duplicate) {
          showNotification(t("inventoryChecks.duplicateScan"), "info");
        }
      } catch (error) {
        showNotification(error instanceof Error ? error.message : t("inventoryChecks.scanUnavailable"), "error");
      }
    };

    const handleQR = async (data: Record<string, unknown>) => {
      if (!activeSession) return;
      const nextRealm = typeof data.realm === "string" ? data.realm : realm;
      if (nextRealm !== realm) return;
      setScanPending(false);
      const itemID = Number(data.item_id);
      if (!Number.isFinite(itemID) || itemID <= 0) return;
      try {
        const result = await api.scanInventoryCheck(activeSession.session.id, { item_id: itemID, found_via: "scan" });
        await refreshActiveSession(activeSession.session.id);
        if (result.duplicate) {
          showNotification(t("inventoryChecks.duplicateScan"), "info");
        }
      } catch (error) {
        showNotification(error instanceof Error ? error.message : t("inventoryChecks.scanUnavailable"), "error");
      }
    };

    const handleUnavailable = () => {
      setScanPending(false);
      showNotification(t("inventoryChecks.scanUnavailable"), "error");
    };

    const unsubBarcode = wsClient.on("barcode.scanned", (data) => { void handleBarcode(data); });
    const unsubQR = wsClient.on("qr.scanned", (data) => { void handleQR(data); });
    const unsubUnavailable = wsClient.on("barcode.capture_unavailable", handleUnavailable);
    return () => {
      unsubBarcode();
      unsubQR();
      unsubUnavailable();
    };
  }, [activeSession, realm, refreshActiveSession, showNotification, t]);

  const openReport = useCallback(async (sessionID: number) => {
    setSelectedReportID(sessionID);
    setBusy(true);
    try {
      setReportDetail(await api.getInventoryCheck(sessionID));
    } finally {
      setBusy(false);
    }
  }, []);

  const startSession = async () => {
    setBusy(true);
    try {
      const detail = await api.startInventoryCheck({
        realm,
        location_id: selectedLocation,
        title: title.trim() || undefined,
      });
      setActiveSession(detail);
      setReportDetail(null);
      setSelectedReportID(null);
      setTitle("");
      showNotification(t("inventoryChecks.activeSession"));
      await loadOverview(null);
    } catch (error) {
      showNotification(error instanceof Error ? error.message : t("inventoryChecks.title"), "error");
    } finally {
      setBusy(false);
    }
  };

  const approveEntry = async (entryID: number) => {
    if (!activeSession) return;
    setBusy(true);
    try {
      await api.approveInventoryCheckEntry(activeSession.session.id, entryID);
      await refreshActiveSession(activeSession.session.id);
    } catch (error) {
      showNotification(error instanceof Error ? error.message : t("inventoryChecks.approve"), "error");
    } finally {
      setBusy(false);
    }
  };

  const correctEntryLocation = async (entryID: number) => {
    if (!activeSession) return;
    setBusy(true);
    try {
      await api.correctInventoryCheckEntryLocation(activeSession.session.id, entryID);
      await refreshActiveSession(activeSession.session.id);
    } catch (error) {
      showNotification(error instanceof Error ? error.message : t("inventoryChecks.correctLocation"), "error");
    } finally {
      setBusy(false);
    }
  };

  const finishSession = async () => {
    if (!activeSession) return;
    setBusy(true);
    try {
      const detail = await api.finishInventoryCheck(activeSession.session.id);
      setActiveSession(null);
      setReportDetail(detail);
      setSelectedReportID(detail.session.id);
      showNotification(t("inventoryChecks.reportReady"));
      await loadOverview(detail.session.id);
    } catch (error) {
      showNotification(error instanceof Error ? error.message : t("inventoryChecks.finishButton"), "error");
    } finally {
      setBusy(false);
    }
  };

  const requestScan = () => {
    if (iosBridgeStatus !== "connected") return;
    setScanPending(true);
    wsClient.send("barcode.capture_request", { realm });
  };

  const visibleDetail = activeSession || reportDetail;
  const expectedEntries = useMemo(
    () => (visibleDetail?.entries || []).filter((entry) => entry.expected_in_scope),
    [visibleDetail],
  );
  const expectedMainEntries = useMemo(
    () => expectedEntries.filter((entry) => entry.status !== "missing" && entry.status !== "location_mismatch" && entry.status !== "checked_out"),
    [expectedEntries],
  );
  const mismatchEntries = useMemo(
    () => expectedEntries.filter((entry) => entry.status === "location_mismatch"),
    [expectedEntries],
  );
  const checkedOutEntries = useMemo(
    () => expectedEntries.filter((entry) => entry.status === "checked_out"),
    [expectedEntries],
  );
  const unexpectedEntries = useMemo(
    () => (visibleDetail?.entries || []).filter((entry) => !entry.expected_in_scope),
    [visibleDetail],
  );
  const missingEntries = useMemo(
    () => expectedEntries.filter((entry) => entry.status === "missing"),
    [expectedEntries],
  );
  const canScan = iosBridgeStatus === "connected";

  // While walking through: what is still open comes first, and a name typed
  // into the search narrows the list for confirming by hand.
  const needle = search.trim().toLowerCase();
  const expectedShown = useMemo(() => {
    const matching = needle ? expectedMainEntries.filter((entry) => entry.item_name.toLowerCase().includes(needle)) : expectedMainEntries;
    return activeSession ? [...matching].sort((a, b) => Number(a.status !== "pending") - Number(b.status !== "pending")) : matching;
  }, [expectedMainEntries, needle, activeSession]);

  const counts = visibleDetail?.counts;
  const checkedCount = counts ? counts.expected - counts.pending : 0;
  const progress = counts && counts.expected > 0 ? Math.round((checkedCount / counts.expected) * 100) : 0;
  const reportIsClean = Boolean(counts && counts.missing === 0 && counts.location_mismatch === 0 && counts.unexpected === 0);

  const closeReport = () => {
    setReportDetail(null);
    setSelectedReportID(null);
  };

  if (!canReadInventory) {
    return <p className="py-10 text-center text-gray-500 dark:text-gray-400">{t("inventoryChecks.noPermission")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="mb-4 text-center sm:flex sm:items-center sm:justify-between sm:text-left lg:mb-8">
        <div className="space-y-1 py-3">
          <nav className="text-sm font-medium dark:text-gray-100">
            <ol className="flex items-center justify-center sm:justify-start">
              <li>
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">
                  {t("nav.dashboard")}
                </Link>
              </li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRight className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-500 dark:text-gray-400">{t(`realm.${realm}`)}</li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRight className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-900 dark:text-white">{t("nav.inventoryChecks")}</li>
            </ol>
          </nav>
          <h2 className="text-2xl font-bold">{t("nav.inventoryChecks")}</h2>
        </div>
        <div className="flex items-center justify-center gap-2 rounded-sm px-2 py-3 sm:justify-end sm:bg-transparent sm:px-0">
          <button
            type="button"
            onClick={() => void loadOverview(selectedReportID)}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-sm transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            title={t("common.refresh")}
            aria-label={t("common.refresh")}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Nothing running and no report open: say what a stocktaking is and start one. */}
      {!activeSession && !reportDetail ? (
        <div className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t("inventoryChecks.introTitle")}</h3>
            <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">{t("inventoryChecks.introText")}</p>
            <ol className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {([
                { icon: MapPin, title: "inventoryChecks.stepScopeTitle", text: "inventoryChecks.stepScopeText" },
                { icon: ClipboardCheck, title: "inventoryChecks.stepWalkTitle", text: canScan ? "inventoryChecks.stepWalkTextScan" : "inventoryChecks.stepWalkTextManual" },
                { icon: FileText, title: "inventoryChecks.stepReportTitle", text: "inventoryChecks.stepReportText" },
              ] as const).map((step, index) => (
                <li key={step.title} className="flex gap-3 rounded-lg bg-gray-50 p-4 dark:bg-white/2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white dark:bg-indigo-500">
                    <step.icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">{index + 1}. {t(step.title)}</span>
                    <span className="mt-0.5 block text-sm text-gray-500 dark:text-gray-400">{t(step.text)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          {canWriteInventory ? (
            <div className="grid grid-cols-1 gap-4 border-t border-gray-200 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end dark:border-white/10">
              <div>
                <label className="mb-2 inline-block text-sm/6 font-medium text-gray-900 dark:text-white">{t("inventoryChecks.scopeLabel")}</label>
                <SelectPicker
                  value={selectedLocation}
                  onChange={(value) => setSelectedLocation(typeof value === "number" ? value : value == null ? null : Number(value))}
                  options={locations.map((location) => ({ id: location.id, name: location.name }))}
                  placeholder={t("inventoryChecks.locationAll")}
                  clearLabel={t("inventoryChecks.locationAll")}
                />
              </div>
              <div>
                <label htmlFor="inventory-check-title" className="mb-2 inline-block text-sm/6 font-medium text-gray-900 dark:text-white">{t("inventoryChecks.customTitle")}</label>
                <input
                  id="inventory-check-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t("inventoryChecks.customTitlePlaceholder")}
                  className="h-[38px] w-full rounded-md bg-white px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                />
              </div>
              <button type="button" onClick={() => void startSession()} disabled={busy} className={clsx("h-[38px] disabled:cursor-not-allowed disabled:opacity-60", saveButtonClass)}>
                {t("inventoryChecks.startButton")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {visibleDetail && counts ? (
        <>
          <div className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
            <div className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
              <div className="min-w-0">
                {!activeSession ? (
                  <button type="button" onClick={closeReport} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                    <ArrowLeft aria-hidden="true" className="size-4" />
                    {t("inventoryChecks.backToOverview")}
                  </button>
                ) : null}
                <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                  {activeSession ? t("inventoryChecks.activeSession") : t("inventoryChecks.report")}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                  {visibleDetail.session.title?.trim() || t("nav.inventoryChecks")}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {visibleDetail.session.location_name?.trim() || t("inventoryChecks.locationAll")}
                  {visibleDetail.session.completed_at ? ` · ${fmtDateTime(visibleDetail.session.completed_at)}` : ""}
                </p>
              </div>
              {activeSession && canWriteInventory ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={requestScan}
                    disabled={busy || scanPending || !canScan}
                    className={clsx("inline-flex items-center gap-x-1.5 disabled:cursor-not-allowed disabled:opacity-60", cancelButtonClass)}
                    title={!canScan ? t("inventoryChecks.scanUnavailable") : undefined}
                  >
                    {scanPending ? <LoaderCircle aria-hidden="true" className="-ml-0.5 size-4 animate-spin" /> : <ScanLine aria-hidden="true" className="-ml-0.5 size-4" />}
                    {scanPending ? t("inventoryChecks.scanWaiting") : t("inventoryChecks.scanButton")}
                  </button>
                  <button type="button" onClick={() => void finishSession()} disabled={busy} className={clsx("disabled:cursor-not-allowed disabled:opacity-60", saveButtonClass)}>
                    {t("inventoryChecks.finishButton")}
                  </button>
                </div>
              ) : null}
            </div>

            {activeSession ? (
              <div className="px-4 pb-5 sm:px-6">
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">{t("inventoryChecks.progress", { done: checkedCount, total: counts.expected })}</span>
                  <span className="text-gray-500 dark:text-gray-400">{progress} %</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-indigo-600 transition-[width] dark:bg-indigo-500" style={{ width: `${progress}%` }} />
                </div>
                {!canScan ? <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{t("inventoryChecks.manualHint")}</p> : null}
              </div>
            ) : (
              <div className={clsx("mx-4 mb-5 flex items-start gap-3 rounded-md p-4 sm:mx-6", reportIsClean ? "bg-green-50 dark:bg-green-500/10 dark:outline dark:outline-green-500/20" : "bg-yellow-50 dark:bg-yellow-500/10 dark:outline dark:outline-yellow-500/15")}>
                {reportIsClean
                  ? <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-green-400" />
                  : <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-yellow-400 dark:text-yellow-300" />}
                <p className={clsx("text-sm font-medium", reportIsClean ? "text-green-800 dark:text-green-200" : "text-yellow-800 dark:text-yellow-100")}>
                  {reportIsClean
                    ? t("inventoryChecks.resultClean")
                    : [
                        counts.missing > 0 ? t("inventoryChecks.resultMissing", { count: counts.missing }) : "",
                        counts.location_mismatch > 0 ? t("inventoryChecks.resultMismatch", { count: counts.location_mismatch }) : "",
                        counts.unexpected > 0 ? t("inventoryChecks.resultUnexpected", { count: counts.unexpected }) : "",
                      ].filter(Boolean).join(" ")}
                </p>
              </div>
            )}

            {/* The figures in one band; the rarer ones only when there is something to say. */}
            <dl className="grid grid-cols-2 gap-px border-t border-gray-200 bg-gray-200 sm:grid-cols-4 dark:border-white/10 dark:bg-white/10">
              {[
                { label: t("inventoryChecks.expected"), value: counts.expected, always: true },
                { label: t("inventoryChecks.found"), value: counts.found, always: true },
                { label: activeSession ? t("inventoryChecks.pending") : t("inventoryChecks.missing"), value: activeSession ? counts.pending : counts.missing, always: true },
                { label: t("inventoryChecks.checkedOut"), value: counts.checked_out, always: true },
                { label: t("inventoryChecks.locationMismatch"), value: counts.location_mismatch },
                { label: t("inventoryChecks.unexpected"), value: counts.unexpected },
                { label: t("inventoryChecks.corrected"), value: counts.corrected },
              ].filter((entry) => entry.always || entry.value > 0).map((entry) => (
                <div key={entry.label} className="bg-white px-4 py-4 sm:px-6 dark:bg-gray-900">
                  <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{entry.label}</dt>
                  <dd className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{entry.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {activeSession && expectedMainEntries.length > 8 ? (
            <div className="grid grid-cols-1">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("inventoryChecks.searchPlaceholder")}
                aria-label={t("inventoryChecks.searchPlaceholder")}
                className="col-start-1 row-start-1 block w-full rounded-md bg-white py-1.5 pr-3 pl-10 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:pl-9 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
              />
              <Search aria-hidden="true" className="pointer-events-none col-start-1 row-start-1 ml-3 size-5 self-center text-gray-400 sm:size-4" />
            </div>
          ) : null}

          <EntriesTable
            title={t("inventoryChecks.expectedItems")}
            entries={expectedShown}
            activeSession={Boolean(activeSession)}
            canApprove={canWriteInventory}
            onApprove={(entryID) => void approveEntry(entryID)}
            canCorrect={Boolean(canWriteInventory)}
            onCorrectLocation={(entryID) => void correctEntryLocation(entryID)}
            t={t}
            fmtDateTime={fmtDateTime}
          />

          {checkedOutEntries.length > 0 ? (
            <EntriesTable
              title={t("inventoryChecks.checkedOutItems")}
              entries={checkedOutEntries}
              activeSession={Boolean(activeSession)}
              canApprove={canWriteInventory}
              onApprove={(entryID) => void approveEntry(entryID)}
              t={t}
              fmtDateTime={fmtDateTime}
            />
          ) : null}

          {mismatchEntries.length > 0 ? (
            <EntriesTable
              title={t("inventoryChecks.locationMismatchItems")}
              entries={mismatchEntries}
              activeSession={Boolean(activeSession)}
              canApprove={false}
              canCorrect={Boolean(canWriteInventory)}
              onCorrectLocation={(entryID) => void correctEntryLocation(entryID)}
              t={t}
              fmtDateTime={fmtDateTime}
            />
          ) : null}

          {unexpectedEntries.length > 0 ? (
            <EntriesTable
              title={t("inventoryChecks.unexpectedItems")}
              entries={unexpectedEntries}
              activeSession={Boolean(activeSession)}
              canApprove={false}
              canCorrect={Boolean(activeSession && canWriteInventory)}
              onCorrectLocation={(entryID) => void correctEntryLocation(entryID)}
              t={t}
              fmtDateTime={fmtDateTime}
            />
          ) : null}

          {!activeSession && missingEntries.length > 0 ? (
            <EntriesTable
              title={t("inventoryChecks.missingItems")}
              entries={missingEntries}
              activeSession={false}
              canApprove={false}
              t={t}
              fmtDateTime={fmtDateTime}
            />
          ) : null}
        </>
      ) : null}

      {(reportDetail && !activeSession) || (!loading && recentSessions.length === 0) ? null : (
      <div className="overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
        <div className="border-b border-gray-200 px-4 py-4 dark:border-white/10 sm:px-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t("inventoryChecks.recentSessions")}</h3>
        </div>
        {loading ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 sm:px-6">{t("common.loading")}</div>
        ) : recentSessions.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 sm:px-6">{t("inventoryChecks.noRecent")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-[13px] dark:divide-white/10">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryChecks.sessionTitle")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryChecks.locationLabel")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryChecks.found")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryChecks.checkedOut")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryChecks.missing")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryChecks.unexpected")}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryChecks.action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {recentSessions.map((summary) => (
                  <tr key={summary.session.id} className="hover:bg-gray-50/80 dark:hover:bg-white/5">
                    <td className="px-4 py-3 text-gray-900 dark:text-white">
                      <div className="font-medium">{summary.session.title?.trim() || t("nav.inventoryChecks")}</div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{fmtDateTime(summary.session.completed_at || summary.session.created_at)}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{summary.session.location_name?.trim() || t("inventoryChecks.locationAll")}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{summary.counts.found}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{summary.counts.checked_out}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{summary.counts.missing}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{summary.counts.unexpected}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void openReport(summary.session.id)}
                        disabled={busy}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        {t("inventoryChecks.openReport")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      <FloatingNotification notification={notification} onClose={() => setNotification(null)} t={t} />
    </div>
  );
}

function EntriesTable({
  title,
  entries,
  activeSession,
  canApprove,
  canCorrect = false,
  onApprove,
  onCorrectLocation,
  t,
  fmtDateTime,
}: {
  title: string;
  entries: InventoryCheckEntry[];
  activeSession: boolean;
  canApprove: boolean;
  canCorrect?: boolean;
  onApprove?: (entryID: number) => void;
  onCorrectLocation?: (entryID: number) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  fmtDateTime: (value?: string | null) => string;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
      <div className="border-b border-gray-200 px-4 py-4 dark:border-white/10 sm:px-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-[13px] dark:divide-white/10">
          <thead className="bg-gray-50 dark:bg-white/5">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryMovements.item")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("nav.categories")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryChecks.snapshotLocation")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryChecks.currentLocation")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryChecks.status")}</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryChecks.action")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-white/10">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50/80 dark:hover:bg-white/5">
                <td className="px-4 py-3 text-gray-900 dark:text-white">
                  <div className="font-medium">{entry.item_name}</div>
                  {entry.status === "checked_out" ? (
                    <div className="mt-1 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                      {entry.checkout_user_name ? (
                        <div>{t("inventoryChecks.checkedOutBy", { name: entry.checkout_user_name })}</div>
                      ) : null}
                      {entry.active_checkout_count > 1 ? (
                        <div>{t("inventoryChecks.checkedOutCount", { count: entry.active_checkout_count })}</div>
                      ) : null}
                      {entry.checkout_due_date ? (
                        <div>{t("inventoryChecks.checkedOutDue", { date: fmtDateTime(entry.checkout_due_date) })}</div>
                      ) : null}
                    </div>
                  ) : null}
                  {entry.found_via ? <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{entry.found_via === "manual" ? t("inventoryChecks.foundByManual") : t("inventoryChecks.foundByScan")}</div> : null}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{entry.category_name || "—"}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  <div>{entry.location_name || "—"}</div>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  <div>{entry.current_location_name || "—"}</div>
                  {entry.location_corrected && entry.corrected_location_name ? (
                    <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-300">{entry.corrected_location_name}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <span className={clsx("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", statusClass(entry.status))}>
                    {statusLabel(entry.status, t)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {activeSession && canApprove && entry.expected_in_scope && (entry.status === "pending" || entry.status === "checked_out") ? (
                      <button
                        type="button"
                        onClick={() => onApprove?.(entry.id)}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-300 px-3 text-xs font-semibold text-gray-900 transition hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-white/5"
                      >
                        {t("inventoryChecks.approve")}
                      </button>
                    ) : null}
                    {activeSession && canCorrect && !entry.location_corrected && (entry.status === "location_mismatch" || !entry.expected_in_scope) ? (
                      <button
                        type="button"
                        onClick={() => onCorrectLocation?.(entry.id)}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-300 px-3 text-xs font-semibold text-gray-900 transition hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-white/5"
                      >
                        {t("inventoryChecks.correctLocation")}
                      </button>
                    ) : null}
                    {!activeSession ? <span className="text-xs text-gray-400 dark:text-gray-500">—</span> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusLabel(status: string, t: (key: string, vars?: Record<string, string | number>) => string) {
  switch (status) {
    case "found":
      return t("inventoryChecks.statusFound");
    case "location_mismatch":
      return t("inventoryChecks.statusLocationMismatch");
    case "missing":
      return t("inventoryChecks.statusMissing");
    case "unexpected":
      return t("inventoryChecks.statusUnexpected");
    case "checked_out":
      return t("inventoryChecks.statusCheckedOut");
    default:
      return t("inventoryChecks.statusPending");
  }
}

function statusClass(status: string) {
  switch (status) {
    case "found":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
    case "location_mismatch":
      return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
    case "missing":
      return "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300";
    case "unexpected":
      return "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300";
    case "checked_out":
      return "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300";
  }
}
