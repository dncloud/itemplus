"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDeleteFlow, ConfirmDelete } from "@/components/confirm-delete";
import { api, type User } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
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
      const response = await fetch(`${api.baseURL}/api/users/${userId}`, {
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
      const response = await fetch(`${api.baseURL}/api/users/${userId}/activate`, {
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
  const permissionLabels = buildPermissionLabels(t);
  const pendingDeleteUserId = deleteFlow.pending?.type === "user" ? deleteFlow.pending.id : null;

  return (
    <div className="space-y-8">
      <div className="mb-4 text-center sm:flex sm:items-center sm:justify-between sm:border-b sm:border-gray-200 sm:text-left lg:mb-8 dark:border-white/10">
        <div className="space-y-1 py-3">
          <nav className="text-sm font-medium dark:text-gray-100">
            <ol className="flex items-center justify-center sm:justify-start">
              <li>
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">
                  {t("nav.dashboard")}
                </Link>
              </li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronDownIcon className="inline-block h-5 w-5 -rotate-90" />
              </li>
              <li className="text-gray-500 dark:text-gray-400">{realm === "archive" ? t("realm.archive") : t("realm.collection")}</li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronDownIcon className="inline-block h-5 w-5 -rotate-90" />
              </li>
              <li className="text-gray-900 dark:text-white">{t("users.title")}</li>
            </ol>
          </nav>
          <h2 className="text-2xl font-bold">{t("users.title")}</h2>
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
