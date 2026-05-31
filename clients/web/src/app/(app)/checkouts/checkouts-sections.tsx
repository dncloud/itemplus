"use client";

import Link from "next/link";
import clsx from "clsx";
import type { CheckoutListEntry } from "@/app/(app)/checkouts/checkouts-page-utils";
import { formatCheckoutRelativeState } from "@/lib/checkout-relative-time";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";

export const STATUS_STYLES: Record<string, { bg: string; text: string; labelKey: string }> = {
  active: { bg: "bg-sky-50 dark:bg-sky-900/30", text: "text-sky-800 dark:text-sky-300", labelKey: "checkouts.active" },
  pending: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-400", labelKey: "checkouts.pending" },
  approved: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-400", labelKey: "checkouts.approved" },
  rejected: { bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-800 dark:text-red-400", labelKey: "checkouts.rejected" },
  completed: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", labelKey: "checkouts.completed" },
  expired: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-500", labelKey: "checkouts.expired" },
};

export function CheckoutFilterTabs({
  filter,
  requests,
  realm,
  onChange,
  t,
}: {
  filter: string;
  requests: CheckoutListEntry[];
  realm: string;
  onChange: (value: string) => void;
  t: (k: string) => string;
}) {
  const tabDefs = [
    { key: "all", label: t("checkouts.all") },
    { key: "active", label: t("checkouts.active") },
    { key: "pending", label: t("checkouts.pending") },
    { key: "approved", label: t("checkouts.approved") },
    { key: "rejected", label: t("checkouts.rejected") },
    { key: "completed", label: t("checkouts.completed") },
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {tabDefs.map(({ key, label }) => {
        const count = key === "all"
          ? requests.filter((r) => r.realm === realm && (r.status === "active" || r.status === "pending")).length
          : requests.filter((r) => r.status === key && r.realm === realm).length;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`px-3 py-1.5 text-sm rounded-lg transition ${
              filter === key
                ? "bg-blue-500 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {label}
            {count > 0 ? <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${filter === key ? "bg-white/20" : "bg-gray-200 dark:bg-gray-700"}`}>{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function CheckoutRequestsList({
  requests,
  canManage,
  fmtDate,
  fmtDateTime,
  onOpenItem,
  onApprove,
  onReject,
  t,
}: {
  requests: CheckoutListEntry[];
  canManage: boolean;
  fmtDate: (value: string) => string;
  fmtDateTime: (value: string) => string;
  onOpenItem: (request: CheckoutListEntry) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const renderRequestSummary = (req: CheckoutListEntry) => {
    const user = req.user_name || `User #${req.user_id}`;
    const date = req.created_at ? fmtDateTime(req.created_at) : null;
    const duration = req.requested_duration_days
      ? req.requested_duration_days === 1
        ? t("checkouts.requestedDurationOne")
        : t("checkouts.requestedDurationMany", { days: req.requested_duration_days })
      : null;

    if (req.entryType === "checkout") {
      if (date) {
        return t("checkouts.checkedOutToSummary", { user, date });
      }
      return t("checkouts.checkedOutToUser", { user });
    }

    if (duration && date) {
      return t("checkouts.requestSummary", { user, duration, date });
    }
    if (duration) {
      return t("checkouts.requestSummaryNoDate", { user, duration });
    }
    if (date) {
      return t("checkouts.requestSummaryNoDuration", { user, date });
    }
    return t("checkouts.requestedByUser", { user });
  };

  const renderLoanWindow = (req: CheckoutListEntry) => {
    if (!req.checkout_created_at || !req.due_date) return null;
    return t("checkouts.fromTo", {
      from: fmtDate(req.checkout_created_at),
      to: fmtDate(req.due_date),
    });
  };

  const renderRelativeDueState = (req: CheckoutListEntry) => {
    return formatCheckoutRelativeState({
      dueDate: req.due_date,
      isOverdue: req.is_overdue,
      overdueDays: req.overdue_days,
      t,
    });
  };

  const renderLateDuration = (req: CheckoutListEntry) => {
    const days = Math.max(1, Math.round(req.overdue_days ?? 1));
    if (days === 1) return t("checkouts.lateDurationOneDay");

    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    if (weeks >= 1 && remainingDays > 0) {
      return t("checkouts.lateDurationWeeksAndDays", { weeks, days: remainingDays });
    }
    if (weeks >= 1) {
      return t("checkouts.lateDurationWeeks", { weeks });
    }
    return t("checkouts.lateDurationDays", { days });
  };

  const renderReturnTiming = (req: CheckoutListEntry) => {
    if (req.status !== "completed" || !req.returned_at || !req.due_date) return null;
    if (req.was_overdue || (req.overdue_days ?? 0) > 0) {
      return {
        label: t("checkouts.returnTimingLate", { duration: renderLateDuration(req) }),
        className: "text-red-600 dark:text-red-400",
      };
    }
    return {
      label: t("checkouts.returnTimingOnTime"),
      className: "text-emerald-600 dark:text-emerald-400",
    };
  };

  const renderBundleState = (req: CheckoutListEntry) => {
    const isBundleRequest = Boolean(
      req.is_bundle
      || (req.component_item_ids && req.component_item_ids.length > 0)
      || (req.component_names && req.component_names.length > 0)
      || (req.bundle_component_item_ids && req.bundle_component_item_ids.length > 0)
      || (req.bundle_component_names && req.bundle_component_names.length > 0)
    );
    return t(isBundleRequest ? "checkouts.bundleYes" : "checkouts.bundleNo");
  };

  const renderComponentStateLabel = (req: CheckoutListEntry, included: boolean) => {
    if (req.status === "pending") {
      return t(included ? "checkouts.requestedComponent" : "checkouts.notRequestedComponent");
    }
    return t(included ? "checkouts.includedComponent" : "checkouts.notIncludedComponent");
  };

  return (
    <div className="overflow-hidden divide-y divide-gray-100 bg-white shadow-xs outline outline-1 -outline-offset-1 outline-gray-900/5 sm:rounded-xl dark:divide-white/5 dark:bg-gray-800/50 dark:outline-white/10">
      {requests.map((req) => {
        const style = STATUS_STYLES[req.status] || STATUS_STYLES.pending;
        const loanWindow = renderLoanWindow(req);
        const relativeDueState = req.status === "completed" ? null : renderRelativeDueState(req);
        const returnTiming = renderReturnTiming(req);
        return (
          <div key={req.id} className="px-4 py-5 hover:bg-gray-50 sm:px-6 dark:hover:bg-white/2.5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <Link
                    href={`/items/${req.item_id}`}
                    onClick={() => onOpenItem(req)}
                    className="text-sm/6 font-semibold text-gray-900 dark:text-white hover:underline truncate"
                  >
                    {req.item_name || `Item #${req.item_id}`}
                  </Link>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${style.bg} ${style.text}`}>
                    {t(style.labelKey)}
                  </span>
                  {req.is_overdue ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0 bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      {t("checkouts.overdue")}
                    </span>
                  ) : null}
                </div>
                <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
                  <span>{renderRequestSummary(req)}</span>
                </div>
                <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
                  <span>{t("checkouts.bundle")}: {renderBundleState(req)}</span>
                </div>
                {loanWindow || relativeDueState ? (
                  <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
                    {loanWindow ? <span>{t("checkouts.period")}: {loanWindow}</span> : null}
                    {relativeDueState ? (
                      <span className={req.is_overdue ? "text-red-600 dark:text-red-400" : ""}>
                        {relativeDueState}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {req.status === "completed" && req.returned_at ? (
                  <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
                    <span>{t("checkouts.returnedAt", { date: fmtDateTime(req.returned_at) })}</span>
                    {returnTiming ? <span className={returnTiming.className}>{returnTiming.label}</span> : null}
                  </div>
                ) : null}
                {req.bundle_component_names && req.bundle_component_names.length > 0 ? (
                  <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <p>{t("checkouts.includedComponents")}:</p>
                    <ul className="space-y-1">
                      {req.bundle_component_names.map((name, index) => {
                        const componentID = req.bundle_component_item_ids?.[index];
                        const included = componentID != null
                          ? !!req.component_item_ids?.includes(componentID)
                          : !!req.component_names?.includes(name);
                        return (
                          <li key={`${componentID ?? name}-${index}`} className="flex flex-wrap items-center gap-2">
                            {componentID ? (
                              <Link
                                href={`/items/${componentID}`}
                                onClick={() => onOpenItem({ ...req, item_id: componentID, item_name: name })}
                                className="hover:underline text-gray-600 dark:text-gray-300"
                              >
                                {name}
                              </Link>
                            ) : (
                              <span>{name}</span>
                            )}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                included
                                  ? "bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                  : "bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300"
                              }`}
                            >
                              {renderComponentStateLabel(req, included)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                {req.notes ? <p className="text-xs text-gray-400">{req.notes}</p> : null}
                {req.approved_by_name && req.status !== "pending" && req.entryType !== "checkout" ? (
                  <p className="text-xs text-gray-400">
                    {req.status === "completed" ? t("checkouts.returnedBy") : req.status === "approved" ? t("checkouts.approvedBy") : t("checkouts.rejectedBy")} {req.approved_by_name}
                  </p>
                ) : null}
              </div>

              {req.status === "pending" && canManage ? (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => onApprove(req.id)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-sm text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20">
                    <CheckCircleIcon className="h-4 w-4" /> {t("checkouts.approve")}
                  </button>
                  <button onClick={() => onReject(req.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 transition hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20">
                    <XCircleIcon className="h-4 w-4" /> {t("checkouts.reject")}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CheckoutsPagination({
  page,
  total,
  itemsPerPage,
  pages,
  t,
  onPage,
}: {
  page: number;
  total: number;
  itemsPerPage: number;
  pages: number[];
  t: (key: string, vars?: Record<string, string | number>) => string;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.ceil(total / itemsPerPage);
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-between border-t border-gray-200 px-4 dark:border-white/10 sm:px-0" aria-label="Pagination">
      <div className="-mt-px flex w-0 flex-1">
        <button
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="inline-flex items-center border-t-2 border-transparent pt-4 pr-1 text-sm font-medium text-gray-400 hover:border-gray-300 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:border-white/20 dark:hover:text-gray-200"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="mr-3 size-5 text-gray-500">
            <path d="M18 10a.75.75 0 0 1-.75.75H4.66l2.1 1.95a.75.75 0 1 1-1.02 1.1l-3.5-3.25a.75.75 0 0 1 0-1.1l3.5-3.25a.75.75 0 1 1 1.02 1.1l-2.1 1.95h12.59A.75.75 0 0 1 18 10Z" />
          </svg>
          {t("common.previous")}
        </button>
      </div>
      <div className="hidden md:-mt-px md:flex">
        {pages.map((pageNumber, index) =>
          pageNumber === -1 ? (
            <span key={`ellipsis-${index}`} className="inline-flex items-center border-t-2 border-transparent px-4 pt-4 text-sm font-medium text-gray-500">
              ...
            </span>
          ) : (
            <button
              key={pageNumber}
              onClick={() => onPage(pageNumber)}
              aria-current={pageNumber === page ? "page" : undefined}
              className={clsx(
                "inline-flex items-center border-t-2 px-4 pt-4 text-sm font-medium",
                pageNumber === page
                  ? "border-indigo-400 text-indigo-400"
                  : "border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-700 dark:hover:border-white/20 dark:hover:text-gray-200",
              )}
            >
              {pageNumber}
            </button>
          ),
        )}
      </div>
      <div className="-mt-px flex w-0 flex-1 justify-end">
        <button
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="inline-flex items-center border-t-2 border-transparent pt-4 pl-1 text-sm font-medium text-gray-400 hover:border-gray-300 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:border-white/20 dark:hover:text-gray-200"
        >
          {t("common.next")}
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="ml-3 size-5 text-gray-500">
            <path d="M2 10a.75.75 0 0 1 .75-.75h12.59l-2.1-1.95a.75.75 0 1 1 1.02-1.1l3.5 3.25a.75.75 0 0 1 0 1.1l-3.5 3.25a.75.75 0 1 1-1.02-1.1l2.1-1.95H2.75A.75.75 0 0 1 2 10Z" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
