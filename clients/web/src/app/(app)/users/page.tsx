"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDeleteFlow, ConfirmDelete } from "@/components/ui/confirm-delete";
import { api, type User } from "@/lib/api";
import { fetchWithSession } from "@/lib/api-helpers";
import { useApp } from "@/lib/app-context";
import { ChevronRight } from "lucide-react";
import { ActiveUsersSection, PendingUsersSection } from "@/app/(app)/users/users-page-sections";
import {
  applyUpdatedCurrentUser,
  applyUpdatedUserList,
  buildPermissionLabels,
  fetchUsersPageData,
} from "@/app/(app)/users/users-page-utils";

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
      const { me, all } = await fetchUsersPageData();
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
        const { me, all } = await fetchUsersPageData();
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

  const applyUpdatedUser = useCallback((updatedUser: User) => {
    setUsers((prev) => applyUpdatedUserList(prev, updatedUser));
    setCurrentUser((prev) => applyUpdatedCurrentUser(prev, updatedUser));
  }, []);

  const updateUser = async (userId: number, data: Record<string, unknown>) => {
    try {
      const response = await fetchWithSession(`${api.baseURL}/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) return;
      const updatedUser = (await response.json()) as User;
      applyUpdatedUser(updatedUser);
    } catch {}
  };

  const activateUser = async (userId: number) => {
    try {
      const response = await fetchWithSession(`${api.baseURL}/api/users/${userId}/activate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) return;
      const updatedUser = (await response.json()) as User;
      applyUpdatedUser(updatedUser);
    } catch {}
  };

  const deleteUser = (userId: number) => {
    const user = users.find((u) => u.id === userId);
    deleteFlow.requestDelete(userId, user?.name || user?.email || t("users.userFallback", { id: userId }), "user");
  };

  if (!currentUser?.is_admin) {
    return <p className="text-center text-gray-500 py-10">{t("users.adminOnly")}</p>;
  }

  const inactive = users.filter((u) => !u.is_active);
  const active = users.filter((u) => u.is_active);
  const connected = active.filter((u) => u.last_session_online).length;
  const admins = active.filter((u) => u.is_admin).length;
  const permissionLabels = buildPermissionLabels(t);
  const pendingDeleteUserId = deleteFlow.pending?.type === "user" ? deleteFlow.pending.id : null;

  return (
    <div className="space-y-8">
      <div className="mb-4 text-center sm:text-left lg:mb-8">
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
              <li className="text-gray-500 dark:text-gray-400">{t("nav.systemGroup")}</li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRight className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-900 dark:text-white">{t("users.title")}</li>
            </ol>
          </nav>
          <h2 className="text-2xl font-bold">{t("users.title")}</h2>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
        <div className="grid grid-cols-2 divide-x divide-y divide-gray-200 dark:divide-white/10 xl:grid-cols-4 xl:divide-y-0">
          <div className="px-4 py-4 sm:px-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("users.totalActive")}</div>
            <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{active.length}</div>
          </div>
          <div className="px-4 py-4 sm:px-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("users.pendingUsers")}</div>
            <div className="mt-2 text-xl font-semibold text-amber-600 dark:text-amber-300">{inactive.length}</div>
          </div>
          <div className="px-4 py-4 sm:px-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("users.adminUsers")}</div>
            <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{admins}</div>
          </div>
          <div className="px-4 py-4 sm:px-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("users.connectedUsers")}</div>
            <div className="mt-2 text-xl font-semibold text-emerald-600 dark:text-emerald-300">{connected}</div>
          </div>
        </div>
      </div>

      <PendingUsersSection inactive={inactive} fmtDate={fmtDate} t={t} activateUser={activateUser} deleteUser={deleteUser} pendingDeleteUserId={pendingDeleteUserId} />

      <ActiveUsersSection
        loading={loading}
        active={active}
        currentUser={currentUser}
        expandedUser={expandedUser}
        setExpandedUser={setExpandedUser}
        permissionLabels={permissionLabels}
        fmtDateTime={fmtDateTime}
        t={t}
        updateUser={updateUser}
        deleteUser={deleteUser}
        pendingDeleteUserId={pendingDeleteUserId}
      />

      {/* Confirm Delete */}
      {deleteFlow.confirm && (
        <ConfirmDelete
          name={deleteFlow.confirm.name}
          t={t}
          onConfirm={async () => {
            try {
              await fetchWithSession(`${api.baseURL}/api/users/${deleteFlow.confirm!.id}`, {
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
