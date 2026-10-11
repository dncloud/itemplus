import type { AppNotification } from "@/lib/api";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

// The server sends what happened and the facts; the words are chosen here,
// in the reader's language. A kind this client does not know is left out.
const KINDS: Record<string, { title: string; text: string; action: string }> = {
  "loan.requested": { title: "notifications.loanRequestedTitle", text: "notifications.loanRequested", action: "notifications.openLoans" },
  "loan.approved": { title: "notifications.loanApprovedTitle", text: "notifications.loanApproved", action: "notifications.openLoans" },
  "loan.rejected": { title: "notifications.loanRejectedTitle", text: "notifications.loanRejected", action: "notifications.openLoans" },
  "loan.return_reported": { title: "notifications.loanReturnReportedTitle", text: "notifications.loanReturnReported", action: "notifications.openLoans" },
  "loan.return_confirmed": { title: "notifications.loanReturnConfirmedTitle", text: "notifications.loanReturnConfirmed", action: "notifications.openLoans" },
  "loan.return_dismissed": { title: "notifications.loanReturnDismissedTitle", text: "notifications.loanReturnDismissed", action: "notifications.openLoans" },
};

export const isKnownNotification = (item: AppNotification) => Boolean(KINDS[item.kind]);

export function notificationWords(item: AppNotification, t: Translate) {
  const kind = KINDS[item.kind];
  const vars = {
    item: String(item.data.item || t("checkouts.unknownItem")),
    user: String(item.data.user || t("users.deletedUser")),
  };
  return { title: t(kind.title, vars), text: t(kind.text, vars), action: t(kind.action) };
}

/**
 * Fired on the window by whoever changed the notifications (read, deleted),
 * so the bell and the messages page stay in step without a live connection.
 */
export const notificationsChangedEvent = "itemplus:notifications-changed";

export function announceNotificationsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(notificationsChangedEvent));
}
