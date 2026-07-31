"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";
import { api, type Item, type MaintenanceReminderPayload } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { ItemMaintenancePanel } from "@/app/(app)/items/[id]/item-detail-maintenance-panel";
import { ItemDetailLoadingView, ItemDetailNotification } from "@/app/(app)/items/[id]/item-detail-chrome";

export function ItemMaintenancePageContent({ itemId }: { itemId: number }) {
  const router = useRouter();
  const { realm, t, fmtDate, can } = useApp();
  const [item, setItem] = useState<Item | null>(null);
  const [notification, setNotification] = useState<{ title: string; message?: string; tone: "success" | "error" } | null>(null);
  const canReadMaintenance = can("maintenance.read");
  const canManageMaintenance = canReadMaintenance && can("maintenance.write");

  const load = useCallback(async () => {
    try {
      const nextItem = await api.getItem(itemId);
      setItem(nextItem);
    } catch {
      router.push("/items");
    }
  }, [itemId, router]);

  useEffect(() => {
    if (!Number.isFinite(itemId)) {
      router.push("/items");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const nextItem = await api.getItem(itemId);
        if (!cancelled) setItem(nextItem);
      } catch {
        if (!cancelled) router.push("/items");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId, router]);

  useEffect(() => {
    if (!notification) return;
    const timeout = window.setTimeout(() => setNotification(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  const runMaintenanceAction = useCallback(async (action: () => Promise<void>) => {
    try {
      await action();
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      setNotification({
        title: t("maintenance.actionFailed"),
        message,
        tone: "error",
      });
      throw error;
    }
  }, [load, t]);

  const createReminder = useCallback(async (payload: MaintenanceReminderPayload) => {
    await runMaintenanceAction(async () => {
      await api.createMaintenanceReminder(itemId, payload);
    });
  }, [itemId, runMaintenanceAction]);

  const updateReminder = useCallback(async (reminderId: number, payload: MaintenanceReminderPayload) => {
    await runMaintenanceAction(async () => {
      await api.updateMaintenanceReminder(itemId, reminderId, payload);
    });
  }, [itemId, runMaintenanceAction]);

  const completeReminder = useCallback(async (reminderId: number, note?: string) => {
    await runMaintenanceAction(async () => {
      await api.completeMaintenanceReminder(itemId, reminderId, note);
    });
  }, [itemId, runMaintenanceAction]);

  const skipReminder = useCallback(async (reminderId: number) => {
    await runMaintenanceAction(async () => {
      await api.skipMaintenanceReminder(itemId, reminderId);
    });
  }, [itemId, runMaintenanceAction]);

  const deleteReminder = useCallback(async (reminderId: number) => {
    await runMaintenanceAction(async () => {
      await api.deleteMaintenanceReminder(itemId, reminderId);
    });
  }, [itemId, runMaintenanceAction]);

  if (!canReadMaintenance) {
    return <p className="py-10 text-center text-gray-500 dark:text-gray-400">Keine Berechtigung</p>;
  }

  if (!item) {
    return <ItemDetailLoadingView />;
  }

  return (
    <div className="w-full space-y-6">
      {notification ? (
        <ItemDetailNotification notification={notification} clearNotification={() => setNotification(null)} />
      ) : null}

      <div className="mb-4 text-center sm:flex sm:items-center sm:justify-between sm:border-b sm:border-gray-200 sm:text-left lg:mb-8 dark:border-white/10">
        <div className="space-y-1 py-3">
          <nav className="text-sm font-medium text-gray-500 dark:text-gray-400">
            <ol className="flex items-center justify-center sm:justify-start">
              <li>
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">
                  {t("nav.dashboard")}
                </Link>
              </li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRight className="inline-block h-4 w-4" />
              </li>
              <li className="text-gray-500 dark:text-gray-400">{realm === "archive" ? t("realm.archive") : t("realm.collection")}</li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRight className="inline-block h-4 w-4" />
              </li>
              <li>
                <Link href="/maintenance" className="hover:text-gray-900 dark:hover:text-white">
                  {t("nav.maintenance")}
                </Link>
              </li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRight className="inline-block h-4 w-4" />
              </li>
              <li className="text-gray-900 dark:text-white">{item.name}</li>
            </ol>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{item.name}</h1>
        </div>
        <div className="flex items-center justify-center gap-2 py-3 sm:justify-end">
          <Link
            href={`/items/${item.id}`}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-sm transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            title={t("itemDetail.details")}
          >
            <FileText className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <ItemMaintenancePanel
        reminders={item.maintenance_reminders || []}
        history={item.maintenance_history || []}
        canManage={canManageMaintenance}
        fmtDate={fmtDate}
        t={t}
        onCreate={createReminder}
        onUpdate={updateReminder}
        onComplete={completeReminder}
        onSkip={skipReminder}
        onDelete={deleteReminder}
      />
    </div>
  );
}
