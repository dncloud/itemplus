"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { ArrowPathIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { CheckoutFilterTabs, CheckoutRequestsList, CheckoutsPagination } from "./checkouts-sections";
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

  const openItem = (request: CheckoutListEntry) => {
    if (request.realm === "archive" || request.realm === "collection") {
      setRealm(request.realm);
    }
  };

  const realmFiltered = filterCheckoutRequests(requests, filter, realm);
  const paginated = paginateCheckoutRequests(realmFiltered, page, itemsPerPage);

  if (!can("checkout.manage")) return <p className="text-center text-gray-500 py-10">Keine Berechtigung</p>;

  return (
    <div className="space-y-6">
      <div className="mb-4 text-center sm:flex sm:items-center sm:justify-between sm:border-b sm:border-gray-200 sm:text-left lg:mb-8 dark:border-white/10">
        <div className="space-y-1 py-3">
          <nav className="text-sm font-medium dark:text-gray-100">
            <ol className="flex items-center justify-center sm:justify-start">
              <li>
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">
                  {t("nav.dashboard")}
                </Link>
              </li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRightIcon className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-500 dark:text-gray-400">{realm === "archive" ? t("realm.archive") : t("realm.collection")}</li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRightIcon className="inline-block h-5 w-5" />
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
            title={t("common.refresh")}
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <CheckoutFilterTabs
        filter={filter}
        requests={requests}
        realm={realm}
        onChange={(nextFilter) => router.push(buildCheckoutsPageUrl({ filter: nextFilter, page: 1 }))}
        t={t}
      />

      {/* Requests List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : paginated.total === 0 ? (
        <p className="text-center text-gray-500 py-10">{t("checkouts.none")}</p>
      ) : (
        <>
          <CheckoutRequestsList
            requests={paginated.items}
            canManage={can("checkout.manage")}
            fmtDate={fmtDate}
            fmtDateTime={fmtDateTime}
            onOpenItem={openItem}
            onApprove={approve}
            onReject={reject}
            t={t}
          />
          <CheckoutsPagination
            page={paginated.page}
            total={paginated.total}
            itemsPerPage={itemsPerPage}
            pages={paginated.pages}
            t={t}
            onPage={(nextPage) => router.push(buildCheckoutsPageUrl({ filter, page: nextPage }))}
          />
        </>
      )}

    </div>
  );
}
