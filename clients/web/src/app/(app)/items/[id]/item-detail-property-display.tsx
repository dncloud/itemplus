"use client";

import { useApp } from "@/lib/app-context";
import type { Property } from "@/lib/api";
import { ALL_AGE_RATINGS, CONDITIONS, PRIORITIES, PRIORITY_BADGE_CLASS } from "@/components/property-field/field";
import { MarkdownView } from "@/components/ui/markdown";
import { formatSelectCountValue } from "@/lib/property-options";

function formatTimeDuration(value: string, locale: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? "0");
  const parts: string[] = [];
  const hourLabel = locale === "en" ? (hours === 1 ? "hour" : "hours") : hours === 1 ? "Stunde" : "Stunden";
  const minuteLabel = locale === "en" ? (minutes === 1 ? "minute" : "minutes") : minutes === 1 ? "Minute" : "Minuten";
  const secondLabel = locale === "en" ? (seconds === 1 ? "second" : "seconds") : seconds === 1 ? "Sekunde" : "Sekunden";

  if (hours > 0) parts.push(`${hours} ${hourLabel}`);
  if (seconds === 0) {
    if (minutes > 0 || hours > 0) parts.push(`${minutes} ${minuteLabel}`);
    return parts.join(", ") || `0 ${minuteLabel}`;
  }
  if (minutes > 0) parts.push(`${minutes} ${minuteLabel}`);
  if (seconds > 0) parts.push(`${seconds} ${secondLabel}`);
  return parts.join(", ") || `0 ${secondLabel}`;
}

export function buildPropertyRows(properties: Property[], values: Record<string, unknown>) {
  const filled = properties.filter((property) => values[String(property.id)] != null);
  const widthUnits: Record<string, number> = { third: 2, half: 3, full: 6 };
  const rows: { prop: Property; span: number }[][] = [];
  let currentRow: { prop: Property; span: number }[] = [];
  let currentUnits = 0;

  for (const property of filled) {
    const width = property.display_width || "third";
    const units = widthUnits[width] || 2;

    if (units === 6) {
      if (currentRow.length > 0) {
        rows.push(currentRow);
        currentRow = [];
        currentUnits = 0;
      }
      rows.push([{ prop: property, span: 6 }]);
    } else if (currentUnits + units > 6) {
      rows.push(currentRow);
      currentRow = [{ prop: property, span: units }];
      currentUnits = units;
    } else {
      currentRow.push({ prop: property, span: units });
      currentUnits += units;
    }
  }

  if (currentRow.length > 0) rows.push(currentRow);
  return rows;
}

export function PropDisplay({ prop, val: rawVal }: { prop: Property; val: unknown }) {
  const { locale, t } = useApp();

  let val = rawVal;
  if (typeof val === "string") {
    if (val.startsWith("[") || val.startsWith("{")) {
      try {
        val = JSON.parse(val);
      } catch {}
    }
    if (typeof val === "string" && (val.startsWith("[") || val.startsWith("{"))) {
      try {
        val = JSON.parse(val);
      } catch {}
    }
  }

  const label = <p className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">{prop.name}</p>;
  const unitSuffix = prop.unit ? ` ${prop.unit}` : "";
  const badge = "inline-flex items-center px-2.5 py-1 rounded text-xs font-medium";

  switch (prop.property_type) {
    case "age_rating": {
      const ratings = Array.isArray(val) ? (val as string[]) : [String(val)];
      const matched = ratings.map((value) => ALL_AGE_RATINGS.find((rating) => rating.value === value)).filter(Boolean);
      if (matched.length === 0) return null;
      return (
        <div>
          {label}
          <div className="flex flex-wrap gap-2">
            {matched.map((rating) =>
              rating!.img ? (
                <img key={rating!.value} src={rating!.img} alt={`${rating!.system} ${rating!.label}`} className="h-10 w-auto" title={`${rating!.system} ${rating!.label}`} />
              ) : (
                <span key={rating!.value} className={`${badge} bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300`}>
                  <span className="mr-1 text-gray-400">{rating!.system}</span>
                  {rating!.label}
                </span>
              ),
            )}
          </div>
        </div>
      );
    }
    case "condition": {
      const condition = CONDITIONS.find((entry) => entry.value === String(val));
      return <div>{label}<span className={`${badge} bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300`}>{condition ? condition.label[locale] : String(val)}</span></div>;
    }
    case "priority": {
      const priority = PRIORITIES.find((entry) => entry.value === String(val));
      return (
        <div>
          {label}
          {priority ? (
            <span className={`${badge} ${PRIORITY_BADGE_CLASS[priority.value].idle}`}>{priority.label[locale]}</span>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">{String(val)}</p>
          )}
        </div>
      );
    }
    case "rating": {
      const rating = Number(val);
      return (
        <div>
          {label}
          <div className="flex gap-0.5 text-lg">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className={star <= rating ? "text-amber-400" : "text-gray-300 dark:text-gray-600"}>★</span>
            ))}
          </div>
        </div>
      );
    }
    case "weight": {
      if (typeof val === "object" && val) {
        const weight = val as Record<string, unknown>;
        return <div>{label}<p className="text-xs text-gray-500 dark:text-gray-400">{String(weight.value)} {String(weight.unit || "g")}</p></div>;
      }
      return <div>{label}<p className="text-xs text-gray-500 dark:text-gray-400">{String(val)}</p></div>;
    }
    case "boolean":
      return <div>{label}<p className="text-xs text-gray-500 dark:text-gray-400">{val === true || val === "true" ? t("common.yes") : t("common.no")}</p></div>;
    case "dimensions": {
      if (typeof val === "object" && val) {
        const dimensions = val as Record<string, unknown>;
        return <div>{label}<p className="text-xs text-gray-500 dark:text-gray-400">{[dimensions.length, dimensions.width, dimensions.height].filter((value) => value != null).join(" × ")}{unitSuffix}</p></div>;
      }
      return <div>{label}<p className="text-xs text-gray-500 dark:text-gray-400">{String(val)}{unitSuffix}</p></div>;
    }
    case "number":
      return <div>{label}<p className="text-xs text-gray-500 dark:text-gray-400">{String(val)}{unitSuffix}</p></div>;
    case "select":
      return <div>{label}<p className="text-xs text-gray-500 dark:text-gray-400">{formatSelectCountValue(val, locale)}{unitSuffix}</p></div>;
    case "time":
      return <div>{label}<p className="text-xs text-gray-500 dark:text-gray-400">{formatTimeDuration(String(val), locale)}</p></div>;
    case "textblock":
      return <div>{label}<div className="text-sm/6 text-gray-700 dark:text-gray-300"><MarkdownView content={String(val)} /></div></div>;
    default: {
      let display = val;
      if (typeof val === "string" && val.startsWith("[")) {
        try {
          display = JSON.parse(val);
        } catch {}
      }
      return <div>{label}<p className="text-xs text-gray-500 dark:text-gray-400">{Array.isArray(display) ? display.join(", ") : String(display)}{unitSuffix}</p></div>;
    }
  }
}
