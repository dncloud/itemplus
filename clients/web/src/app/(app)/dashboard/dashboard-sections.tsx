"use client";

import type React from "react";
import Link from "next/link";
import clsx from "clsx";
import { useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import type { InventoryWarning, LocationWarning, MaintenanceReminder } from "@/lib/api";
import {
  Banknote,
  Box,
  ChartBarBig,
  ChevronDown,
  CircleX,
  History,
} from "lucide-react";
import { ColorChip } from "@/components/ui/color-chip";

const enableDashboardPrefetch = process.env.NODE_ENV === "production";

export function ColorBadge({ label, color }: { label: string; color?: string }) {
  return <ColorChip label={label} color={color} />;
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

// One item in a dashboard list: its picture (or a placeholder of the same
// size, so the names line up), its name, category and location, and one line
// of detail.
function DashboardItemRow({
  item,
  detail,
  canOpenItems,
  serverURL,
}: {
  item: Record<string, unknown>;
  detail: React.ReactNode;
  canOpenItems: boolean;
  serverURL: string;
}) {
  const imageURL = typeof item.image_url === "string" && item.image_url ? `${serverURL}${item.image_url}` : "";

  return (
    <li className="relative flex gap-x-4 px-4 py-3 hover:bg-gray-50 sm:px-6 dark:hover:bg-white/2.5">
      {imageURL ? (
        <img src={imageURL} alt="" loading="lazy" className="size-12 flex-none rounded-md bg-gray-100 object-cover outline -outline-offset-1 outline-black/5 dark:bg-white/5 dark:outline-white/10" />
      ) : (
        <div className="flex size-12 flex-none items-center justify-center rounded-md bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500">
          <Box className="size-5" />
        </div>
      )}
      <div className="min-w-0 flex-auto">
        <h4 className="truncate text-sm/6 font-semibold text-gray-900 dark:text-white">
          {canOpenItems ? (
            <Link prefetch={enableDashboardPrefetch} href={`/items/${item.id}`}>
              <span className="absolute inset-x-0 inset-y-0" />
              {item.name as string}
            </Link>
          ) : (
            (item.name as string)
          )}
        </h4>
        {item.category_name || item.location_name ? (
          <div className="mt-1 flex flex-wrap gap-2">
            {item.category_name ? (
              <ColorBadge label={item.category_name as string} color={item.category_color as string | undefined} />
            ) : null}
            {item.location_name ? (
              <ColorBadge label={item.location_name as string} color={item.location_color as string | undefined} />
            ) : null}
          </div>
        ) : null}
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{detail}</div>
      </div>
    </li>
  );
}

export function RecentlyAddedPanel({
  items,
  canOpenItems = true,
  serverURL,
  fmtDate,
  t,
}: {
  items: Record<string, unknown>[];
  canOpenItems?: boolean;
  serverURL: string;
  fmtDate: (value: string) => string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  if (!items.length) return null;

  return (
    <DashboardPanel title={t("dashboard.recentlyAdded")} icon={History} meta={t("dashboard.itemCount", { count: items.length })} flush>
      <ul role="list" className="divide-y divide-gray-200 dark:divide-white/5">
        {items.map((item) => {
          const isUpdated = item.updated_at && item.created_at && item.updated_at !== item.created_at;
          return (
            <DashboardItemRow
              key={item.id as number}
              item={item}
              canOpenItems={canOpenItems}
              serverURL={serverURL}
              detail={<>{isUpdated ? t("common.updated") : t("common.created")} {fmtDate(isUpdated ? (item.updated_at as string) : (item.created_at as string))}</>}
            />
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
  serverURL,
  t,
}: {
  items: Record<string, unknown>[];
  topSort: "value" | "quantity";
  onSelectSort: (value: "value" | "quantity") => void;
  formatCurrency: (value: number) => string;
  canOpenItems?: boolean;
  serverURL: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  if (!items.length) return null;

  return (
    <DashboardPanel
      title={t("dashboard.topItems")}
      icon={Banknote}
      meta={t("dashboard.itemCount", { count: items.length })}
      flush
      action={
        <Menu as="div" className="relative">
          <MenuButton className="flex items-center gap-x-1 text-sm/6 font-medium text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            {t("items.sortBy")}
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-5 text-gray-400 dark:text-gray-500">
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
            className="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-md bg-white py-2 shadow-lg outline-1 outline-gray-900/5 transition dark:bg-gray-800 dark:-outline-offset-1 dark:outline-white/10 duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
          >
            <MenuItem>
              <button
                type="button"
                onClick={() => onSelectSort("value")}
                className={clsx(
                  "block w-full px-3 py-1 text-left text-sm/6 text-gray-900 focus:outline-hidden data-[focus]:bg-gray-50 dark:text-gray-300 dark:data-[focus]:bg-white/5",
                  topSort === "value" ? "font-semibold dark:text-white" : undefined,
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
                  "block w-full px-3 py-1 text-left text-sm/6 text-gray-900 focus:outline-hidden data-[focus]:bg-gray-50 dark:text-gray-300 dark:data-[focus]:bg-white/5",
                  topSort === "quantity" ? "font-semibold dark:text-white" : undefined,
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
          <DashboardItemRow
            key={item.id as number}
            item={item}
            canOpenItems={canOpenItems}
            serverURL={serverURL}
            detail={topSort === "value"
              ? formatCurrency((item as { value: number }).value)
              : `${(item as { quantity: number }).quantity} ${t("items.quantity")}`}
          />
        ))}
      </ul>
    </DashboardPanel>
  );
}

// CategoryValuePanel compares the categories by the value of their items.
export function CategoryValuePanel({
  categories,
  formatCurrency,
  canOpenItems = true,
  t,
}: {
  categories: { id: number; name: string; items: number; value: number }[];
  formatCurrency: (value: number) => string;
  canOpenItems?: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const ranked = categories.filter((category) => category.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
  if (!ranked.length) return null;
  const highest = ranked[0].value;

  return (
    <DashboardPanel title={t("dashboard.valueByCategory")} icon={ChartBarBig}>
      <ul role="list" className="space-y-4">
        {ranked.map((category) => (
          <li key={category.id} className="relative">
            <div className="flex items-baseline justify-between gap-x-4 text-sm">
              <span className="min-w-0 truncate font-medium text-gray-900 dark:text-white">
                {canOpenItems ? (
                  <Link prefetch={enableDashboardPrefetch} href={`/items?category=${category.id}`}>
                    <span className="absolute inset-0" />
                    {category.name}
                  </Link>
                ) : (
                  category.name
                )}
              </span>
              <span className="flex-none text-gray-500 dark:text-gray-400">
                {formatCurrency(category.value)} · {t("dashboard.itemCount", { count: category.items })}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
              <div className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500" style={{ width: `${Math.max(2, Math.round((category.value / highest) * 100))}%` }} />
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

export function DashboardPanel({
  title,
  meta,
  icon: Icon,
  action,
  children,
  flush = false,
  fill = false,
  collapsible = false,
  defaultOpen = false,
}: {
  title: string;
  meta?: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  action?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
  // Stretch to the height of the row, so neighbouring panels end level.
  fill?: boolean;
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
    <section className={clsx("overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-900/5 dark:bg-gray-800/50 dark:outline-white/10", fill && "flex h-full flex-col")}>
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
      {open || !collapsible ? <div className={clsx(!flush && "px-6 py-4", fill && "flex flex-1 flex-col")}>{children}</div> : null}
    </section>
  );
}
