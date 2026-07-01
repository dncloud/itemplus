"use client";
import clsx from "clsx";
import { Check, ChevronDown, Shield, Trash2, Wifi, KeyRound } from "lucide-react";
import type { User } from "@/lib/api";
import { UserAvatar } from "@/components/ui/user-avatar";

export const ALL_PERMISSIONS = [
  "items.read",
  "items.write",
  "items.delete",
  "inventory.read",
  "inventory.write",
  "maintenance.read",
  "maintenance.write",
  "attachments.write",
  "checkout.manage",
  "print",
  "categories.read",
  "categories.write",
  "categories.delete",
  "locations.read",
  "locations.write",
  "locations.delete",
  "vendors.read",
  "vendors.write",
  "vendors.delete",
] as const;

export const userInputClass = "w-full h-[38px] rounded-md bg-white px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500";
export const userSwitchBaseClass = "relative inline-flex h-6 w-11 items-center rounded-full outline outline-1 -outline-offset-1 transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500";
const userBadgeClass = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium";

function UserMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-sm text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}

export function PendingUsersSection({
  inactive,
  fmtDate,
  t,
  activateUser,
  deleteUser,
  pendingDeleteUserId,
}: {
  inactive: User[];
  fmtDate: (value: string | null | undefined) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
  activateUser: (userId: number) => void;
  deleteUser: (userId: number) => void;
  pendingDeleteUserId: number | null;
}) {
  if (inactive.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 dark:border-white/10 sm:px-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t("users.pendingActivation")}</h2>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{inactive.length}</span>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-white/10">
        {inactive.map((user) => (
          <div key={user.id} className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm/6 font-semibold text-gray-900 dark:text-white">{user.name || user.email || t("users.userFallback", { id: user.id })}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="truncate">{user.email || "—"}</span>
                {user.created_at ? <span>{t("users.registered")}: {fmtDate(user.created_at)}</span> : null}
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={() => activateUser(user.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 px-3 py-1.5 text-sm text-green-700 transition hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20"
              >
                <Check className="h-4 w-4" /> {t("users.activate")}
              </button>
              <button
                onClick={() => deleteUser(user.id)}
                disabled={pendingDeleteUserId === user.id}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:hover:bg-red-900/20"
              >
                {pendingDeleteUserId === user.id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                ) : (
                  <Trash2 className="h-4 w-4 text-red-400" />
                )}
              </button>
            </div>
          </div>
        ))}
        </div>
      </div>
    </section>
  );
}

