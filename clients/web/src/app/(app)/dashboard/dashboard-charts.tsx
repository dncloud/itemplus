"use client";

import Link from "next/link";
import clsx from "clsx";
import { useState } from "react";
import { Activity, ChartPie, MapPin, Trophy, TrendingUp } from "lucide-react";
import { DashboardPanel } from "./dashboard-sections";

const enableDashboardPrefetch = process.env.NODE_ENV === "production";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

// Used for categories and locations that have no colour of their own.
const chartPalette = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#14b8a6", "#ec4899"];
const otherColor = "#9ca3af";
const uncategorisedColor = "#d1d5db";

function monthLabel(month: string, locale: string, long = false) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return month;
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString(locale === "en" ? "en-US" : "de-DE", {
    month: long ? "long" : "short",
    year: long ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

// GrowthPanel draws how many items there were, or what they were worth, at
// the end of each of the last twelve months.
export function GrowthPanel({
  growth,
  locale,
  formatCurrency,
  t,
}: {
  growth: { month: string; added: number; items: number; value: number }[];
  locale: string;
  formatCurrency: (value: number) => string;
  t: Translate;
}) {
  const [mode, setMode] = useState<"items" | "value">("items");
  const [hovered, setHovered] = useState<number | null>(null);
  if (growth.length < 2) return null;

  const values = growth.map((point) => (mode === "items" ? point.items : point.value));
  const format = (value: number) => (mode === "items" ? value.toLocaleString(locale === "en" ? "en-US" : "de-DE") : formatCurrency(value));
  const top = Math.max(...values, 1);
  const x = (index: number) => (index / (growth.length - 1)) * 100;
  const y = (value: number) => 100 - (value / top) * 92;
  const line = values.map((value, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(value).toFixed(2)}`).join(" ");
  const active = hovered ?? growth.length - 1;

  return (
    <DashboardPanel
      title={t("dashboard.growthTitle")}
      meta={t("dashboard.growthMeta")}
      icon={TrendingUp}
      fill
      action={
        <div className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-white/5">
          {(["items", "value"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              aria-pressed={mode === option}
              className={clsx(
                "rounded-md px-2.5 py-1 text-sm font-medium",
                mode === option
                  ? "bg-white text-gray-900 shadow-xs dark:bg-white/10 dark:text-white dark:shadow-none"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
              )}
            >
              {option === "items" ? t("dashboard.items") : t("dashboard.value")}
            </button>
          ))}
        </div>
      }
    >
      <div className="flex items-baseline gap-x-3">
        <p className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{format(values[active])}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {monthLabel(growth[active].month, locale, true)}
          {growth[active].added > 0 ? <span className="ml-2 font-medium text-green-600 dark:text-green-400">{t("dashboard.addedInMonth", { count: growth[active].added })}</span> : null}
        </p>
      </div>

      <div
        className="relative mt-4 min-h-48 flex-1"
        onMouseLeave={() => setHovered(null)}
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const position = (event.clientX - box.left) / box.width;
          setHovered(Math.min(growth.length - 1, Math.max(0, Math.round(position * (growth.length - 1)))));
        }}
      >
        {[0, 0.5, 1].map((share) => (
          <div key={share} className="absolute inset-x-0 border-t border-gray-100 dark:border-white/5" style={{ top: `${y(top * share)}%` }}>
            <span className="absolute left-0 -translate-y-full pb-0.5 text-xs text-gray-400 dark:text-gray-500">{format(Math.round(top * share))}</span>
          </div>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible text-indigo-600 dark:text-indigo-400" aria-hidden="true">
          <path d={`${line} L 100 100 L 0 100 Z`} fill="currentColor" fillOpacity="0.12" />
          <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="pointer-events-none absolute inset-y-0 w-px bg-gray-300 dark:bg-white/20" style={{ left: `${x(active)}%` }} />
        <div
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600 ring-2 ring-white dark:bg-indigo-400 dark:ring-gray-900"
          style={{ left: `${x(active)}%`, top: `${y(values[active])}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-gray-400 dark:text-gray-500">
        {growth.map((point, index) => (
          <span key={point.month} className={clsx(index % 2 === 1 && "hidden sm:inline", index === active && "font-semibold text-gray-900 dark:text-white")}>
            {monthLabel(point.month, locale)}
          </span>
        ))}
      </div>
    </DashboardPanel>
  );
}

// CategoryDonutPanel shows which categories the items belong to.
export function CategoryDonutPanel({
  categories,
  totalItems,
  canOpenItems,
  t,
}: {
  categories: { id: number; name: string; color?: string | null; items: number }[];
  totalItems: number;
  canOpenItems: boolean;
  t: Translate;
}) {
  const ranked = categories.filter((category) => category.items > 0).sort((a, b) => b.items - a.items);
  const categorised = ranked.reduce((sum, category) => sum + category.items, 0);
  // Items without a category belong in the picture too, or the ring would
  // claim to show everything while leaving them out.
  const uncategorised = Math.max(0, totalItems - categorised);
  const total = categorised + uncategorised;
  if (total === 0) return null;

  const shown = ranked.slice(0, 8).map((category, index) => ({
    key: String(category.id),
    href: `/items?category=${category.id}`,
    name: category.name,
    items: category.items,
    color: category.color || chartPalette[index % chartPalette.length],
  }));
  const rest = ranked.slice(8).reduce((sum, category) => sum + category.items, 0);
  const withRest = [
    ...shown,
    ...(rest > 0 ? [{ key: "other", href: "", name: t("dashboard.other"), items: rest, color: otherColor }] : []),
    ...(uncategorised > 0 ? [{ key: "none", href: "", name: t("dashboard.noCategory"), items: uncategorised, color: uncategorisedColor }] : []),
  ];
  // Each segment starts where the ones before it end.
  const segments = withRest.map((segment, index) => ({
    ...segment,
    share: (segment.items / total) * 100,
    start: (withRest.slice(0, index).reduce((sum, earlier) => sum + earlier.items, 0) / total) * 100,
  }));

  return (
    <DashboardPanel title={t("dashboard.byCategoryTitle")} meta={t("dashboard.itemCount", { count: total })} icon={ChartPie} fill>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 sm:flex-row lg:flex-col">
        <div className="relative size-36 flex-none">
          {/* The radius is chosen so the circumference is 100: a segment's length is its share in percent. */}
          <svg viewBox="0 0 42 42" className="size-full -rotate-90" aria-hidden="true">
            <circle cx="21" cy="21" r="15.9155" fill="none" strokeWidth="5" className="stroke-gray-100 dark:stroke-white/5" />
            {segments.map((segment) => (
              <circle
                key={segment.key}
                cx="21"
                cy="21"
                r="15.9155"
                fill="none"
                stroke={segment.color}
                strokeWidth="5"
                strokeDasharray={`${Math.max(0, segment.share - 0.6)} ${100 - Math.max(0, segment.share - 0.6)}`}
                strokeDashoffset={-segment.start}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-gray-900 dark:text-white">{total}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{t("dashboard.items")}</span>
          </div>
        </div>
        <ul role="list" className="w-full min-w-0 flex-auto space-y-2 text-sm">
          {segments.map((segment) => (
            <li key={segment.key} className="relative flex items-center gap-x-3">
              <span className="size-2.5 flex-none rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="min-w-0 flex-auto truncate text-gray-900 dark:text-white">
                {canOpenItems && segment.href ? (
                  <Link prefetch={enableDashboardPrefetch} href={segment.href}>
                    <span className="absolute inset-0" />
                    {segment.name}
                  </Link>
                ) : (
                  segment.name
                )}
              </span>
              <span className="flex-none text-gray-500 tabular-nums dark:text-gray-400">
                {segment.items} · {Math.round((segment.items / total) * 100)} %
              </span>
            </li>
          ))}
        </ul>
      </div>
    </DashboardPanel>
  );
}

// LocationBarsPanel shows where the items are.
export function LocationBarsPanel({
  locations,
  canOpenItems,
  t,
}: {
  locations: { id: number; name: string; color?: string | null; items: number }[];
  canOpenItems: boolean;
  t: Translate;
}) {
  const ranked = locations.filter((location) => location.items > 0).sort((a, b) => b.items - a.items).slice(0, 6);
  if (!ranked.length) return null;
  const highest = ranked[0].items;

  return (
    <DashboardPanel title={t("dashboard.byLocationTitle")} icon={MapPin}>
      <ul role="list" className="space-y-4">
        {ranked.map((location) => (
          <li key={location.id} className="relative">
            <div className="flex items-baseline justify-between gap-x-4 text-sm">
              <span className="min-w-0 truncate font-medium text-gray-900 dark:text-white">
                {canOpenItems ? (
                  <Link prefetch={enableDashboardPrefetch} href={`/items?location=${location.id}`}>
                    <span className="absolute inset-0" />
                    {location.name}
                  </Link>
                ) : (
                  location.name
                )}
              </span>
              <span className="flex-none text-gray-500 tabular-nums dark:text-gray-400">{t("dashboard.itemCount", { count: location.items })}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
              {/* A location's own colour is darkened on a light page, or pale ones would vanish. */}
              <div
                className={clsx(
                  "h-full rounded-full",
                  location.color
                    ? "bg-[color-mix(in_oklab,var(--bar-color)_70%,black)] dark:bg-[var(--bar-color)]"
                    : "bg-indigo-600 dark:bg-indigo-500",
                )}
                style={{
                  width: `${Math.max(2, Math.round((location.items / highest) * 100))}%`,
                  ...(location.color ? ({ "--bar-color": location.color } as React.CSSProperties) : {}),
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </DashboardPanel>
  );
}

// The kinds of stock movement, in the order they are stacked and listed.
const movementKinds: { type: string; color: string }[] = [
  { type: "created", color: "#6366f1" },
  { type: "imported", color: "#8b5cf6" },
  { type: "bought", color: "#10b981" },
  { type: "consumed", color: "#f59e0b" },
  { type: "adjusted", color: "#64748b" },
  { type: "checked_out", color: "#f43f5e" },
  { type: "returned", color: "#0ea5e9" },
];
const unknownKindColor = "#9ca3af";

function dayLabel(date: string, locale: string, long = false) {
  const day = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return date;
  return day.toLocaleDateString(
    locale === "en" ? "en-US" : "de-DE",
    long ? { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" } : { day: "numeric", month: "numeric", timeZone: "UTC" },
  );
}

// ActivityPanel shows what has happened to the stock on each of the last
// thirty days: how much, of which kind, and which day was the busiest.
export function ActivityPanel({
  activity,
  locale,
  t,
}: {
  activity: { date: string; count: number; types?: Record<string, number> }[];
  locale: string;
  t: Translate;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!activity.length) return null;

  const total = activity.reduce((sum, day) => sum + day.count, 0);
  const highest = Math.max(...activity.map((day) => day.count), 1);
  const busiest = activity.reduce((best, day, index) => (day.count > activity[best].count ? index : best), 0);
  const kindLabel = (type: string) => (movementKinds.some((kind) => kind.type === type) ? t(`inventoryMovements.movementType.${type}`) : type);
  const kindColor = (type: string) => movementKinds.find((kind) => kind.type === type)?.color ?? unknownKindColor;
  // A server that does not say which kind the movements were still gets bars.
  const partsOf = (day: (typeof activity)[number]) => {
    const types = day.types ?? {};
    const known = movementKinds.filter((kind) => types[kind.type]).map((kind) => ({ type: kind.type, count: types[kind.type] }));
    const unknown = Object.keys(types).filter((type) => types[type] && !movementKinds.some((kind) => kind.type === type)).map((type) => ({ type, count: types[type] }));
    const parts = [...known, ...unknown];
    return parts.length > 0 || day.count === 0 ? parts : [{ type: "", count: day.count }];
  };
  const totals = new Map<string, number>();
  for (const day of activity) for (const part of partsOf(day)) if (part.type) totals.set(part.type, (totals.get(part.type) ?? 0) + part.count);
  const legend = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const shown = hovered ?? busiest;
  const shownDay = activity[shown];
  const shownParts = partsOf(shownDay).filter((part) => part.type);
  // What happened is the point, not that something moved: a day with one
  // kind of movement reads "4 Erstellt", and only a mixed day gets the total.
  const shownSummary = shownParts.length === 0
    ? t("dashboard.movementsOnDay", { count: shownDay.count })
    : `${shownParts.length > 1 ? `${t("dashboard.movementsOnDay", { count: shownDay.count })}: ` : ""}${shownParts.map((part) => `${part.count} ${kindLabel(part.type)}`).join(", ")}`;

  return (
    <DashboardPanel title={t("dashboard.activityTitle")} meta={t("dashboard.activityMeta", { count: total })} icon={Activity}>
      {total === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("dashboard.noActivity")}</p>
      ) : (
        <>
          {legend.length > 0 ? (
            <ul role="list" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {legend.map(([type, count]) => (
                <li key={type} className="flex items-center gap-x-2">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: kindColor(type) }} />
                  <span className="text-gray-900 dark:text-white">{kindLabel(type)}</span>
                  <span className="text-gray-500 tabular-nums dark:text-gray-400">{count}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="relative mt-8" onMouseLeave={() => setHovered(null)}>
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-gray-200 dark:border-white/10">
              <span className="absolute right-0 -translate-y-full pb-0.5 text-xs text-gray-400 dark:text-gray-500">{highest}</span>
            </div>
            <div className="flex h-32 items-end gap-1 border-b border-gray-200 dark:border-white/10">
              {activity.map((day, index) => (
                <div
                  key={day.date}
                  onMouseEnter={() => setHovered(index)}
                  className={clsx("relative flex h-full flex-1 flex-col justify-end rounded-t-sm", index === shown && "bg-gray-100 dark:bg-white/5")}
                >
                  {day.count > 0 ? (
                    <>
                      <span className="mb-0.5 hidden text-center text-[10px]/3 font-medium text-gray-500 tabular-nums lg:block dark:text-gray-400">{day.count}</span>
                      <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-sm" style={{ height: `${Math.max(6, Math.round((day.count / highest) * 86))}%` }}>
                        {partsOf(day).map((part) => (
                          <div key={part.type} style={{ flexGrow: part.count, backgroundColor: part.type ? kindColor(part.type) : undefined }} className={clsx("w-full", !part.type && "bg-indigo-600 dark:bg-indigo-500")} />
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-1 text-xs text-gray-400 dark:text-gray-500">
              {activity.map((day, index) => (
                <div key={day.date} className="relative h-4 flex-1">
                  {/* A date under every seventh day, counted back from today. */}
                  {(activity.length - 1 - index) % 7 === 0 ? (
                    <span className={clsx("absolute left-1/2 -translate-x-1/2 whitespace-nowrap", index === activity.length - 1 && "left-auto right-0 translate-x-0")}>
                      {dayLabel(day.date, locale)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            {hovered === null ? <span className="font-medium text-gray-900 dark:text-white">{t("dashboard.busiestDay")}: </span> : null}
            <span className={hovered === null ? undefined : "font-medium text-gray-900 dark:text-white"}>{dayLabel(shownDay.date, locale, true)}</span>
            {" · "}
            {shownSummary}
          </p>
        </>
      )}
    </DashboardPanel>
  );
}

// CollectionProgressPanel shows how much of each platform's catalogue is in
// the collection. It only appears when a game catalog is connected and says
// how many games each platform has.
export function CollectionProgressPanel({
  profiles,
  canOpenItems,
  locale,
  t,
}: {
  profiles: { key: string; name: string; owned: number; total: number; category_ids: number[] }[];
  canOpenItems: boolean;
  locale: string;
  t: Translate;
}) {
  if (!profiles.length) return null;
  const number = (value: number) => value.toLocaleString(locale === "en" ? "en-US" : "de-DE");

  return (
    <DashboardPanel title={t("dashboard.progressTitle")} meta={t("dashboard.progressMeta")} icon={Trophy}>
      <ul role="list" className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {profiles.map((profile) => {
          const share = Math.min(100, (profile.owned / profile.total) * 100);
          // Real catalogues are huge, so most shares are tiny: the count is the
          // headline, and the share keeps a decimal while it is below ten.
          const percent = `${share.toLocaleString(locale === "en" ? "en-US" : "de-DE", { maximumFractionDigits: share < 10 ? (share < 0.1 ? 2 : 1) : 0 })} %`;
          // A single category can be opened directly; several cannot be filtered together.
          const href = canOpenItems && profile.category_ids.length === 1 ? `/items?category=${profile.category_ids[0]}` : "";
          return (
            <li key={profile.key} className="relative flex flex-col items-center text-center">
              <div className="relative size-20">
                <svg viewBox="0 0 42 42" className="size-full -rotate-90" aria-hidden="true">
                  <circle cx="21" cy="21" r="15.9155" fill="none" strokeWidth="4" className="stroke-gray-100 dark:stroke-white/10" />
                  <circle
                    cx="21"
                    cy="21"
                    r="15.9155"
                    fill="none"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.max(1.5, share)} ${100 - Math.max(1.5, share)}`}
                    className={share >= 100 ? "stroke-green-500" : "stroke-indigo-600 dark:stroke-indigo-400"}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold text-gray-900 tabular-nums dark:text-white">{number(profile.owned)}</span>
              </div>
              <p className="mt-2 max-w-full truncate text-sm font-medium text-gray-900 dark:text-white">
                {href ? (
                  <Link prefetch={enableDashboardPrefetch} href={href}>
                    <span className="absolute inset-0" />
                    {profile.name}
                  </Link>
                ) : (
                  profile.name
                )}
              </p>
              <p className="text-xs text-gray-500 tabular-nums dark:text-gray-400">
                {t("dashboard.progressOf", { total: number(profile.total) })} · {percent}
              </p>
            </li>
          );
        })}
      </ul>
    </DashboardPanel>
  );
}
