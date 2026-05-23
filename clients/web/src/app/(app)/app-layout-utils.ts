"use client";

import { api } from "@/lib/api";
import { wsClient } from "@/lib/ws";

export async function loadAppBadges(can: (perm: string) => boolean) {
  const badges: Record<string, number> = {};
  try {
    if (can("users.manage")) {
      const users = await api.getInactiveUsers().catch(() => []);
      if (users.length > 0) badges["/users"] = users.length;
    }
    if (can("checkout.manage")) {
      const requests = await api.getCheckoutRequests().catch(() => []);
      const pending = requests.filter((request: { status: string }) => request.status === "pending").length;
      if (pending > 0) badges["/checkouts"] = pending;
    }
  } catch {
    // keep empty badge state on background fetch failures
  }
  return badges;
}

export async function loadIOSBridgeStatus(): Promise<"connected" | "offline" | "none"> {
  try {
    const response = await fetch(`${api.baseURL}/api/devices/sessions`, { credentials: "include" });
    if (!response.ok) return "none";
    const data = await response.json();
    const sessions = Array.isArray(data)
      ? data
      : Array.isArray(data.sessions)
        ? data.sessions
        : [];
    const iosSessions = sessions.filter((session: { device_type?: string }) => session.device_type === "ios");
    if (iosSessions.length === 0) return "none";
    return iosSessions.some((session: { is_online?: boolean }) => session.is_online) ? "connected" : "offline";
  } catch {
    return "none";
  }
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
  refreshIOSBridge,
}: {
  routerPush: (href: string) => void;
  routerReplace: (href: string) => void;
  realm: "archive" | "collection";
  setRealm: (realm: "archive" | "collection") => void;
  refreshBadges: () => void;
  refreshIOSBridge: () => void;
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
  const unsub10 = wsClient.on("device.connected", refreshIOSBridge);
  const unsub11 = wsClient.on("device.disconnected", refreshIOSBridge);
  const unsub12 = wsClient.on("devices.list", refreshIOSBridge);

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
    unsub11();
    unsub12();
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
