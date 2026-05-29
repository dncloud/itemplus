"use client";

import type React from "react";
import Link from "next/link";
import clsx from "clsx";
import type { ActiveCheckout, InventoryWarning, LocationWarning } from "@/lib/api";
import { formatCheckoutRelativeState } from "@/lib/checkout-relative-time";
import {
  ArchiveBoxIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

const enableDashboardPrefetch = process.env.NODE_ENV === "production";

function ColorBadge({
  label,
  color,
}: {
  label: string;
  color?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${!color ? "bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-300" : ""}`}
      style={color ? { backgroundColor: `${color}15`, color } : undefined}
    >
      {label}
    </span>
  );
}

export function WarningGrid({
  inventoryWarnings,
  locationWarnings,
  canOpenItems = true,
  canOpenLocations = true,
  t,
}: {
  inventoryWarnings: InventoryWarning[];
  locationWarnings: LocationWarning[];
  canOpenItems?: boolean;
  canOpenLocations?: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const locationLabelMap: Record<string, string> = {
    full: t("dashboard.full"),
    almost_full: t("dashboard.almostFull"),
    warning: t("dashboard.warningHigh"),
  };

  if (inventoryWarnings.length === 0 && locationWarnings.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8">
      {inventoryWarnings.length > 0 ? (
        <SignalCard title={t("dashboard.inventoryWarnings")} tone="red">
          {inventoryWarnings.map((warning) => (
            <li key={warning.item_id}>
              {canOpenItems ? (
                <Link prefetch={enableDashboardPrefetch} href={`/items/${warning.item_id}`} className="hover:text-rose-700 dark:hover:text-rose-300">
                  {warning.name}
                </Link>
              ) : (
                <span>{warning.name}</span>
              )}{" "}
              <span className="text-rose-700 dark:text-rose-300">
                {warning.level === "out_of_stock" ? t("dashboard.outOfStock") : `${warning.quantity}/${warning.minimum}`}
              </span>
            </li>
          ))}
        </SignalCard>
      ) : null}

      {locationWarnings.length > 0 ? (
        <SignalCard title={t("dashboard.locationCapacity")} tone="red">
          {locationWarnings.map((warning) => (
            <li key={warning.location_id}>
              {canOpenLocations ? (
                <Link prefetch={enableDashboardPrefetch} href={`/items?location=${warning.location_id}`} className="hover:text-rose-700 dark:hover:text-rose-300">
                  {warning.name}
                </Link>
              ) : (
                <span>{warning.name}</span>
              )}{" "}
              <span className="text-rose-700 dark:text-rose-300">
                {locationLabelMap[warning.level]} · {warning.used}/{warning.capacity}
              </span>
            </li>
          ))}
        </SignalCard>
      ) : null}
    </div>
  );
}

export function OverduePanel({
  checkouts,
  fmtDate,
  canOpenItems = true,
  t,
  onOpenCheckout,
}: {
  checkouts: ActiveCheckout[];
  fmtDate: (value: string) => string;
  canOpenItems?: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onOpenCheckout: (checkout: ActiveCheckout) => void;
}) {
  if (checkouts.length === 0) return null;

  return (
    <DashboardPanel
      title={t("dashboard.overdueTitle")}
      icon={CalendarCardIcon}
      meta={`${checkouts.length} ${checkouts.length === 1 ? "checkout" : "checkouts"}`}
      flush
    >
      <nav>
        <ul role="list" className="divide-y divide-gray-200 dark:divide-white/5">
          {checkouts.map((checkout) => (
            <li key={checkout.id} className="relative px-4 py-3 hover:bg-gray-50 sm:px-6 dark:hover:bg-white/2.5">
              <div className="min-w-0">
                <p className="text-sm/6 font-semibold text-gray-900 dark:text-white">
                  {canOpenItems ? (
                    <Link prefetch={enableDashboardPrefetch} href={`/items/${checkout.item_id}`} onClick={() => onOpenCheckout(checkout)}>
                      <span className="absolute inset-x-0 inset-y-0" aria-hidden="true" />
                      {checkout.item_name}
                    </Link>
                  ) : (
                    <span>{checkout.item_name}</span>
                  )}
                </p>
                {checkout.user_name ? (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t("checkouts.checkedOutToUser", { user: checkout.user_name })}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {checkout.created_at ? fmtDate(checkout.created_at) : "—"}
                </p>
                {checkout.created_at && checkout.due_date ? (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t("checkouts.period")}: {t("checkouts.fromTo", {
                      from: fmtDate(checkout.created_at),
                      to: fmtDate(checkout.due_date),
                    })}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {formatCheckoutRelativeState({
                    dueDate: checkout.due_date,
                    isOverdue: true,
                    overdueDays: checkout.overdue_days,
                    t,
                  })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </nav>
    </DashboardPanel>
  );
}

export function RecentlyAddedPanel({
  items,
  canOpenItems = true,
  fmtDate,
  t,
}: {
  items: Record<string, unknown>[];
  canOpenItems?: boolean;
  fmtDate: (value: string) => string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  if (!items.length) return null;

  return (
    <DashboardPanel
      title={t("dashboard.recentlyAdded")}
      icon={ArchiveBoxIcon}
      meta={`${items.length} ${items.length === 1 ? "item" : "items"}`}
      flush
    >
      <ul role="list" className="divide-y divide-gray-200 dark:divide-white/5">
        {items.map((item) => {
          const isUpdated = item.updated_at && item.created_at && item.updated_at !== item.created_at;
          return (
            <li
              key={item.id as number}
              className="relative px-4 py-3 hover:bg-gray-50 sm:px-6 dark:hover:bg-white/2.5"
            >
              <div className="min-w-0">
                <h4 className="text-sm/6 font-bold text-gray-900 dark:text-white">
                  {canOpenItems ? (
                    <Link prefetch={enableDashboardPrefetch} href={`/items/${item.id}`}>
                      <span className="absolute inset-x-0 inset-y-0" />
                      <span className="truncate">{item.name as string}</span>
                    </Link>
                  ) : (
                    <span className="truncate">{item.name as string}</span>
                  )}
                </h4>
                <div className="mt-1 flex flex-wrap gap-2">
                  {item.category_name ? (
                    <ColorBadge label={item.category_name as string} color={item.category_color as string | undefined} />
                  ) : null}
                  {item.location_name ? (
                    <ColorBadge label={item.location_name as string} color={item.location_color as string | undefined} />
                  ) : null}
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {isUpdated ? t("common.updated") : t("common.created")} {fmtDate(isUpdated ? (item.updated_at as string) : (item.created_at as string))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </DashboardPanel>
  );
}

export function TopItemsPanel({
  items,
  topSort,
  topSortMenuOpen,
  onToggleMenu,
  onSelectSort,
  formatCurrency,
  canOpenItems = true,
  t,
}: {
  items: Record<string, unknown>[];
  topSort: "value" | "quantity";
  topSortMenuOpen: boolean;
  onToggleMenu: () => void;
  onSelectSort: (value: "value" | "quantity") => void;
  formatCurrency: (value: number) => string;
  canOpenItems?: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  if (!items.length) return null;

  return (
    <DashboardPanel
      title={t("dashboard.topItems")}
      icon={BanknotesIcon}
      meta={`${items.length} ${items.length === 1 ? "item" : "items"}`}
      flush
      action={
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu();
            }}
            className="flex items-center gap-x-1 text-sm/6 font-medium text-gray-400 hover:text-white"
          >
            {t("items.sortBy")}
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-5 text-gray-500">
              <path
                fillRule="evenodd"
                d="M10.53 3.47a.75.75 0 0 0-1.06 0L6.22 6.72a.75.75 0 0 0 1.06 1.06L10 5.06l2.72 2.72a.75.75 0 1 0 1.06-1.06l-3.25-3.25Zm-4.31 9.81 3.25 3.25a.75.75 0 0 0 1.06 0l3.25-3.25a.75.75 0 1 0-1.06-1.06L10 14.94l-2.72-2.72a.75.75 0 0 0-1.06 1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          {topSortMenuOpen ? (
            <div className="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-md bg-gray-800 py-2 shadow-lg outline-1 -outline-offset-1 outline-white/10 transition">
              <button
                type="button"
                onClick={() => onSelectSort("value")}
                className={clsx(
                  "block w-full px-3 py-1 text-left text-sm/6 focus:outline-hidden",
                  topSort === "value" ? "font-semibold text-white" : "text-gray-300 hover:bg-white/5",
                )}
              >
                {t("dashboard.byValue")}
              </button>
              <button
                type="button"
                onClick={() => onSelectSort("quantity")}
                className={clsx(
                  "block w-full px-3 py-1 text-left text-sm/6 focus:outline-hidden",
                  topSort === "quantity" ? "font-semibold text-white" : "text-gray-300 hover:bg-white/5",
                )}
              >
                {t("dashboard.byQuantity")}
              </button>
            </div>
          ) : null}
        </div>
      }
    >
      <ul role="list" className="divide-y divide-gray-200 dark:divide-white/5">
        {items.map((item) => (
          <li
            key={item.id as number}
            className="relative px-4 py-3 hover:bg-gray-50 sm:px-6 dark:hover:bg-white/2.5"
          >
            <div className="min-w-0">
              <h4 className="text-sm/6 font-bold text-gray-900 dark:text-white">
                {canOpenItems ? (
                  <Link prefetch={enableDashboardPrefetch} href={`/items/${item.id}`}>
                    <span className="absolute inset-x-0 inset-y-0" />
                    <span className="truncate">{item.name as string}</span>
                  </Link>
                ) : (
                  <span className="truncate">{item.name as string}</span>
                )}
              </h4>
              <div className="mt-1 flex flex-wrap gap-2">
                {item.category_name ? (
                  <ColorBadge label={item.category_name as string} color={item.category_color as string | undefined} />
                ) : null}
                {item.location_name ? (
                  <ColorBadge label={item.location_name as string} color={item.location_color as string | undefined} />
                ) : null}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {topSort === "value"
                  ? formatCurrency((item as { value: number }).value)
                  : `${(item as { quantity: number }).quantity} ${t("items.quantity")}`}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </DashboardPanel>
  );
}

function SignalCard({
  title,
  children,
  tone = "red",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "red" | "emerald" | "blue";
}) {
  const tones = {
    red: {
      iconWrap: "bg-red-500/15",
      icon: "text-red-400",
      title: "text-gray-900 dark:text-white",
      body: "text-gray-600 dark:text-gray-300",
      marker: "marker:text-red-400",
    },
    emerald: {
      iconWrap: "bg-emerald-500/15",
      icon: "text-emerald-400",
      title: "text-gray-900 dark:text-white",
      body: "text-gray-600 dark:text-gray-300",
      marker: "marker:text-emerald-400",
    },
    blue: {
      iconWrap: "bg-blue-500/15",
      icon: "text-blue-400",
      title: "text-gray-900 dark:text-white",
      body: "text-gray-600 dark:text-gray-300",
      marker: "marker:text-blue-400",
    },
  } as const;

  const toneStyles = tones[tone];

  return (
    <div className="overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
      <div className="flex gap-3 px-4 py-4 sm:px-6">
        <div className="shrink-0">
          <div className={clsx("rounded-full p-1", toneStyles.iconWrap)}>
            <XCircleIcon className={clsx("size-5", toneStyles.icon)} />
          </div>
        </div>
        <div className="min-w-0">
          <h3 className={clsx("text-sm font-semibold", toneStyles.title)}>{title}</h3>
          <div className={clsx("mt-2 text-sm", toneStyles.body)}>
            <ul role="list" className={clsx("list-disc space-y-1 pl-5", toneStyles.marker)}>
              {children}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardPanel({
  title,
  meta,
  icon: Icon,
  action,
  children,
  flush = false,
}: {
  title: string;
  meta?: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  action?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-900/5 dark:bg-gray-800/50 dark:outline-white/10">
      <div className="flex items-center gap-x-4 border-b border-gray-200 bg-gray-50/80 p-6 dark:border-white/10 dark:bg-gray-800/50">
        <div className="flex size-12 flex-none items-center justify-center rounded-lg bg-gray-100 ring-1 ring-gray-200 dark:bg-gray-700 dark:ring-white/10">
          <Icon className="size-6 text-gray-500 dark:text-gray-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm/6 font-medium text-gray-900 dark:text-white">{title}</h3>
          {meta ? <p className="text-sm text-gray-400">{meta}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={flush ? "" : "px-6 py-4"}>{children}</div>
    </section>
  );
}

const CalendarCardIcon = CalendarDaysIcon;
