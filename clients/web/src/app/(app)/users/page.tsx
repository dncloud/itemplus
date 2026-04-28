"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDeleteFlow, ConfirmDelete } from "@/components/confirm-delete";
import { api, type User } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { ShieldCheckIcon, UserIcon, CheckIcon, TrashIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

const ALL_PERMISSIONS = [
  { key: "items.read", label: "Items ansehen" },
  { key: "items.write", label: "Items erstellen/bearbeiten" },
  { key: "items.delete", label: "Items löschen" },
  { key: "attachments.write", label: "Fotos & Anhänge" },
  { key: "checkout.manage", label: "Ausleihe verwalten" },
  { key: "print", label: "QR-Codes drucken" },
  { key: "categories.read", label: "Kategorien ansehen" },
  { key: "categories.write", label: "Kategorien bearbeiten" },
  { key: "categories.delete", label: "Kategorien löschen" },
  { key: "locations.read", label: "Standorte ansehen" },
  { key: "locations.write", label: "Standorte bearbeiten" },
  { key: "locations.delete", label: "Standorte löschen" },
  { key: "vendors.read", label: "Hersteller/Händler ansehen" },
  { key: "vendors.write", label: "Hersteller/Händler bearbeiten" },
  { key: "vendors.delete", label: "Hersteller/Händler löschen" },
];

export default function UsersPage() {
  const { realm, fmtDate, fmtDateTime, t } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);

  const loadingRef = useRef(false);
  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const [me, all] = await Promise.all([api.getMe(), api.getUsers()]);
      setCurrentUser(me);
      setUsers(all);
    } catch {}
    setLoading(false);
    loadingRef.current = false;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        const [me, all] = await Promise.all([api.getMe(), api.getUsers()]);
        if (!cancelled) {
          setCurrentUser(me);
          setUsers(all);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    void loadInitial();
    return () => { cancelled = true; };
  }, [realm]);

  const deleteFlow = useDeleteFlow({
    realm,
    onDeleted: useCallback(() => {
      load();
    }, [load]),
  });

  const updateUser = async (userId: number, data: Record<string, unknown>) => {
    try {
      await fetch(`${api.baseURL}/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      load();
    } catch {}
  };

  const activateUser = async (userId: number) => {
    try {
      await fetch(`${api.baseURL}/api/users/${userId}/activate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      load();
    } catch {}
  };

  const deleteUser = (userId: number) => {
    const user = users.find((u) => u.id === userId);
    deleteFlow.requestDelete(userId, user?.name || user?.email || `User #${userId}`, "user");
  };

  if (!currentUser?.is_admin) {
    return <p className="text-center text-gray-500 py-10">{t("users.adminOnly")}</p>;
  }

  const inactive = users.filter((u) => !u.is_active);
  const active = users.filter((u) => u.is_active);

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-2xl font-bold">{t("users.title")}</h1>

      {/* Pending Activations */}
      {inactive.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {t("users.pendingActivation")}
            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium px-2 py-0.5 rounded-full">{inactive.length}</span>
          </h2>
          <div className="space-y-2">
            {inactive.map((user) => (
              <div key={user.id} className="flex items-center gap-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4">
                <div className="flex-1">
                  <p className="text-sm font-medium">{user.name || user.email || `User #${user.id}`}</p>
                  {user.email && <p className="text-xs text-gray-500">{user.email}</p>}
                  {user.created_at && <p className="text-xs text-gray-400">{t("users.registered")}: {fmtDate(user.created_at)}</p>}
                </div>
                <button
                  onClick={() => activateUser(user.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-green-500 text-white hover:bg-green-600 transition"
                >
                  <CheckIcon className="h-4 w-4" /> {t("users.activate")}
                </button>
                <button onClick={() => deleteUser(user.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                  <TrashIcon className="h-4 w-4 text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Users */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("users.activeUsers")} ({active.length})</h2>
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : active.map((user) => {
            const isMe = user.id === currentUser.id;
            const isExpanded = expandedUser === user.id;
            const userPerms = user.permissions || [];
            return (
              <div key={user.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                <div className="flex items-center gap-4 px-4 py-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${user.is_admin ? "bg-red-100 dark:bg-red-900/30" : "bg-gray-100 dark:bg-gray-800"}`}>
                    {user.is_admin ? <ShieldCheckIcon className="h-5 w-5 text-red-500" /> : <UserIcon className="h-5 w-5 text-gray-400" />}
                  </div>
                  <button onClick={() => !isMe && setExpandedUser(isExpanded ? null : user.id)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">
                      {user.name || user.email || `User #${user.id}`}
                      {isMe && <span className="ml-2 text-xs text-gray-400">{t("users.you")}</span>}
                      {user.is_admin ? <span className="ml-2 text-xs text-red-500">Admin</span> : null}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user.email || "—"}
                      {!user.is_admin && !isMe && (
                        <span className="ml-2 text-gray-400">· {userPerms.length}/{ALL_PERMISSIONS.length} Rechte</span>
                      )}
                    </p>
                    {user.created_at && (
                      <p className="text-[11px] text-gray-400">
                        {t("users.registered")}: {fmtDateTime(user.created_at)}
                      </p>
                    )}
                    {user.last_login && (
                      <div className="mt-1.5 space-y-0.5 text-[11px] text-gray-400">
                        <p>{t("users.lastOnline")} {fmtDateTime(user.last_login)}</p>
                        {user.last_ip && <p>IP: {user.last_ip}</p>}
                        {user.last_device && <p>{t("users.device")}: {user.last_device}</p>}
                      </div>
                    )}
                  </button>
                  {!isMe && (
                    <>
                      <button onClick={() => setExpandedUser(isExpanded ? null : user.id)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                        <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                      <button onClick={() => deleteUser(user.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                        <TrashIcon className="h-4 w-4 text-red-400" />
                      </button>
                    </>
                  )}
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 space-y-4">
                    {/* Profile fields */}
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">{t("settings.displayName")}</label>
                          <input
                            defaultValue={user.name || ""}
                            onBlur={(e) => { if (e.target.value !== (user.name || "")) updateUser(user.id, { display_name: e.target.value }); }}
                            className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">{t("settings.email")}</label>
                          <input
                            defaultValue={user.email || ""}
                            onBlur={(e) => { if (e.target.value !== (user.email || "")) updateUser(user.id, { email: e.target.value }); }}
                            className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-3 cursor-pointer text-sm text-gray-700 dark:text-gray-400">
                          <span>Aktiv</span>
                          <button type="button" onClick={() => updateUser(user.id, { is_active: !user.is_active })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${user.is_active ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${user.is_active ? "translate-x-6" : "translate-x-1"}`} />
                          </button>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer text-sm text-gray-700 dark:text-gray-400">
                          <span>Administrator</span>
                          <button type="button" onClick={() => updateUser(user.id, { is_admin: !user.is_admin })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${user.is_admin ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${user.is_admin ? "translate-x-6" : "translate-x-1"}`} />
                          </button>
                        </label>
                      </div>
                    </div>

                    {/* Permissions (only for non-admins) */}
                    {!user.is_admin && (
                      <>
                        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 grid grid-cols-2 gap-2">
                          {ALL_PERMISSIONS.map(({ key, label }) => {
                            const checked = userPerms.includes(key);
                            return (
                              <label key={key} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1.5 transition">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const next = checked ? userPerms.filter((p) => p !== key) : [...userPerms, key];
                                    updateUser(user.id, { permissions: next });
                                  }}
                                  className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                                />
                                <span className={checked ? "text-gray-900 dark:text-white" : "text-gray-500"}>{label}</span>
                              </label>
                            );
                          })}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateUser(user.id, { permissions: ALL_PERMISSIONS.map((p) => p.key) })}
                            className="text-xs text-blue-500 hover:underline"
                          >Alle aktivieren</button>
                          <button
                            onClick={() => updateUser(user.id, { permissions: [] })}
                            className="text-xs text-gray-400 hover:underline"
                          >Alle entfernen</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Confirm Delete */}
      {deleteFlow.confirm && (
        <ConfirmDelete
          name={deleteFlow.confirm.name}
          t={t}
          onConfirm={async () => {
            try {
              await fetch(`${api.baseURL}/api/users/${deleteFlow.confirm!.id}`, {
                method: "DELETE",
                credentials: "include",
              });
              load();
            } catch {}
            deleteFlow.cancelConfirm();
          }}
          onCancel={() => deleteFlow.cancelConfirm()}
        />
      )}
    </div>
  );
}
