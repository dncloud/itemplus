"use client";

import { api, type Category, type Item, type Location, type Property } from "@/lib/api";
import { wsClient } from "@/lib/ws";

export async function fetchItemDetailData(itemId: number) {
  const item = await api.getItem(itemId);
  const [properties, requests] = await Promise.all([
    item.category_id ? api.getProperties(item.category_id).catch(() => [] as Property[]) : Promise.resolve([] as Property[]),
    api.getCheckoutRequests().catch(() => []),
  ]);

  return {
    item,
    properties: [...properties].sort((a, b) => a.position - b.position),
    checkoutState: buildCheckoutState(item, requests, itemId),
  };
}

export async function fetchItemDisplayMeta() {
  const [categories, locations] = await Promise.all([
    api.getCategories().catch(() => [] as Category[]),
    api.getLocations().catch(() => [] as Location[]),
  ]);
  return { categories, locations };
}

export function buildCheckoutState(
  item: Item,
  requests: Array<{ item_id: number; status: string }>,
  itemId: number,
) {
  const pendingForItem = requests.filter((request) => request.item_id === itemId && request.status === "pending");
  const activeCount = item.checked_out_to ? 1 : 0;
  return {
    blocked: (activeCount + pendingForItem.length) >= item.quantity,
    sent: pendingForItem.length > 0,
  };
}

export function getBadgeStyle(color?: string) {
  return color
    ? { backgroundColor: `${color}15`, color }
    : undefined;
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
