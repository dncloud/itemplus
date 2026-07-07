"use client";

import { api, type AIVendorSuggestionResult, type Vendor } from "@/lib/api";
import { fetchWithSession } from "@/lib/api-helpers";
import type { EntityType } from "./vendors-sections";

function getVendorEndpoint(realm: string, tab: EntityType, vendorId?: number) {
  const base = tab === "sales-platforms"
    ? `${api.baseURL}/api/sales-platforms`
    : `${api.baseURL}/api/${realm}/${tab}`;
  return vendorId ? `${base}/${vendorId}` : base;
}

export async function fetchVendorsPageData(realm: string, tab: EntityType) {
  if (tab === "sales-platforms") {
    return api.getSalesPlatforms();
  }
  const response = await fetchWithSession(getVendorEndpoint(realm, tab), {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
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
  if (draft.logo_background && !/^#[0-9a-f]{6}$/i.test(draft.logo_background)) {
    return t("vendors.invalidLogoBackground");
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
  const cleanDraft = { ...draft };
  delete cleanDraft.external_logo_url;
  await fetchWithSession(endpoint, {
    method: isNew ? "POST" : "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(cleanDraft),
  });
}

export async function deleteVendorDraft(realm: string, tab: EntityType, vendorId: number) {
  await fetchWithSession(getVendorEndpoint(realm, tab, vendorId), {
    method: "DELETE",
    credentials: "include",
  });
}

export async function suggestVendorDraft({
  realm,
  tab,
  prompt,
  locale,
  allowWebSearch,
  draft,
}: {
  realm: "archive" | "collection";
  tab: EntityType;
  prompt: string;
  locale?: string;
  allowWebSearch?: boolean;
  draft?: Partial<Vendor>;
}): Promise<AIVendorSuggestionResult> {
  const entityType =
    tab === "manufacturers"
      ? "manufacturer"
      : tab === "suppliers"
        ? "supplier"
        : tab === "vendors"
          ? "vendor"
          : "sales_platform";

  return api.suggestVendor({
    realm,
    entity_type: entityType,
    prompt,
    locale,
    allow_web_search: allowWebSearch,
    draft,
  });
}
