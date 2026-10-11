"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type StatsOverview } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import {
  ArrowLeftRight,
  Banknote,
  Box,
  Layers,
} from "lucide-react";
import {
  ActivityPanel,
  CategoryDonutPanel,
  CollectionProgressPanel,
  GrowthPanel,
  LocationBarsPanel,
} from "./dashboard-charts";
import { SpotlightCard } from "./dashboard-spotlight";
import {
  CategoryValuePanel,
  RecentlyAddedPanel,
  TopItemsPanel,
} from "./dashboard-sections";
import {
  fetchDashboardPageData,
  formatDashboardCurrency,
} from "./dashboard-page-utils";

const enableDashboardPrefetch = process.env.NODE_ENV === "production";

type IconType = React.ComponentType<{ className?: string }>;

export default function DashboardPage() {
  const { realm, serverURL, locale, fmtDate, t, can } = useApp();
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [topSort, setTopSort] = useState<"value" | "quantity">("value");
  const canReadItems = can("items.read");
  // Only filled when a game catalog is connected and offers the figures.
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof api.getCollectionProgress>>["profiles"]>([]);
  const canReadLocations = can("locations.read");
  const canManageCheckout = can("checkout.manage");

  useEffect(() => {
    let cancelled = false;

    void fetchDashboardPageData({
      includeInventoryWarnings: false,
      includeLocationWarnings: false,
      includeAllOverdue: canManageCheckout,
    })
      .then(({ overview }) => {
        if (cancelled) return;
        setStats(overview);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [realm, canManageCheckout]);

  useEffect(() => {
    if (realm !== "collection" || !canReadItems) return;
    let cancelled = false;
    api.getCollectionProgress()
      .then((result) => {
        if (!cancelled) setProgress(result.available ? result.profiles : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [realm, canReadItems]);

  if (loading) return <Loading />;
  if (!stats) return <p className="text-gray-500">{t("dashboard.noData")}</p>;

  const current = stats[realm];
  const topItems = topSort === "value" ? current.top_by_value : current.top_by_quantity;
  const formatCurrency = (value: number) => formatDashboardCurrency(value, locale);
  const viewAll = t("dashboard.viewAll");
  const hasGrowth = (current.growth?.length ?? 0) >= 2;
  return (
    <div className="space-y-8">
      <div className="text-center sm:text-left">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{realm === "archive" ? t("realm.archive") : t("realm.collection")}</p>
        <h2 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{t("dashboard.title")}</h2>
      </div>

      {realm === "collection" && current.spotlight ? (
        <SpotlightCard
          spotlight={current.spotlight}
          canOpenItems={canReadItems}
          serverURL={serverURL}
          formatCurrency={formatCurrency}
          fmtDate={fmtDate}
          t={t}
        />
      ) : null}

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t("dashboard.items")}
          value={current.items}
          icon={Box}
          href={canReadItems ? "/items" : undefined}
          footer={canReadItems ? viewAll : undefined}
        />
        <StatCard
          title={t("dashboard.totalValue")}
          value={formatCurrency(current.total_value)}
          icon={Banknote}
          footer={t("dashboard.averagePrice", { value: formatCurrency(current.avg_price) })}
        />
        <StatCard title={t("dashboard.totalQuantity")} value={current.total_quantity.toLocaleString(locale === "en" ? "en-US" : "de-DE")} icon={Layers} />
        {current.checked_out !== undefined ? (
          <StatCard
            title={t("dashboard.checkedOut")}
            value={current.checked_out}
            icon={ArrowLeftRight}
            href={canManageCheckout ? "/checkouts" : undefined}
            footer={canManageCheckout ? viewAll : undefined}
          />
        ) : null}
      </dl>

      {realm === "collection" ? <CollectionProgressPanel profiles={progress} canOpenItems={canReadItems} locale={locale} t={t} /> : null}

      <div className={hasGrowth ? "grid grid-cols-1 gap-8 lg:grid-cols-3" : "grid grid-cols-1 gap-8"}>
        {hasGrowth ? (
          <div className="h-full lg:col-span-2">
            <GrowthPanel growth={current.growth ?? []} locale={locale} formatCurrency={formatCurrency} t={t} />
          </div>
        ) : null}
        <CategoryDonutPanel categories={current.by_category ?? []} totalItems={current.items} canOpenItems={canReadItems} t={t} />
      </div>

      <ActivityPanel activity={current.activity ?? []} locale={locale} t={t} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <CategoryValuePanel categories={current.by_category ?? []} formatCurrency={formatCurrency} canOpenItems={canReadItems} t={t} />
        <LocationBarsPanel locations={current.by_location ?? []} canOpenItems={canReadItems && canReadLocations} t={t} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <RecentlyAddedPanel items={(current.recently_added ?? []).slice(0, 5)} canOpenItems={canReadItems} serverURL={serverURL} fmtDate={fmtDate} t={t} />
        <TopItemsPanel
          items={topItems ?? []}
          topSort={topSort}
          onSelectSort={setTopSort}
          formatCurrency={formatCurrency}
          canOpenItems={canReadItems}
          serverURL={serverURL}
          t={t}
        />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  footer,
}: {
  title: string;
  value: string | number;
  icon: IconType;
  href?: string;
  footer?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-white px-4 pt-5 pb-12 shadow-sm sm:px-6 sm:pt-6 dark:bg-gray-800/75 dark:shadow-none dark:inset-ring dark:inset-ring-white/10">
      <dt>
        <div className="absolute rounded-md bg-indigo-500 p-3">
          <Icon className="size-6 text-white" />
        </div>
        <p className="ml-16 truncate text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
      </dt>
      <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
        <p className="truncate text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
        <div className="absolute inset-x-0 bottom-0 bg-gray-50 px-4 py-4 sm:px-6 dark:bg-gray-700/20">
          <div className="truncate text-sm">
            {footer && href ? (
              <Link
                prefetch={enableDashboardPrefetch}
                href={href}
                className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                {footer}
                <span className="sr-only"> {title}</span>
              </Link>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">{footer || " "}</span>
            )}
          </div>
        </div>
      </dd>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
    </div>
  );
}
