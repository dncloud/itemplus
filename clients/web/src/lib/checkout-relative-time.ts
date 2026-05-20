export type CheckoutTranslate = (key: string, vars?: Record<string, string | number>) => string;

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function diffLocalDays(from: string, to: string) {
  const fromDate = new Date(from);
  const toDate = new Date(to);
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

  if (isOverdue) {
    const days = Math.max(1, Math.round(overdueDays ?? diffLocalDays(dueDate, nowIso)));
    if (days === 1) return t("checkouts.overdueSinceYesterday");

    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    if (weeks >= 1 && remainingDays > 0) {
      return t("checkouts.overdueSinceWeeksAndDays", { weeks, days: remainingDays });
    }
    if (weeks >= 1) {
      return t("checkouts.overdueSinceWeeks", { weeks });
    }
    return t("checkouts.overdueSinceDays", { days });
  }

  const remainingDays = diffLocalDays(nowIso, dueDate);
  if (remainingDays <= 0) return t(compact ? "checkouts.today" : "checkouts.dueToday");
  if (remainingDays === 1) return t(compact ? "checkouts.tomorrow" : "checkouts.dueTomorrow");
  return t(compact ? "checkouts.inDays" : "checkouts.dueInDays", { days: remainingDays });
}
