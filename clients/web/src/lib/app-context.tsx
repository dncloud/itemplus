"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { translate, type Locale } from "./i18n";
import { wsClient } from "./ws";

type Realm = "archive" | "collection";
type Theme = "light" | "dark" | "system";
type PrintMode = "server" | "ios";

type DateFormat = "DD.MM.YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD/MM/YYYY";

interface AppContextValue {
  realm: Realm;
  setRealm: (r: Realm) => void;
  serverURL: string;
  theme: Theme;
  setTheme: (t: Theme) => void;
  isDark: boolean;
  ready: boolean;
  isAdmin: boolean;
  can: (perm: string) => boolean;
  locale: Locale;
  setLocale: (l: Locale) => void;
  dateFormat: DateFormat;
  iosDeleteConfirm: boolean;
  setIosDeleteConfirm: (v: boolean) => void;
  setDateFormat: (f: DateFormat) => void;
  printMode: PrintMode;
  setPrintMode: (mode: PrintMode) => void;
  printItemQR: (itemId: number, copies?: number) => Promise<void>;
  printLocationQR: (locationId: number, copies?: number) => Promise<void>;
  brandingLogo: string | null;
  brandingSubtitle: string;
  brandingWidth: number;
  refreshBranding: () => Promise<void>;
  fmtDate: (dateStr: string | null | undefined) => string;
  fmtDateTime: (dateStr: string | null | undefined) => string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const AppContext = createContext<AppContextValue>(null!);

const getStoredRealm = (): Realm => {
  if (typeof window === "undefined") return "archive";
  const saved = localStorage.getItem("itemplus_realm");
  return saved === "collection" ? "collection" : "archive";
};

const getStoredTheme = (): Theme => {
  if (typeof window === "undefined") return "system";
  const saved = localStorage.getItem("itemplus_theme");
  return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
};

const getStoredLocale = (): Locale => {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem("itemplus_locale");
  return saved === "de" ? "de" : "en";
};

const getStoredDateFormat = (): DateFormat => {
  if (typeof window === "undefined") return "DD.MM.YYYY";
  const saved = localStorage.getItem("itemplus_date_format");
  switch (saved) {
    case "MM/DD/YYYY":
    case "YYYY-MM-DD":
    case "DD/MM/YYYY":
      return saved;
    default:
      return "DD.MM.YYYY";
  }
};

const getStoredIosDeleteConfirm = (): boolean => {
  if (typeof window === "undefined") return true;
  const saved = localStorage.getItem("itemplus_ios_delete_confirm");
  return saved === null ? true : saved === "true";
};

const getStoredPrintMode = (): PrintMode => {
  if (typeof window === "undefined") return "server";
  return localStorage.getItem("itemplus_print_mode") === "ios" ? "ios" : "server";
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [realm, _setRealm] = useState<Realm>(getStoredRealm);
  const [serverURL] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));
  const [theme, _setTheme] = useState<Theme>(getStoredTheme);
  const [isDark, setIsDark] = useState(false);
  const [ready, setReady] = useState(false);
  const [dateFormat, _setDateFormat] = useState<DateFormat>(getStoredDateFormat);
  const [iosDeleteConfirm, _setIosDeleteConfirm] = useState(getStoredIosDeleteConfirm);
  const [printMode, _setPrintMode] = useState<PrintMode>(getStoredPrintMode);
  const [brandingLogo, setBrandingLogo] = useState<string | null>(null);
  const [brandingSubtitle, setBrandingSubtitle] = useState<string>("");
  const [brandingWidth, setBrandingWidth] = useState<number>(180);
  const [locale, _setLocale] = useState<Locale>(getStoredLocale);
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);

  const can = useCallback((perm: string) => isAdmin || permissions.includes(perm), [isAdmin, permissions]);

  const refreshBranding = useCallback(async () => {
    try {
      const branding = await api.getBranding();
      setBrandingLogo(branding.logo || null);
      setBrandingSubtitle(branding.subtitle || "");
      setBrandingWidth(branding.width || 180);
    } catch {
      setBrandingLogo(null);
      setBrandingSubtitle("");
      setBrandingWidth(180);
    }
  }, []);

  // Initialize from localStorage + fetch user role
  useEffect(() => {
    api.realm = realm;
    api.baseURL = ""; // Same origin — relative /api/ calls

    // Fetch user permissions (cookie-based auth — try the call, handle 401 gracefully)
    api.getMe().then((u) => {
      setIsAdmin(u.is_admin);
      setPermissions(u.permissions || []);
    }).catch(() => {}).finally(() => setReady(true));
  }, [realm]);

  useEffect(() => {
    let cancelled = false;
    api.getBranding().then((branding) => {
      if (cancelled) return;
      setBrandingLogo(branding.logo || null);
      setBrandingSubtitle(branding.subtitle || "");
      setBrandingWidth(branding.width || 180);
    }).catch(() => {
      if (cancelled) return;
      setBrandingLogo(null);
      setBrandingSubtitle("");
      setBrandingWidth(180);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply theme to <html> element
  useEffect(() => {
    const applyDark = (dark: boolean) => {
      document.documentElement.classList.toggle("dark", dark);
      setIsDark(dark);
    };

    if (theme === "dark") {
      applyDark(true);
    } else if (theme === "light") {
      applyDark(false);
    } else {
      // System preference
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      applyDark(mq.matches);
      const handler = (e: MediaQueryListEvent) => applyDark(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  const setRealm = (r: Realm) => {
    _setRealm(r);
    api.realm = r;
    localStorage.setItem("itemplus_realm", r);
  };

  const setTheme = (t: Theme) => {
    _setTheme(t);
    localStorage.setItem("itemplus_theme", t);
  };

  const setLocale = (l: Locale) => {
    _setLocale(l);
    localStorage.setItem("itemplus_locale", l);
  };

  const setDateFormat = (f: DateFormat) => {
    _setDateFormat(f);
    localStorage.setItem("itemplus_date_format", f);
  };

  const setIosDeleteConfirm = (v: boolean) => {
    _setIosDeleteConfirm(v);
    localStorage.setItem("itemplus_ios_delete_confirm", String(v));
  };

  const setPrintMode = (mode: PrintMode) => {
    _setPrintMode(mode);
    localStorage.setItem("itemplus_print_mode", mode);
  };

  const printViaIOSBridge = useCallback((entityType: "item" | "location", entityId: number, copies = 1) => {
    return new Promise<void>((resolve, reject) => {
      const requestId = `${entityType}-${entityId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const cleanups: Array<() => void> = [];
      const timer = window.setTimeout(() => {
        cleanups.forEach((fn) => fn());
        reject(new Error("iOS bridge timeout"));
      }, 15000);

      const finish = (ok: boolean, detail?: string) => {
        window.clearTimeout(timer);
        cleanups.forEach((fn) => fn());
        if (ok) resolve();
        else reject(new Error(detail || "iOS bridge print failed"));
      };

      cleanups.push(wsClient.on("print.done", (data) => {
        if (data.request_id === requestId) finish(true, typeof data.detail === "string" ? data.detail : undefined);
      }));
      cleanups.push(wsClient.on("print.failed", (data) => {
        if (data.request_id === requestId) finish(false, typeof data.detail === "string" ? data.detail : undefined);
      }));

      wsClient.send("print.request", {
        request_id: requestId,
        realm,
        entity_type: entityType,
        entity_id: entityId,
        copies,
      });
    });
  }, [realm]);

  const printItemQR = useCallback(async (itemId: number, copies = 1) => {
    if (printMode === "ios") {
      await printViaIOSBridge("item", itemId, copies);
      return;
    }
    await api.printItemQR(itemId, copies);
  }, [printMode, printViaIOSBridge]);

  const printLocationQR = useCallback(async (locationId: number, copies = 1) => {
    if (printMode === "ios") {
      await printViaIOSBridge("location", locationId, copies);
      return;
    }
    await api.printLocationQR(locationId, copies);
  }, [printMode, printViaIOSBridge]);

  const fmtDate = useCallback((dateStr: string | null | undefined): string => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    switch (dateFormat) {
      case "DD.MM.YYYY": return `${dd}.${mm}.${yyyy}`;
      case "MM/DD/YYYY": return `${mm}/${dd}/${yyyy}`;
      case "DD/MM/YYYY": return `${dd}/${mm}/${yyyy}`;
      case "YYYY-MM-DD": return `${yyyy}-${mm}-${dd}`;
      default: return `${dd}.${mm}.${yyyy}`;
    }
  }, [dateFormat]);

  const fmtDateTime = useCallback((dateStr: string | null | undefined): string => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${fmtDate(dateStr)}, ${time}`;
  }, [fmtDate]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale]
  );

  return (
    <AppContext.Provider value={{ realm, setRealm, serverURL, theme, setTheme, isDark, ready, isAdmin, can, locale, setLocale, dateFormat, setDateFormat, iosDeleteConfirm, setIosDeleteConfirm, printMode, setPrintMode, printItemQR, printLocationQR, brandingLogo, brandingSubtitle, brandingWidth, refreshBranding, fmtDate, fmtDateTime, t }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
