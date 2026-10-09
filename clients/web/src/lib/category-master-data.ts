import type { Category } from "@/lib/api";

export type MasterDataRole = "manufacturer" | "supplier" | "vendor" | "developer" | "publisher";

export function isMasterDataRoleVisible(category: Category | undefined, role: MasterDataRole) {
  const fallback = role === "manufacturer" || role === "supplier" || role === "vendor";
  const value = category?.[`show_${role}` as keyof Category];
  if (value === undefined || value === null) return fallback;
  return value === true || value === 1 || value === "1";
}
