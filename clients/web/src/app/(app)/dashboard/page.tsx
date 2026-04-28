"use client";

import { useEffect, useState } from "react";
import { api, type StatsOverview, type InventoryWarning, type LocationWarning, type RealmStats, type ActiveCheckout } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { CubeIcon, TagIcon, MapPinIcon, ExclamationTriangleIcon, BanknotesIcon, ArchiveBoxIcon, ArrowRightStartOnRectangleIcon, ClockIcon } from "@heroicons/react/24/outline";

const fmt = (v: number) => v.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export default function DashboardPage() {
  const { realm, isAdmin, fmtDate, t } = useApp();
  const [editCheckout, setEditCheckout] = useState<ActiveCheckout | null>(null);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [warnings, setWarnings] = useState<InventoryWarning[]>([]);
  const [locWarnings, setLocWarnings] = useState<LocationWarning[]>([]);
  const [activeCheckouts, setActiveCheckouts] = useState<ActiveCheckout[]>([]);
  const [myOverdue, setMyOverdue] = useState<ActiveCheckout[]>([]);
  const [loading, setLoading] = useState(true);
  const [topSort, setTopSort] = useState<"value" | "quantity">("value");

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      api.getOverview(),
      api.getInventoryStats(),
      api.getLocationStats(),
      api.getActiveCheckouts().catch(() => []),
      api.getMyOverdueCheckouts().catch(() => []),
    ])
      .then(([s, inv, loc, co, overdue]) => {
        if (cancelled) return;
        setStats(s);
        setWarnings(inv.warnings);
        setLocWarnings(loc.warnings);
        setActiveCheckouts(co);
        setMyOverdue(overdue);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [realm]);

  if (loading) return <Loading />;
  if (!stats) return <p className="text-gray-500">{t("dashboard.noData")}</p>;

  const current = stats[realm];
  const realmWarnings = warnings.filter((w) => w.realm === realm);
  const realmLocWarnings = locWarnings.filter((w) => w.realm === realm);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={BanknotesIcon} label={t("dashboard.totalValue")} value={fmt(current.total_value)} highlight />
        <StatCard icon={CubeIcon} label={t("dashboard.items")} value={current.items} />
        <StatCard icon={TagIcon} label={t("dashboard.categories")} value={current.categories} />
        <StatCard icon={MapPinIcon} label={t("dashboard.locations")} value={current.locations} />
        <StatCard icon={TagIcon} label={t("dashboard.properties")} value={current.properties} />
      </div>

      {/* Overdue Items — personal warning */}
      {myOverdue.length > 0 && (
        <div className="rounded-xl border-2 border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-6 space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2 text-red-700 dark:text-red-400">
            <ClockIcon className="h-6 w-6" />
            {t("dashboard.overdueTitle")} ({myOverdue.length})
          </h2>
          <div className="space-y-2">
            {myOverdue.map((co) => (
              <a key={co.id} href={`/items/${co.item_id}`} className="flex items-center justify-between rounded-lg bg-red-100 dark:bg-red-900/30 px-4 py-3 hover:bg-red-200 dark:hover:bg-red-900/40 transition">
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300">{co.item_name}</p>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {t("dashboard.since")} {co.created_at ? fmtDate(co.created_at) : "—"}
                    {co.due_date && ` · ${t("dashboard.dueDate")} ${fmtDate(co.due_date)}`}
                  </p>
                </div>
                <span className="text-lg font-bold text-red-600 dark:text-red-400">
                  +{co.overdue_days}d
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Warnings — Stock + Location combined */}
      {(realmWarnings.length > 0 || realmLocWarnings.length > 0) && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-6 space-y-4">
          {/* Stock warnings */}
          {realmWarnings.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                {t("dashboard.inventoryWarnings")}
              </h2>
              <div className="space-y-1">
                {realmWarnings.map((w) => (
                  <a key={w.item_id} href={`/items/${w.item_id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 -mx-2 hover:bg-amber-100 dark:hover:bg-amber-900/20 transition">
                    <span className="text-sm truncate">{w.name}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      w.level === "out_of_stock"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}>
                      {w.level === "out_of_stock" ? t("dashboard.outOfStock") : `${w.quantity}/${w.minimum}`}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Location capacity */}
          {realmLocWarnings.length > 0 && (
            <div className={`space-y-2 ${realmWarnings.length > 0 ? "pt-3 border-t border-amber-200 dark:border-amber-800" : ""}`}>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <ArchiveBoxIcon className="h-4 w-4 text-amber-500" />
                {t("dashboard.locationCapacity")}
              </h2>
              <div className="space-y-2">
                {realmLocWarnings.map((w) => {
                  const pct = Math.min(100, Math.round((w.used / w.capacity) * 100));
                  const labelMap: Record<string, string> = { full: t("dashboard.full"), almost_full: t("dashboard.almostFull"), warning: t("dashboard.warningHigh") };
                  const barColor = w.level === "full" ? "bg-red-500" : w.level === "almost_full" ? "bg-orange-500" : "bg-amber-500";
                  return (
                    <div key={w.location_id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <a href={`/items?location=${w.location_id}`} className="font-medium hover:text-blue-500 transition">{w.name}</a>
                        <span className="text-xs text-gray-500">{labelMap[w.level]} — {w.used}/{w.capacity}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-amber-200 dark:bg-amber-900/30 overflow-hidden">
                        <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Checkouts */}
      {activeCheckouts.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ArrowRightStartOnRectangleIcon className="h-5 w-5 text-amber-500" />
            {t("dashboard.activeCheckouts")} <span className="text-sm font-normal text-gray-400">({activeCheckouts.length})</span>
          </h2>
          <div className="space-y-1.5">
            {activeCheckouts.map((co) => {
              const overdue = co.due_date && new Date(co.due_date) < new Date();
              return (
                <div key={co.id} className="flex items-center justify-between rounded-lg px-2 py-2 -mx-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  <a href={`/items/${co.item_id}`} className="min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">{co.item_name || `Item #${co.item_id}`}</span>
                    <span className="text-xs text-gray-400 ml-2">→ {co.user_name || `User #${co.user_id}`}</span>
                  </a>
                  <div className="flex items-center gap-2 shrink-0">
                    {co.due_date && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${overdue ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "text-gray-500"}`}>
                        {overdue ? t("dashboard.overdue") : t("dashboard.dueDate")} {fmtDate(co.due_date)}
                      </span>
                    )}
                    {co.created_at && !co.due_date && (
                      <span className="text-xs text-gray-400">{t("itemDetail.since")} {fmtDate(co.created_at)}</span>
                    )}
                    {isAdmin && (
                      <button onClick={() => setEditCheckout(co)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✎</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2 columns: Recently Added + Top Items */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Recently Active */}
        {current.recently_added && current.recently_added.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-3">
            <h2 className="text-lg font-semibold">{t("dashboard.recentlyAdded")}</h2>
            <div className="space-y-1">
              {current.recently_added.map((item: Record<string, unknown>) => {
                const catColor = item.category_color as string | undefined;
                const locColor = item.location_color as string | undefined;
                const isUpdated = item.updated_at && item.created_at && item.updated_at !== item.created_at;
                return (
                  <a key={item.id as number} href={`/items/${item.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 -mx-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name as string}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.category_name ? (
                          <span className="text-[11px] flex items-center gap-1 text-gray-400">
                            {catColor ? <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: catColor }} /> : null}
                            {item.category_name as string}
                          </span>
                        ) : null}
                        {item.location_name ? (
                          <span className="text-[11px] flex items-center gap-1 text-gray-400">
                            {locColor ? <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: locColor }} /> : null}
                            {item.location_name as string}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0">
                      {fmtDate(isUpdated ? item.updated_at as string : item.created_at as string)}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Items */}
        {(current.top_by_value?.length > 0 || current.top_by_quantity?.length > 0) && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("dashboard.topItems")}</h2>
              <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
                <button onClick={() => setTopSort("value")} className={`px-3 py-1 text-xs rounded-md font-medium transition ${topSort === "value" ? "bg-white dark:bg-gray-700 shadow-sm" : "text-gray-500"}`}>{t("dashboard.byValue")}</button>
                <button onClick={() => setTopSort("quantity")} className={`px-3 py-1 text-xs rounded-md font-medium transition ${topSort === "quantity" ? "bg-white dark:bg-gray-700 shadow-sm" : "text-gray-500"}`}>{t("dashboard.byQuantity")}</button>
              </div>
            </div>
            <div className="space-y-1">
              {(topSort === "value" ? current.top_by_value : current.top_by_quantity)?.map((item: Record<string, unknown>, i: number) => {
                const catColor = item.category_color as string | undefined;
                const locColor = item.location_color as string | undefined;
                return (
                  <a key={item.id as number} href={`/items/${item.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 -mx-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                    <span className="text-xs text-gray-400 w-5 text-right shrink-0">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name as string}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.category_name ? (
                          <span className="text-[11px] flex items-center gap-1 text-gray-400">
                            {catColor ? <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: catColor }} /> : null}
                            {item.category_name as string}
                          </span>
                        ) : null}
                        {item.location_name ? (
                          <span className="text-[11px] flex items-center gap-1 text-gray-400">
                            {locColor ? <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: locColor }} /> : null}
                            {item.location_name as string}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-500 shrink-0">
                      {topSort === "value" ? fmt((item as unknown as { value: number }).value) : `×${(item as unknown as { quantity: number }).quantity}`}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Both Realms Overview */}
      <div className="grid md:grid-cols-2 gap-4">
        <RealmCard title={t("realm.archive")} stats={stats.archive} active={realm === "archive"} t={t} />
        <RealmCard title={t("realm.collection")} stats={stats.collection} active={realm === "collection"} t={t} />
      </div>

      {/* Edit Checkout Modal (Admin) */}
      {editCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Checkout bearbeiten</h2>
            <p className="text-sm text-gray-500">{editCheckout.item_name} → {editCheckout.user_name}</p>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ausgeliehen am</label>
              <input
                type="datetime-local"
                defaultValue={editCheckout.created_at?.slice(0, 16)}
                onChange={(e) => setEditCheckout({ ...editCheckout, created_at: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Fällig am</label>
              <input
                type="datetime-local"
                defaultValue={editCheckout.due_date?.slice(0, 16)}
                onChange={(e) => setEditCheckout({ ...editCheckout, due_date: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditCheckout(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">Abbrechen</button>
              <button
                onClick={async () => {
                  await fetch(`${api.baseURL}/api/checkout/${realm}/${editCheckout.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ created_at: editCheckout.created_at, due_date: editCheckout.due_date }),
                  });
                  setEditCheckout(null);
                  // Reload
                  const [co, overdue] = await Promise.all([api.getActiveCheckouts().catch(() => []), api.getMyOverdueCheckouts().catch(() => [])]);
                  setActiveCheckouts(co); setMyOverdue(overdue);
                }}
                className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600"
              >Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, highlight }: { icon: React.ElementType; label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${highlight ? "bg-blue-100 dark:bg-blue-900/30" : "bg-blue-50 dark:bg-blue-900/20"}`}>
          <Icon className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <p className={`font-bold ${highlight ? "text-xl" : "text-2xl"}`}>{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function RealmCard({ title, stats, active, t }: { title: string; stats: RealmStats; active: boolean; t: (k: string) => string }) {
  return (
    <div className={`rounded-xl border p-4 ${active ? "border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"}`}>
      <h3 className="text-sm font-semibold mb-3">{title} {active && <span className="text-blue-500">{t("dashboard.active")}</span>}</h3>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><p className="text-lg font-bold">{stats.items}</p><p className="text-xs text-gray-500">{t("dashboard.items")}</p></div>
        <div><p className="text-lg font-bold">{stats.categories}</p><p className="text-xs text-gray-500">{t("dashboard.categories")}</p></div>
        <div><p className="text-lg font-bold">{stats.locations}</p><p className="text-xs text-gray-500">{t("dashboard.locations")}</p></div>
      </div>
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
