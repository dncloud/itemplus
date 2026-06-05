"use client";
import { CheckIcon, ChevronDownIcon, ShieldCheckIcon, TrashIcon, UserIcon } from "@heroicons/react/24/outline";
import type { User } from "@/lib/api";

export const ALL_PERMISSIONS = [
  "items.read",
  "items.write",
  "items.delete",
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
export const userCheckboxClass = "rounded-sm border border-gray-300 bg-white text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-indigo-500";

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
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {t("users.pendingActivation")}
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{inactive.length}</span>
      </h2>
      <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/70 shadow-xs divide-y divide-amber-200 dark:border-amber-800 dark:bg-amber-900/10 dark:divide-amber-800">
        {inactive.map((user) => (
          <div key={user.id} className="flex items-center gap-4 px-4 py-4 sm:px-6">
            <div className="flex-1">
              <p className="text-sm/6 font-semibold text-gray-900 dark:text-white">{user.name || user.email || t("users.userFallback", { id: user.id })}</p>
              {user.email ? <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p> : null}
              {user.created_at ? <p className="text-xs text-gray-500 dark:text-gray-400">{t("users.registered")}: {fmtDate(user.created_at)}</p> : null}
            </div>
            <button
              onClick={() => activateUser(user.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 px-3 py-1.5 text-sm text-green-700 transition hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20"
            >
              <CheckIcon className="h-4 w-4" /> {t("users.activate")}
            </button>
            <button
              onClick={() => deleteUser(user.id)}
              disabled={pendingDeleteUserId === user.id}
              className="inline-flex items-center justify-center rounded-lg border border-amber-300 p-2 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-700 dark:hover:bg-red-900/20"
            >
              {pendingDeleteUserId === user.id ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
              ) : (
                <TrashIcon className="h-4 w-4 text-red-400" />
              )}
            </button>
          </div>
        ))}
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
      <h2 className="text-lg font-semibold">{t("users.activeUsers")} ({active.length})</h2>
      <div className="overflow-hidden bg-white shadow-xs outline outline-1 -outline-offset-1 outline-gray-900/5 divide-y divide-gray-100 sm:rounded-xl dark:bg-gray-800/50 dark:outline-white/10 dark:divide-white/5">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : (
          active.map((user) => {
            const isMe = user.id === currentUser.id;
            const isExpanded = expandedUser === user.id;
            const userPerms = user.permissions || [];
            return (
              <div key={user.id} className="overflow-hidden">
                <div className="flex items-center gap-4 px-4 py-5 hover:bg-gray-50 dark:hover:bg-white/2.5 sm:px-6">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${user.is_admin ? "bg-red-100 dark:bg-red-900/30" : "bg-gray-100 dark:bg-white/5"}`}>
                    {user.is_admin ? <ShieldCheckIcon className="h-5 w-5 text-red-500" /> : <UserIcon className="h-5 w-5 text-gray-400" />}
                  </div>
                  <button onClick={() => !isMe && setExpandedUser(isExpanded ? null : user.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm/6 font-semibold text-gray-900 dark:text-white">
                      {user.name || user.email || t("users.userFallback", { id: user.id })}
                      {isMe ? <span className="ml-2 text-xs text-gray-400">{t("users.you")}</span> : null}
                      {user.is_admin ? <span className="ml-2 text-xs text-red-500">{t("users.administrator")}</span> : null}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {user.email || "—"}
                      {!user.is_admin && !isMe ? (
                        <span className="ml-2 text-gray-400">· {t("users.permissionsCount", { current: userPerms.length, total: ALL_PERMISSIONS.length })}</span>
                      ) : null}
                    </p>
                    {user.created_at ? (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t("users.registered")}: {fmtDateTime(user.created_at)}
                      </p>
                    ) : null}
                    {user.last_login || user.last_session_seen ? (
                      <div className="mt-1.5 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {user.last_login ? <p>{t("users.lastSignedIn")} {fmtDateTime(user.last_login)}</p> : null}
                        {user.last_session_seen ? (
                          <p>
                            {t("users.lastDeviceSession")} {fmtDateTime(user.last_session_seen)}
                            {user.last_session_online ? <span className="ml-1 text-emerald-600 dark:text-emerald-400">({t("users.connected")})</span> : null}
                          </p>
                        ) : null}
                        {user.last_ip ? <p>IP: {user.last_ip}</p> : null}
                        {user.last_device ? <p>{t("users.device")}: {user.last_device}</p> : null}
                      </div>
                    ) : null}
                  </button>
                  {!isMe ? (
                    <>
                      <button onClick={() => setExpandedUser(isExpanded ? null : user.id)} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/10">
                        <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                      <button
                        onClick={() => deleteUser(user.id)}
                        disabled={pendingDeleteUserId === user.id}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:hover:bg-red-900/20"
                      >
                        {pendingDeleteUserId === user.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                        ) : (
                          <TrashIcon className="h-4 w-4 text-red-400" />
                        )}
                      </button>
                    </>
                  ) : null}
                </div>

                {isExpanded ? (
                  <div className="space-y-4 border-t border-gray-100 px-4 pb-4 pt-4 dark:border-white/10 sm:px-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
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
                      <div className="flex items-center gap-6">
                        <label className="flex cursor-pointer items-center gap-3 text-sm text-gray-700 dark:text-gray-400">
                          <span>{t("users.active")}</span>
                          <button
                            type="button"
                            onClick={() => updateUser(user.id, { is_active: !user.is_active })}
                            className={`${userSwitchBaseClass} ${user.is_active ? "bg-indigo-600 outline-indigo-600 dark:bg-indigo-500 dark:outline-indigo-500" : "bg-gray-200 outline-gray-300 dark:bg-white/10 dark:outline-white/10"}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${user.is_active ? "translate-x-6" : "translate-x-1"}`} />
                          </button>
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 text-sm text-gray-700 dark:text-gray-400">
                          <span>{t("users.administrator")}</span>
                          <button
                            type="button"
                            onClick={() => updateUser(user.id, { is_admin: !user.is_admin })}
                            className={`${userSwitchBaseClass} ${user.is_admin ? "bg-indigo-600 outline-indigo-600 dark:bg-indigo-500 dark:outline-indigo-500" : "bg-gray-200 outline-gray-300 dark:bg-white/10 dark:outline-white/10"}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${user.is_admin ? "translate-x-6" : "translate-x-1"}`} />
                          </button>
                        </label>
                      </div>
                    </div>

                    {!user.is_admin ? (
                      <>
                        <div className="border-t border-gray-100 pt-4 dark:border-white/10">
                          <div className="grid grid-cols-2 gap-2">
                            {ALL_PERMISSIONS.map((permission) => {
                              const checked = userPerms.includes(permission);
                              return (
                                <label key={permission} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs transition hover:bg-gray-100 dark:hover:bg-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      const next = checked ? userPerms.filter((entry) => entry !== permission) : [...userPerms, permission];
                                      updateUser(user.id, { permissions: next });
                                    }}
                                    className={userCheckboxClass}
                                  />
                                  <span className={checked ? "text-gray-900 dark:text-white" : "text-gray-500"}>{permissionLabels[permission]}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => updateUser(user.id, { permissions: [...ALL_PERMISSIONS] })} className="text-xs text-blue-500 hover:underline">{t("users.enableAll")}</button>
                          <button onClick={() => updateUser(user.id, { permissions: [] })} className="text-xs text-gray-400 hover:underline">{t("users.removeAll")}</button>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
