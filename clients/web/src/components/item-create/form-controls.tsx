"use client";

import clsx from "clsx";
import { Check, X } from "lucide-react";

export function BooleanToggle({
  label,
  yesLabel,
  noLabel,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  yesLabel: string;
  noLabel: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div>
      <span className="block text-sm/6 font-medium text-gray-900 dark:text-white">{label}</span>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div
          className={clsx(
            "group relative inline-flex w-11 shrink-0 rounded-full p-0.5 inset-ring inset-ring-gray-900/5 outline-offset-2 outline-indigo-600 transition-colors duration-200 ease-in-out has-focus-within:outline-2 dark:outline-indigo-500",
            disabled && "opacity-60",
            checked
              ? "bg-indigo-600 dark:bg-indigo-500 dark:inset-ring-white/10"
              : "bg-gray-200 dark:bg-white/5 dark:inset-ring-white/10",
          )}
        >
          <span
            className={clsx(
              "relative size-5 rounded-full bg-white shadow-xs ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out",
              checked && "translate-x-5",
            )}
          >
            <span
              aria-hidden="true"
              className={clsx(
                "absolute inset-0 flex size-full items-center justify-center transition-opacity duration-200 ease-in",
                checked ? "opacity-0 duration-100 ease-out" : "opacity-100",
              )}
            >
              <X className="size-3 text-gray-400 dark:text-gray-600" />
            </span>
            <span
              aria-hidden="true"
              className={clsx(
                "absolute inset-0 flex size-full items-center justify-center transition-opacity duration-100 ease-out",
                checked ? "opacity-100 duration-200 ease-in" : "opacity-0",
              )}
            >
              <Check className="size-3 text-indigo-600 dark:text-indigo-500" />
            </span>
          </span>
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            className="absolute inset-0 size-full appearance-none focus:outline-hidden disabled:cursor-not-allowed"
          />
        </div>
        <div className="text-sm">
          <span className="font-medium text-gray-900 dark:text-white">{checked ? yesLabel : noLabel}</span>
        </div>
      </div>
    </div>
  );
}

export function ConsumableToggle({
  t,
  checked,
  onChange,
}: {
  t: (key: string) => string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <BooleanToggle
      label={t("items.consumable")}
      yesLabel={t("common.yes")}
      noLabel={t("common.no")}
      checked={checked}
      onChange={onChange}
    />
  );
}
