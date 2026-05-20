"use client";

import { api, type Vendor } from "@/lib/api";
import type { EntityType } from "./vendors-sections";

function getVendorFetcher(tab: EntityType) {
  return tab === "manufacturers"
    ? api.getManufacturers
    : tab === "suppliers"
      ? api.getSuppliers
      : tab === "vendors"
        ? api.getVendors
        : api.getSalesPlatforms;
}

function getVendorEndpoint(realm: string, tab: EntityType, vendorId?: number) {
  const base = tab === "sales-platforms"
    ? `${api.baseURL}/api/sales-platforms`
    : `${api.baseURL}/api/${realm}/${tab}`;
  return vendorId ? `${base}/${vendorId}` : base;
}

export async function fetchVendorsPageData(tab: EntityType) {
  return getVendorFetcher(tab)();
}

export function filterVendors(vendors: Vendor[], search: string) {
  if (!search) return vendors;
  const needle = search.toLowerCase();
  return vendors.filter((vendor) => vendor.name.toLowerCase().includes(needle));
}

export function validateVendorDraft(
  draft: Partial<Vendor>,
  t: (key: string) => string,
) {
  if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
    return t("vendors.invalidEmail");
  }
  if (draft.website && !/^https?:\/\/.+/.test(draft.website)) {
    return t("vendors.invalidWebsite");
  }
  if (draft.support_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.support_email)) {
    return t("vendors.invalidSupportEmail");
  }
  if (draft.support_url && !/^https?:\/\/.+/.test(draft.support_url)) {
    return t("vendors.invalidSupportUrl");
  }
  return null;
}

export async function saveVendorDraft({
  realm,
  tab,
  draft,
  isNew,
}: {
  realm: string;
  tab: EntityType;
  draft: Partial<Vendor>;
  isNew: boolean;
}) {
  const endpoint = getVendorEndpoint(realm, tab, isNew ? undefined : draft.id);
  await fetch(endpoint, {
    method: isNew ? "POST" : "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(draft),
  });
}

export async function deleteVendorDraft(realm: string, tab: EntityType, vendorId: number) {
  await fetch(getVendorEndpoint(realm, tab, vendorId), {
    method: "DELETE",
    credentials: "include",
  });
}
