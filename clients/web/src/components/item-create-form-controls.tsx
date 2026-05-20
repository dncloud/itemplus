"use client";

import clsx from "clsx";

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
              <svg viewBox="0 0 12 12" fill="none" className="size-3 text-gray-400 dark:text-gray-600">
                <path d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span
              aria-hidden="true"
              className={clsx(
                "absolute inset-0 flex size-full items-center justify-center transition-opacity duration-100 ease-out",
                checked ? "opacity-100 duration-200 ease-in" : "opacity-0",
              )}
            >
              <svg viewBox="0 0 12 12" fill="currentColor" className="size-3 text-indigo-600 dark:text-indigo-500">
                <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
              </svg>
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
