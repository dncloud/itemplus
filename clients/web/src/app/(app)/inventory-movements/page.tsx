"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, ArrowUpRight, ChevronRight, Download, type LucideIcon, PackageMinus, Plus, Search, ShoppingCart, SlidersHorizontal, Undo2 } from "lucide-react";
import {
  api,
  type InventoryMovement,
  type InventoryWarning,
  type LocationWarning,
} from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { StockWarnings } from "./stock-warnings";
import { filterWarningsByRealm } from "@/app/(app)/dashboard/dashboard-page-utils";
import { cancelButtonClass } from "@/components/ui/list-controls";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

const PAGE_SIZE = 50;
const PERIODS = [7, 30, 90, 0] as const;

// What kind of movement it is, at a glance: an icon per type. The tiles are
// all in the page's quiet grey; colour is left to the amount on the right.
const MOVEMENT_ICON: Record<string, LucideIcon> = {
  created: Plus,
  bought: ShoppingCart,
  consumed: PackageMinus,
  adjusted: SlidersHorizontal,
  checked_out: ArrowUpRight,
  returned: Undo2,
  imported: Download,
};
const MOVEMENT_TYPES = Object.keys(MOVEMENT_ICON);

function deltaLabel(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

// A loan or return that, by the server's setting, does not count as a change of quantity.
function isNeutralLoanMovement(movement: InventoryMovement) {
  const isLoan = movement.movement_type === "checked_out" || movement.movement_type === "returned";
  return isLoan && movement.quantity_delta === 0 && movement.quantity_before === movement.quantity_after;
}

function movementUserLabel(movement: InventoryMovement) {
  if (movement.movement_type === "checked_out" || movement.movement_type === "returned") {
    return movement.checkout_user_name || movement.created_by_name || "";
  }
  return movement.created_by_name || "";
}

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export default function InventoryMovementsPage() {
  const { realm, setRealm, t, fmtDate, locale, can } = useApp();
  const searchParams = useSearchParams();
  const itemID = Number(searchParams.get("item_id") || "") || undefined;

  // A link may name the area. It is followed once, when it is opened: after
  // that the switch in the menu decides, also while the address still names it.
  const urlRealm = searchParams.get("realm");
  const followedRealm = useRef<string | null>(null);
  useEffect(() => {
    if (urlRealm === followedRealm.current) return;
    followedRealm.current = urlRealm;
    if (urlRealm === "archive" || urlRealm === "collection") {
      setRealm(urlRealm);
    }
  }, [urlRealm, setRealm]);

  if (!can("inventory.read")) {
    return <p className="py-10 text-center text-gray-500 dark:text-gray-400">{t("inventoryChecks.noPermission")}</p>;
  }

  return (
    <InventoryMovementsPageContent
      key={`${realm}:${itemID ?? "all"}`}
      realm={realm}
      itemID={itemID}
      t={t}
      fmtDate={fmtDate}
      locale={locale}
      canReadItems={can("items.read")}
      canReadLocations={can("locations.read")}
      canWriteInventory={can("inventory.write")}
    />
  );
}

function InventoryMovementsPageContent({ realm, itemID, t, fmtDate, locale, canReadItems, canReadLocations, canWriteInventory }: {
  realm: "archive" | "collection";
  itemID?: number;
  t: Translate;
  fmtDate: (value?: string | null) => string;
  locale: string;
  canReadItems: boolean;
  canReadLocations: boolean;
  canWriteInventory: boolean;
}) {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [typeFilter, setTypeFilter] = useState("");
  const [days, setDays] = useState<number>(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [inventoryWarnings, setInventoryWarnings] = useState<InventoryWarning[]>([]);
  const [locationWarnings, setLocationWarnings] = useState<LocationWarning[]>([]);
  const isItemView = !!itemID;
  const canViewWarnings = canWriteInventory && !isItemView;

  // Typing searches after a short pause, not on every key.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Answers can arrive out of order; only the newest request may fill the list.
  const requestRef = useRef(0);
  const load = useCallback(async (offset: number) => {
    const request = ++requestRef.current;
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const response = await api.getInventoryMovements({
        realm,
        item_id: itemID,
        type: typeFilter || undefined,
        q: search || undefined,
        days: days || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      if (request !== requestRef.current) return;
      const page = response.movements || [];
      setMovements((current) => (offset === 0 ? page : [...current, ...page]));
      // A server from before this page has no counts and no total.
      setTotal(response.total ?? (offset === 0 ? page.length : offset + page.length));
      if (response.counts) {
        setCounts(response.counts);
      } else if (offset === 0) {
        const fromPage: Record<string, number> = {};
        for (const movement of page) fromPage[movement.movement_type] = (fromPage[movement.movement_type] || 0) + 1;
        setCounts(fromPage);
      }
    } catch {
      if (request === requestRef.current && offset === 0) {
        setMovements([]);
        setTotal(0);
        setCounts({});
      }
    } finally {
      if (request === requestRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [realm, itemID, typeFilter, search, days]);

  useEffect(() => {
    void Promise.resolve().then(() => load(0));
  }, [load]);

  useEffect(() => {
    if (!canViewWarnings) return;
    let cancelled = false;
    void Promise.all([
      api.getInventoryStats().catch(() => ({ warnings: [] as InventoryWarning[] })),
      api.getLocationStats().catch(() => ({ warnings: [] as LocationWarning[] })),
    ]).then(([inventoryResponse, locationResponse]) => {
      if (cancelled) return;
      setInventoryWarnings(inventoryResponse.warnings || []);
      setLocationWarnings(locationResponse.warnings || []);
    });
    return () => {
      cancelled = true;
    };
  }, [canViewWarnings, realm]);

  const allCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const typeTabs = [
    { type: "", label: t("inventoryMovements.allTypes"), count: allCount },
    ...MOVEMENT_TYPES.filter((type) => (counts[type] || 0) > 0 || type === typeFilter).map((type) => ({
      type,
      label: t(`inventoryMovements.movementType.${type}`),
      count: counts[type] || 0,
    })),
  ];

  // One block per day, newest first, as the server sends them.
  const groups = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const result: { key: string; label: string; rows: InventoryMovement[] }[] = [];
    for (const movement of movements) {
      const date = new Date(movement.created_at);
      const key = Number.isNaN(date.getTime()) ? movement.created_at : dayKey(date);
      let group = result[result.length - 1];
      if (!group || group.key !== key) {
        const label = key === dayKey(today) ? t("inventoryMovements.today") : key === dayKey(yesterday) ? t("inventoryMovements.yesterday") : fmtDate(movement.created_at);
        group = { key, label, rows: [] };
        result.push(group);
      }
      group.rows.push(movement);
    }
    return result;
  }, [movements, fmtDate, t]);

  const timeOf = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  };
  const itemName = isItemView ? movements[0]?.item_name : undefined;
  const filtered = Boolean(typeFilter || search || days);

  return (
    <div className="space-y-6">
      <div className="mb-4 text-center sm:flex sm:items-center sm:justify-between sm:text-left lg:mb-8">
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
          <h2 className="text-2xl font-bold">{isItemView && itemName ? t("inventoryMovements.titleForItem", { item: itemName }) : t("inventoryMovements.title")}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{isItemView ? t("inventoryMovements.introItem") : t("inventoryMovements.intro")}</p>
        </div>
        {isItemView ? (
          <div className="flex items-center justify-center gap-2 px-2 py-3 sm:justify-end sm:px-0">
            <Link href={`/inventory-movements?realm=${realm}`} className={clsx("inline-flex items-center gap-x-1.5", cancelButtonClass)}>
              <ArrowLeft aria-hidden="true" className="-ml-0.5 size-4" />
              {t("inventoryMovements.allMovements")}
            </Link>
            {canReadItems ? <Link href={`/items/${itemID}`} className={cancelButtonClass}>{t("inventoryMovements.openItem")}</Link> : null}
          </div>
        ) : null}
      </div>

      {canViewWarnings ? (
        <StockWarnings
          realm={realm}
          inventoryWarnings={filterWarningsByRealm(inventoryWarnings, realm)}
          locationWarnings={filterWarningsByRealm(locationWarnings, realm)}
          canOpenItems={canReadItems}
          canOpenLocations={canReadLocations}
          t={t}
        />
      ) : null}

      <div className="overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
        <div className="space-y-4 border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-white/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {!isItemView ? (
              <div className="grid min-w-0 flex-1 grid-cols-1">
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={t("inventoryMovements.searchPlaceholder")}
                  aria-label={t("inventoryMovements.searchPlaceholder")}
                  className="col-start-1 row-start-1 block w-full rounded-md bg-white py-1.5 pr-3 pl-10 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:pl-9 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                />
                <Search aria-hidden="true" className="pointer-events-none col-start-1 row-start-1 ml-3 size-5 self-center text-gray-400 sm:size-4" />
              </div>
            ) : null}
            <div role="radiogroup" aria-label={t("inventoryMovements.period")} className="isolate inline-flex shrink-0 rounded-md shadow-xs dark:shadow-none">
              {PERIODS.map((period, index) => (
                <button
                  key={period}
                  type="button"
                  role="radio"
                  aria-checked={days === period}
                  onClick={() => setDays(period)}
                  className={clsx(
                    "relative inline-flex items-center px-3 py-2 text-sm font-semibold inset-ring inset-ring-gray-300 focus:z-10 dark:inset-ring-gray-700",
                    index === 0 && "rounded-l-md",
                    index > 0 && "-ml-px",
                    index === PERIODS.length - 1 && "rounded-r-md",
                    days === period
                      ? "z-10 bg-indigo-600 text-white inset-ring-indigo-600 dark:bg-indigo-500 dark:inset-ring-indigo-500"
                      : "bg-white text-gray-900 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/20",
                  )}
                >
                  {period === 0 ? t("inventoryMovements.periodAll") : t("inventoryMovements.periodDays", { days: period })}
                </button>
              ))}
            </div>
          </div>

          {/* The types that occur, each with how many there are; a click filters. */}
          <div className="flex flex-wrap gap-2">
            {typeTabs.map((tab) => (
              <button
                key={tab.type || "all"}
                type="button"
                aria-pressed={typeFilter === tab.type}
                onClick={() => setTypeFilter(tab.type)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition",
                  typeFilter === tab.type
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
                )}
              >
                {tab.label}
                <span className={clsx("rounded-full px-2 py-0.5 text-xs", typeFilter === tab.type ? "bg-indigo-200/70 dark:bg-indigo-500/30" : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300")}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : movements.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-gray-500 sm:px-6 dark:text-gray-400">
            {filtered ? t("inventoryMovements.emptyFiltered") : t("inventoryMovements.empty")}
          </p>
        ) : (
          <div>
            {groups.map((group) => (
              <section key={group.key}>
                <h3 className="flex items-baseline justify-between gap-4 border-y border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-900 first:border-t-0 sm:px-6 dark:border-white/10 dark:bg-white/5 dark:text-white">
                  {group.label}
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                    {group.rows.length === 1 ? t("inventoryMovements.movementCountOne") : t("inventoryMovements.movementCount", { count: group.rows.length })}
                  </span>
                </h3>
                <ul role="list" className="divide-y divide-gray-100 dark:divide-white/5">
                  {group.rows.map((movement) => {
                    const Icon = MOVEMENT_ICON[movement.movement_type] || SlidersHorizontal;
                    const neutral = isNeutralLoanMovement(movement);
                    const user = movementUserLabel(movement);
                    const name = movement.item_name || `#${movement.item_id}`;
                    return (
                      <li key={`${movement.realm}-${movement.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 sm:px-6 dark:hover:bg-white/2.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400">
                          <Icon aria-hidden="true" className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-gray-900 dark:text-white">
                            {!isItemView ? (
                              canReadItems ? (
                                <Link href={`/inventory-movements?realm=${movement.realm || realm}&item_id=${movement.item_id}`} className="font-semibold hover:underline">{name}</Link>
                              ) : (
                                <span className="font-semibold">{name}</span>
                              )
                            ) : null}
                            <span className={clsx(!isItemView && "ml-2", "text-gray-600 dark:text-gray-300")}>{t(`inventoryMovements.movementType.${movement.movement_type}`)}</span>
                          </p>
                          <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                            {[timeOf(movement.created_at), user, !isItemView ? movement.category_name : "", movement.notes].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={clsx(
                              "text-sm font-semibold",
                              neutral || movement.quantity_delta === 0
                                ? "text-gray-500 dark:text-gray-400"
                                : movement.quantity_delta > 0
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400",
                            )}
                          >
                            {neutral ? t("inventoryMovements.unchanged") : deltaLabel(movement.quantity_delta)}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {neutral
                              ? t("inventoryMovements.totalStock", { quantity: movement.quantity_after })
                              : t("inventoryMovements.totalStockChange", { before: movement.quantity_before, after: movement.quantity_after })}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 sm:px-6 dark:border-white/10">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("inventoryMovements.shown", { shown: movements.length, total: Math.max(total, movements.length) })}</p>
              {movements.length < total ? (
                <button type="button" onClick={() => { void load(movements.length); }} disabled={loadingMore} className={clsx("disabled:cursor-not-allowed disabled:opacity-60", cancelButtonClass)}>
                  {loadingMore ? t("common.loading") : t("inventoryMovements.loadMore")}
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
