"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { MapPin, PackageOpen } from "lucide-react";
import type { InventoryWarning, LocationWarning } from "@/lib/api";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

const SHOWN_AT_FIRST = 4;

const tones = {
  red: { badge: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400", bar: "bg-red-500 dark:bg-red-400" },
  yellow: { badge: "bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200", bar: "bg-amber-400 dark:bg-amber-300/60" },
};

type Row = { key: string; name: string; href?: string; badge: string; tone: keyof typeof tones; detail: string; share: number };

// One kind of warning as a card: every row says what is wrong, how far off
// it is in words, and shows the same as a bar.
function WarningCard({ title, icon: Icon, rows, t }: { title: string; icon: typeof MapPin; rows: Row[]; t: Translate }) {
  const [showAll, setShowAll] = useState(false);
  if (rows.length === 0) return null;
  const shown = showAll ? rows : rows.slice(0, SHOWN_AT_FIRST);

  return (
    <section className="overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
      <h3 className="flex items-center gap-2 px-4 pt-4 text-sm/6 font-semibold text-gray-900 sm:px-6 dark:text-white">
        <Icon aria-hidden="true" className="size-4 text-gray-400" />
        {title}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">{rows.length}</span>
      </h3>
      <ul role="list" className="mt-2 divide-y divide-gray-100 dark:divide-white/5">
        {shown.map((row) => (
          <li key={row.key} className="px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              {row.href ? (
                <Link href={row.href} className="truncate text-sm font-medium text-gray-900 hover:underline dark:text-white">{row.name}</Link>
              ) : (
                <span className="truncate text-sm font-medium text-gray-900 dark:text-white">{row.name}</span>
              )}
              <span className={clsx("shrink-0 rounded-md px-2 py-1 text-xs font-medium", tones[row.tone].badge)}>{row.badge}</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                <div className={clsx("h-full rounded-full", tones[row.tone].bar)} style={{ width: `${Math.max(row.share > 0 ? 3 : 0, Math.min(100, row.share))}%` }} />
              </div>
              <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{row.detail}</span>
            </div>
          </li>
        ))}
      </ul>
      {rows.length > SHOWN_AT_FIRST ? (
        <div className="border-t border-gray-100 px-4 py-2.5 sm:px-6 dark:border-white/5">
          <button type="button" onClick={() => setShowAll(!showAll)} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
            {showAll ? t("inventoryMovements.showLess") : t("inventoryMovements.showAllWarnings", { count: rows.length })}
          </button>
        </div>
      ) : null}
    </section>
  );
}

/**
 * What needs attention in the stock of the current realm: items below their
 * minimum and locations at or over their capacity, worst first.
 */
export function StockWarnings({ realm, inventoryWarnings, locationWarnings, canOpenItems, canOpenLocations, t }: {
  realm: "archive" | "collection";
  inventoryWarnings: InventoryWarning[];
  locationWarnings: LocationWarning[];
  canOpenItems: boolean;
  canOpenLocations: boolean;
  t: Translate;
}) {
  if (inventoryWarnings.length === 0 && locationWarnings.length === 0) return null;

  const share = (value: number, of?: number) => (of && of > 0 ? (value / of) * 100 : 0);

  const stockRows: Row[] = [...inventoryWarnings]
    .sort((a, b) => share(a.quantity, a.minimum) - share(b.quantity, b.minimum))
    .map((warning) => ({
      key: String(warning.item_id),
      name: warning.name,
      // The stock history of the item is what explains a low stock.
      href: canOpenItems ? `/inventory-movements?realm=${realm}&item_id=${warning.item_id}` : undefined,
      badge: warning.level === "out_of_stock" ? t("dashboard.outOfStock") : t("dashboard.lowStock"),
      tone: warning.level === "out_of_stock" ? "red" : "yellow",
      detail: warning.minimum ? t("inventoryMovements.stockOfMinimum", { quantity: warning.quantity, minimum: warning.minimum }) : t("inventoryMovements.stockLeft", { quantity: warning.quantity }),
      share: share(warning.quantity, warning.minimum),
    }));

  const locationBadge: Record<string, string> = {
    full: t("dashboard.full"),
    almost_full: t("dashboard.almostFull"),
    warning: t("dashboard.warningHigh"),
  };
  const locationRows: Row[] = [...locationWarnings]
    .sort((a, b) => share(b.used, b.capacity) - share(a.used, a.capacity))
    .map((warning) => ({
      key: String(warning.location_id),
      name: warning.name,
      href: canOpenLocations && canOpenItems ? `/items?location=${warning.location_id}` : undefined,
      badge: locationBadge[warning.level] || warning.level,
      tone: warning.level === "full" ? "red" : "yellow",
      detail: t("inventoryMovements.locationUsed", { used: warning.used, capacity: warning.capacity }),
      share: share(warning.used, warning.capacity),
    }));

  return (
    <div className={clsx("grid grid-cols-1 gap-4 lg:gap-6", stockRows.length > 0 && locationRows.length > 0 && "lg:grid-cols-2")}>
      <WarningCard title={t("dashboard.inventoryWarnings")} icon={PackageOpen} rows={stockRows} t={t} />
      <WarningCard title={t("dashboard.locationCapacity")} icon={MapPin} rows={locationRows} t={t} />
    </div>
  );
}
