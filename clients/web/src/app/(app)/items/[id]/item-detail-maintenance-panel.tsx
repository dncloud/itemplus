"use client";

import { Fragment, useState, type FormEvent, type ReactNode } from "react";
import { Check, Clock3, Forward, Pencil, Trash2, X } from "lucide-react";
import SelectPicker from "@/components/ui/select-picker";
import type {
  MaintenanceReminder,
  MaintenanceReminderPayload,
  MaintenanceReminderType,
  MaintenanceRepeatUnit,
} from "@/lib/api";

function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function reminderStatusMeta(
  reminder: MaintenanceReminder,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (reminder.status !== "open") {
    return {
      label: reminder.action === "completed" ? t("maintenance.status.completed") : t("maintenance.status.skipped"),
      className: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300",
    };
  }

  if (reminder.is_overdue) {
    return {
      label: t("maintenance.stateOverdue"),
      className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    };
  }

  if (reminder.is_due) {
    return {
      label: t("maintenance.stateDue"),
      className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    };
  }

  return {
    label: t("maintenancePage.openTitle"),
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  };
}

function MaintenanceSection({
  title,
  description,
  headerActions,
  flush = false,
  children,
}: {
  title: string;
  description?: string;
  headerActions?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
      <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 dark:border-white/10 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          {description ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p> : null}
        </div>
        {headerActions ? <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">{headerActions}</div> : null}
      </div>
      <div className={flush ? "" : "space-y-4 px-4 py-4 sm:px-6"}>{children}</div>
    </div>
  );
}

export function ItemMaintenancePanel({
  reminders,
  history,
  canManage,
  fmtDate,
  t,
  onCreate,
  onUpdate,
  onComplete,
  onSkip,
  onDelete,
}: {
  reminders: MaintenanceReminder[];
  history: MaintenanceReminder[];
  canManage: boolean;
  fmtDate: (s: string | null | undefined) => string;
  t: (k: string, vars?: Record<string, string | number>) => string;
  onCreate?: (payload: MaintenanceReminderPayload) => Promise<void>;
  onUpdate?: (id: number, payload: MaintenanceReminderPayload) => Promise<void>;
  onComplete?: (id: number, note?: string) => Promise<void>;
  onSkip?: (id: number) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [reminderType, setReminderType] = useState<MaintenanceReminderType>("maintenance");
  const [customTypeLabel, setCustomTypeLabel] = useState("");
  const [dueDate, setDueDate] = useState(todayInputValue());
  const [repeatInterval, setRepeatInterval] = useState("");
  const [repeatUnit, setRepeatUnit] = useState<MaintenanceRepeatUnit>("months");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [completionNote, setCompletionNote] = useState("");
  const [completionSaving, setCompletionSaving] = useState(false);

  const open = reminders.filter((reminder) => reminder.status === "open");
  const overdueCount = open.filter((reminder) => reminder.is_overdue).length;
  const dueCount = open.filter((reminder) => reminder.is_due || reminder.is_overdue).length;
  const historyPageSize = 10;
  const historyPages = Math.max(1, Math.ceil(history.length / historyPageSize));
  const currentHistoryPage = Math.min(historyPage, historyPages - 1);
  const pagedHistory = history.slice(
    currentHistoryPage * historyPageSize,
    currentHistoryPage * historyPageSize + historyPageSize,
  );

  const typeLabels: Record<MaintenanceReminderType, string> = {
    maintenance: t("maintenance.type.maintenance"),
    warranty: t("maintenance.type.warranty"),
    inspection: t("maintenance.type.inspection"),
    custom: t("maintenance.type.custom"),
  };

  const unitLabels: Record<MaintenanceRepeatUnit, string> = {
    days: t("maintenance.unit.days"),
    weeks: t("maintenance.unit.weeks"),
    months: t("maintenance.unit.months"),
    years: t("maintenance.unit.years"),
  };

  const reminderTypeLabel = (reminder: Pick<MaintenanceReminder, "reminder_type" | "custom_type_label">) =>
    reminder.reminder_type === "custom" && reminder.custom_type_label?.trim()
      ? reminder.custom_type_label.trim()
      : typeLabels[reminder.reminder_type];

  const formatRepeat = (reminder: Pick<MaintenanceReminder, "repeat_interval" | "repeat_unit">) => {
    if (!reminder.repeat_interval || !reminder.repeat_unit) return "—";
    return t("maintenance.repeatsEvery", {
      count: reminder.repeat_interval,
      unit: unitLabels[reminder.repeat_unit],
    });
  };

  const parseNotes = (value?: string | null) => {
    const text = value?.trim();
    if (!text) {
      return null;
    }
    const [baseNote, completionNote] = text.split("\n\n---\n", 2).map((part) => part?.trim() || "");
    return {
      baseNote: baseNote || "",
      completionNote: completionNote || "",
    };
  };

  const renderNote = (value?: string | null) => {
    const parsed = parseNotes(value);
    if (!parsed) {
      return <span className="text-gray-400 dark:text-gray-500">—</span>;
    }
    const { baseNote, completionNote } = parsed;

    return (
      <div className="space-y-2 text-sm">
        {baseNote ? (
          <div className="whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300">
            {baseNote}
          </div>
        ) : null}
        {completionNote ? (
          <div className="space-y-1 border-t border-gray-200 pt-2 dark:border-white/10">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t("maintenance.completionNoteLabel")}
            </div>
            <div className="whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300">
              {completionNote}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const resetForm = () => {
    setTitle("");
    setReminderType("maintenance");
    setCustomTypeLabel("");
    setDueDate(todayInputValue());
    setRepeatInterval("");
    setRepeatUnit("months");
    setNotes("");
    setEditingId(null);
  };

  const resetCompletion = () => {
    setCompletingId(null);
    setCompletionNote("");
    setCompletionSaving(false);
  };

  const startEdit = (reminder: MaintenanceReminder) => {
    setTitle(reminder.title || "");
    setReminderType(reminder.reminder_type || "maintenance");
    setCustomTypeLabel(reminder.custom_type_label || "");
    setDueDate((reminder.due_date || todayInputValue()).slice(0, 10));
    setRepeatInterval(reminder.repeat_interval ? String(reminder.repeat_interval) : "");
    setRepeatUnit(reminder.repeat_unit || "months");
    setNotes(reminder.notes || "");
    setEditingId(reminder.id);
    setNotice(null);
  };

  const reminderPayload = (): MaintenanceReminderPayload => ({
    title: title.trim(),
    reminder_type: reminderType,
    custom_type_label: reminderType === "custom" ? customTypeLabel.trim() || null : null,
    due_date: dueDate,
    repeat_interval: repeatInterval ? Number(repeatInterval) : null,
    repeat_unit: repeatInterval ? repeatUnit : "",
    notes: notes.trim() || null,
  });

  const action = async (run: () => Promise<void>, successText: string) => {
    setNotice(null);
    try {
      await run();
      setNotice({ tone: "success", text: successText });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : t("maintenance.actionFailed") });
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !dueDate) return;
    setSaving(true);
    try {
      if (editingId != null) {
        if (!onUpdate) return;
        await onUpdate(editingId, reminderPayload());
        setNotice({ tone: "success", text: t("maintenance.updated") });
      } else {
        if (!onCreate) return;
        await onCreate(reminderPayload());
        setNotice({ tone: "success", text: t("maintenance.saved") });
      }
      resetForm();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : t("maintenance.actionFailed") });
    } finally {
      setSaving(false);
    }
  };

  const submitCompletion = async (reminderId: number) => {
    if (!onComplete) return;
    setCompletionSaving(true);
    await action(async () => {
      await onComplete(reminderId, completionNote);
      resetCompletion();
    }, t("maintenance.completed"));
    setCompletionSaving(false);
  };

  return (
    <section className="space-y-6">
      {notice ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            notice.tone === "success"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-rose-400/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <MaintenanceSection
        title={t("maintenancePage.openTitle")}
        description={t("maintenance.panelHint")}
        flush
        headerActions={
          <>
            {editingId != null ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
              >
                <X className="h-3.5 w-3.5" />
                {t("common.cancel")}
              </button>
            ) : null}
          </>
        }
      >
        <div className="border-b border-gray-200 px-4 py-4 dark:border-white/10 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-gray-300">
              {t("maintenancePage.openTitle")}: {open.length}
            </span>
            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              {t("maintenancePage.due")}: {dueCount}
            </span>
            <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
              {t("maintenancePage.overdue")}: {overdueCount}
            </span>
          </div>
        </div>
        {open.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 sm:px-6">{t("maintenance.empty")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-white/10">
              <thead className="bg-gray-50/90 dark:bg-white/5">
                <tr>
                  <th className="w-[28%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t("dashboard.maintenanceTask")}
                  </th>
                  <th className="w-[16%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t("maintenance.dueDate")}
                  </th>
                  <th className="w-[18%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t("maintenance.repeatEvery")}
                  </th>
                  <th className="w-[14%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t("dashboard.maintenanceStatus")}
                  </th>
                  <th className="w-[18%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t("maintenance.notes")}
                  </th>
                  {canManage ? (
                    <th className="w-[16%] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {t("common.actions")}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {open.map((reminder) => {
                  const status = reminderStatusMeta(reminder, t);
                  const isCompleting = completingId === reminder.id;
                  return (
                    <Fragment key={reminder.id}>
                        <tr className="align-top hover:bg-gray-50/80 dark:hover:bg-white/5">
                          <td className="px-4 py-4">
                            <div className="space-y-2">
                              <div className="text-[13px] font-medium text-gray-900 dark:text-white">{reminder.title}</div>
                              <div className="flex flex-wrap gap-2">
                                <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-gray-300">
                                  {reminderTypeLabel(reminder)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                            <div>{fmtDate(reminder.due_date)}</div>
                            {(reminder.is_due || reminder.is_overdue) ? (
                              <div className={`mt-2 text-xs font-medium ${reminder.is_overdue ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-300"}`}>
                                {status.label}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{formatRepeat(reminder)}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {renderNote(reminder.notes)}
                          </td>
                          {canManage ? (
                            <td className="px-4 py-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEdit(reminder)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                                  title={t("common.edit")}
                                  aria-label={t("common.edit")}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNotice(null);
                                    setCompletingId((current) => (current === reminder.id ? null : reminder.id));
                                    setCompletionNote("");
                                  }}
                                  disabled={!reminder.is_due}
                                  title={!reminder.is_due ? t("maintenance.notDueYet") : undefined}
                                  aria-label={t("maintenance.complete")}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void action(() => onSkip?.(reminder.id) || Promise.resolve(), t("maintenance.skipped"))}
                                  disabled={!reminder.is_due}
                                  title={!reminder.is_due ? t("maintenance.notDueYet") : undefined}
                                  aria-label={t("maintenance.skip")}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                                >
                                  <Forward className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void action(async () => {
                                      await onDelete?.(reminder.id);
                                      if (editingId === reminder.id) resetForm();
                                      if (completingId === reminder.id) resetCompletion();
                                    }, t("maintenance.deleted"))
                                  }
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                  title={t("common.delete")}
                                  aria-label={t("common.delete")}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                        {canManage && isCompleting ? (
                          <tr className="bg-gray-50/80 dark:bg-white/5">
                            <td colSpan={canManage ? 6 : 5} className="px-4 py-4">
                              <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-gray-950/40">
                                <label className="block space-y-2">
                                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    {t("maintenance.completionNote")}
                                  </span>
                                  <textarea
                                    value={completionNote}
                                    onChange={(event) => setCompletionNote(event.target.value)}
                                    rows={3}
                                    placeholder={t("maintenance.completionNotePlaceholder")}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                                  />
                                </label>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void submitCompletion(reminder.id)}
                                    disabled={completionSaving}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {completionSaving ? (
                                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5" />
                                    )}
                                    {t("maintenance.confirmComplete")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={resetCompletion}
                                    disabled={completionSaving}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    {t("common.cancel")}
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </MaintenanceSection>

      {history.length > 0 ? (
        <MaintenanceSection
          title={t("maintenancePage.historyTitle")}
          description={historyPages > 1 ? t("maintenance.historyPage", { page: currentHistoryPage + 1, pages: historyPages }) : undefined}
          flush
        >
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-white/10">
              <thead className="bg-gray-50/90 dark:bg-white/5">
                <tr>
                  <th className="w-[28%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t("dashboard.maintenanceTask")}
                  </th>
                  <th className="w-[16%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t("maintenance.dueDate")}
                  </th>
                  <th className="w-[14%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t("dashboard.maintenanceStatus")}
                  </th>
                  <th className="w-[18%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t("dashboard.maintenanceDoneAt")}
                  </th>
                  <th className="w-[24%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t("maintenance.notes")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {pagedHistory.map((entry) => {
                  const status = reminderStatusMeta(entry, t);
                  return (
                    <tr key={entry.id} className="align-top hover:bg-gray-50/80 dark:hover:bg-white/5">
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <div className="text-[13px] font-medium text-gray-900 dark:text-white">{entry.title}</div>
                          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-gray-300">
                            {reminderTypeLabel(entry)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{fmtDate(entry.due_date)}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <div className="inline-flex items-center gap-2">
                          <Clock3 className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                          {fmtDate(entry.performed_at || entry.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {renderNote(entry.notes)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {historyPages > 1 ? (
            <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-4 dark:border-white/10 sm:px-6">
              <button
                type="button"
                onClick={() => setHistoryPage((page) => Math.max(0, page - 1))}
                disabled={currentHistoryPage === 0}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
              >
                {t("common.previous")}
              </button>
              <button
                type="button"
                onClick={() => setHistoryPage((page) => Math.min(historyPages - 1, page + 1))}
                disabled={currentHistoryPage >= historyPages - 1}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
              >
                {t("common.next")}
              </button>
            </div>
          ) : null}
        </MaintenanceSection>
      ) : null}

      {canManage ? (
        <MaintenanceSection
          title={editingId != null ? t("common.edit") : t("maintenance.add")}
          description={t("maintenance.panelHint")}
        >
          <form onSubmit={submit}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t("maintenance.formTitle")}</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </label>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t("maintenance.typeLabel")}</span>
                <SelectPicker
                  value={reminderType}
                  onChange={(value) => {
                    const nextType = value as MaintenanceReminderType;
                    setReminderType(nextType);
                    if (nextType !== "custom") setCustomTypeLabel("");
                  }}
                  options={Object.entries(typeLabels).map(([id, name]) => ({ id, name }))}
                  searchable={false}
                  allowClear={false}
                />
              </div>

              {reminderType === "custom" ? (
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t("maintenance.customTypeLabel")}</span>
                  <input
                    value={customTypeLabel}
                    onChange={(event) => setCustomTypeLabel(event.target.value)}
                    placeholder={t("maintenance.customTypePlaceholder")}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </label>
              ) : null}

              <label className="space-y-1">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t("maintenance.dueDate")}</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 [color-scheme:light] dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark] dark:[&::-webkit-calendar-picker-indicator]:opacity-90"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t("maintenance.repeatEvery")}</span>
                  <input
                    type="number"
                    min="1"
                    value={repeatInterval}
                    onChange={(event) => setRepeatInterval(event.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </label>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-transparent">.</span>
                  <SelectPicker
                    value={repeatUnit}
                    onChange={(value) => setRepeatUnit(value as MaintenanceRepeatUnit)}
                    options={Object.entries(unitLabels).map(([id, name]) => ({ id, name }))}
                    searchable={false}
                    allowClear={false}
                    disabled={!repeatInterval}
                  />
                </div>
              </div>
            </div>

            <label className="mt-3 block space-y-1">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t("maintenance.notes")}</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving || !title.trim() || !dueDate}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? t("maintenance.saving") : editingId != null ? t("common.save") : t("maintenance.add")}
              </button>
              {editingId != null ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                >
                  {t("common.cancel")}
                </button>
              ) : null}
            </div>
          </form>
        </MaintenanceSection>
      ) : null}
    </section>
  );
}
