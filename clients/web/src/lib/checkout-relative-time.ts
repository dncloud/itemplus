export type CheckoutTranslate = (key: string, vars?: Record<string, string | number>) => string;

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseCheckoutDate(value: string) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return new Date(value);
}

function diffLocalDays(from: string, to: string) {
  const fromDate = parseCheckoutDate(from);
  const toDate = parseCheckoutDate(to);
  const milliseconds = startOfLocalDay(toDate).getTime() - startOfLocalDay(fromDate).getTime();
  return Math.round(milliseconds / 86400000);
}

export function formatCheckoutRelativeState({
  dueDate,
  isOverdue,
  overdueDays,
  t,
  nowIso = new Date().toISOString(),
  compact = false,
}: {
  dueDate?: string | null;
  isOverdue?: boolean;
  overdueDays?: number;
  t: CheckoutTranslate;
  nowIso?: string;
  compact?: boolean;
}) {
  if (!dueDate) return null;

  const remainingDays = diffLocalDays(nowIso, dueDate);
  if (Number.isNaN(remainingDays)) return null;
  const effectivelyOverdue = isOverdue ?? remainingDays < 0;

  if (effectivelyOverdue) {
    const days = Math.max(1, Math.round(overdueDays ?? Math.abs(remainingDays)));
    if (days === 1) return t("checkouts.overdueSinceYesterday");

    const weeks = Math.floor(days / 7);
    const remainingOverdueDays = days % 7;
    if (weeks >= 1 && remainingOverdueDays > 0) {
      return t("checkouts.overdueSinceWeeksAndDays", { weeks, days: remainingOverdueDays });
    }
    if (weeks >= 1) {
      return t("checkouts.overdueSinceWeeks", { weeks });
    }
    return t("checkouts.overdueSinceDays", { days });
  }

  if (remainingDays <= 0) return t(compact ? "checkouts.today" : "checkouts.dueToday");
  if (remainingDays === 1) return t(compact ? "checkouts.tomorrow" : "checkouts.dueTomorrow");
  return t(compact ? "checkouts.inDays" : "checkouts.dueInDays", { days: remainingDays });
}