export function ActiveUsersSection({
  loading,
  active,
  currentUser,
  expandedUser,
  setExpandedUser,
  permissionLabels,
  fmtDateTime,
  t,
  updateUser,
  deleteUser,
  pendingDeleteUserId,
}: {
  loading: boolean;
  active: User[];
  currentUser: User;
  expandedUser: number | null;
  setExpandedUser: (userId: number | null) => void;
  permissionLabels: Record<(typeof ALL_PERMISSIONS)[number], string>;
  fmtDateTime: (value: string | null | undefined) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
  updateUser: (userId: number, data: Record<string, unknown>) => void;
  deleteUser: (userId: number) => void;
  pendingDeleteUserId: number | null;
}) {
  return (
    <section className="space-y-3">
      <div className="overflow-hidden rounded-xl bg-white shadow-xs outline outline-1 -outline-offset-1 outline-gray-900/5 dark:bg-gray-800/50 dark:outline-white/10">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 dark:border-white/10 sm:px-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t("users.activeUsers")}</h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">{active.length}</span>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-white/5">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : (
          active.map((user) => {
            const isMe = user.id === currentUser.id;
            const isExpanded = expandedUser === user.id;
            const userPerms = user.permissions || [];
            const activeCheckoutCount = user.active_checkouts || 0;
            return (
              <div key={user.id} className="overflow-hidden">
                <div className="px-4 py-4 hover:bg-gray-50 dark:hover:bg-white/2.5 sm:px-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <button
                      onClick={() => !isMe && setExpandedUser(isExpanded ? null : user.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative mt-0.5 shrink-0">
                          <UserAvatar name={user.name || user.email || undefined} avatarUrl={user.avatar_url} size="md" />
                          {user.is_admin ? (
                            <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-500 text-white outline outline-2 outline-gray-800/50 dark:outline-gray-900">
                              <Shield className="h-2.5 w-2.5" />
                            </span>
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm/6 font-semibold text-gray-900 dark:text-white">
                              {user.name || user.email || t("users.userFallback", { id: user.id })}
                            </p>
                            {user.last_session_online ? (
                              <span className={clsx(userBadgeClass, "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300")}>
                                <Wifi className="mr-1 h-3.5 w-3.5" />
                                {t("users.connected")}
                              </span>
                            ) : null}
                            {activeCheckoutCount > 0 ? (
                              <span className={clsx(userBadgeClass, "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300")}>
                                {t("users.openCheckouts", { count: activeCheckoutCount })}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                            <span className="truncate">{user.email || t("users.noEmail")}</span>
                            {!user.is_admin && !isMe ? (
                              <span>{t("users.permissionsCount", { current: userPerms.length, total: ALL_PERMISSIONS.length })}</span>
                            ) : null}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                            <span>{t("users.registered")}: {user.created_at ? fmtDateTime(user.created_at) : "—"}</span>
                            <span>{t("users.lastSignedIn")}: {user.last_login ? fmtDateTime(user.last_login) : "—"}</span>
                          </div>
                        </div>
                      </div>
                    </button>

                    {!isMe ? (
                      <div className="flex items-center gap-2 self-start xl:ml-2">
                        <button onClick={() => setExpandedUser(isExpanded ? null : user.id)} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/10">
                          <ChevronDown className={`h-4 w-4 text-gray-400 transition ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                        <button
                          onClick={() => deleteUser(user.id)}
                          disabled={pendingDeleteUserId === user.id}
                          className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:hover:bg-red-900/20"
                        >
                          {pendingDeleteUserId === user.id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-red-400" />
                          )}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                {isExpanded ? (
                  <div className="border-t border-gray-100 px-4 pb-5 pt-5 dark:border-white/10 sm:px-6">
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.displayName")}</label>
                            <input
                              defaultValue={user.name || ""}
                              onBlur={(e) => {
                                if (e.target.value !== (user.name || "")) updateUser(user.id, { display_name: e.target.value });
                              }}
                              className={userInputClass}
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.email")}</label>
                            <input
                              defaultValue={user.email || ""}
                              onBlur={(e) => {
                                if (e.target.value !== (user.email || "")) updateUser(user.id, { email: e.target.value });
                              }}
                              className={userInputClass}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 dark:border-white/10 sm:grid-cols-2">
                          <label className="flex items-center justify-between gap-4 py-1">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{t("users.active")}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateUser(user.id, { is_active: !user.is_active })}
                              className={`${userSwitchBaseClass} ${user.is_active ? "bg-indigo-600 outline-indigo-600 dark:bg-indigo-500 dark:outline-indigo-500" : "bg-gray-200 outline-gray-300 dark:bg-white/10 dark:outline-white/10"}`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${user.is_active ? "translate-x-6" : "translate-x-1"}`} />
                            </button>
                          </label>
                          <label className="flex items-center justify-between gap-4 py-1">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{t("users.administrator")}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateUser(user.id, { is_admin: !user.is_admin })}
                              className={`${userSwitchBaseClass} ${user.is_admin ? "bg-indigo-600 outline-indigo-600 dark:bg-indigo-500 dark:outline-indigo-500" : "bg-gray-200 outline-gray-300 dark:bg-white/10 dark:outline-white/10"}`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${user.is_admin ? "translate-x-6" : "translate-x-1"}`} />
                            </button>
                          </label>
                        </div>

                        <div className="border-t border-gray-100 pt-4 dark:border-white/10">
                          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                            <UserMeta label={t("users.registered")} value={user.created_at ? fmtDateTime(user.created_at) : "—"} />
                            <UserMeta label={t("users.lastSignedIn")} value={user.last_login ? fmtDateTime(user.last_login) : "—"} />
                            <UserMeta label={t("users.lastDeviceSession")} value={user.last_session_seen ? fmtDateTime(user.last_session_seen) : "—"} />
                            <UserMeta label={t("users.device")} value={user.last_device || "—"} />
                            <UserMeta label={t("users.currentIp")} value={user.current_ip || "—"} />
                            <UserMeta label="IP" value={user.last_ip || "—"} />
                            <div className="sm:col-span-2">
                              <UserMeta label={t("users.appleSub")} value={user.sub || "—"} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {!user.is_admin ? (
                        <div className="border-t border-gray-100 pt-4 dark:border-white/10">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                              <KeyRound className="h-4 w-4 text-gray-400" />
                              {t("settings.permissions")}
                            </div>
                            <div className="flex gap-3">
                              <button onClick={() => updateUser(user.id, { permissions: [...ALL_PERMISSIONS] })} className="text-xs text-blue-500 hover:underline">{t("users.enableAll")}</button>
                              <button onClick={() => updateUser(user.id, { permissions: [] })} className="text-xs text-gray-400 hover:underline">{t("users.removeAll")}</button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
                            {ALL_PERMISSIONS.map((permission) => {
                              const checked = userPerms.includes(permission);
                              return (
                                <div
                                  key={permission}
                                  className="flex items-center justify-between gap-3 border-b border-gray-100 py-2.5 dark:border-white/10"
                                >
                                  <span className={clsx("text-xs", checked ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400")}>
                                    {permissionLabels[permission]}
                                  </span>
                                  <button
                                    type="button"
                                    aria-pressed={checked}
                                    aria-label={permissionLabels[permission]}
                                    onClick={() => {
                                      const next = checked ? userPerms.filter((entry) => entry !== permission) : [...userPerms, permission];
                                      updateUser(user.id, { permissions: next });
                                    }}
                                    className={`${userSwitchBaseClass} ${checked ? "bg-indigo-600 outline-indigo-600 dark:bg-indigo-500 dark:outline-indigo-500" : "bg-gray-200 outline-gray-300 dark:bg-white/10 dark:outline-white/10"}`}
                                  >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? "translate-x-6" : "translate-x-1"}`} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
        </div>
      </div>
    </section>
  );
}
