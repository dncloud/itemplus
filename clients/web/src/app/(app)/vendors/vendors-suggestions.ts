"use client";

import type { AIVendorProposal, VendorLogoPreviewResult } from "@/lib/api";
import type { EntityType, VendorLogoSuggestion, VendorSuggestionEntry } from "./vendors-types";

export function buildVendorSuggestionEntries(
  tab: EntityType,
  proposal?: AIVendorProposal | null,
  t?: (k: string, vars?: Record<string, string | number>) => string,
): VendorSuggestionEntry[] {
  if (!proposal) return [];

  const entries: VendorSuggestionEntry[] = [];
  const pushEntry = (key: string, label: string, value?: string) => {
    const cleaned = String(value || "").trim();
    if (!cleaned) return;
    entries.push({ key, label, value: cleaned });
  };

  pushEntry("name", t ? t("vendors.name") : "Name", proposal.name);
  pushEntry("website", t ? t("vendors.website") : "Website", proposal.website);
  pushEntry("email", t ? t("vendors.email") : "E-Mail", proposal.email);
  pushEntry("phone", t ? t("vendors.phone") : "Telefon", proposal.phone);

  if (tab === "suppliers" || tab === "vendors" || tab === "sales-platforms") {
    pushEntry("contact_person", t ? t("vendors.contactPerson") : "Kontaktperson", proposal.contact_person);
  }
  if (tab === "suppliers") {
    pushEntry("account_manager", t ? t("vendors.accountManager") : "Account Manager", proposal.account_manager);
  }
  if (tab === "vendors" || tab === "sales-platforms") {
    pushEntry("customer_number", t ? t("vendors.customerNumber") : "Kundennummer", proposal.customer_number);
  }
  if (tab === "manufacturers") {
    pushEntry("support_email", t ? t("vendors.supportEmail") : "Support E-Mail", proposal.support_email);
    pushEntry("support_phone", t ? t("vendors.supportPhone") : "Support Telefon", proposal.support_phone);
    pushEntry("support_url", t ? t("vendors.supportUrl") : "Support URL", proposal.support_url);
  }

  if (proposal.address) {
    pushEntry("address.street", t ? t("vendors.street") : "Straße", proposal.address.street);
    pushEntry("address.house_number", t ? t("vendors.houseNo") : "Nr.", proposal.address.house_number);
    pushEntry("address.zip", t ? t("vendors.zip") : "PLZ", proposal.address.zip);
    pushEntry("address.city", t ? t("vendors.city") : "Ort", proposal.address.city);
  }

  return entries;
}

export function buildVendorLogoSuggestion(result?: VendorLogoPreviewResult | null): VendorLogoSuggestion | null {
  if (!result || !Array.isArray(result.candidates) || result.candidates.length === 0) {
    return null;
  }
  return result;
}
