"use client";

import type React from "react";
import Link from "next/link";
import clsx from "clsx";
import { useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import type { InventoryWarning, LocationWarning, MaintenanceReminder } from "@/lib/api";
import {
  Archive,
  Banknote,
  ChevronDown,
  CircleX,
} from "lucide-react";

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
  maintenanceWarnings = [],
  canOpenItems = true,
  canOpenLocations = true,
  t,
}: {
  inventoryWarnings: InventoryWarning[];
  locationWarnings: LocationWarning[];
  maintenanceWarnings?: MaintenanceReminder[];
  canOpenItems?: boolean;
  canOpenLocations?: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const locationLabelMap: Record<string, string> = {
    full: t("dashboard.full"),
    almost_full: t("dashboard.almostFull"),
    warning: t("dashboard.warningHigh"),
  };

  if (inventoryWarnings.length === 0 && locationWarnings.length === 0 && maintenanceWarnings.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8">
      {inventoryWarnings.length > 0 ? (
        <SignalCard title={t("dashboard.inventoryWarnings")} tone="red">
          {inventoryWarnings.map((warning) => (
            <li key={warning.item_id}>
              {canOpenItems ? (
                <Link prefetch={enableDashboardPrefetch} href={`/items/${warning.item_id}`} className="text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-300">
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
                <Link prefetch={enableDashboardPrefetch} href={`/items?location=${warning.location_id}`} className="text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-300">
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

      {maintenanceWarnings.length > 0 ? (
        <SignalCard title={t("dashboard.maintenanceTitle")} tone="red">
          {maintenanceWarnings.map((warning) => (
            <li key={`${warning.realm || "realm"}-${warning.id}`}>
              {canOpenItems ? (
                <Link prefetch={enableDashboardPrefetch} href={`/items/${warning.item_id}`} className="text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-300">
                  {warning.item_name || warning.title}
                </Link>
              ) : (
                <span>{warning.item_name || warning.title}</span>
              )}{" "}
              <span className="text-rose-700 dark:text-rose-300">
                {warning.title} · {t("maintenance.dueOn", { date: warning.due_date })}
              </span>
            </li>
          ))}
        </SignalCard>
      ) : null}
    </div>
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
      icon={Archive}
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
  onSelectSort,
  formatCurrency,
  canOpenItems = true,
  t,
}: {
  items: Record<string, unknown>[];
  topSort: "value" | "quantity";
  onSelectSort: (value: "value" | "quantity") => void;
  formatCurrency: (value: number) => string;
  canOpenItems?: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  if (!items.length) return null;

  return (
    <DashboardPanel
      title={t("dashboard.topItems")}
      icon={Banknote}
      meta={`${items.length} ${items.length === 1 ? "item" : "items"}`}
      flush
      action={
        <Menu as="div" className="relative">
          <MenuButton className="flex items-center gap-x-1 text-sm/6 font-medium text-gray-400 hover:text-white">
            {t("items.sortBy")}
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-5 text-gray-500">
              <path
                fillRule="evenodd"
                d="M10.53 3.47a.75.75 0 0 0-1.06 0L6.22 6.72a.75.75 0 0 0 1.06 1.06L10 5.06l2.72 2.72a.75.75 0 1 0 1.06-1.06l-3.25-3.25Zm-4.31 9.81 3.25 3.25a.75.75 0 0 0 1.06 0l3.25-3.25a.75.75 0 1 0-1.06-1.06L10 14.94l-2.72-2.72a.75.75 0 0 0-1.06 1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </MenuButton>
          <MenuItems
            anchor="bottom end"
            transition
            className="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-md bg-gray-800 py-2 shadow-lg outline-1 -outline-offset-1 outline-white/10 transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
          >
            <MenuItem>
              <button
                type="button"
                onClick={() => onSelectSort("value")}
                className={clsx(
                  "block w-full px-3 py-1 text-left text-sm/6 text-gray-300 focus:outline-hidden data-[focus]:bg-white/5",
                  topSort === "value" ? "font-semibold text-white" : undefined,
                )}
              >
                {t("dashboard.byValue")}
              </button>
            </MenuItem>
            <MenuItem>
              <button
                type="button"
                onClick={() => onSelectSort("quantity")}
                className={clsx(
                  "block w-full px-3 py-1 text-left text-sm/6 text-gray-300 focus:outline-hidden data-[focus]:bg-white/5",
                  topSort === "quantity" ? "font-semibold text-white" : undefined,
                )}
              >
                {t("dashboard.byQuantity")}
              </button>
            </MenuItem>
          </MenuItems>
        </Menu>
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
            <CircleX className={clsx("size-5", toneStyles.icon)} />
          </div>
        </div>
        <div className="min-w-0">
          <h3 className={clsx("text-sm font-semibold", toneStyles.title)}>{title}</h3>
          <div className={clsx("mt-2 text-[13px]", toneStyles.body)}>
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
  collapsible = false,
  defaultOpen = false,
}: {
  title: string;
  meta?: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  action?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const headerContent = (
    <>
      <div className="flex size-12 flex-none items-center justify-center rounded-lg bg-gray-100 ring-1 ring-gray-200 dark:bg-gray-700 dark:ring-white/10">
        <Icon className="size-6 text-gray-500 dark:text-gray-300" />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <h3 className="truncate text-sm/6 font-medium text-gray-900 dark:text-white">{title}</h3>
        {meta ? <p className="text-sm text-gray-400">{meta}</p> : null}
      </div>
      {collapsible ? (
        <ChevronDown className={clsx("size-5 shrink-0 text-gray-400 transition-transform", open ? "rotate-180" : "")} />
      ) : action ? (
        <div className="shrink-0">{action}</div>
      ) : null}
    </>
  );

  return (
    <section className="overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-900/5 dark:bg-gray-800/50 dark:outline-white/10">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={clsx(
            "flex w-full items-center gap-x-4 bg-gray-50/80 p-6 transition hover:bg-gray-100/80 dark:bg-gray-800/50 dark:hover:bg-gray-700/40",
            open ? "border-b border-gray-200 dark:border-white/10" : "",
          )}
          aria-expanded={open}
        >
          {headerContent}
        </button>
      ) : (
        <div className="flex items-center gap-x-4 border-b border-gray-200 bg-gray-50/80 p-6 dark:border-white/10 dark:bg-gray-800/50">
          {headerContent}
        </div>
      )}
      {open || !collapsible ? <div className={flush ? "" : "px-6 py-4"}>{children}</div> : null}
    </section>
  );
}
