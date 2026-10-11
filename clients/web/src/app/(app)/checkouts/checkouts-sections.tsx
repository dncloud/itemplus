"use client";

import Link from "next/link";
import clsx from "clsx";
import type { CheckoutListEntry } from "@/app/(app)/checkouts/checkouts-page-utils";
import { formatCheckoutRelativeState } from "@/lib/checkout-relative-time";
import { cancelButtonClass, saveButtonClass } from "@/components/ui/list-controls";
import { useState } from "react";
import { Bell, CircleCheck, CircleX, Undo2 } from "lucide-react";

export const STATUS_STYLES: Record<string, { bg: string; text: string; labelKey: string }> = {
  active: { bg: "bg-sky-50 dark:bg-sky-900/30", text: "text-sky-800 dark:text-sky-300", labelKey: "checkouts.active" },
  pending: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-400", labelKey: "checkouts.pending" },
  approved: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-400", labelKey: "checkouts.approved" },
  rejected: { bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-800 dark:text-red-400", labelKey: "checkouts.rejected" },
  completed: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", labelKey: "checkouts.completed" },
  expired: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-500", labelKey: "checkouts.expired" },
};

// Returns a borrower has reported. The loan is still open: the manager
// confirms that the item is back, or says that it is not.
export function ReturnReportCards({ requests, fmtDateTime, onOpenItem, onConfirm, onDismiss, busyKey, t }: {
  requests: CheckoutListEntry[];
  fmtDateTime: (value: string) => string;
  onOpenItem: (request: CheckoutListEntry) => void;
  onConfirm: (request: CheckoutListEntry) => void;
  onDismiss: (request: CheckoutListEntry) => void;
  busyKey: string | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  if (requests.length === 0) return null;

  return (
    <section className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
      <h3 className="px-4 pt-4 text-sm/6 font-semibold text-gray-900 sm:px-6 dark:text-white">{t("checkouts.returnReports")}</h3>
      <ul role="list" className="divide-y divide-gray-100 dark:divide-white/5">
        {requests.map((req) => (
          <li key={`${req.realm}-${req.id}`} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-sm/6 text-gray-700 dark:text-gray-300">
                <span className="font-semibold text-gray-900 dark:text-white">{req.user_name || t("users.deletedUser")}</span>
                {" "}{t("checkouts.returnReportSays")}{" "}
                <Link href={`/items/${req.item_id}`} onClick={() => onOpenItem(req)} className="font-semibold text-gray-900 hover:underline dark:text-white">
                  {req.item_name || t("checkouts.unknownItem")}
                </Link>
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {req.return_requested_at ? t("checkouts.returnReportedAt", { date: fmtDateTime(req.return_requested_at) }) : ""}
                {req.is_overdue ? ` · ${t("checkouts.overdue")}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" disabled={busyKey !== null} onClick={() => onDismiss(req)} className={`disabled:cursor-not-allowed disabled:opacity-60 ${cancelButtonClass}`}>
                {t("checkouts.returnNotBack")}
              </button>
              <button type="button" disabled={busyKey !== null} onClick={() => onConfirm(req)} className={`disabled:cursor-not-allowed disabled:opacity-60 ${saveButtonClass}`}>
                {t("checkouts.returnConfirmReport")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Requests that wait for a decision, each as one sentence with the decision
// next to it. A manager decides here; the requester reads that it is waiting.
export function PendingRequestCards({ requests, canManage, fmtDateTime, onOpenItem, onApprove, onReject, t }: {
  requests: CheckoutListEntry[];
  canManage: boolean;
  fmtDateTime: (value: string) => string;
  onOpenItem: (request: CheckoutListEntry) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  if (requests.length === 0) return null;

  return (
    <section className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
      <h3 className="px-4 pt-4 text-sm/6 font-semibold text-gray-900 sm:px-6 dark:text-white">
        {canManage ? t("checkouts.openRequests") : t("checkouts.myOpenRequests")}
      </h3>
      <ul role="list" className="divide-y divide-gray-100 dark:divide-white/5">
        {requests.map((req) => {
          const duration = req.requested_duration_days
            ? (req.requested_duration_days === 1 ? t("checkouts.requestedDurationOne") : t("checkouts.requestedDurationMany", { days: req.requested_duration_days }))
            : "";
          const details = [
            duration ? t("checkouts.requestFor", { duration }) : "",
            req.created_at ? t("checkouts.requestedAt", { date: fmtDateTime(req.created_at) }) : "",
          ].filter(Boolean).join(" · ");
          const item = (
            <Link href={`/items/${req.item_id}`} onClick={() => onOpenItem(req)} className="font-semibold text-gray-900 hover:underline dark:text-white">
              {req.item_name || t("checkouts.unknownItem")}
            </Link>
          );
          return (
            <li key={`${req.realm}-${req.id}`} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-sm/6 text-gray-700 dark:text-gray-300">
                  {canManage ? (
                    <>
                      <span className="font-semibold text-gray-900 dark:text-white">{req.user_name || t("users.deletedUser")}</span>
                      {" "}{t("checkouts.requestWants")}{" "}
                    </>
                  ) : null}
                  {item}
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {!canManage ? `${t(`realm.${req.realm}`)} · ` : ""}{details}
                </p>
                {req.component_names && req.component_names.length > 0 ? (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("checkouts.includedComponents")}: {req.component_names.join(", ")}</p>
                ) : null}
                {req.notes ? <p className="mt-1 text-sm text-gray-600 italic dark:text-gray-300">„{req.notes}“</p> : null}
              </div>
              {canManage ? (
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => onReject(req.id)} className={cancelButtonClass}>{t("checkouts.reject")}</button>
                  <button type="button" onClick={() => onApprove(req.id)} className={saveButtonClass}>{t("checkouts.approve")}</button>
                </div>
              ) : (
                <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES.pending.bg} ${STATUS_STYLES.pending.text}`}>
                  {t("checkouts.waitingForApproval")}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
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
  onRemind,
  onReturn,
  returningKey,
  remindingCheckoutIds,
  t,
}: {
  requests: CheckoutListEntry[];
  /** May approve, reject and remind. Without it the list holds only the viewer's own rows. */
  canManage: boolean;
  onReturn: (request: CheckoutListEntry) => void;
  returningKey: string | null;
  fmtDate: (value: string) => string;
  fmtDateTime: (value: string) => string;
  onOpenItem: (request: CheckoutListEntry) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onRemind: (request: CheckoutListEntry) => void;
  remindingCheckoutIds: Set<number>;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  // The row whose return is waiting for a second click.
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const rowKey = (req: CheckoutListEntry) => `${req.entryType}-${req.realm}-${req.id}`;

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

  const isBundle = (req: CheckoutListEntry) => Boolean(
    req.is_bundle
    || (req.component_item_ids && req.component_item_ids.length > 0)
    || (req.component_names && req.component_names.length > 0)
    || (req.bundle_component_item_ids && req.bundle_component_item_ids.length > 0)
    || (req.bundle_component_names && req.bundle_component_names.length > 0)
  );

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
              <th className={clsx(canManage ? "w-[28%]" : "w-[40%]", "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400")}>
                {t("checkouts.itemColumn")}
              </th>
              {canManage ? (
                <th className="w-[21%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t("checkouts.userColumn")}
                </th>
              ) : null}
              <th className="w-[23%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("checkouts.timingColumn")}
              </th>
              <th className="w-[16%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("checkouts.statusColumn")}
              </th>
              <th className="w-[16%] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
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
                <tr key={rowKey(req)} className="align-top hover:bg-gray-50/80 dark:hover:bg-white/5">
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      <Link
                        href={`/items/${req.item_id}`}
                        onClick={() => onOpenItem(req)}
                        className="block truncate text-[13px] font-medium text-gray-900 hover:underline dark:text-white"
                      >
                        {req.item_name || t("checkouts.unknownItem")}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-2 empty:hidden">
                        {!canManage ? <MetaPill label={t(`realm.${req.realm}`)} /> : null}
                        {isBundle(req) ? <MetaPill label={t("checkouts.bundle")} /> : null}
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
                  {canManage ? (
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
                  ) : null}
                  <td className="px-4 py-3">
                    <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                      {!canManage && requestSubline ? <div>{requestSubline}</div> : null}
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
                      {req.status === "active" && req.return_requested_at ? (
                        <div><MetaPill label={t("checkouts.returnWaiting")} tone="success" /></div>
                      ) : null}
                      {req.last_reminder_sent_at ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{t("checkouts.reminded")}</div>
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
                      ) : null}
                      {canManage && req.entryType === "checkout" && req.status === "active" && req.is_overdue ? (
                        <button
                          type="button"
                          onClick={() => onRemind(req)}
                          disabled={remindingCheckoutIds.has(req.id) || req.reminder_cooldown_active || req.user_has_email === false}
                          aria-label={
                            req.user_has_email === false
                              ? t("checkouts.reminderMissingEmail")
                              : req.reminder_cooldown_active
                                ? t("checkouts.reminderCooldown")
                                : t("checkouts.remind")
                          }
                          title={
                            req.user_has_email === false
                              ? t("checkouts.reminderMissingEmail")
                              : req.reminder_cooldown_active
                                ? t("checkouts.reminderCooldown")
                                : t("checkouts.remind")
                          }
                          className={clsx(
                            "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 p-2 text-sm transition dark:border-gray-700 dark:text-gray-300",
                            remindingCheckoutIds.has(req.id)
                              ? "cursor-wait text-gray-700 dark:text-gray-300"
                              : req.user_has_email === false || req.reminder_cooldown_active
                                ? "cursor-not-allowed text-gray-400 opacity-60 dark:text-gray-500"
                                : "text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800",
                          )}
                        >
                          {remindingCheckoutIds.has(req.id) ? (
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <Bell className="h-3.5 w-3.5" />
                          )}
                        </button>
                      ) : null}
                      {req.entryType === "checkout" && req.status === "active" && (canManage || !req.return_requested_at) ? (
                        confirmKey === rowKey(req) ? (
                          <>
                            <button type="button" onClick={() => setConfirmKey(null)} className={cancelButtonClass}>
                              {t("common.cancel")}
                            </button>
                            <button
                              type="button"
                              disabled={returningKey !== null}
                              onClick={() => { setConfirmKey(null); onReturn(req); }}
                              className={`disabled:cursor-not-allowed disabled:opacity-60 ${saveButtonClass}`}
                            >
                              {canManage ? t("checkouts.returnConfirm") : t("checkouts.returnReport")}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmKey(rowKey(req))}
                            disabled={returningKey !== null}
                            title={canManage ? t("checkouts.returnAction") : t("checkouts.returnReport")}
                            aria-label={canManage ? t("checkouts.returnAction") : t("checkouts.returnReport")}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            {returningKey === rowKey(req) ? (
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              <Undo2 className="h-4 w-4" />
                            )}
                          </button>
                        )
                      ) : null}
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
