import type { Locale } from "@/lib/i18n-data";

const CUSTOM_OPTION_PATTERNS = [
  /^other(?:\s*\(.*\))?$/i,
  /^andere(?:\s*\(.*\))?$/i,
  /\bfree\s*text\b/i,
  /\bfreitext\b/i,
];

export type PropertyOptionConfig = {
  choices: string[];
  allowCustom: boolean;
  customLabel: string;
  withCount: boolean;
  countLabel: string;
};

function defaultCustomLabel(locale?: string) {
  return String(locale || "").toLowerCase().startsWith("de") ? "Andere (Freitext)" : "Other (Free text)";
}

export function defaultCountLabel(locale?: string) {
  return String(locale || "").toLowerCase().startsWith("de") ? "Anzahl" : "Count";
}

function normalizeDefaultCountLabel(label: string, locale?: string) {
  const trimmed = label.trim();
  if (trimmed === "Count" || trimmed === "Anzahl") {
    return defaultCountLabel(locale);
  }
  return trimmed;
}

export function isCustomOptionChoice(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return CUSTOM_OPTION_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function getPropertyOptionConfig(raw: unknown, locale?: Locale | string): PropertyOptionConfig {
  const config: PropertyOptionConfig = {
    choices: [],
    allowCustom: false,
    customLabel: defaultCustomLabel(locale),
    withCount: false,
    countLabel: defaultCountLabel(locale),
  };

  if (!raw || typeof raw !== "object") {
    return config;
  }

  const source = raw as Record<string, unknown>;
  if (typeof source.allow_custom === "boolean") {
    config.allowCustom = source.allow_custom;
  }
  if (typeof source.custom_label === "string" && source.custom_label.trim()) {
    config.customLabel = source.custom_label.trim();
  }
  if (typeof source.with_count === "boolean") {
    config.withCount = source.with_count;
  }
  if (typeof source.count_label === "string" && source.count_label.trim()) {
    config.countLabel = normalizeDefaultCountLabel(source.count_label, locale);
  }

  const rawChoices = Array.isArray(source.choices)
    ? source.choices.filter((choice): choice is string => typeof choice === "string")
    : [];

  const seen = new Set<string>();
  for (const rawChoice of rawChoices) {
    const choice = rawChoice.trim();
    if (!choice) continue;
    if (isCustomOptionChoice(choice)) {
      config.allowCustom = true;
      if (!("custom_label" in source)) {
        config.customLabel = choice;
      }
      continue;
    }
    const key = choice.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    config.choices.push(choice);
  }

  return config;
}

export function normalizeSelectCountValue(value: unknown): { selected: string; count: number | null } {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const source = value as Record<string, unknown>;
    const selected = typeof source.value === "string" ? source.value : "";
    const rawCount = source.count;
    const count = typeof rawCount === "number" && Number.isFinite(rawCount) ? rawCount : null;
    return { selected, count };
  }
  return { selected: value != null ? String(value) : "", count: null };
}

export function buildSelectCountValue(selected: string, count: number | null) {
  if (!selected) return "";
  return {
    value: selected,
    count,
  };
}

export function formatSelectCountValue(value: unknown, locale?: Locale | string) {
  const normalized = normalizeSelectCountValue(value);
  if (!normalized.selected) return "";
  if (normalized.count == null) return normalized.selected;
  return `${normalized.selected} (${defaultCountLabel(locale)}: ${normalized.count})`;
}

export function buildPropertyOptionsPayload(
  choices: string[] | undefined,
  locale?: Locale | string,
  current?: Record<string, unknown> | undefined,
) {
  const base = getPropertyOptionConfig(current, locale);
  const cleanChoices = (choices || [])
    .map((choice) => choice.trim())
    .filter((choice) => choice && !isCustomOptionChoice(choice));

  const payload: Record<string, unknown> = {
    ...(current || {}),
    choices: cleanChoices,
  };

  if (base.allowCustom) {
    payload.allow_custom = true;
    payload.custom_label = base.customLabel || defaultCustomLabel(locale);
  } else {
    delete payload.allow_custom;
    delete payload.custom_label;
  }

  if (base.withCount) {
    payload.with_count = true;
    payload.count_label = base.countLabel || defaultCountLabel(locale);
  } else {
    delete payload.with_count;
    delete payload.count_label;
  }

  return payload;
}
