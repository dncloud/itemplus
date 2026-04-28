"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, type CheckoutRequest } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

const STATUS_STYLES: Record<string, { bg: string; text: string; labelKey: string }> = {
  pending: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", labelKey: "checkouts.pending" },
  approved: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", labelKey: "checkouts.approved" },
  rejected: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", labelKey: "checkouts.rejected" },
  completed: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", labelKey: "checkouts.completed" },
  expired: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-500", labelKey: "checkouts.expired" },
};

export default function CheckoutsPage() {
  const { realm, can, fmtDateTime, t } = useApp();
  const [requests, setRequests] = useState<CheckoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const loadingRef = useRef(false);
  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const reqs = await api.getCheckoutRequests();
      setRequests(reqs);
    } catch {}
    setLoading(false);
    loadingRef.current = false;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        const reqs = await api.getCheckoutRequests();
        if (!cancelled) {
          setRequests(reqs);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    void loadInitial();
    return () => { cancelled = true; };
  }, [realm]);

  const approve = async (id: number) => {
    try { await api.approveRequest(id); load(); } catch {}
  };

  const reject = async (id: number) => {
    try { await api.rejectRequest(id); load(); } catch {}
  };

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const realmFiltered = filtered.filter((r) => r.realm === realm);

  if (!can("checkout.manage")) return <p className="text-center text-gray-500 py-10">Keine Berechtigung</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("checkouts.title")}</h1>
        <button onClick={load} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
          <ArrowPathIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "all", label: t("checkouts.all") },
          { key: "pending", label: t("checkouts.pending") },
          { key: "approved", label: t("checkouts.approved") },
          { key: "rejected", label: t("checkouts.rejected") },
          { key: "completed", label: t("checkouts.completed") },
        ].map(({ key, label }) => {
          const count = key === "all"
            ? realmFiltered.length
            : requests.filter((r) => r.status === key && r.realm === realm).length;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition ${
                filter === key
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {label}
              {count > 0 && <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${filter === key ? "bg-white/20" : "bg-gray-200 dark:bg-gray-700"}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : realmFiltered.length === 0 ? (
        <p className="text-center text-gray-500 py-10">{t("checkouts.none")}</p>
      ) : (
        <div className="space-y-3">
          {realmFiltered.map((req) => {
            const style = STATUS_STYLES[req.status] || STATUS_STYLES.pending;
            return (
              <div key={req.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Link href={`/items/${req.item_id}`} className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate">
                        {req.item_name || `Item #${req.item_id}`}
                      </Link>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${style.bg} ${style.text}`}>
                        {t(style.labelKey)}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
                      <span>{t("checkouts.by")} <strong>{req.user_name || `User #${req.user_id}`}</strong></span>
                      {req.requested_duration_days && <span>{req.requested_duration_days} {t("checkouts.days")}</span>}
                      {req.created_at && <span>{fmtDateTime(req.created_at)}</span>}
                    </div>
                    {req.notes && <p className="text-xs text-gray-400">{req.notes}</p>}
                    {req.approved_by_name && req.status !== "pending" && (
                      <p className="text-xs text-gray-400">
                        {req.status === "completed" ? t("checkouts.returnedBy")
                          : req.status === "approved" ? t("checkouts.approvedBy")
                          : t("checkouts.rejectedBy")} {req.approved_by_name}
                      </p>
                    )}
                  </div>

                  {req.status === "pending" && can("checkout.manage") && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => approve(req.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-green-500 text-white hover:bg-green-600 transition"
                      >
                        <CheckCircleIcon className="h-4 w-4" /> {t("checkouts.approve")}
                      </button>
                      <button
                        onClick={() => reject(req.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      >
                        <XCircleIcon className="h-4 w-4" /> {t("checkouts.reject")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
