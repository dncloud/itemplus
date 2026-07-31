"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { InventoryMovement } from "@/lib/api";

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const sectionClass =
    "overflow-hidden rounded-xl bg-white shadow-xs outline outline-1 -outline-offset-1 outline-gray-900/5 dark:bg-gray-800/50 dark:outline-white/10";
  return (
    <div className="space-y-2">
      <p className="font-semibold text-white">{title}</p>
      <section className={sectionClass}>{children}</section>
    </div>
  );
}

function movementDeltaLabel(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function isNeutralLoanMovement(movement: InventoryMovement) {
  const isLoan = movement.movement_type === "checked_out" || movement.movement_type === "returned";
  return isLoan && movement.quantity_delta === 0 && movement.quantity_before === movement.quantity_after;
}

function movementUserLabel(movement: InventoryMovement) {
  if (movement.movement_type === "checked_out" || movement.movement_type === "returned") {
    return movement.checkout_user_name || movement.created_by_name || "—";
  }
  return movement.created_by_name || "—";
}

export function ItemInventoryMovementsPreview({
  itemID,
  movements,
  fmtDate,
  t,
}: {
  itemID: number;
  movements: InventoryMovement[];
  fmtDate: (s: string | null | undefined) => string;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  if (!movements.length) return null;
  return (
    <DetailSection title={t("inventoryMovements.recent")}>
      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {movements.slice(0, 5).map((movement) => (
          <div key={`${movement.realm}-${movement.id}`} className="grid grid-cols-1 gap-2 px-6 py-3 text-sm sm:grid-cols-[minmax(0,1.8fr)_80px_120px_minmax(0,1fr)] sm:items-center sm:gap-4">
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-white">{t(`inventoryMovements.movementType.${movement.movement_type}`)}</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{fmtDate(movement.created_at)}</p>
            </div>
            <p
              className={`font-semibold ${
                isNeutralLoanMovement(movement)
                  ? "text-gray-500 dark:text-gray-400"
                  : movement.quantity_delta > 0
                    ? "text-emerald-600 dark:text-emerald-300"
                    : movement.quantity_delta < 0
                      ? "text-rose-600 dark:text-rose-300"
                      : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {isNeutralLoanMovement(movement) ? "—" : movementDeltaLabel(movement.quantity_delta)}
            </p>
            <p className="text-gray-600 dark:text-gray-300">
              {movement.quantity_before} → {movement.quantity_after}
            </p>
            <p className="min-w-0 truncate text-gray-500 dark:text-gray-400 sm:text-right" title={movementUserLabel(movement)}>
              {movementUserLabel(movement)}
            </p>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 px-6 py-3 dark:border-white/5">
        <Link
          href={`/inventory-movements?realm=${movements[0]?.realm || "archive"}&item_id=${itemID}`}
          className="text-sm font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {t("inventoryMovements.all")}
        </Link>
      </div>
    </DetailSection>
  );
}
