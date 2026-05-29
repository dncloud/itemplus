"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import {
  type ActiveCheckout,
  type InventoryWarning,
  type LocationWarning,
  type StatsOverview,
} from "@/lib/api";
import { useApp } from "@/lib/app-context";
import {
  ArchiveBoxIcon,
  BanknotesIcon,
  MapPinIcon,
  Squares2X2Icon,
  SwatchIcon,
} from "@heroicons/react/24/outline";
import {
  OverduePanel,
  RecentlyAddedPanel,
  TopItemsPanel,
  WarningGrid,
} from "./dashboard-sections";
import {
  fetchDashboardPageData,
  filterWarningsByRealm,
  formatDashboardCurrency,
} from "./dashboard-page-utils";

const enableDashboardPrefetch = process.env.NODE_ENV === "production";

export default function DashboardPage() {
  const { realm, setRealm, fmtDate, t, can } = useApp();
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [warnings, setWarnings] = useState<InventoryWarning[]>([]);
  const [locWarnings, setLocWarnings] = useState<LocationWarning[]>([]);
  const [myOverdue, setMyOverdue] = useState<ActiveCheckout[]>([]);
  const [loading, setLoading] = useState(true);
  const [topSort, setTopSort] = useState<"value" | "quantity">("value");
  const [topSortMenuOpen, setTopSortMenuOpen] = useState(false);
  const canReadItems = can("items.read");
  const canReadCategories = can("categories.read");
  const canReadLocations = can("locations.read");
  const canViewInventoryWarnings = can("items.write");
  const canViewLocationWarnings = can("locations.write");
  const canManageCheckout = can("checkout.manage");

  useEffect(() => {
    let cancelled = false;

    void fetchDashboardPageData({
      includeInventoryWarnings: canViewInventoryWarnings,
      includeLocationWarnings: canViewLocationWarnings,
      includeAllOverdue: canManageCheckout,
    })
      .then(({ overview, inventoryWarnings, locationWarnings, overdue }) => {
        if (cancelled) return;
        setStats(overview);
        setWarnings(inventoryWarnings);
        setLocWarnings(locationWarnings);
        setMyOverdue(overdue);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [realm, canViewInventoryWarnings, canViewLocationWarnings, canManageCheckout]);

  useEffect(() => {
    if (!topSortMenuOpen) return;
    const close = () => setTopSortMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [topSortMenuOpen]);

  if (loading) return <Loading />;
  if (!stats) return <p className="text-gray-500">{t("dashboard.noData")}</p>;

  const current = stats[realm];
  const realmWarnings = filterWarningsByRealm(warnings, realm);
  const realmLocWarnings = filterWarningsByRealm(locWarnings, realm);
  const topItems = topSort === "value" ? current.top_by_value : current.top_by_quantity;

  return (
    <div className="space-y-4 lg:space-y-8">
      <div>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <SimpleStat
            title="Realm"
            value={realm === "archive" ? t("realm.archive") : t("realm.collection")}
            icon={ArchiveBoxIcon}
            accent="gray"
          />
          <SimpleStat
            title={t("dashboard.totalValue")}
            value={formatDashboardCurrency(current.total_value)}
            detail={`Ø ${formatDashboardCurrency(current.avg_price)}`}
            icon={BanknotesIcon}
            accent="indigo"
          />
          <SimpleStat
            title={t("dashboard.items")}
            value={current.items}
            detail={canReadItems ? "Alle anzeigen" : undefined}
            icon={ArchiveBoxIcon}
            accent="blue"
            href={canReadItems ? "/items" : undefined}
          />
          <SimpleStat
            title={t("dashboard.categories")}
            value={current.categories}
            detail={canReadCategories ? "Alle anzeigen" : undefined}
            icon={Squares2X2Icon}
            accent="emerald"
            href={canReadCategories ? "/categories" : undefined}
          />
          <SimpleStat
            title={t("dashboard.locations")}
            value={current.locations}
            detail={canReadLocations ? "Alle anzeigen" : undefined}
            icon={MapPinIcon}
            accent="gray"
            href={canReadLocations ? "/locations" : undefined}
          />
          <SimpleStat
            title={t("dashboard.properties")}
            value={current.properties}
            detail={canReadCategories ? "Alle anzeigen" : undefined}
            icon={SwatchIcon}
            accent="purple"
            href={canReadCategories ? "/categories" : undefined}
          />
        </dl>
      </div>

      <WarningGrid
        inventoryWarnings={canViewInventoryWarnings ? realmWarnings : []}
        locationWarnings={canViewLocationWarnings ? realmLocWarnings : []}
        canOpenItems={canReadItems}
        canOpenLocations={canReadLocations}
        t={t}
      />

      <OverduePanel
        checkouts={myOverdue}
        fmtDate={fmtDate}
        canOpenItems={canReadItems}
        t={t}
        onOpenCheckout={(checkout) => {
          if (checkout.realm === "archive" || checkout.realm === "collection") {
            setRealm(checkout.realm);
          }
        }}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 lg:gap-8">
        <div className="space-y-4 lg:space-y-8">
          <RecentlyAddedPanel items={current.recently_added ?? []} canOpenItems={canReadItems} fmtDate={fmtDate} t={t} />
        </div>

        <div className="space-y-4 lg:space-y-8">
          <TopItemsPanel
            items={topItems ?? []}
            topSort={topSort}
            topSortMenuOpen={topSortMenuOpen}
            onToggleMenu={() => setTopSortMenuOpen((open) => !open)}
            onSelectSort={(value) => {
              setTopSort(value);
              setTopSortMenuOpen(false);
            }}
            formatCurrency={formatDashboardCurrency}
            canOpenItems={canReadItems}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}

function SimpleStat({
  title,
  value,
  detail,
  icon: Icon,
  href,
  accent = "indigo",
}: {
  title: string;
  value: string | number;
  detail?: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  href?: string;
  accent?: "indigo" | "blue" | "emerald" | "gray" | "purple";
}) {
  const accentMap: Record<string, { tile: string; value: string }> = {
    indigo: {
      tile: "bg-indigo-500/85",
      value: "text-gray-900 dark:text-white",
    },
    blue: {
      tile: "bg-blue-500/85",
      value: "text-gray-900 dark:text-white",
    },
    emerald: {
      tile: "bg-emerald-500/85",
      value: "text-gray-900 dark:text-white",
    },
    gray: {
      tile: "bg-gray-600",
      value: "text-gray-900 dark:text-white",
    },
    purple: {
      tile: "bg-purple-500/85",
      value: "text-gray-900 dark:text-white",
    },
  };
  const cardBody = (
    <>
      <dt className={clsx("flex w-16 shrink-0 items-center justify-center rounded-l-md text-white", accentMap[accent].tile)}>
        <Icon className="size-5" />
      </dt>
      <dd className="flex min-w-0 flex-1 items-center justify-between truncate rounded-r-md border-y border-r border-gray-200 bg-white/80 dark:border-white/10 dark:bg-gray-800/50">
        <div className="min-w-0 flex-1 truncate px-4 py-2 text-sm">
          <div className="truncate text-sm font-medium text-gray-900 dark:text-white">{title}</div>
          <div className={clsx("mt-0.5 truncate text-base font-semibold", accentMap[accent].value)}>{value}</div>
          {detail ? (
            href ? (
              <div className="mt-0.5 text-xs text-indigo-500 dark:text-indigo-400">{detail}</div>
            ) : (
              <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{detail}</div>
            )
          ) : null}
        </div>
      </dd>
    </>
  );

  return (
    <div className="col-span-1 flex rounded-md">
      {href ? (
        <Link prefetch={enableDashboardPrefetch} href={href} className="flex w-full rounded-md">
          {cardBody}
        </Link>
      ) : (
        cardBody
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  );
}
