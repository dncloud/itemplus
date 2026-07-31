"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { api, type MaintenanceReminder, type MaintenanceStats } from "@/lib/api";
import { useApp } from "@/lib/app-context";

function reminderTypeLabel(reminder: MaintenanceReminder, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (reminder.reminder_type === "custom" && reminder.custom_type_label?.trim()) {
    return reminder.custom_type_label.trim();
  }
  return reminder.reminder_type ? t(`maintenance.type.${reminder.reminder_type}`) : "";
}

function colorBadgeStyle(color?: string | null) {
  return color ? { backgroundColor: `${color}15`, color } : undefined;
}

function statusPill(reminder: MaintenanceReminder, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (reminder.is_overdue) {
    return {
      label: t("maintenancePage.overdue"),
      className: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
    };
  }
  return {
    label: t("maintenancePage.due"),
    className: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  };
}

export default function MaintenancePage() {
  const { realm, t, fmtDate, fmtDateTime, can } = useApp();
  const [stats, setStats] = useState<MaintenanceStats>({ items: [], history: [], due: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(0);
  const canReadMaintenance = can("maintenance.read");
  const canReadItems = can("items.read");

  useEffect(() => {
    let cancelled = false;
    void api.getMaintenanceStats()
      .then((response) => {
        if (!cancelled) setStats(response);
      })
      .catch(() => {
        if (!cancelled) setStats({ items: [], history: [], due: 0, overdue: 0 });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reminders = useMemo(
    () => (stats.items || []).filter((reminder) => reminder.realm === realm),
    [stats.items, realm],
  );
  const history = useMemo(
    () => (stats.history || []).filter((reminder) => reminder.realm === realm),
    [stats.history, realm],
  );

  const historyPageSize = 10;
  const historyPages = Math.max(1, Math.ceil(history.length / historyPageSize));
  const currentHistoryPage = Math.min(historyPage, historyPages - 1);
  const pagedHistory = history.slice(currentHistoryPage * historyPageSize, currentHistoryPage * historyPageSize + historyPageSize);
  const overdueCount = reminders.filter((reminder) => reminder.is_overdue).length;
  const dueCount = reminders.length;

  if (!canReadMaintenance) return <p className="py-10 text-center text-gray-500 dark:text-gray-400">Keine Berechtigung</p>;

  return (
    <div className="space-y-6">
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
              <li className="text-gray-500 dark:text-gray-400">{t(`realm.${realm}`)}</li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRight className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-900 dark:text-white">{t("nav.maintenance")}</li>
            </ol>
          </nav>
          <h2 className="text-2xl font-bold">{t("nav.maintenance")}</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white px-4 py-4 outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("maintenancePage.openTitle")}</div>
          <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{dueCount}</div>
        </div>
        <div className="rounded-xl bg-white px-4 py-4 outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("maintenancePage.overdue")}</div>
          <div className="mt-2 text-xl font-semibold text-rose-600 dark:text-rose-300">{overdueCount}</div>
        </div>
        <div className="rounded-xl bg-white px-4 py-4 outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("maintenancePage.historyTitle")}</div>
          <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{history.length}</div>
        </div>
      </div>

      <div className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
        <div className="border-b border-gray-200 px-4 py-4 dark:border-white/10 sm:px-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t("maintenancePage.openTitle")}</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : reminders.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 sm:px-6">{t("dashboard.maintenanceEmpty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-[13px] dark:divide-white/10">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("dashboard.maintenanceTask")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("dashboard.maintenanceItem")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("dashboard.maintenanceStatus")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("maintenancePage.due")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("checkouts.detailsColumn")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {reminders.map((reminder) => {
                  const status = statusPill(reminder, t);
                  const typeLabel = reminderTypeLabel(reminder, t);
                  return (
                    <tr key={`${reminder.realm}-${reminder.id}`} className="align-top hover:bg-gray-50/80 dark:hover:bg-white/5">
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        <div className="font-medium">{reminder.title}</div>
                        {typeLabel ? <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{typeLabel}</div> : null}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {canReadItems ? (
                          <Link href={`/maintenance/item/${reminder.item_id}`} className="font-medium hover:text-blue-600 dark:hover:text-blue-300">
                            {reminder.item_name || `#${reminder.item_id}`}
                          </Link>
                        ) : (
                          <span>{reminder.item_name || `#${reminder.item_id}`}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", status.className)}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{fmtDate(reminder.due_date)}</td>
                      <td className="px-4 py-3">
                        <div className="min-w-[220px] space-y-2 text-xs text-gray-500 dark:text-gray-400">
                          <div className="flex flex-wrap gap-2">
                            {reminder.category_name ? (
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${!reminder.category_color ? "bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-300" : ""}`}
                                style={colorBadgeStyle(reminder.category_color)}
                              >
                                {reminder.category_name}
                              </span>
                            ) : null}
                            {reminder.location_name ? (
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${!reminder.location_color ? "bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-300" : ""}`}
                                style={colorBadgeStyle(reminder.location_color)}
                              >
                                {reminder.location_name}
                              </span>
                            ) : null}
                          </div>
                          {reminder.notes ? <div>{reminder.notes}</div> : <div className="text-gray-400 dark:text-gray-500">-</div>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
        <div className="border-b border-gray-200 px-4 py-4 dark:border-white/10 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t("maintenancePage.historyTitle")}</h2>
            {historyPages > 1 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("maintenance.historyPage", { page: currentHistoryPage + 1, pages: historyPages })}</p>
            ) : null}
          </div>
        </div>
        {pagedHistory.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 sm:px-6">—</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-[13px] dark:divide-white/10">
                <thead className="bg-gray-50 dark:bg-white/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("dashboard.maintenanceTask")}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("dashboard.maintenanceItem")}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("dashboard.maintenanceStatus")}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("dashboard.maintenanceDoneAt")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {pagedHistory.map((entry) => {
                    const typeLabel = reminderTypeLabel(entry, t);
                    const statusLabel = entry.action === "completed" ? t("maintenance.status.completed") : t("maintenance.status.skipped");
                    return (
                      <tr key={`${entry.realm}-${entry.id}-${entry.performed_at || entry.completed_at || entry.updated_at || entry.due_date}`}>
                        <td className="px-4 py-3 text-gray-900 dark:text-white">
                          <div className="font-medium">{entry.title}</div>
                          {typeLabel ? <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{typeLabel}</div> : null}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {canReadItems ? (
                            <Link href={`/items/${entry.item_id}`} className="hover:text-blue-600 dark:hover:text-blue-300">
                              {entry.item_name || `#${entry.item_id}`}
                            </Link>
                          ) : (
                            <span>{entry.item_name || `#${entry.item_id}`}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{statusLabel}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{fmtDateTime(entry.performed_at || entry.completed_at || entry.updated_at || entry.due_date)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {historyPages > 1 ? (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-white/10 sm:px-6">
                <button
                  type="button"
                  onClick={() => setHistoryPage((page) => Math.max(0, page - 1))}
                  disabled={currentHistoryPage === 0}
                  className="text-sm text-gray-500 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:text-white"
                >
                  {t("common.previous")}
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryPage((page) => Math.min(historyPages - 1, page + 1))}
                  disabled={currentHistoryPage >= historyPages - 1}
                  className="text-sm text-gray-500 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:text-white"
                >
                  {t("common.next")}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
