"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type BrandingSettings } from "./api";
import { translate, type Locale } from "./i18n";
import { wsClient } from "./ws";
import {
  getServerURL,
  getStoredDateFormat,
  getStoredFlag,
  getStoredIosDeleteConfirm,
  getStoredItemsPerPage,
  getStoredLocale,
  getStoredPercent,
  getStoredPrintMode,
  getStoredRealm,
  getStoredShowPrintFeatures,
  getStoredShowItemImages,
  getStoredShowItemPlaceholders,
  getStoredTheme,
  setStoredBoolean,
  setStoredNumber,
  setStoredString,
  setStoredValue,
  type DateFormat,
  type PrintMode,
  type Realm,
  type Theme,
} from "./app-context-storage";
import { formatAppDate, formatAppDateTime } from "./app-context-format";
import { fetchWithSession } from "./api-helpers";

interface AppContextValue {
  iosBridgeStatus: "connected" | "disconnected";
  printerBridgeStatus: "connected" | "disconnected";
  aiAssistantBusy: boolean;
  aiAssistantPanelAvailable: boolean;
  aiAssistantPanelOpen: boolean;
  realm: Realm;
  setRealm: (r: Realm) => void;
  serverURL: string;
  theme: Theme;
  setTheme: (t: Theme) => void;
  isDark: boolean;
  ready: boolean;
  isAdmin: boolean;
  currentUserLabel: string;
  can: (perm: string) => boolean;
  locale: Locale;
  setLocale: (l: Locale) => void;
  dateFormat: DateFormat;
  iosDeleteConfirm: boolean;
  setIosDeleteConfirm: (v: boolean) => void;
  setDateFormat: (f: DateFormat) => void;
  printMode: PrintMode;
  setPrintMode: (mode: PrintMode) => void;
  showPrintFeatures: boolean;
  setShowPrintFeatures: (v: boolean) => void;
  showItemImages: boolean;
  setShowItemImages: (v: boolean) => void;
  showItemPlaceholders: boolean;
  setShowItemPlaceholders: (v: boolean) => void;
  showItemCategory: boolean;
  setShowItemCategory: (v: boolean) => void;
  showItemLocation: boolean;
  setShowItemLocation: (v: boolean) => void;
  showItemDescription: boolean;
  setShowItemDescription: (v: boolean) => void;
  showItemStock: boolean;
  setShowItemStock: (v: boolean) => void;
  showItemConsumable: boolean;
  setShowItemConsumable: (v: boolean) => void;
  showItemPrice: boolean;
  setShowItemPrice: (v: boolean) => void;
  showItemTotal: boolean;
  setShowItemTotal: (v: boolean) => void;
  showItemProperties: boolean;
  setShowItemProperties: (v: boolean) => void;
  showItemActivity: boolean;
  setShowItemActivity: (v: boolean) => void;
  showAttachmentUploadOnItemDetail: boolean;
  setShowAttachmentUploadOnItemDetail: (v: boolean) => void;
  itemStockWarningPercent: number;
  setItemStockWarningPercent: (v: number) => void;
  itemStockCriticalPercent: number;
  setItemStockCriticalPercent: (v: number) => void;
  itemsPerPage: number;
  setItemsPerPage: (v: number) => void;
  printItemQR: (itemId: number, copies?: number) => Promise<void>;
  printLocationQR: (locationId: number, copies?: number) => Promise<void>;
  brandingLogo: string | null;
  brandingTitle: string;
  brandingTitleSize: number;
  brandingTitlePosition: "right" | "below";
  brandingSubtitle: string;
  brandingFooterText: string;
  brandingWidth: number;
  brandingLogoBackground: string;
  brandingLogoPadding: number;
  brandingLogoRadius: number;
  refreshBranding: () => Promise<void>;
  fmtDate: (dateStr: string | null | undefined) => string;
  fmtDateTime: (dateStr: string | null | undefined) => string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setAiAssistantBusy: (v: boolean) => void;
  setAiAssistantPanelController: (controller: AIAssistantPanelController | null) => void;
  toggleAiAssistantPanel: () => void;
}

