"use client";

import { api, type Category, type CheckoutRequest, type Location, type Property } from "@/lib/api";

export async function fetchItemsReferenceData() {
  const [categories, locations, properties] = await Promise.all([
    api.getCategories().catch(() => [] as Category[]),
    api.getLocations().catch(() => [] as Location[]),
    api.getProperties().catch(() => [] as Property[]),
  ]);

  return { categories, locations, properties };
}

export async function fetchPendingRequestsByItem(realm: string) {
  const requests = await api.getCheckoutRequests().catch(() => [] as CheckoutRequest[]);
  return requests
    .filter((request) => request.realm === realm && request.status === "pending")
    .reduce<Record<number, CheckoutRequest[]>>((acc, request) => {
      if (!acc[request.item_id]) acc[request.item_id] = [];
      acc[request.item_id].push(request);
      return acc;
    }, {});
}
