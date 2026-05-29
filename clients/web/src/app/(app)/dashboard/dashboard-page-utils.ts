"use client";

import { api, type ActiveCheckout, type InventoryWarning, type LocationWarning, type StatsOverview } from "@/lib/api";

export function formatDashboardCurrency(value: number) {
  return value.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export async function fetchDashboardPageData({
  includeInventoryWarnings = true,
  includeLocationWarnings = true,
  includeAllOverdue = false,
}: {
  includeInventoryWarnings?: boolean;
  includeLocationWarnings?: boolean;
  includeAllOverdue?: boolean;
} = {}) {
  const [overview, inventory, locations, overdue] = await Promise.all([
    api.getOverview(),
    includeInventoryWarnings ? api.getInventoryStats() : Promise.resolve({ warnings: [] }),
    includeLocationWarnings ? api.getLocationStats() : Promise.resolve({ warnings: [] }),
    (includeAllOverdue ? api.getOverdueCheckouts() : api.getMyOverdueCheckouts()).catch(() => []),
  ]);

  return {
    overview,
    inventoryWarnings: inventory.warnings,
    locationWarnings: locations.warnings,
    overdue,
  } as {
    overview: StatsOverview;
    inventoryWarnings: InventoryWarning[];
    locationWarnings: LocationWarning[];
    overdue: ActiveCheckout[];
  };
}

export function filterWarningsByRealm<T extends { realm: string }>(warnings: T[], realm: string) {
  return warnings.filter((warning) => warning.realm === realm);
}
