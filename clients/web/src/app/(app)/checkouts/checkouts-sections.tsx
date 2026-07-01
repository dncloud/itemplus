"use client";

import Link from "next/link";
import clsx from "clsx";
import type { CheckoutListEntry } from "@/app/(app)/checkouts/checkouts-page-utils";
import { formatCheckoutRelativeState } from "@/lib/checkout-relative-time";
import { CircleCheck, CircleX } from "lucide-react";

export const STATUS_STYLES: Record<string, { bg: string; text: string; labelKey: string }> = {
  active: { bg: "bg-sky-50 dark:bg-sky-900/30", text: "text-sky-800 dark:text-sky-300", labelKey: "checkouts.active" },
  pending: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-400", labelKey: "checkouts.pending" },
  approved: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-400", labelKey: "checkouts.approved" },
  rejected: { bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-800 dark:text-red-400", labelKey: "checkouts.rejected" },
  completed: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", labelKey: "checkouts.completed" },
  expired: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-500", labelKey: "checkouts.expired" },
};

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
  const renderRequestSubline = (req: CheckoutListEntry) => {
    if (req.entryType === "checkout") {
      return req.created_at ? fmtDateTime(req.created_at) : null;
    }
    if (req.requested_duration_days && req.created_at) {
      return `${req.requested_duration_days === 1 ? t("checkouts.requestedDurationOne") : t("checkouts.requestedDurationMany", { days: req.requested_duration_days })} · ${fmtDateTime(req.created_at)}`;
    }
    if (req.requested_duration_days) {
      return req.requested_duration_days === 1 ? t("checkouts.requestedDurationOne") : t("checkouts.requestedDurationMany", { days: req.requested_duration_days });
    }
    if (req.created_at) {
      return fmtDateTime(req.created_at);
    }
    return null;
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

  const summarizeComponents = (req: CheckoutListEntry) => {
    if (!req.bundle_component_names || req.bundle_component_names.length === 0) return null;
    if (req.bundle_component_names.length <= 2) return req.bundle_component_names.join(", ");
    return `${req.bundle_component_names.slice(0, 2).join(", ")} +${req.bundle_component_names.length - 2}`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-white/10">
          <thead className="bg-gray-50/90 dark:bg-white/5">
            <tr>
              <th className="w-[30%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("checkouts.itemColumn")}
              </th>
              <th className="w-[21%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("checkouts.userColumn")}
              </th>
              <th className="w-[23%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("checkouts.timingColumn")}
              </th>
              <th className="w-[16%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("checkouts.statusColumn")}
              </th>
              <th className="w-[10%] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("checkouts.actionsColumn")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-white/10">
            {requests.map((req) => {
              const style = STATUS_STYLES[req.status] || STATUS_STYLES.pending;
              const loanWindow = renderLoanWindow(req);
              const relativeDueState = req.status === "completed" ? null : renderRelativeDueState(req);
              const returnTiming = renderReturnTiming(req);
              const user = req.user_name || t("users.deletedUser");
              const requestSubline = renderRequestSubline(req);

              return (
                <tr key={req.id} className="align-top hover:bg-gray-50/80 dark:hover:bg-white/5">
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      <Link
                        href={`/items/${req.item_id}`}
                        onClick={() => onOpenItem(req)}
                        className="block truncate text-[13px] font-medium text-gray-900 hover:underline dark:text-white"
                      >
                        {req.item_name || `Item #${req.item_id}`}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <MetaPill label={`${t("checkouts.bundle")}: ${renderBundleState(req)}`} />
                        {req.is_overdue ? <MetaPill label={t("checkouts.overdue")} tone="danger" /> : null}
                      </div>
                      {summarizeComponents(req) ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t("checkouts.includedComponents")}: {summarizeComponents(req)}
                        </div>
                      ) : null}
                      {req.notes ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{req.notes}</div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="truncate text-[13px] font-medium text-gray-900 dark:text-white">{user}</div>
                      {requestSubline ? <div className="text-xs text-gray-500 dark:text-gray-400">{requestSubline}</div> : null}
                      {req.approved_by_name && req.status !== "pending" && req.entryType !== "checkout" ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {req.status === "completed" ? t("checkouts.returnedBy") : req.status === "approved" ? t("checkouts.approvedBy") : t("checkouts.rejectedBy")} {req.approved_by_name}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                      {loanWindow ? <div>{loanWindow}</div> : null}
                      {relativeDueState ? (
                        <div className={req.is_overdue ? "font-medium text-red-600 dark:text-red-400" : ""}>
                          {relativeDueState}
                        </div>
                      ) : null}
                      {req.status === "completed" && req.returned_at ? (
                        <div>{t("checkouts.returnedAt", { date: fmtDateTime(req.returned_at) })}</div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${style.bg} ${style.text}`}>
                        {t(style.labelKey)}
                      </span>
                      {returnTiming ? (
                        <div>
                          <MetaPill
                            label={returnTiming.label}
                            tone={returnTiming.className.includes("emerald") ? "success" : "danger"}
                          />
                        </div>
                      ) : null}
                      {req.bundle_component_names && req.bundle_component_names.length > 0 ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {req.bundle_component_names.slice(0, 2).map((name, index) => {
                            const componentID = req.bundle_component_item_ids?.[index];
                            const included = componentID != null
                              ? !!req.component_item_ids?.includes(componentID)
                              : !!req.component_names?.includes(name);
                            return (
                              <div key={`${componentID ?? name}-${index}`} className="truncate">
                                {name} · {renderComponentStateLabel(req, included)}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {req.status === "pending" && canManage ? (
                        <>
                          <button
                            onClick={() => onApprove(req.id)}
                            title={t("checkouts.approve")}
                            aria-label={t("checkouts.approve")}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                          >
                            <CircleCheck className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onReject(req.id)}
                            title={t("checkouts.reject")}
                            aria-label={t("checkouts.reject")}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-700 transition hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            <CircleX className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
      </table>
    </div>
  );
}

function MetaPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "danger" | "success";
}) {
  const toneClass = {
    neutral: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
    danger: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  }[tone];

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${toneClass}`}>
      {label}
    </span>
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
