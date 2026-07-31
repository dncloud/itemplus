"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { FloatingNotification, type FloatingNotificationState } from "@/components/ui/floating-notification";
import { ChevronRight, RefreshCw } from "lucide-react";
import { CheckoutRequestsList, CheckoutsPagination } from "./checkouts-sections";
import {
  buildCheckoutsPageUrl,
  type CheckoutListEntry,
  fetchCheckoutsPageData,
  filterCheckoutRequests,
  paginateCheckoutRequests,
} from "./checkouts-page-utils";

export default function CheckoutsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { realm, setRealm, can, fmtDate, fmtDateTime, t } = useApp();
  const [requests, setRequests] = useState<CheckoutListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<FloatingNotificationState>(null);
  const [remindingCheckoutIds, setRemindingCheckoutIds] = useState<Set<number>>(new Set());
  const itemID = Number(searchParams.get("item_id") || "") || undefined;
  const filter = searchParams.get("filter") || "all";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const itemsPerPage = 10;

  const loadingRef = useRef(false);
  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      setRequests(await fetchCheckoutsPageData());
    } catch {}
    setLoading(false);
    loadingRef.current = false;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        const reqs = await fetchCheckoutsPageData();
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

  useEffect(() => {
    const urlRealm = searchParams.get("realm");
    if (urlRealm === "archive" || urlRealm === "collection") {
      setRealm(urlRealm);
    }
  }, [searchParams, setRealm]);

  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => setNotification(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notification]);

  const approve = async (id: number) => {
    try {
      await api.approveRequest(id);
      setRequests((current) => current.filter((entry) => !(entry.entryType === "request" && entry.id === id)));
      await load();
    } catch {}
  };

  const reject = async (id: number) => {
    try {
      await api.rejectRequest(id);
      setRequests((current) => current.map((entry) => (
        entry.entryType === "request" && entry.id === id ? { ...entry, status: "rejected" } : entry
      )));
      await load();
    } catch {}
  };

  const remind = async (request: CheckoutListEntry) => {
    if (request.entryType !== "checkout") return;
    setRemindingCheckoutIds((current) => new Set(current).add(request.id));
    try {
      const updated = await api.sendCheckoutReminder(request.realm, request.id);
      setRequests((current) => current.map((entry) => (
        entry.entryType === "checkout" && entry.realm === request.realm && entry.id === request.id
          ? {
              ...entry,
              last_reminder_sent_at: updated.last_reminder_sent_at,
              reminder_cooldown_active: updated.reminder_cooldown_active,
              next_reminder_at: updated.next_reminder_at,
            }
          : entry
      )));
      setNotification({
        title: t("checkouts.reminderSent"),
        message: t("checkouts.reminderSentMessage"),
        tone: "success",
      });
    } catch (error) {
      const err = error as Error & { code?: string };
      setNotification({
        title: err.code === "checkout_reminder_missing_email" ? t("checkouts.reminderMissingEmail") : t("common.error"),
        message: err.message || t("checkouts.reminderMissingEmailMessage"),
        tone: "error",
      });
    } finally {
      setRemindingCheckoutIds((current) => {
        const next = new Set(current);
        next.delete(request.id);
        return next;
      });
    }
  };

  const openItem = (request: CheckoutListEntry) => {
    if (request.realm === "archive" || request.realm === "collection") {
      setRealm(request.realm);
    }
  };

  const scopedRequests = filterCheckoutRequests(requests, filter, realm, itemID);
  const paginated = paginateCheckoutRequests(scopedRequests, page, itemsPerPage);
  const realmRequests = requests.filter((request) => request.realm === realm && (!itemID || request.item_id === itemID));
  const filterCards = [
    { value: "all", label: t("checkouts.all"), count: realmRequests.filter((entry) => entry.status === "active" || entry.status === "pending").length },
    { value: "active", label: t("checkouts.active"), count: realmRequests.filter((entry) => entry.status === "active").length },
    { value: "pending", label: t("checkouts.pending"), count: realmRequests.filter((entry) => entry.status === "pending").length },
    { value: "approved", label: t("checkouts.approved"), count: realmRequests.filter((entry) => entry.status === "approved").length },
    { value: "rejected", label: t("checkouts.rejected"), count: realmRequests.filter((entry) => entry.status === "rejected").length },
    { value: "completed", label: t("checkouts.completed"), count: realmRequests.filter((entry) => entry.status === "completed").length },
  ];

  if (!can("checkout.manage")) return <p className="text-center text-gray-500 py-10">Keine Berechtigung</p>;

  return (
    <div className="space-y-6">
      <div className="mb-4 text-center sm:flex sm:items-center sm:justify-between sm:text-left lg:mb-8">
        <div className="space-y-1 py-3">
          <nav className="text-sm font-medium dark:text-gray-100">
            <ol className="flex items-center justify-center sm:justify-start">
              <li>
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">
                  {t("nav.dashboard")}
                </Link>
              </li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRight className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-500 dark:text-gray-400">{t(`realm.${realm}`)}</li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRight className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-900 dark:text-white">{t("checkouts.title")}</li>
            </ol>
          </nav>
          <h2 className="text-2xl font-bold">{t("checkouts.title")}</h2>
        </div>
        <div className="flex items-center justify-center gap-2 rounded-sm px-2 py-3 sm:justify-end sm:bg-transparent sm:px-0">
          <button
            onClick={load}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-sm transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            title={t("checkouts.refresh")}
            aria-label={t("checkouts.refresh")}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
        {filterCards.map((entry) => (
          <CompactStatCard
            key={entry.value}
            label={entry.label}
            value={entry.count}
            active={filter === entry.value}
            onClick={() => router.push(buildCheckoutsPageUrl({ filter: entry.value, page: 1, realm, itemID }))}
          />
        ))}
      </div>

      <div className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : paginated.total === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 sm:px-6">
            {t("checkouts.none")}
          </div>
        ) : (
          <div className="overflow-hidden">
            <CheckoutRequestsList
              requests={paginated.items}
              canManage={can("checkout.manage")}
              fmtDate={fmtDate}
              fmtDateTime={fmtDateTime}
              onOpenItem={openItem}
              onApprove={approve}
              onReject={reject}
              onRemind={remind}
              remindingCheckoutIds={remindingCheckoutIds}
              t={t}
            />
          </div>
        )}
      </div>

      {!loading && paginated.total > 0 ? (
        <CheckoutsPagination
          page={paginated.page}
          total={paginated.total}
          itemsPerPage={itemsPerPage}
          pages={paginated.pages}
          t={t}
          onPage={(nextPage) => router.push(buildCheckoutsPageUrl({ filter, page: nextPage, realm, itemID }))}
        />
      ) : null}

      <FloatingNotification notification={notification} onClose={() => setNotification(null)} t={t} />
    </div>
  );
}

function CompactStatCard({
  label,
  value,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-4 text-left outline outline-1 -outline-offset-1 transition ${
        active
          ? "bg-blue-50 outline-blue-300 dark:bg-blue-500/10 dark:outline-blue-500/30"
          : "bg-white outline-gray-200 hover:bg-gray-50 dark:bg-gray-800/50 dark:outline-white/10 dark:hover:bg-white/10"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{value}</div>
    </button>
  );
}
