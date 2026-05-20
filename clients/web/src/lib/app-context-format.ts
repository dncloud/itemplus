import type { DateFormat } from "./app-context-storage";

export function formatAppDate(dateFormat: DateFormat, dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());

  switch (dateFormat) {
    case "DD.MM.YYYY":
      return `${dd}.${mm}.${yyyy}`;
    case "MM/DD/YYYY":
      return `${mm}/${dd}/${yyyy}`;
    case "DD/MM/YYYY":
      return `${dd}/${mm}/${yyyy}`;
    case "YYYY-MM-DD":
      return `${yyyy}-${mm}-${dd}`;
    default:
      return `${dd}.${mm}.${yyyy}`;
  }
}

export function formatAppDateTime(
  dateFormat: DateFormat,
  dateStr: string | null | undefined,
): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${formatAppDate(dateFormat, dateStr)}, ${time}`;
}
