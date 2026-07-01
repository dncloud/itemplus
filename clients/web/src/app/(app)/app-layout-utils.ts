"use client";

import { api, type InventoryWarning, type LocationWarning, type MaintenanceReminder } from "@/lib/api";
import { wsClient } from "@/lib/ws";

function filterWarningsByRealm<T extends { realm?: string }>(warnings: T[], realm: "archive" | "collection") {
  return warnings.filter((warning) => warning.realm === realm);
}

export async function loadAppBadges(can: (perm: string) => boolean, realm: "archive" | "collection") {
  const badges: Record<string, number> = {};
  try {
    if (can("users.manage")) {
      const users = await api.getInactiveUsers().catch(() => []);
      if (users.length > 0) badges["/users"] = users.length;
    }

    const canReadInventory = can("inventory.read");
    const canViewInventoryWarnings = canReadInventory && can("inventory.write");
    const canViewLocationWarnings = canReadInventory && can("inventory.write");
    if (canReadInventory && (canViewInventoryWarnings || canViewLocationWarnings)) {
      const [inventoryWarnings, locationWarnings] = await Promise.all([
        canViewInventoryWarnings
          ? api.getInventoryStats().then((response) => response.warnings || []).catch(() => [] as InventoryWarning[])
          : Promise.resolve([] as InventoryWarning[]),
        canViewLocationWarnings
          ? api.getLocationStats().then((response) => response.warnings || []).catch(() => [] as LocationWarning[])
          : Promise.resolve([] as LocationWarning[]),
      ]);
      const warningCount =
        filterWarningsByRealm(inventoryWarnings, realm).length +
        filterWarningsByRealm(locationWarnings, realm).length;
      if (warningCount > 0) badges["/inventory-movements"] = warningCount;
    }

    if (can("maintenance.read")) {
      const maintenance = await api.getMaintenanceStats().catch(() => ({ items: [] as MaintenanceReminder[] }));
      const maintenanceCount = filterWarningsByRealm(maintenance.items || [], realm).length;
      if (maintenanceCount > 0) badges["/maintenance"] = maintenanceCount;
    }

    const overdueCheckouts = can("checkout.manage")
      ? await api.getOverdueCheckouts().catch(() => [])
      : await api.getMyOverdueCheckouts().catch(() => []);
    if (overdueCheckouts.length > 0) badges["/checkouts"] = overdueCheckouts.length;
  } catch {
    // keep empty badge state on background fetch failures
  }
  return badges;
}

export async function verifySessionOrRedirect(onUnauthorized: () => void) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await api.getMe();
      return;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "Unauthorized") {
        return;
      }
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      onUnauthorized();
      return;
    }
  }
}

export function connectAppWebSocket(serverURL: string) {
  if (serverURL) {
    wsClient.connect(serverURL);
  }
}

export function sendAppPresence(pathname: string, query: string, realm: "archive" | "collection") {
  const path = `${pathname || "/"}${query ? `?${query}` : ""}`;
  wsClient.updatePresence({
    path,
    label: buildPresenceLabel(pathname || "/", realm),
    realm,
  });
}

function buildPresenceLabel(pathname: string, realm: "archive" | "collection") {
  const realmLabel = realm === "collection" ? "Collection" : "Archive";
  const itemMatch = pathname.match(/^\/items\/(\d+)(?:\/edit)?$/);
  if (itemMatch) {
    return pathname.endsWith("/edit") ? `${realmLabel} / Item #${itemMatch[1]} / Edit` : `${realmLabel} / Item #${itemMatch[1]}`;
  }
  if (pathname === "/items/new") return `${realmLabel} / Items / New`;
  if (pathname.startsWith("/items")) return `${realmLabel} / Items`;
  if (pathname.startsWith("/categories")) return `${realmLabel} / Categories`;
  if (pathname.startsWith("/locations")) return `${realmLabel} / Locations`;
  if (pathname.startsWith("/vendors")) return `${realmLabel} / Master Data`;
  if (pathname.startsWith("/inventory-checks")) return `${realmLabel} / Inventory audit`;
  if (pathname.startsWith("/inventory-movements")) return `${realmLabel} / Stock`;
  if (pathname.startsWith("/maintenance")) return `${realmLabel} / Maintenance`;
  if (pathname.startsWith("/checkouts")) return "Checkouts";
  if (pathname.startsWith("/users")) return "Users";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/dashboard") || pathname === "/") return "Dashboard";
  return pathSegmentLabel(pathname);
}

function pathSegmentLabel(pathname: string) {
  const segment = pathname.split("/").filter(Boolean).at(-1);
  if (!segment) return "Dashboard";
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function registerAppShellEvents({
  routerPush,
  routerReplace,
  realm,
  setRealm,
  refreshBadges,
}: {
  routerPush: (href: string) => void;
  routerReplace: (href: string) => void;
  realm: "archive" | "collection";
  setRealm: (realm: "archive" | "collection") => void;
  refreshBadges: () => void;
}) {
  const unsub1 = wsClient.on("browser.open_item", (data) => {
    const itemId = Number(data.item_id);
    const nextRealm = data.realm as string;
    if ((nextRealm === "archive" || nextRealm === "collection") && nextRealm !== realm) {
      setRealm(nextRealm);
    }
    if (Number.isFinite(itemId) && itemId > 0) routerPush(`/items/${itemId}`);
  });

  const unsub2 = wsClient.on("browser.open_location", (data) => {
    const locationId = Number(data.location_id);
    const nextRealm = data.realm as string;
    if ((nextRealm === "archive" || nextRealm === "collection") && nextRealm !== realm) {
      setRealm(nextRealm);
    }
    if (Number.isFinite(locationId) && locationId > 0) routerPush(`/items?location=${locationId}`);
  });

  const unsub3 = wsClient.on("session.kicked", async () => {
    wsClient.disconnect();
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore logout cleanup failures
    }
    routerReplace("/auth");
  });

  const unsub4 = wsClient.on("admin.checkout_requested", refreshBadges);
  const unsub5 = wsClient.on("admin.new_user_registered", refreshBadges);
  const unsub6 = wsClient.on("checkout.approved", refreshBadges);
  const unsub7 = wsClient.on("checkout.rejected", refreshBadges);
  const unsub8 = wsClient.on("user.activated", refreshBadges);
  const unsub9 = wsClient.on("delete.done", refreshBadges);
  const unsub10 = wsClient.on("barcode.scanned", (data) => {
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/inventory-checks")) {
      return;
    }
    const code = typeof data.code === "string" ? data.code.trim() : "";
    const symbology = typeof data.symbology === "string" ? data.symbology.trim() : "";
    const nextRealm = typeof data.realm === "string" ? data.realm : realm;
    if ((nextRealm === "archive" || nextRealm === "collection") && nextRealm !== realm) {
      setRealm(nextRealm);
    }
    if (!code) return;
    const params = new URLSearchParams({ barcode: code });
    if (symbology) params.set("symbology", symbology);
    routerPush(`/items/new?${params.toString()}`);
  });
  return () => {
    unsub1();
    unsub2();
    unsub3();
    unsub4();
    unsub5();
    unsub6();
    unsub7();
    unsub8();
    unsub9();
    unsub10();
  };
}

export async function logoutAppSession() {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch {
    // ignore logout cleanup failures
  }
  wsClient.disconnect();
  window.location.href = "/auth";
}
