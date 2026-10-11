"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CalendarClock, ChevronRight, CircleCheck, SkipForward, Wrench } from "lucide-react";
import { api, type MaintenanceReminder, type MaintenanceStats } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { formatCheckoutRelativeState } from "@/lib/checkout-relative-time";
import { ColorChip } from "@/components/ui/color-chip";
import { cancelButtonClass } from "@/components/ui/list-controls";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

const HISTORY_STEP = 10;

function reminderTypeLabel(reminder: MaintenanceReminder, t: Translate) {
  if (reminder.reminder_type === "custom" && reminder.custom_type_label?.trim()) {
    return reminder.custom_type_label.trim();
  }
  return reminder.reminder_type ? t(`maintenance.type.${reminder.reminder_type}`) : "";
}

/**
 * What is due across all items of the realm, and what was done lately.
 * Creating, completing and skipping a reminder happens on the maintenance
 * page of its item; every row here leads there.
 */
export default function MaintenancePage() {
  const { realm, t, fmtDate, fmtDateTime, can } = useApp();
  const [stats, setStats] = useState<MaintenanceStats>({ items: [], history: [], due: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"open" | "done">("open");
  const [historyShown, setHistoryShown] = useState(HISTORY_STEP);
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

  // Overdue first, then by date: the most pressing reminder is on top.
  const reminders = useMemo(
    () => (stats.items || [])
      .filter((reminder) => reminder.realm === realm)
      .sort((a, b) => Number(Boolean(b.is_overdue)) - Number(Boolean(a.is_overdue)) || a.due_date.localeCompare(b.due_date)),
    [stats.items, realm],
  );
  const history = useMemo(
    () => (stats.history || []).filter((reminder) => reminder.realm === realm),
    [stats.history, realm],
  );
  const overdueCount = reminders.filter((reminder) => reminder.is_overdue).length;

  if (!can("maintenance.read")) {
    return <p className="py-10 text-center text-gray-500 dark:text-gray-400">{t("inventoryChecks.noPermission")}</p>;
  }

  const summary = reminders.length === 0
    ? t("maintenancePage.summaryNone")
    : overdueCount > 0
      ? t("maintenancePage.summaryOverdue", { open: reminders.length, overdue: overdueCount })
      : t("maintenancePage.summaryOpen", { open: reminders.length });

  const tabs = [
    { value: "open" as const, label: t("maintenancePage.tabOpen"), count: reminders.length },
    { value: "done" as const, label: t("maintenancePage.tabDone"), count: history.length },
  ];

  const itemLink = (reminder: MaintenanceReminder) => {
    const name = reminder.item_name || `#${reminder.item_id}`;
    return canReadItems
      ? <Link href={`/maintenance/item/${reminder.item_id}`} className="font-medium text-gray-700 hover:underline dark:text-gray-200">{name}</Link>
      : <span className="font-medium text-gray-700 dark:text-gray-200">{name}</span>;
  };

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
          {!loading ? <p className="text-sm text-gray-500 dark:text-gray-400">{summary}</p> : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
        <div className="flex flex-wrap gap-2 border-b border-gray-200 px-4 py-3 sm:px-6 dark:border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={view === tab.value}
              onClick={() => setView(tab.value)}
              className={clsx(
                "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition",
                view === tab.value
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
              )}
            >
              {tab.label}
              <span className={clsx("rounded-full px-2 py-0.5 text-xs", view === tab.value ? "bg-indigo-200/70 dark:bg-indigo-500/30" : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300")}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : view === "open" ? (
          reminders.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <CalendarClock aria-hidden="true" className="mx-auto size-8 text-gray-300 dark:text-gray-600" />
              <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">{t("maintenancePage.emptyTitle")}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">{t("maintenancePage.emptyText")}</p>
              {canReadItems ? (
                <div className="mt-5">
                  <Link href="/items" className={clsx("inline-flex", cancelButtonClass)}>{t("maintenancePage.emptyAction")}</Link>
                </div>
              ) : null}
            </div>
          ) : (
            <ul role="list" className="divide-y divide-gray-100 dark:divide-white/5">
              {reminders.map((reminder) => {
                const typeLabel = reminderTypeLabel(reminder, t);
                const relative = formatCheckoutRelativeState({ dueDate: reminder.due_date, isOverdue: reminder.is_overdue, t });
                return (
                  <li key={`${reminder.realm}-${reminder.id}`} className="flex items-start gap-4 px-4 py-4 hover:bg-gray-50 sm:px-6 dark:hover:bg-white/2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400">
                      <Wrench aria-hidden="true" className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 dark:text-white">
                        <span className="font-semibold">{reminder.title}</span>
                        {typeLabel ? <span className="ml-2 text-gray-500 dark:text-gray-400">{typeLabel}</span> : null}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                        {itemLink(reminder)}
                        {reminder.category_name ? <ColorChip label={reminder.category_name} color={reminder.category_color} /> : null}
                        {reminder.location_name ? <ColorChip label={reminder.location_name} color={reminder.location_color} /> : null}
                      </div>
                      {reminder.notes ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{reminder.notes}</p> : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={clsx("text-sm font-semibold", reminder.is_overdue ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white")}>{relative || fmtDate(reminder.due_date)}</p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{fmtDate(reminder.due_date)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : history.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-gray-500 sm:px-6 dark:text-gray-400">{t("maintenancePage.historyEmpty")}</p>
        ) : (
          <>
            <ul role="list" className="divide-y divide-gray-100 dark:divide-white/5">
              {history.slice(0, historyShown).map((entry) => {
                const typeLabel = reminderTypeLabel(entry, t);
                const completed = entry.action === "completed";
                const when = entry.performed_at || entry.completed_at || entry.updated_at || entry.due_date;
                const Icon = completed ? CircleCheck : SkipForward;
                return (
                  <li key={`${entry.realm}-${entry.id}-${when}`} className="flex items-start gap-4 px-4 py-4 sm:px-6">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400">
                      <Icon aria-hidden="true" className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 dark:text-white">
                        <span className="font-semibold">{entry.title}</span>
                        {typeLabel ? <span className="ml-2 text-gray-500 dark:text-gray-400">{typeLabel}</span> : null}
                      </p>
                      <p className="mt-1 text-sm">{itemLink(entry)}</p>
                      {entry.notes ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{entry.notes}</p> : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{completed ? t("maintenance.status.completed") : t("maintenance.status.skipped")}</p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {[fmtDateTime(when), entry.performed_by_name].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {history.length > historyShown ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 sm:px-6 dark:border-white/10">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("maintenancePage.historyShown", { shown: historyShown, total: history.length })}</p>
                <button type="button" onClick={() => setHistoryShown((shown) => shown + HISTORY_STEP)} className={cancelButtonClass}>{t("inventoryMovements.loadMore")}</button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
