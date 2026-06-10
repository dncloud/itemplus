"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowPathIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { api, type AIUsageStats, type AIUsageStatsBucket, type AIUsageStatsPeriod } from "@/lib/api";
import { useApp } from "@/lib/app-context";

type PeriodKey = "hour" | "day" | "week" | "month" | "total";
type ProviderFilter = "all" | "openai" | "ollama";

type UsageTotals = {
  requests: number;
  successful_requests: number;
  failed_requests: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  reasoning_tokens: number;
  web_search_requests: number;
  web_fetch_requests: number;
};

const periodKeys: PeriodKey[] = ["hour", "day", "week", "month", "total"];
const providerFilters: ProviderFilter[] = ["all", "openai", "ollama"];

const emptyTotals: UsageTotals = {
  requests: 0,
  successful_requests: 0,
  failed_requests: 0,
  input_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
  reasoning_tokens: 0,
  web_search_requests: 0,
  web_fetch_requests: 0,
};

function sumBuckets(buckets: AIUsageStatsBucket[]): UsageTotals {
  return buckets.reduce<UsageTotals>(
    (totals, bucket) => ({
      requests: totals.requests + bucket.requests,
      successful_requests: totals.successful_requests + bucket.successful_requests,
      failed_requests: totals.failed_requests + bucket.failed_requests,
      input_tokens: totals.input_tokens + bucket.input_tokens,
      output_tokens: totals.output_tokens + bucket.output_tokens,
      total_tokens: totals.total_tokens + bucket.total_tokens,
      reasoning_tokens: totals.reasoning_tokens + bucket.reasoning_tokens,
      web_search_requests: totals.web_search_requests + bucket.web_search_requests,
      web_fetch_requests: totals.web_fetch_requests + bucket.web_fetch_requests,
    }),
    { ...emptyTotals },
  );
}

function filterProviderBucket(bucket: AIUsageStatsBucket, filter: ProviderFilter) {
  if (filter === "all") return true;
  return bucket.provider === filter;
}

function aggregateBucketsByLabel(buckets: AIUsageStatsBucket[]): AIUsageStatsBucket[] {
  const byBucket = new Map<string, AIUsageStatsBucket>();
  for (const bucket of buckets) {
    const current = byBucket.get(bucket.bucket);
    if (!current) {
      byBucket.set(bucket.bucket, { ...bucket, provider: "all" });
      continue;
    }
    current.requests += bucket.requests;
    current.successful_requests += bucket.successful_requests;
    current.failed_requests += bucket.failed_requests;
    current.input_tokens += bucket.input_tokens;
    current.output_tokens += bucket.output_tokens;
    current.total_tokens += bucket.total_tokens;
    current.reasoning_tokens += bucket.reasoning_tokens;
    current.web_search_requests += bucket.web_search_requests;
    current.web_fetch_requests += bucket.web_fetch_requests;
  }
  return Array.from(byBucket.values()).sort((left, right) => left.bucket.localeCompare(right.bucket));
}

function seriesFor(buckets: AIUsageStatsBucket[], key: keyof UsageTotals) {
  return buckets.map((bucket) => Number(bucket[key]) || 0);
}

