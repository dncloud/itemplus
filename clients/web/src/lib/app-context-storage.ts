import type { Locale } from "./i18n";

export type Realm = "archive" | "collection";
export type Theme = "light" | "dark" | "system";
export type PrintMode = "server" | "ios";
export type DateFormat = "DD.MM.YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD/MM/YYYY";

// Browser storage is only a preference cache. If a browser blocks it, the app
// should keep working with defaults instead of failing during startup.
const readStoredValue = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStoredValue = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preferences are non-critical; failing silently is better than blocking UI.
  }
};

export const getStoredRealm = (): Realm => {
  const saved = readStoredValue("itemplus_realm");
  return saved === "collection" ? "collection" : "archive";
};

export const getStoredTheme = (): Theme => {
  const saved = readStoredValue("itemplus_theme");
  return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
};

export const getStoredLocale = (): Locale => {
  const saved = readStoredValue("itemplus_locale");
  return saved === "de" ? "de" : "en";
};

export const getStoredDateFormat = (): DateFormat => {
  const saved = readStoredValue("itemplus_date_format");
  switch (saved) {
    case "MM/DD/YYYY":
    case "YYYY-MM-DD":
    case "DD/MM/YYYY":
      return saved;
    default:
      return "DD.MM.YYYY";
  }
};

export const getStoredIosDeleteConfirm = (): boolean => {
  const saved = readStoredValue("itemplus_ios_delete_confirm");
  return saved === null ? true : saved === "true";
};

export const getStoredPrintMode = (): PrintMode => {
  return readStoredValue("itemplus_print_mode") === "ios" ? "ios" : "server";
};

export const getStoredShowItemImages = (): boolean => {
  const saved = readStoredValue("itemplus_show_item_images");
  return saved === null ? true : saved === "true";
};

export const getStoredShowItemPlaceholders = (): boolean => {
  const saved = readStoredValue("itemplus_show_item_placeholders");
  return saved === null ? true : saved === "true";
};

export const getStoredShowPrintFeatures = (): boolean => {
  const saved = readStoredValue("itemplus_show_print_features");
  return saved === null ? true : saved === "true";
};

export const getStoredItemsPerPage = (): number => {
  const stored = readStoredValue("itemplus_items_per_page");
  if (stored === null) return 24;
  const saved = Number(stored);
  return [12, 24, 48, 96].includes(saved) ? saved : 24;
};

export const getStoredFlag = (key: string, fallback = true): boolean => {
  const saved = readStoredValue(key);
  return saved === null ? fallback : saved === "true";
};

export const getStoredPercent = (key: string, fallback: number): number => {
  const stored = readStoredValue(key);
  if (stored === null) return fallback;
  const saved = Number(stored);
  if (!Number.isFinite(saved)) return fallback;
  return Math.min(500, Math.max(0, Math.round(saved)));
};

export const setStoredValue = (key: string, value: string) => {
  writeStoredValue(key, value);
};

export const setStoredBoolean = (
  setState: (value: boolean) => void,
  key: string,
  value: boolean,
) => {
  setState(value);
  setStoredValue(key, String(value));
};

export const setStoredNumber = (
  setState: (value: number) => void,
  key: string,
  value: number,
) => {
  setState(value);
  setStoredValue(key, String(value));
};

export const setStoredString = <T extends string>(
  setState: (value: T) => void,
  key: string,
  value: T,
) => {
  setState(value);
  setStoredValue(key, value);
};

export const getServerURL = (): string => {
  if (typeof window === "undefined") return "";

  const explicit = process.env.NEXT_PUBLIC_SERVER_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const { protocol, hostname, port } = window.location;
  if (port === "3000") {
    return `${protocol}//${hostname}:17117`;
  }

  return window.location.origin;
};
