import type { Locale } from "./i18n";

export type Dict = { [key: string]: string | Dict };

export function resolvePath(dict: Dict, path: string): string | null {
  const parts = path.split(".");
  let current: string | Dict = dict;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return null;
    current = current[part];
    if (current === undefined) return null;
  }
  return typeof current === "string" ? current : null;
}

export function resolveTranslation(
  translations: Record<Locale, Dict>,
  locale: Locale,
  key: string,
) {
  return resolvePath(translations[locale], key) || resolvePath(translations.en, key) || key;
}

export function interpolate(text: string, vars?: Record<string, string | number>) {
  if (!vars) return text;
  let next = text;
  for (const [key, value] of Object.entries(vars)) {
    next = next.replace(`{${key}}`, String(value));
  }
  return next;
}