type BridgeSession = {
  device_type?: string;
  is_online?: boolean | number;
  printer_bridge_configured?: boolean | number;
  printer_bridge_reachable?: boolean | number;
};

type AIAssistantPanelController = {
  available: boolean;
  open: boolean;
  toggle: () => void;
};

const AppContext = createContext<AppContextValue>(null!);

export function AppProvider({ children }: { children: ReactNode }) {
  const [iosBridgeStatus, setIosBridgeStatus] = useState<"connected" | "disconnected">("disconnected");
  const [printerBridgeStatus, setPrinterBridgeStatus] = useState<"connected" | "disconnected">("disconnected");
  const [aiAssistantBusy, setAiAssistantBusy] = useState(false);
  const [aiAssistantPanelController, setAiAssistantPanelController] = useState<AIAssistantPanelController | null>(null);
  const [realm, _setRealm] = useState<Realm>(getStoredRealm);
  const [serverURL] = useState(getServerURL);
  const [theme, _setTheme] = useState<Theme>(getStoredTheme);
  const [isDark, setIsDark] = useState(false);
  const [ready, setReady] = useState(false);
  const [dateFormat, _setDateFormat] = useState<DateFormat>(getStoredDateFormat);
  const [iosDeleteConfirm, _setIosDeleteConfirm] = useState(getStoredIosDeleteConfirm);
  const [printMode, _setPrintMode] = useState<PrintMode>(getStoredPrintMode);
  const [showPrintFeatures, _setShowPrintFeatures] = useState(getStoredShowPrintFeatures);
  const [showItemImages, _setShowItemImages] = useState(getStoredShowItemImages);
  const [showItemPlaceholders, _setShowItemPlaceholders] = useState(getStoredShowItemPlaceholders);
  const [showItemCategory, _setShowItemCategory] = useState(() => getStoredFlag("itemplus_show_item_category", true));
  const [showItemLocation, _setShowItemLocation] = useState(() => getStoredFlag("itemplus_show_item_location", true));
  const [showItemDescription, _setShowItemDescription] = useState(() => getStoredFlag("itemplus_show_item_description", true));
  const [showItemStock, _setShowItemStock] = useState(() => getStoredFlag("itemplus_show_item_stock", true));
  const [showItemConsumable, _setShowItemConsumable] = useState(() => getStoredFlag("itemplus_show_item_consumable", true));
  const [showItemPrice, _setShowItemPrice] = useState(() => getStoredFlag("itemplus_show_item_price", true));
  const [showItemTotal, _setShowItemTotal] = useState(() => getStoredFlag("itemplus_show_item_total", true));
  const [showItemProperties, _setShowItemProperties] = useState(() => getStoredFlag("itemplus_show_item_properties", true));
  const [showItemActivity, _setShowItemActivity] = useState(() => getStoredFlag("itemplus_show_item_activity", true));
  const [showAttachmentUploadOnItemDetail, _setShowAttachmentUploadOnItemDetail] = useState(() => getStoredFlag("itemplus_show_attachment_upload_on_item_detail", false));
  const [itemStockWarningPercent, _setItemStockWarningPercent] = useState(() => getStoredPercent("itemplus_item_stock_warning_percent", 100));
  const [itemStockCriticalPercent, _setItemStockCriticalPercent] = useState(() => getStoredPercent("itemplus_item_stock_critical_percent", 15));
  const [itemsPerPage, _setItemsPerPage] = useState(getStoredItemsPerPage);
  const [brandingLogo, setBrandingLogo] = useState<string | null>(null);
  const [brandingTitle, setBrandingTitle] = useState<string>("item+");
  const [brandingTitleSize, setBrandingTitleSize] = useState<number>(17);
  const [brandingTitlePosition, setBrandingTitlePosition] = useState<"right" | "below">("right");
  const [brandingSubtitle, setBrandingSubtitle] = useState<string>("");
  const [brandingFooterText, setBrandingFooterText] = useState<string>("");
  const [brandingWidth, setBrandingWidth] = useState<number>(64);
  const [brandingLogoBackground, setBrandingLogoBackground] = useState<string>("");
  const [brandingLogoPadding, setBrandingLogoPadding] = useState<number>(0);
  const [brandingLogoRadius, setBrandingLogoRadius] = useState<number>(6);
  const [locale, _setLocale] = useState<Locale>(getStoredLocale);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserLabel, setCurrentUserLabel] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);

  const can = useCallback((perm: string) => isAdmin || permissions.includes(perm), [isAdmin, permissions]);

  const fetchDeviceSessions = useCallback(async (): Promise<BridgeSession[]> => {
    try {
      const response = await fetchWithSession("/api/devices/sessions", { credentials: "include" });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data)
        ? data
        : Array.isArray(data.sessions)
          ? data.sessions
          : [];
    } catch {
      return [];
    }
  }, []);

  const applyBrandingState = useCallback((branding?: Partial<BrandingSettings>) => {
    setBrandingLogo(branding?.logo || null);
    setBrandingTitle((branding?.title || "").trim() || "item+");
    setBrandingTitleSize(typeof branding?.titleSize === "number" ? branding.titleSize : 17);
    setBrandingTitlePosition(branding?.titlePosition === "below" ? "below" : "right");
    setBrandingSubtitle(branding?.subtitle || "");
    setBrandingFooterText(branding?.footerText || "");
    setBrandingWidth(branding?.width || 64);
    setBrandingLogoBackground(branding?.logoBackground || "");
    setBrandingLogoPadding(typeof branding?.logoPadding === "number" ? branding.logoPadding : 0);
    setBrandingLogoRadius(typeof branding?.logoRadius === "number" ? branding.logoRadius : 6);
  }, []);

  const refreshBranding = useCallback(async () => {
    try {
      applyBrandingState(await api.getBranding());
    } catch {
      applyBrandingState();
    }
  }, [applyBrandingState]);

  const applyLocale = useCallback((value: Locale) => {
    setStoredString(_setLocale, "itemplus_locale", value);
  }, []);

  useEffect(() => {
    api.realm = realm;
    api.baseURL = ""; // Same origin — relative /api/ calls
  }, [realm]);

  // Initialize user role and branding before the app shell becomes ready.
  useEffect(() => {
    let cancelled = false;
    api.baseURL = "";

    void Promise.allSettled([api.getMe(), api.getBranding()]).then(([meResult, brandingResult]) => {
      if (cancelled) return;

      if (meResult.status === "fulfilled") {
        const u = meResult.value;
        setIsAdmin(u.is_admin);
        setCurrentUserLabel((u.name || u.email || "").trim());
        setPermissions(u.permissions || []);
        if (u.locale === "de" || u.locale === "en") {
          applyLocale(u.locale);
        }
      }

      if (brandingResult.status === "fulfilled") {
        applyBrandingState(brandingResult.value);
      } else {
        applyBrandingState();
      }

      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [applyBrandingState, applyLocale]);

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
    setStoredValue("itemplus_realm", r);
  };

  const setTheme = (t: Theme) => {
    setStoredString(_setTheme, "itemplus_theme", t);
  };

  const setLocale = (l: Locale) => {
    applyLocale(l);
  };

  const setDateFormat = (f: DateFormat) => {
    setStoredString(_setDateFormat, "itemplus_date_format", f);
  };

  const setIosDeleteConfirm = (v: boolean) => {
    setStoredBoolean(_setIosDeleteConfirm, "itemplus_ios_delete_confirm", v);
  };

  const setPrintMode = (mode: PrintMode) => {
    setStoredString(_setPrintMode, "itemplus_print_mode", mode);
  };

  const setShowPrintFeatures = (v: boolean) => {
    setStoredBoolean(_setShowPrintFeatures, "itemplus_show_print_features", v);
  };

  const setShowItemImages = (v: boolean) => {
    setStoredBoolean(_setShowItemImages, "itemplus_show_item_images", v);
  };

  const setShowItemPlaceholders = (v: boolean) => {
    setStoredBoolean(_setShowItemPlaceholders, "itemplus_show_item_placeholders", v);
  };

  const setShowItemCategory = (v: boolean) => {
    setStoredBoolean(_setShowItemCategory, "itemplus_show_item_category", v);
  };

  const setShowItemLocation = (v: boolean) => {
    setStoredBoolean(_setShowItemLocation, "itemplus_show_item_location", v);
  };

  const setShowItemDescription = (v: boolean) => {
    setStoredBoolean(_setShowItemDescription, "itemplus_show_item_description", v);
  };

  const setShowItemStock = (v: boolean) => {
    setStoredBoolean(_setShowItemStock, "itemplus_show_item_stock", v);
  };

  const setShowItemConsumable = (v: boolean) => {
    setStoredBoolean(_setShowItemConsumable, "itemplus_show_item_consumable", v);
  };

  const setShowItemPrice = (v: boolean) => {
    setStoredBoolean(_setShowItemPrice, "itemplus_show_item_price", v);
  };

  const setShowItemTotal = (v: boolean) => {
    setStoredBoolean(_setShowItemTotal, "itemplus_show_item_total", v);
  };

  const setShowItemProperties = (v: boolean) => {
    setStoredBoolean(_setShowItemProperties, "itemplus_show_item_properties", v);
  };

  const setShowItemActivity = (v: boolean) => {
    setStoredBoolean(_setShowItemActivity, "itemplus_show_item_activity", v);
  };

  const setShowAttachmentUploadOnItemDetail = (v: boolean) => {
    setStoredBoolean(_setShowAttachmentUploadOnItemDetail, "itemplus_show_attachment_upload_on_item_detail", v);
  };

  const setItemStockWarningPercent = (v: number) => {
    const next = Math.min(500, Math.max(0, Math.round(v)));
    setStoredNumber(_setItemStockWarningPercent, "itemplus_item_stock_warning_percent", next);
  };

  const setItemStockCriticalPercent = (v: number) => {
    const next = Math.min(500, Math.max(0, Math.round(v)));
    setStoredNumber(_setItemStockCriticalPercent, "itemplus_item_stock_critical_percent", next);
  };

  const setItemsPerPage = (v: number) => {
    setStoredNumber(_setItemsPerPage, "itemplus_items_per_page", v);
  };

  const resolveIOSBridgeStatus = useCallback((sessions: BridgeSession[]): "connected" | "disconnected" => {
    const iosSessions = sessions.filter((session) => session.device_type === "ios");
    return iosSessions.some((session) => session.is_online === true || session.is_online === 1) ? "connected" : "disconnected";
  }, []);

  const refreshPrinterBridgeStatus = useCallback(async (
    iosStatus?: "connected" | "disconnected",
    sessions?: Array<Record<string, unknown>>,
  ) => {
    if (!showPrintFeatures || !(isAdmin || permissions.includes("print"))) {
      setPrinterBridgeStatus("disconnected");
      return;
    }

    if (printMode === "ios") {
      const deviceSessions = sessions ?? await fetchDeviceSessions();
      const nextIOSStatus = iosStatus ?? resolveIOSBridgeStatus(deviceSessions);
      if (nextIOSStatus !== "connected") {
        setPrinterBridgeStatus("disconnected");
        return;
      }

      const iosSessions = deviceSessions.filter((session: BridgeSession) => session.device_type === "ios" && (session.is_online === true || session.is_online === 1));
      const hasReachablePrinter = iosSessions.some(
        (session: BridgeSession) =>
          (session.printer_bridge_configured === true || session.printer_bridge_configured === 1) &&
          (session.printer_bridge_reachable === true || session.printer_bridge_reachable === 1),
      );
      setPrinterBridgeStatus(hasReachablePrinter ? "connected" : "disconnected");
      return;
    }

    try {
      const printer = await api.getPrinterStatus();
      setPrinterBridgeStatus(printer.reachable ? "connected" : "disconnected");
    } catch {
      setPrinterBridgeStatus("disconnected");
    }
  }, [fetchDeviceSessions, isAdmin, permissions, printMode, resolveIOSBridgeStatus, showPrintFeatures]);

  useEffect(() => {
    if (!ready) return;

    const refreshBridgeStatus = async () => {
      const sessions = await fetchDeviceSessions();
      const nextIOSStatus = resolveIOSBridgeStatus(sessions);
      setIosBridgeStatus(nextIOSStatus);
      await refreshPrinterBridgeStatus(nextIOSStatus, sessions);
    };

    void refreshBridgeStatus();

    const interval = window.setInterval(() => {
      void refreshBridgeStatus();
    }, 30000);

    const handleBridgeUpdate = () => {
      void refreshBridgeStatus();
    };

    const unsubDeviceConnected = wsClient.on("device.connected", handleBridgeUpdate);
    const unsubDeviceDisconnected = wsClient.on("device.disconnected", handleBridgeUpdate);
    const unsubDevicesList = wsClient.on("devices.list", handleBridgeUpdate);

    return () => {
      window.clearInterval(interval);
      unsubDeviceConnected();
      unsubDeviceDisconnected();
      unsubDevicesList();
    };
  }, [fetchDeviceSessions, ready, refreshPrinterBridgeStatus, resolveIOSBridgeStatus]);

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
    return formatAppDate(dateFormat, dateStr);
  }, [dateFormat]);

  const fmtDateTime = useCallback((dateStr: string | null | undefined): string => {
    return formatAppDateTime(dateFormat, dateStr);
  }, [dateFormat]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale]
  );
  const toggleAiAssistantPanel = useCallback(() => {
    aiAssistantPanelController?.toggle();
  }, [aiAssistantPanelController]);

  return (
    <AppContext.Provider value={{ iosBridgeStatus, printerBridgeStatus, aiAssistantBusy, aiAssistantPanelAvailable: aiAssistantPanelController?.available ?? false, aiAssistantPanelOpen: aiAssistantPanelController?.open ?? false, realm, setRealm, serverURL, theme, setTheme, isDark, ready, isAdmin, currentUserLabel, can, locale, setLocale, dateFormat, setDateFormat, iosDeleteConfirm, setIosDeleteConfirm, printMode, setPrintMode, showPrintFeatures, setShowPrintFeatures, showItemImages, setShowItemImages, showItemPlaceholders, setShowItemPlaceholders, showItemCategory, setShowItemCategory, showItemLocation, setShowItemLocation, showItemDescription, setShowItemDescription, showItemStock, setShowItemStock, showItemConsumable, setShowItemConsumable, showItemPrice, setShowItemPrice, showItemTotal, setShowItemTotal, showItemProperties, setShowItemProperties, showItemActivity, setShowItemActivity, showAttachmentUploadOnItemDetail, setShowAttachmentUploadOnItemDetail, itemStockWarningPercent, setItemStockWarningPercent, itemStockCriticalPercent, setItemStockCriticalPercent, itemsPerPage, setItemsPerPage, printItemQR, printLocationQR, brandingLogo, brandingTitle, brandingTitleSize, brandingTitlePosition, brandingSubtitle, brandingFooterText, brandingWidth, brandingLogoBackground, brandingLogoPadding, brandingLogoRadius, refreshBranding, fmtDate, fmtDateTime, t, setAiAssistantBusy, setAiAssistantPanelController, toggleAiAssistantPanel }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
