"use client";

import React from "react";
import { Building2, Code2, Store, Tag, Truck, WandSparkles } from "lucide-react";
import type { VendorLogoPreviewResult } from "@/lib/api";

export type EntityType = "manufacturers" | "suppliers" | "vendors" | "developers" | "publishers" | "sales-platforms";

export const TABS: { key: EntityType; labelKey: string; icon: React.ElementType }[] = [
  { key: "manufacturers", labelKey: "vendors.manufacturers", icon: Building2 },
  { key: "suppliers", labelKey: "vendors.suppliers", icon: Truck },
  { key: "vendors", labelKey: "vendors.vendors", icon: Store },
  { key: "developers", labelKey: "vendors.developers", icon: Code2 },
  { key: "publishers", labelKey: "vendors.publishers", icon: WandSparkles },
  { key: "sales-platforms", labelKey: "vendors.salesPlatforms", icon: Tag },
];

export type VendorSuggestionEntry = {
  key: string;
  label: string;
  value: string;
};

export type VendorLogoSuggestion = VendorLogoPreviewResult;
