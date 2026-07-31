"use client";

import { api, type ActiveCheckout, type CheckoutRequest } from "@/lib/api";
import { buildPaginationPages } from "@/app/(app)/items/items-page-navigation";

export type CheckoutListEntry = (CheckoutRequest & { entryType: "request" }) | (CheckoutRequest & { entryType: "checkout" });

export async function fetchCheckoutsPageData() {
  const [requests, activeCheckouts] = await Promise.all([
    api.getCheckoutRequests(),
    api.getActiveCheckouts().catch(() => [] as ActiveCheckout[]),
  ]);

  const normalizedRequests: CheckoutListEntry[] = requests.map((request) => ({
    ...request,
    entryType: "request",
  }));

  const normalizedActiveCheckouts: CheckoutListEntry[] = activeCheckouts.map((checkout) => ({
    id: checkout.id,
    realm: checkout.realm,
    item_id: checkout.item_id,
    item_name: checkout.item_name,
    is_bundle: checkout.is_bundle,
    component_item_ids: checkout.component_item_ids,
    component_names: checkout.component_names,
    bundle_component_item_ids: checkout.bundle_component_item_ids,
    bundle_component_names: checkout.bundle_component_names,
    user_id: checkout.user_id,
    user_name: checkout.user_name,
    status: "active",
    notes: checkout.notes,
    created_at: checkout.created_at,
    checkout_created_at: checkout.created_at,
    due_date: checkout.due_date,
    duration_days: checkout.duration_days,
    is_overdue: checkout.is_overdue,
    overdue_days: checkout.overdue_days,
    user_has_email: checkout.user_has_email,
    last_reminder_sent_at: checkout.last_reminder_sent_at,
    reminder_cooldown_active: checkout.reminder_cooldown_active,
    next_reminder_at: checkout.next_reminder_at,
    entryType: "checkout",
  }));

  return [...normalizedRequests, ...normalizedActiveCheckouts].sort((a, b) => {
    const left = a.created_at ? new Date(a.created_at).getTime() : 0;
    const right = b.created_at ? new Date(b.created_at).getTime() : 0;
    return right - left;
  });
}

export function filterCheckoutRequests(
  requests: CheckoutListEntry[],
  filter: string,
  realm: string,
  itemID?: number,
) {
  const filtered = filter === "all"
    ? requests.filter((request) => request.status === "active" || request.status === "pending")
    : requests.filter((request) => request.status === filter);
  return filtered.filter((request) => request.realm === realm && (!itemID || request.item_id === itemID));
}

export function buildCheckoutsPageUrl(opts: { page?: number; filter?: string; realm?: "archive" | "collection"; itemID?: number }) {
  const params = new URLSearchParams();
  if (opts.realm) params.set("realm", opts.realm);
  if (opts.itemID) params.set("item_id", String(opts.itemID));
  if (opts.filter && opts.filter !== "all") params.set("filter", opts.filter);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  const query = params.toString();
  return query ? `/checkouts?${query}` : "/checkouts";
}

export function paginateCheckoutRequests(requests: CheckoutListEntry[], page: number, perPage: number) {
  const total = requests.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  return {
    page: safePage,
    total,
    totalPages,
    pages: buildPaginationPages(safePage, totalPages),
    items: requests.slice(start, start + perPage),
  };
}
