"use client";

import { api, type User } from "@/lib/api";
import { ALL_PERMISSIONS } from "@/app/(app)/users/users-page-sections";

export async function fetchUsersPageData() {
  const [me, all] = await Promise.all([api.getMe(), api.getUsers()]);
  return { me, all };
}

export function buildPermissionLabels(
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  return Object.fromEntries(
    ALL_PERMISSIONS.map((permission) => [permission, t(`users.permissions.${permission}`)]),
  ) as Record<(typeof ALL_PERMISSIONS)[number], string>;
}

export function applyUpdatedUserList(users: User[], updatedUser: User) {
  return users.map((user) => (user.id === updatedUser.id ? updatedUser : user));
}

export function applyUpdatedCurrentUser(currentUser: User | null, updatedUser: User) {
  return currentUser?.id === updatedUser.id ? updatedUser : currentUser;
}
