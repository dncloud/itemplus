"use client";

import { useEffect, useState } from "react";
import { FloatingNotification, type FloatingNotificationState } from "@/components/ui/floating-notification";
import { useApp } from "@/lib/app-context";

/**
 * Safety net for failed requests that no screen handles itself. Without it
 * such a failure is silent: the user clicks, the server refuses, and nothing
 * on the page says so. Screens that show their own message are unaffected,
 * because an error they catch never becomes an unhandled rejection.
 */
export function UnhandledErrorNotice() {
  const { t } = useApp();
  const [notification, setNotification] = useState<FloatingNotificationState>(null);

  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as (Error & { status?: number }) | undefined;
      // Only failed API calls; an expired session has its own handling.
      if (!(reason instanceof Error) || typeof reason.status !== "number" || reason.name === "UnauthorizedError") return;
      setNotification({ title: t("common.actionFailed"), message: reason.message, tone: "error" });
    };
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", onUnhandledRejection);
  }, [t]);

  useEffect(() => {
    if (!notification) return;
    const timeout = window.setTimeout(() => setNotification(null), 7000);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  return <FloatingNotification notification={notification} onClose={() => setNotification(null)} t={t} />;
}
