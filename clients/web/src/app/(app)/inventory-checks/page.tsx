"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronRight, RefreshCw, ScanLine } from "lucide-react";
import { FloatingNotification, type FloatingNotificationState } from "@/components/ui/floating-notification";
import SelectPicker from "@/components/ui/select-picker";
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
  const { realm, t, fmtDateTime, can } = useApp();
  const [activeSession, setActiveSession] = useState<InventoryCheckDetail | null>(null);
  const [recentSessions, setRecentSessions] = useState<InventoryCheckSummary[]>([]);
  const [reportDetail, setReportDetail] = useState<InventoryCheckDetail | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedReportID, setSelectedReportID] = useState<number | null>(null);
  const [notification, setNotification] = useState<FloatingNotificationState>(null);
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
    wsClient.send("barcode.capture_request", { realm });
  };

  const visibleDetail = activeSession || reportDetail;
  const expectedEntries = useMemo(
    () => (visibleDetail?.entries || []).filter((entry) => entry.expected_in_scope),
    [visibleDetail],
  );
  const expectedMainEntries = useMemo(
    () => expectedEntries.filter((entry) => entry.status !== "missing" && entry.status !== "location_mismatch"),
    [expectedEntries],
  );
  const mismatchEntries = useMemo(
    () => expectedEntries.filter((entry) => entry.status === "location_mismatch"),
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

  if (!canReadInventory) {
    return <p className="py-10 text-center text-gray-500 dark:text-gray-400">Keine Berechtigung</p>;
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
            title={t("common.open")}
            aria-label={t("common.open")}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!activeSession ? (
        <div className="rounded-xl bg-white p-4 outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10 sm:p-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
            <div>
              <label className="mb-2 inline-block text-sm/6 font-medium text-gray-900 dark:text-white">{t("inventoryChecks.locationLabel")}</label>
              <SelectPicker
                value={selectedLocation}
                onChange={(value) => setSelectedLocation(typeof value === "number" ? value : value == null ? null : Number(value))}
                options={locations.map((location) => ({ id: location.id, name: location.name }))}
                placeholder={t("inventoryChecks.locationAll")}
                clearLabel={t("inventoryChecks.locationAll")}
              />
            </div>
            <div>
              <label className="mb-2 inline-block text-sm/6 font-medium text-gray-900 dark:text-white">{t("inventoryChecks.customTitle")}</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("inventoryChecks.customTitlePlaceholder")}
                className="h-[38px] w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
            {canWriteInventory ? (
              <button
                type="button"
                onClick={() => void startSession()}
                disabled={busy}
                className="inline-flex h-[38px] items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("inventoryChecks.startButton")}
              </button>
            ) : null}
          </div>
          {!recentSessions.length ? (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{t("inventoryChecks.noActive")}</p>
          ) : null}
        </div>
      ) : null}

      {visibleDetail ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-7">
            <StatCard label={t("inventoryChecks.expected")} value={visibleDetail.counts.expected} />
            <StatCard label={t("inventoryChecks.pending")} value={visibleDetail.counts.pending} />
            <StatCard label={t("inventoryChecks.found")} value={visibleDetail.counts.found} />
            <StatCard label={t("inventoryChecks.missing")} value={visibleDetail.counts.missing} />
            <StatCard label={t("inventoryChecks.unexpected")} value={visibleDetail.counts.unexpected} />
            <StatCard label={t("inventoryChecks.locationMismatch")} value={visibleDetail.counts.location_mismatch} />
            <StatCard label={t("inventoryChecks.corrected")} value={visibleDetail.counts.corrected} />
          </div>

          <div className="rounded-xl bg-white p-4 outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryChecks.sessionTitle")}</p>
                <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                  {visibleDetail.session.title?.trim() || t("nav.inventoryChecks")}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {visibleDetail.session.location_name?.trim() || t("inventoryChecks.locationAll")}
                  {visibleDetail.session.completed_at ? ` · ${fmtDateTime(visibleDetail.session.completed_at)}` : ""}
                </p>
              </div>
              {activeSession ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={requestScan}
                    disabled={busy}
                    className="inline-flex h-[38px] items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-white dark:hover:bg-white/5"
                  >
                    <ScanLine className="h-4 w-4" />
                    {t("inventoryChecks.scanButton")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void finishSession()}
                    disabled={busy}
                    className="inline-flex h-[38px] items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t("inventoryChecks.finishButton")}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <EntriesTable
            title={t("inventoryChecks.expectedItems")}
            entries={expectedMainEntries}
            activeSession={Boolean(activeSession)}
            canApprove={canWriteInventory}
            onApprove={(entryID) => void approveEntry(entryID)}
            canCorrect={Boolean(canWriteInventory)}
            onCorrectLocation={(entryID) => void correctEntryLocation(entryID)}
            t={t}
          />

          {mismatchEntries.length > 0 ? (
            <EntriesTable
              title={t("inventoryChecks.locationMismatchItems")}
              entries={mismatchEntries}
              activeSession={Boolean(activeSession)}
              canApprove={false}
              canCorrect={Boolean(canWriteInventory)}
              onCorrectLocation={(entryID) => void correctEntryLocation(entryID)}
              t={t}
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
            />
          ) : null}

          {!activeSession && missingEntries.length > 0 ? (
            <EntriesTable
              title={t("inventoryChecks.missingItems")}
              entries={missingEntries}
              activeSession={false}
              canApprove={false}
              t={t}
            />
          ) : null}
        </>
      ) : null}

      <div className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
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
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{summary.counts.missing}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{summary.counts.unexpected}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void openReport(summary.session.id)}
                        disabled={busy}
                        className="text-sm font-medium text-blue-600 hover:text-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {t("common.open")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FloatingNotification notification={notification} onClose={() => setNotification(null)} t={t} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white px-4 py-4 outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{value}</div>
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
}: {
  title: string;
  entries: InventoryCheckEntry[];
  activeSession: boolean;
  canApprove: boolean;
  canCorrect?: boolean;
  onApprove?: (entryID: number) => void;
  onCorrectLocation?: (entryID: number) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
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
                    {activeSession && canApprove && entry.expected_in_scope && entry.status === "pending" ? (
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
    default:
      return "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300";
  }
}
