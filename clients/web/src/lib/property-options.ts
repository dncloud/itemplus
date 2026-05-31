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
};

function defaultCustomLabel(locale?: string) {
  return String(locale || "").toLowerCase().startsWith("de") ? "Andere (Freitext)" : "Other (Free text)";
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

  return payload;
}
