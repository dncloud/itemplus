"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  api,
  type InventoryMovement,
  type InventoryWarning,
  type LocationWarning,
} from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { WarningGrid } from "@/app/(app)/dashboard/dashboard-sections";
import { filterWarningsByRealm } from "@/app/(app)/dashboard/dashboard-page-utils";

const movementTypes = ["created", "bought", "consumed", "adjusted", "checked_out", "returned", "imported"];

function deltaLabel(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

export default function InventoryMovementsPage() {
  const { realm, setRealm, t, fmtDate, can } = useApp();
  const searchParams = useSearchParams();
  const [typeFilter, setTypeFilter] = useState<string>("");
  const itemID = Number(searchParams.get("item_id") || "") || undefined;
  const canReadInventory = can("inventory.read");

  useEffect(() => {
    const urlRealm = searchParams.get("realm");
    if (urlRealm === "archive" || urlRealm === "collection") {
      setRealm(urlRealm);
    }
  }, [searchParams, setRealm]);

  if (!canReadInventory) {
    return <p className="py-10 text-center text-gray-500 dark:text-gray-400">Keine Berechtigung</p>;
  }

  return (
    <InventoryMovementsPageContent
      key={`${realm}:${itemID ?? "all"}:${typeFilter || "all"}`}
      realm={realm}
      itemID={itemID}
      typeFilter={typeFilter}
      setTypeFilter={setTypeFilter}
      t={t}
      fmtDate={fmtDate}
      canReadItems={can("items.read")}
      canReadLocations={can("locations.read")}
      canWriteInventory={can("inventory.write")}
    />
  );
}

function InventoryMovementsPageContent({
  realm,
  itemID,
  typeFilter,
  setTypeFilter,
  t,
  fmtDate,
  canReadItems,
  canReadLocations,
  canWriteInventory,
}: {
  realm: "archive" | "collection";
  itemID?: number;
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  fmtDate: (value?: string | null) => string;
  canReadItems: boolean;
  canReadLocations: boolean;
  canWriteInventory: boolean;
}) {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [movementSummary, setMovementSummary] = useState<InventoryMovement[]>([]);
  const [inventoryWarnings, setInventoryWarnings] = useState<InventoryWarning[]>([]);
  const [locationWarnings, setLocationWarnings] = useState<LocationWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const canViewInventoryWarnings = canWriteInventory;
  const canViewLocationWarnings = canWriteInventory;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getInventoryMovements({ realm, item_id: itemID, type: typeFilter || undefined, limit: 200 }),
      api.getInventoryMovements({ realm, item_id: itemID, limit: 1000 }).catch(() => ({ movements: [] as InventoryMovement[] })),
    ])
      .then(([listResponse, summaryResponse]) => {
        if (cancelled) return;
        setMovements(listResponse.movements || []);
        setMovementSummary(summaryResponse.movements || []);
      })
      .catch(() => {
        if (!cancelled) {
          setMovements([]);
          setMovementSummary([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [realm, itemID, typeFilter]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      canViewInventoryWarnings ? api.getInventoryStats().catch(() => ({ warnings: [] })) : Promise.resolve({ warnings: [] as InventoryWarning[] }),
      canViewLocationWarnings ? api.getLocationStats().catch(() => ({ warnings: [] as LocationWarning[] })) : Promise.resolve({ warnings: [] as LocationWarning[] }),
    ]).then(([inventoryResponse, locationResponse]) => {
      if (cancelled) return;
      setInventoryWarnings(inventoryResponse.warnings || []);
      setLocationWarnings(locationResponse.warnings || []);
    });

    return () => {
      cancelled = true;
    };
  }, [canViewInventoryWarnings, canViewLocationWarnings, realm]);

  const realmInventoryWarnings = canViewInventoryWarnings ? filterWarningsByRealm(inventoryWarnings, realm) : [];
  const realmLocationWarnings = canViewLocationWarnings ? filterWarningsByRealm(locationWarnings, realm) : [];
  const movementStats = useMemo(
    () => [
      {
        type: "",
        label: t("inventoryMovements.all"),
        count: movementSummary.length,
      },
      ...movementTypes.map((type) => ({
        type,
        label: t(`inventoryMovements.movementType.${type}`),
        count: movementSummary.filter((movement) => movement.movement_type === type).length,
      })),
    ],
    [movementSummary, t],
  );

  return (
    <div className="space-y-6">
      <div className="mb-4 text-center sm:text-left lg:mb-8">
        <div className="space-y-1 py-3">
          <nav className="text-sm font-medium dark:text-gray-100">
            <ol className="flex items-center justify-center sm:justify-start">
              <li>
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">{t("nav.dashboard")}</Link>
              </li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRight className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-500 dark:text-gray-400">{t(`realm.${realm}`)}</li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRight className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-900 dark:text-white">{t("inventoryMovements.title")}</li>
            </ol>
          </nav>
          <h2 className="text-2xl font-bold">{t("inventoryMovements.title")}</h2>
        </div>
      </div>

      <WarningGrid
        inventoryWarnings={realmInventoryWarnings}
        locationWarnings={realmLocationWarnings}
        canOpenItems={canReadItems}
        canOpenLocations={canReadLocations}
        t={t}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {movementStats.map((entry) => (
          <CompactStatCard
            key={entry.type || "all"}
            label={entry.label}
            value={entry.count}
            active={typeFilter === entry.type}
            onClick={() => setTypeFilter(entry.type)}
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-[13px] dark:divide-white/10">
            <thead className="bg-gray-50 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryMovements.type")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryMovements.item")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryMovements.quantity")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryMovements.beforeAfter")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryMovements.user")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("inventoryMovements.date")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">{t("common.loading")}</td></tr>
              ) : movements.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">{t("inventoryMovements.empty")}</td></tr>
              ) : movements.map((movement) => (
                <tr key={`${movement.realm}-${movement.id}`} className="hover:bg-gray-50 dark:hover:bg-white/2.5">
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-gray-300">
                      {t(`inventoryMovements.movementType.${movement.movement_type}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canReadItems ? (
                      <Link href={`/items/${movement.item_id}`} className="font-medium text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-300">
                        {movement.item_name || `#${movement.item_id}`}
                      </Link>
                    ) : (
                      <span className="font-medium text-gray-900 dark:text-white">{movement.item_name || `#${movement.item_id}`}</span>
                    )}
                    {movement.category_name ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{movement.category_name}</p> : null}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${movement.quantity_delta > 0 ? "text-emerald-600 dark:text-emerald-300" : movement.quantity_delta < 0 ? "text-rose-600 dark:text-rose-300" : "text-gray-500 dark:text-gray-400"}`}>
                    {deltaLabel(movement.quantity_delta)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {movement.quantity_before} → {movement.quantity_after}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{movement.created_by_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{fmtDate(movement.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CompactStatCard({
  label,
  value,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-4 text-left outline outline-1 -outline-offset-1 transition ${
        active
          ? "bg-blue-50 outline-blue-300 dark:bg-blue-500/10 dark:outline-blue-500/30"
          : "bg-white outline-gray-200 hover:bg-gray-50 dark:bg-gray-800/50 dark:outline-white/10 dark:hover:bg-white/10"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{value}</div>
    </button>
  );
}
