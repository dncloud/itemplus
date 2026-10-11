"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { Bell } from "lucide-react";
import { api, type AppNotification } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { announceNotificationsChanged, isKnownNotification, notificationWords, notificationsChangedEvent } from "@/lib/notifications";
import { wsClient } from "@/lib/ws";

/**
 * Bell in the page header with what the signed-in user has not read yet.
 * A message that was read leaves the bell; all of them, read or not, are on
 * the messages page.
 */
export function NotificationBell() {
  const router = useRouter();
  const { t, fmtDateTime } = useApp();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const result = await api.getNotifications();
      setItems(result.items.filter((item) => isKnownNotification(item) && !item.read_at));
      setUnread(result.unread);
    } catch {
      // The bell just stays as it is; the next round tries again.
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
    const unsubscribe = wsClient.on("notifications.updated", () => { void load(); });
    // Also without a live connection the bell catches up.
    const interval = window.setInterval(() => { void load(); }, 60000);
    const onChanged = () => { void load(); };
    window.addEventListener(notificationsChangedEvent, onChanged);
    return () => {
      unsubscribe();
      window.removeEventListener(notificationsChangedEvent, onChanged);
      window.clearInterval(interval);
    };
  }, [load]);

  const open = async (item: AppNotification, close: () => void) => {
    close();
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    setUnread((current) => Math.max(0, current - 1));
    await api.markNotificationsRead(item.id).catch(() => {});
    announceNotificationsChanged();
    if (item.link) router.push(item.link);
  };

  const readAll = async () => {
    setItems([]);
    setUnread(0);
    await api.markNotificationsRead().catch(() => {});
    announceNotificationsChanged();
  };

  const label = unread > 0 ? t("notifications.titleUnread", { count: unread }) : t("notifications.title");

  return (
    <Popover className="relative">
      <PopoverButton
        title={label}
        aria-label={label}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:outline-indigo-500"
      >
        <Bell className="size-4 shrink-0" />
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-orange-500 px-1 text-center text-[10px]/4 font-semibold text-white dark:bg-orange-400 dark:text-gray-900">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </PopoverButton>
      <PopoverPanel
        anchor={{ to: "bottom end", gap: 8 }}
        transition
        className="z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg bg-white shadow-lg outline-1 outline-black/5 transition data-[closed]:translate-y-1 data-[closed]:opacity-0 data-[enter]:duration-150 data-[leave]:duration-100 dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
      >
        {({ close }) => (
          <>
            <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-3 dark:border-white/10">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t("notifications.title")}</h2>
              {unread > 0 ? (
                <button type="button" onClick={() => { void readAll(); }} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                  {t("notifications.readAll")}
                </button>
              ) : null}
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">{t("notifications.noneNew")}</p>
            ) : (
              <ul role="list" className="max-h-[60vh] divide-y divide-gray-100 overflow-y-auto dark:divide-white/5">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => { void open(item, close); }}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-hidden dark:hover:bg-white/5 dark:focus-visible:bg-white/5"
                    >
                      <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900 dark:text-white">{notificationWords(item, t).text}</span>
                        <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                          {item.data.realm ? `${t(`realm.${String(item.data.realm)}`)} · ` : ""}{fmtDateTime(item.created_at)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-gray-200 px-4 py-2.5 dark:border-white/10">
              <Link href="/notifications" onClick={() => close()} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                {t("notifications.showAll")} <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}
