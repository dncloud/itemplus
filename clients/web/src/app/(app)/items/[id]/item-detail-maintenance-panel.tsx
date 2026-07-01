"use client";

import { useState, type FormEvent } from "react";
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

function reminderTone(reminder: MaintenanceReminder) {
  if (reminder.status !== "open") return "border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300";
  if (reminder.is_overdue) return "border-rose-400/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  if (reminder.is_due) return "border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
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
  onComplete?: (id: number) => Promise<void>;
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
  const open = reminders.filter((reminder) => reminder.status === "open");
  const historyPageSize = 10;
  const historyPages = Math.max(1, Math.ceil(history.length / historyPageSize));
  const currentHistoryPage = Math.min(historyPage, historyPages - 1);
  const pagedHistory = history.slice(currentHistoryPage * historyPageSize, currentHistoryPage * historyPageSize + historyPageSize);
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

  return (
    <section className="space-y-4 border-b border-gray-200 pb-6 dark:border-white/10">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t("maintenance.title")}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("maintenance.panelHint")}</p>
        </div>
      </div>
      <div className="space-y-4">
        {notice ? (
          <div className={`rounded-lg border px-3 py-2 text-sm ${
            notice.tone === "success"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-rose-400/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          }`}>
            {notice.text}
          </div>
        ) : null}

        {open.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("maintenance.empty")}</p>
        ) : (
          <div className="space-y-3">
            {open.map((reminder) => (
              <div key={reminder.id} className={`rounded-lg border px-4 py-3 ${reminderTone(reminder)}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white">{reminder.title}</p>
                      <span className="rounded-full border border-current/20 px-2 py-0.5 text-[11px] font-medium">{reminderTypeLabel(reminder)}</span>
                      {reminder.repeat_interval && reminder.repeat_unit ? (
                        <span className="rounded-full border border-current/20 px-2 py-0.5 text-[11px] font-medium">
                          {t("maintenance.repeatsEvery", { count: reminder.repeat_interval, unit: unitLabels[reminder.repeat_unit] })}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm">{t("maintenance.dueOn", { date: fmtDate(reminder.due_date) })}</p>
                    {reminder.notes ? <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{reminder.notes}</p> : null}
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(reminder)}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void action(() => onComplete?.(reminder.id) || Promise.resolve(), t("maintenance.completed"))}
                        disabled={!reminder.is_due}
                        title={!reminder.is_due ? t("maintenance.notDueYet") : undefined}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {t("maintenance.complete")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void action(() => onSkip?.(reminder.id) || Promise.resolve(), t("maintenance.skipped"))}
                        disabled={!reminder.is_due}
                        title={!reminder.is_due ? t("maintenance.notDueYet") : undefined}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                      >
                        {t("maintenance.skip")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void action(async () => {
                          await onDelete?.(reminder.id);
                          if (editingId === reminder.id) resetForm();
                        }, t("maintenance.deleted"))}
                        className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {history.length > 0 ? (
          <div className="border-t border-gray-100 pt-4 dark:border-white/5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("maintenance.history")}</p>
              {historyPages > 1 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("maintenance.historyPage", { page: currentHistoryPage + 1, pages: historyPages })}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              {pagedHistory.map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 dark:border-white/10 dark:text-gray-300">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{entry.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t("maintenance.dueOn", { date: fmtDate(entry.due_date) })}</p>
                  </div>
                  <div className="text-right">
                    <p>{entry.action === "completed" ? t("maintenance.status.completed") : t("maintenance.status.skipped")}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(entry.performed_at || entry.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
            {historyPages > 1 ? (
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setHistoryPage((page) => Math.max(0, page - 1))}
                  disabled={currentHistoryPage === 0}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                >
                  {t("common.previous")}
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryPage((page) => Math.min(historyPages - 1, page + 1))}
                  disabled={currentHistoryPage >= historyPages - 1}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                >
                  {t("common.next")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {canManage ? (
          <form onSubmit={submit} className="space-y-3 border-t border-gray-100 pt-4 dark:border-white/5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t("maintenance.formTitle")}</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
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
                  <input type="number" min="1" value={repeatInterval} onChange={(event) => setRepeatInterval(event.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
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
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t("maintenance.notes")}</span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={saving || !title.trim() || !dueDate} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? t("maintenance.saving") : editingId != null ? t("common.save") : t("maintenance.add")}
              </button>
              {editingId != null ? (
                <button type="button" onClick={resetForm} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5">
                  {t("common.cancel")}
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}
