"use client";

import { api, type Category, type CheckoutRequest, type Item, type Location, type Property } from "@/lib/api";
import { wsClient } from "@/lib/ws";

export async function fetchItemDetailData(itemId: number) {
  const item_realm = api.realm;
  const item = await api.getItem(itemId);
  const [properties, requests] = await Promise.all([
    item.category_id ? api.getProperties(item.category_id).catch(() => [] as Property[]) : Promise.resolve([] as Property[]),
    api.getCheckoutRequests().catch(() => [] as CheckoutRequest[]),
  ]);
  // Item numbers repeat between archive and collection, so the realm counts too.
  const pending = requests.filter((request) => request.item_id === itemId && request.realm === item_realm && request.status === "pending");

  return {
    item,
    properties: [...properties].sort((a, b) => a.position - b.position),
    checkoutState: buildCheckoutState(item, pending),
    pendingRequests: pending,
  };
}

export async function fetchItemDisplayMeta() {
  const [categories, locations] = await Promise.all([
    api.getCategories().catch(() => [] as Category[]),
    api.getLocations().catch(() => [] as Location[]),
  ]);
  return { categories, locations };
}

// The server only hands out requests the viewer may see: their own, or all
// of them for whoever manages loans.
export function buildCheckoutState(item: Item, pendingForItem: CheckoutRequest[]) {
  const activeCount = item.checked_out_to ? 1 : 0;
  return {
    blocked: (activeCount + pendingForItem.length) >= item.quantity,
  };
}

export async function requestConnectedDevices() {
  return new Promise<Record<string, unknown>[]>((resolve) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      resolve([]);
    }, 1200);
    const unsubscribe = wsClient.on("devices.list", (data) => {
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(Array.isArray(data.devices) ? (data.devices as Record<string, unknown>[]) : []);
    });
    wsClient.send("devices.list");
  });
}
