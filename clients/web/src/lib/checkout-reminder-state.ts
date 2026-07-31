import type { CheckoutTranslate } from "@/lib/checkout-relative-time";

function parseReminderDate(value: string) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return new Date(value);
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function formatReminderCooldownLabel(nextReminderAt: string | undefined, t: CheckoutTranslate) {
  if (!nextReminderAt) return null;
  const next = parseReminderDate(nextReminderAt);
  if (Number.isNaN(next.getTime())) return null;
  const now = new Date();
  const milliseconds = startOfLocalDay(next).getTime() - startOfLocalDay(now).getTime();
  const days = Math.max(1, Math.round(milliseconds / 86400000));
  return t("checkouts.reminderAgainInDays", { days });
}
