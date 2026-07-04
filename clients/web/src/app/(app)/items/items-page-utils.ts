import type { Item, Property } from "@/lib/api";
import { formatSelectCountValue } from "@/lib/property-options";

export function formatTimeDuration(value: string, locale: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? "0");
  const parts: string[] = [];
  const hourLabel = locale === "en" ? (hours === 1 ? "hour" : "hours") : (hours === 1 ? "Stunde" : "Stunden");
  const minuteLabel = locale === "en" ? (minutes === 1 ? "minute" : "minutes") : (minutes === 1 ? "Minute" : "Minuten");
  const secondLabel = locale === "en" ? (seconds === 1 ? "second" : "seconds") : (seconds === 1 ? "Sekunde" : "Sekunden");

  if (hours > 0) parts.push(`${hours} ${hourLabel}`);
  if (seconds === 0) {
    if (minutes > 0 || hours > 0) parts.push(`${minutes} ${minuteLabel}`);
    return parts.join(", ") || `0 ${minuteLabel}`;
  }
  if (minutes > 0) parts.push(`${minutes} ${minuteLabel}`);
  if (seconds > 0) parts.push(`${seconds} ${secondLabel}`);
  return parts.join(", ") || `0 ${secondLabel}`;
}

export function formatPropShort(val: unknown, type: string, locale: string): string {
  if (val == null) return "";
  if (typeof val === "boolean") return val ? (locale === "en" ? "Yes" : "Ja") : (locale === "en" ? "No" : "Nein");
  if (type === "rating") return "★".repeat(Number(val));
  if (type === "condition") {
    const labels: Record<string, string> = locale === "en"
      ? { new: "New", like_new: "Like new", very_good: "Very good", good: "Good", acceptable: "Acceptable", poor: "Poor", defective: "Defective" }
      : { new: "Neu", like_new: "Wie neu", very_good: "Sehr gut", good: "Gut", acceptable: "Akzeptabel", poor: "Schlecht", defective: "Defekt" };
    return labels[String(val)] || String(val);
  }
  if (type === "priority") {
    const labels: Record<string, string> = locale === "en"
      ? { low: "Low", medium: "Medium", high: "High", critical: "Critical" }
      : { low: "Niedrig", medium: "Mittel", high: "Hoch", critical: "Kritisch" };
    return labels[String(val)] || String(val);
  }
  if (type === "weight" && typeof val === "object") {
    const weight = val as Record<string, unknown>;
    return `${weight.value} ${weight.unit || "g"}`;
  }
  if (type === "time") return formatTimeDuration(String(val), locale);
  if (type === "select") return formatSelectCountValue(val, locale);
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (obj.length != null) return [obj.length, obj.width, obj.height].filter((value) => value != null).join("×");
    return "";
  }
  return String(val);
}

export function getListPropValues(item: Item, listProps: Property[]) {
  if (!item.properties) return [];
  return listProps
    .filter((property) => property.category_id === item.category_id && item.properties?.[String(property.id)] != null)
    .map((property) => ({
      id: property.id,
      name: property.name,
      unit: property.unit,
      value: item.properties![String(property.id)],
      type: property.property_type,
    }));
}

export function formatQuantityMeta(item: Item) {
  if (item.minimum_quantity != null && item.minimum_quantity > 0) {
    return `${item.quantity}/${item.minimum_quantity}`;
  }
  return String(item.quantity);
}

export function quantityValueTone(item: Item, warningPercent: number, criticalPercent: number) {
  if (!item.is_consumable || item.minimum_quantity == null || item.minimum_quantity <= 0) {
    return "text-gray-500 dark:text-gray-400";
  }
  const ratioPercent = (item.quantity / item.minimum_quantity) * 100;
  if (ratioPercent <= criticalPercent) return "text-red-600 dark:text-red-400";
  if (ratioPercent < warningPercent) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

export function formatCurrency(value: number, currency?: string | null) {
  return value.toLocaleString("de-DE", { style: "currency", currency: currency || "EUR" });
}
