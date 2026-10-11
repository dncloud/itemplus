"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Inbox } from "lucide-react";
import clsx from "clsx";
import { api, type AppNotification } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { announceNotificationsChanged, isKnownNotification, notificationWords, notificationsChangedEvent } from "@/lib/notifications";
import { RowMenu, cancelButtonClass, saveButtonClass } from "@/components/ui/list-controls";
import { wsClient } from "@/lib/ws";

/**
 * Every message of the signed-in user, read or not, laid out like a mail
 * client without folders: the list on the left, the chosen message on the
 * right. Choosing a message marks it as read.
 */
export default function NotificationsPage() {
  const { t, fmtDateTime } = useApp();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api.getNotifications();
      setItems(result.items.filter(isKnownNotification));
    } catch {
      // Keep what is shown; the next change or reload tries again.
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
    const unsubscribe = wsClient.on("notifications.updated", () => { void load(); });
    const onChanged = () => { void load(); };
    window.addEventListener(notificationsChangedEvent, onChanged);
    return () => {
      unsubscribe();
      window.removeEventListener(notificationsChangedEvent, onChanged);
    };
  }, [load]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const unread = items.filter((item) => !item.read_at).length;
  const hasRead = items.some((item) => item.read_at);

  const select = async (item: AppNotification) => {
    setSelectedId(item.id);
    if (item.read_at) return;
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry)));
    await api.markNotificationsRead(item.id).catch(() => {});
    announceNotificationsChanged();
  };

  const readAll = async () => {
    setItems((current) => current.map((entry) => (entry.read_at ? entry : { ...entry, read_at: new Date().toISOString() })));
    await api.markNotificationsRead().catch(() => {});
    announceNotificationsChanged();
  };

  const remove = async (item: AppNotification) => {
    setDeletingId(item.id);
    try {
      await api.deleteNotification(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setSelectedId(null);
      announceNotificationsChanged();
    } catch {
      await load();
    } finally {
      setDeletingId(null);
    }
  };

  const removeRead = async () => {
    await api.deleteReadNotifications().catch(() => {});
    setItems((current) => current.filter((entry) => !entry.read_at));
    setSelectedId(null);
    announceNotificationsChanged();
  };

  const meta = (item: AppNotification) =>
    `${item.data.realm ? `${t(`realm.${String(item.data.realm)}`)} · ` : ""}${fmtDateTime(item.created_at)}`;

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
              <li className="text-gray-900 dark:text-white">{t("notifications.pageTitle")}</li>
            </ol>
          </nav>
          <h2 className="text-2xl font-bold">{t("notifications.pageTitle")}</h2>
          {unread > 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">{t("notifications.unreadCount", { count: unread })}</p> : null}
        </div>
        <div className="flex items-center justify-center gap-2 px-2 py-3 sm:justify-end sm:px-0">
          {unread > 0 ? <button type="button" onClick={() => { void readAll(); }} className={cancelButtonClass}>{t("notifications.readAll")}</button> : null}
          {hasRead ? <button type="button" onClick={() => { void removeRead(); }} className={cancelButtonClass}>{t("notifications.deleteRead")}</button> : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 lg:grid lg:min-h-[28rem] lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] dark:bg-gray-800/50 dark:outline-white/10">
        {/* On a narrow screen there is room for one pane: the list, or the chosen message. */}
        <div className={clsx("lg:block lg:border-r lg:border-gray-200 dark:lg:border-white/10", selected ? "hidden" : "block")}>
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Inbox aria-hidden="true" className="mx-auto size-8 text-gray-300 dark:text-gray-600" />
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t("notifications.none")}</p>
            </div>
          ) : (
            <ul role="list" className="divide-y divide-gray-100 lg:max-h-[70vh] lg:overflow-y-auto dark:divide-white/5">
              {items.map((item) => {
                const words = notificationWords(item, t);
                const isSelected = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => { void select(item); }}
                      aria-current={isSelected ? "true" : undefined}
                      className={clsx(
                        "flex w-full items-start gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-500",
                        isSelected ? "bg-indigo-50 dark:bg-indigo-500/10" : "hover:bg-gray-50 dark:hover:bg-white/5",
                      )}
                    >
                      <span aria-hidden="true" className={clsx("mt-1.5 size-2 shrink-0 rounded-full", item.read_at ? "bg-transparent" : "bg-indigo-600 dark:bg-indigo-400")} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className={clsx("truncate text-sm", item.read_at ? "font-medium text-gray-700 dark:text-gray-300" : "font-semibold text-gray-900 dark:text-white")}>{words.title}</span>
                          <time dateTime={item.created_at} className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{fmtDateTime(item.created_at)}</time>
                        </span>
                        <span className="mt-0.5 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{words.text}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={clsx("lg:block", selected ? "block" : "hidden")}>
          {selected ? (
            <article className="px-4 py-5 sm:px-6">
              <button type="button" onClick={() => setSelectedId(null)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 lg:hidden dark:text-gray-400 dark:hover:text-white">
                <ArrowLeft aria-hidden="true" className="size-4" />
                {t("notifications.back")}
              </button>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{notificationWords(selected, t).title}</h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{meta(selected)}</p>
                </div>
                <RowMenu t={t} pending={deletingId === selected.id} onDelete={() => { void remove(selected); }} />
              </div>
              <p className="mt-5 text-sm/6 text-gray-700 dark:text-gray-300">{notificationWords(selected, t).text}</p>
              {selected.link ? (
                <div className="mt-6">
                  <Link href={selected.link} className={clsx("inline-flex", saveButtonClass)}>{notificationWords(selected, t).action}</Link>
                </div>
              ) : null}
            </article>
          ) : (
            <div className="hidden h-full items-center justify-center px-6 py-16 text-sm text-gray-500 lg:flex dark:text-gray-400">
              {items.length > 0 ? t("notifications.selectOne") : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
