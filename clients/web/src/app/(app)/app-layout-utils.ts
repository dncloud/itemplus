"use client";

import { api, type InventoryWarning, type LocationWarning, type MaintenanceReminder } from "@/lib/api";
import { wsClient } from "@/lib/ws";

function filterWarningsByRealm<T extends { realm?: string }>(warnings: T[], realm: "archive" | "collection") {
  return warnings.filter((warning) => warning.realm === realm);
}

type Realm = "archive" | "collection";

/**
 * Key under which the badges hold how much is waiting in a realm other than
 * the current one. It names the realm, so a count that was loaded before a
 * realm switch never shows up on the wrong side of the switch.
 */
export const realmBadgeKey = (realm: "archive" | "collection") => `@realm:${realm}`;

// Every badge counts what waits in the current realm, like the page behind
// it. What waits in the other realm is added up separately, so the realm
// switch can say that something is going on over there.
export async function loadAppBadges(can: (perm: string) => boolean, realm: Realm) {
  const badges: Record<string, number> = {};
  const otherRealm: Realm = realm === "archive" ? "collection" : "archive";
  let waitingElsewhere = 0;
  const count = <T extends { realm?: string }>(href: string, rows: T[]) => {
    const here = filterWarningsByRealm(rows, realm).length;
    badges[href] = (badges[href] || 0) + here;
    waitingElsewhere += filterWarningsByRealm(rows, otherRealm).length;
  };

  try {
    if (can("users.manage")) {
      const users = await api.getInactiveUsers().catch(() => []);
      if (users.length > 0) badges["/users"] = users.length;
    }

    const canViewWarnings = can("inventory.read") && can("inventory.write");
    if (canViewWarnings) {
      const [inventoryWarnings, locationWarnings] = await Promise.all([
        api.getInventoryStats().then((response) => response.warnings || []).catch(() => [] as InventoryWarning[]),
        api.getLocationStats().then((response) => response.warnings || []).catch(() => [] as LocationWarning[]),
      ]);
      count("/inventory-movements", inventoryWarnings);
      count("/inventory-movements", locationWarnings);
    }

    if (can("maintenance.read")) {
      const maintenance = await api.getMaintenanceStats().catch(() => ({ items: [] as MaintenanceReminder[] }));
      count("/maintenance", maintenance.items || []);
    }

    if (can("checkout.manage")) {
      // A manager's loans page shows one realm: overdue loans there, plus requests and reported returns waiting for a decision.
      const [overdue, requests, returnReports] = await Promise.all([
        api.getOverdueCheckouts().catch(() => []),
        api.getCheckoutRequests().catch(() => []),
        api.getCheckoutReturnRequests().catch(() => []),
      ]);
      // An overdue loan whose return is already reported counts once, as a report.
      const reported = new Set(returnReports.map((loan) => `${loan.realm}-${loan.id}`));
      count("/checkouts", overdue.filter((loan) => !reported.has(`${loan.realm}-${loan.id}`)));
      count("/checkouts", returnReports);
      count("/checkouts", requests.filter((request) => request.status === "pending"));
    } else {
      // A borrower's page shows their own loans from both realms.
      const overdue = await api.getMyOverdueCheckouts().catch(() => []);
      badges["/checkouts"] = overdue.length;
    }
  } catch {
    // keep empty badge state on background fetch failures
  }

  for (const href of Object.keys(badges)) {
    if (!badges[href]) delete badges[href];
  }
  if (waitingElsewhere > 0) badges[realmBadgeKey(otherRealm)] = waitingElsewhere;
  return badges;
}

/**
 * Asks the server whether there is a session. "none" means signed out;
 * "unknown" means the server gave no clear answer (unreachable, an error),
 * which is not a reason to send someone to the sign-in page.
 */
export async function checkSession(): Promise<"ok" | "none" | "unknown"> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await api.getMe();
      return "ok";
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "Unauthorized") {
        return "unknown";
      }
      // One more try: right after signing in the cookie can be a moment late.
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  return "none";
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
  // A message means something waits or was decided: the counts in the menu changed too.
  const unsubNotifications = wsClient.on("notifications.updated", refreshBadges);
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
    unsubNotifications();
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
