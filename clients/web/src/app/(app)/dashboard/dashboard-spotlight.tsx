"use client";

import Link from "next/link";
import { Box, Sparkles } from "lucide-react";
import type { RealmStats } from "@/lib/api";
import { ColorBadge } from "./dashboard-sections";

const enableDashboardPrefetch = process.env.NODE_ENV === "production";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

// Timestamps arrive as "2026-05-20 11:00:00" or in ISO form, always in UTC.
function daysSince(timestamp: string | undefined, today: string) {
  if (!timestamp) return null;
  const then = Date.parse(`${timestamp.slice(0, 10)}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(then) || Number.isNaN(now)) return null;
  return Math.max(0, Math.round((now - then) / 86_400_000));
}

// SpotlightCard presents the collection's find of the day: one item the server
// picks anew every day, shown large so that things get rediscovered.
export function SpotlightCard({
  spotlight,
  canOpenItems,
  serverURL,
  formatCurrency,
  fmtDate,
  t,
}: {
  spotlight: NonNullable<RealmStats["spotlight"]>;
  canOpenItems: boolean;
  serverURL: string;
  formatCurrency: (value: number) => string;
  fmtDate: (value: string) => string;
  t: Translate;
}) {
  const days = daysSince(spotlight.created_at, spotlight.date);
  const since =
    days === null
      ? ""
      : days === 0
        ? t("dashboard.spotlightToday")
        : days === 1
          ? t("dashboard.spotlightSinceOneDay")
          : t("dashboard.spotlightSinceCollection", { days });
  const edited = spotlight.updated_at && spotlight.updated_at !== spotlight.created_at ? t("dashboard.spotlightUpdated", { date: fmtDate(spotlight.updated_at) }) : "";
  const worth = typeof spotlight.value === "number" && spotlight.value > 0 ? t("dashboard.spotlightValue", { value: formatCurrency(spotlight.value) }) : "";
  const facts = [since, worth, edited].filter(Boolean);

  return (
    <section
      aria-labelledby="dashboard-spotlight"
      className="relative overflow-hidden rounded-xl bg-white shadow-sm outline outline-1 -outline-offset-1 outline-gray-900/5 dark:bg-gray-800/50 dark:shadow-none dark:outline-white/10"
    >
      <div className="flex flex-col sm:flex-row">
        {/* Covers are shown whole, never cropped. */}
        <div className="flex h-48 flex-none items-center justify-center bg-gray-100 p-4 sm:h-auto sm:min-h-44 sm:w-56 dark:bg-white/5">
          {spotlight.image_url ? (
            <img src={`${serverURL}${spotlight.image_url}`} alt="" className="max-h-40 max-w-full rounded-md object-contain shadow-md sm:max-h-44" />
          ) : (
            <Box className="size-14 text-gray-300 dark:text-gray-600" />
          )}
        </div>
        <div className="flex min-w-0 flex-auto flex-col justify-center gap-y-3 px-6 py-6">
          <p id="dashboard-spotlight" className="flex items-center gap-x-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            <Sparkles className="size-4" />
            {t("dashboard.spotlightTitle")}
            <span className="font-normal text-gray-400 dark:text-gray-500">{t("dashboard.spotlightHint")}</span>
          </p>
          <h3 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {canOpenItems ? (
              <Link prefetch={enableDashboardPrefetch} href={`/items/${spotlight.id}`}>
                <span className="absolute inset-0" />
                {spotlight.name}
              </Link>
            ) : (
              spotlight.name
            )}
          </h3>
          {spotlight.category_name || spotlight.location_name ? (
            <div className="flex flex-wrap gap-2">
              {spotlight.category_name ? <ColorBadge label={spotlight.category_name} color={spotlight.category_color || undefined} /> : null}
              {spotlight.location_name ? <ColorBadge label={spotlight.location_name} color={spotlight.location_color || undefined} /> : null}
            </div>
          ) : null}
          {facts.length > 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">{facts.join(" · ")}</p> : null}
          {canOpenItems ? (
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              {t("dashboard.spotlightView")} <span aria-hidden="true">&rarr;</span>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