function sparklinePath(values: number[], width: number, height: number, padding = 5) {
  if (values.length === 0) return "";
  if (values.length === 1) {
    const y = height - padding;
    return `M ${padding} ${y} L ${width - padding} ${y}`;
  }
  const max = Math.max(1, ...values);
  const step = (width - padding * 2) / (values.length - 1);
  return values
    .map((value, index) => {
      const x = padding + index * step;
      const y = height - padding - (value / max) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function MiniLineChart({
  values,
  color,
  secondaryValues,
  secondaryColor,
  className,
}: {
  values: number[];
  color: string;
  secondaryValues?: number[];
  secondaryColor?: string;
  className?: string;
}) {
  const width = 220;
  const height = 52;
  const mainPath = sparklinePath(values, width, height);
  const secondaryPath = secondaryValues ? sparklinePath(secondaryValues, width, height) : "";
  const last = values.length > 0 ? values[values.length - 1] : 0;
  const max = Math.max(1, ...values);
  const lastX = values.length <= 1 ? width - 5 : 5 + (values.length - 1) * ((width - 10) / (values.length - 1));
  const lastY = height - 5 - (last / max) * (height - 10);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={clsx("h-14 w-full overflow-visible", className)} role="img" aria-hidden="true">
      <path d={`M 5 ${height - 5} L ${width - 5} ${height - 5}`} stroke="currentColor" strokeOpacity="0.22" strokeWidth="2" strokeDasharray="5 5" />
      {secondaryPath ? <path d={secondaryPath} fill="none" stroke={secondaryColor || "#a855f7"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {mainPath ? <path d={mainPath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {values.length > 0 ? <circle cx={lastX} cy={lastY} r="4" fill="#111827" stroke={color} strokeWidth="3" className="dark:fill-gray-900" /> : null}
    </svg>
  );
}

function MiniBarChart({ values, color }: { values: number[]; color: string }) {
  const hasValues = values.some((value) => value > 0);
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-14 items-end gap-1">
      {values.length === 0 || !hasValues ? (
        <div className="h-px flex-1 border-t border-dashed border-gray-300 dark:border-gray-500" />
      ) : (
        values.slice(-18).map((value, index) => (
          <span
            key={`${value}-${index}`}
            className="w-2 rounded-t-sm"
            style={{
              height: `${Math.max(4, Math.round((value / max) * 48))}px`,
              backgroundColor: color,
            }}
          />
        ))
      )}
    </div>
  );
}

function DashboardMetric({
  title,
  value,
  children,
}: {
  title: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-32 border-b border-gray-200 p-4 dark:border-white/10 lg:border-r lg:border-b-0">
      <p className="text-sm/6 font-medium text-gray-500 dark:text-gray-400">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      <div className="mt-3 text-gray-400">{children}</div>
    </div>
  );
}

function providerLabel(filter: ProviderFilter, allLabel: string) {
  if (filter === "openai") return "OpenAI";
  if (filter === "ollama") return "Ollama";
  return allLabel;
}

export default function AIUsagePage() {
  const { locale, t, fmtDateTime } = useApp();
  const [stats, setStats] = useState<AIUsageStats | null>(null);
  const [activePeriod, setActivePeriod] = useState<PeriodKey>("day");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const activeStats: AIUsageStatsPeriod | null = stats ? stats[activePeriod] : null;
  const filteredBuckets = useMemo(
    () => (activeStats?.buckets || []).filter((bucket) => filterProviderBucket(bucket, providerFilter)),
    [activeStats, providerFilter],
  );
  const chartBuckets = useMemo(() => aggregateBucketsByLabel(filteredBuckets), [filteredBuckets]);
  const totals = useMemo(() => sumBuckets(filteredBuckets), [filteredBuckets]);
  const openAITotals = useMemo(() => sumBuckets((activeStats?.buckets || []).filter((bucket) => bucket.provider === "openai")), [activeStats]);
  const ollamaTotals = useMemo(() => sumBuckets((activeStats?.buckets || []).filter((bucket) => bucket.provider === "ollama")), [activeStats]);
  const averageTokens = totals.requests > 0 ? Math.round(totals.total_tokens / totals.requests) : 0;

  const tokenSeries = seriesFor(chartBuckets, "total_tokens");
  const outputSeries = seriesFor(chartBuckets, "output_tokens");
  const requestSeries = seriesFor(chartBuckets, "requests");
  const failedSeries = seriesFor(chartBuckets, "failed_requests");

  const formatNumber = (value: number) => numberFormat.format(value);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      setStats(await api.getAIUsageStats());
    } catch {
      setError(t("aiUsage.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col space-y-6">
      <div className="text-center sm:border-b sm:border-gray-200 sm:text-left dark:border-gray-700">
        <div className="space-y-1">
          <nav className="text-sm font-medium dark:text-gray-100">
            <ol className="flex items-center justify-center sm:justify-start">
              <li>
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">
                  {t("nav.dashboard")}
                </Link>
              </li>
              <li className="flex items-center px-1 opacity-30">
                <ChevronRightIcon className="h-4 w-4" />
              </li>
              <li>{t("aiUsage.title")}</li>
            </ol>
          </nav>
          <div className="py-3 sm:flex sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("aiUsage.title")}</h1>
              <p className="mt-1 max-w-3xl text-sm/6 text-gray-500 dark:text-gray-400">{t("aiUsage.intro")}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadStats()}
              disabled={loading}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10 sm:mt-0"
            >
              <ArrowPathIcon className={clsx("h-4 w-4", loading && "animate-spin")} />
              {t("aiUsage.refresh")}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {periodKeys.map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setActivePeriod(period)}
              className={clsx(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                activePeriod === period
                  ? "bg-blue-500 text-white shadow-sm shadow-blue-500/20"
                  : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10",
              )}
            >
              {t(`aiUsage.${period}`)}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-white/5">
          {providerFilters.map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={() => setProviderFilter(provider)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-semibold transition",
                providerFilter === provider
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
              )}
            >
              {providerLabel(provider, t("common.all"))}
            </button>
          ))}
        </div>
      </div>

      {loading && !stats ? (
        <div className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          {t("aiUsage.loading")}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {activeStats ? (
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900">
          <div className="grid lg:grid-cols-4">
            <DashboardMetric title={t("aiUsage.tokens")} value={formatNumber(totals.total_tokens)}>
              <MiniLineChart values={tokenSeries} secondaryValues={outputSeries} color="#f97316" secondaryColor="#ec4899" />
            </DashboardMetric>
            <DashboardMetric title={t("aiUsage.requests")} value={formatNumber(totals.requests)}>
              <MiniBarChart values={requestSeries} color="#6d5dfc" />
            </DashboardMetric>
            <DashboardMetric title={t("aiUsage.webActivity")} value={formatNumber(totals.web_search_requests + totals.web_fetch_requests)}>
              <div className="space-y-2">
                <div className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.min(100, Math.max(6, (totals.web_search_requests / Math.max(1, totals.web_search_requests + totals.web_fetch_requests)) * 100))}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("aiUsage.webSearch")}: {formatNumber(totals.web_search_requests)} · {t("aiUsage.webFetch")}: {formatNumber(totals.web_fetch_requests)}
                </p>
              </div>
            </DashboardMetric>
            <div className="min-h-32 border-b border-gray-200 p-4 dark:border-white/10 lg:border-b-0">
              <p className="text-sm/6 font-medium text-gray-500 dark:text-gray-400">{t("aiUsage.providerSplit")}</p>
              <div className="mt-2 grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">OpenAI</span>
                  <span className="font-mono text-sm text-gray-500 dark:text-gray-400">{formatNumber(openAITotals.total_tokens)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, Math.max(3, (openAITotals.total_tokens / Math.max(1, openAITotals.total_tokens + ollamaTotals.total_tokens)) * 100))}%` }} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ollama</span>
                  <span className="font-mono text-sm text-gray-500 dark:text-gray-400">{formatNumber(ollamaTotals.total_tokens)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, Math.max(3, (ollamaTotals.total_tokens / Math.max(1, openAITotals.total_tokens + ollamaTotals.total_tokens)) * 100))}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 p-4 dark:border-white/10">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm/6 font-medium text-gray-500 dark:text-gray-400">{t("aiUsage.totalRequests")}</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{formatNumber(totals.requests)}</p>
              </div>
              <div className="text-right text-xs/5 text-gray-500 dark:text-gray-400">
                <p>{providerLabel(providerFilter, t("common.all"))}</p>
                <p>{t("aiUsage.since", { date: fmtDateTime(activeStats.since) })}</p>
                {totals.requests > 0 ? <p>{t("aiUsage.avgPerRequest", { count: formatNumber(averageTokens) })}</p> : null}
              </div>
            </div>
            {totals.requests === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 px-4 py-5 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
                {t("aiUsage.empty")}
              </div>
            ) : (
              <MiniLineChart values={requestSeries} secondaryValues={failedSeries} color="#14b8a6" secondaryColor="#ef4444" className="h-28" />
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
