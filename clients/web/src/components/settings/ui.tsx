"use client";

import { type ReactNode } from "react";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { ChevronsUpDown } from "lucide-react";
import { Check, type LucideIcon } from "lucide-react";

type SettingsAccent = "blue" | "emerald";

// Both accent names give the app's indigo: a setting that is chosen or
// switched on looks the same everywhere. Green is left to states such as
// "active" or "reachable".
const indigoToggle = "bg-indigo-600 dark:bg-indigo-500";
const toggleActiveClasses: Record<SettingsAccent, string> = { blue: indigoToggle, emerald: indigoToggle };

export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: ReactNode;
  value: string | number;
  onChange: (value: string | number) => void;
  options: { value: string | number; label: ReactNode }[];
  hint?: ReactNode;
}) {
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div>
      <label className="block text-sm/6 font-medium text-gray-900 dark:text-white">{label}</label>
      <Listbox value={selected?.value} onChange={onChange}>
        <div className="mt-2 block">
          <ListboxButton className="grid w-full cursor-default grid-cols-1 rounded-md bg-white py-1.5 pr-2 pl-3 text-left text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:focus-visible:outline-indigo-500">
            <span className="col-start-1 row-start-1 truncate pr-6">{selected?.label}</span>
            <ChevronsUpDown aria-hidden="true" className="col-start-1 row-start-1 size-5 self-center justify-self-end text-gray-400 sm:size-4" />
          </ListboxButton>

          <ListboxOptions
            anchor="bottom start"
            transition
            className="z-20 mt-1 max-h-60 w-[var(--button-width)] overflow-auto rounded-md bg-white py-1 text-base outline-1 -outline-offset-1 outline-gray-300 transition duration-100 ease-in data-[closed]:opacity-0 sm:text-sm dark:bg-gray-800 dark:outline-white/10"
          >
            {options.map((option) => (
              <ListboxOption
                key={String(option.value)}
                value={option.value}
                className="group relative cursor-default py-2 pr-4 pl-8 text-gray-900 select-none focus:bg-indigo-600 focus:text-white focus:outline-hidden dark:text-white"
              >
                <span className="block truncate font-normal group-data-[selected]:font-semibold">{option.label}</span>
                <span className="absolute inset-y-0 left-0 flex items-center pl-1.5 text-indigo-500 group-not-data-[selected]:hidden group-focus:text-white">
                  <Check className="size-5" />
                </span>
              </ListboxOption>
            ))}
          </ListboxOptions>
        </div>
      </Listbox>
      {hint ? <p className="mt-2 text-sm/6 text-gray-500 dark:text-gray-400">{hint}</p> : null}
    </div>
  );
}

/**
 * One option among a few, or one entry of a short list to pick from: an icon,
 * a title and a line of explanation, as on the attachment tiles. The chosen
 * one is framed in indigo, its icon filled, and it carries a check mark.
 */
export function ChoiceTile({
  active,
  title,
  description,
  onClick,
  icon: Icon,
  badge,
}: {
  active: boolean;
  title: ReactNode;
  description?: ReactNode;
  onClick: () => void;
  icon?: LucideIcon;
  /** A state such as "active" or "default", shown next to the title. */
  badge?: ReactNode;
  /** Kept for callers; every tile uses the app's indigo. */
  accent?: SettingsAccent;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-lg p-3 text-left transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-500 ${
        active
          ? "bg-indigo-50 outline-2 -outline-offset-2 outline-indigo-600 dark:bg-indigo-500/10 dark:outline-indigo-500"
          : "bg-white outline-1 -outline-offset-1 outline-gray-200 hover:bg-gray-50 hover:outline-indigo-500 dark:bg-white/5 dark:outline-white/10 dark:hover:bg-white/10 dark:hover:outline-indigo-400"
      }`}
    >
      {Icon ? (
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition ${
            active
              ? "bg-indigo-600 text-white dark:bg-indigo-500"
              : "bg-gray-100 text-gray-500 group-hover:bg-indigo-600 group-hover:text-white dark:bg-white/10 dark:text-gray-400 dark:group-hover:bg-indigo-500"
          }`}
        >
          <Icon aria-hidden="true" className="size-4" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{title}</span>
          {badge ? <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{badge}</span> : null}
        </span>
        {description ? <span className="mt-0.5 block text-xs break-words text-gray-500 dark:text-gray-400">{description}</span> : null}
      </span>
      <Check aria-hidden="true" className={`size-4 shrink-0 text-indigo-600 dark:text-indigo-400 ${active ? "" : "invisible"}`} />
    </button>
  );
}

export function ToggleRow({
  title,
  description,
  checked,
  onToggle,
  accent = "blue",
}: {
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onToggle: () => void;
  accent?: SettingsAccent;
}) {
  return (
    <label className="group relative flex flex-row-reverse items-center justify-between gap-3 border-b border-gray-200 py-3 last:border-b-0 dark:border-white/10">
      <button
        type="button"
        onClick={onToggle}
        className={`relative h-6 w-10 flex-none rounded-full transition-all duration-150 ease-out ${checked ? toggleActiveClasses[accent] : "bg-gray-300 dark:bg-gray-700"}`}
      >
        <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform duration-150 ease-out ${checked ? "translate-x-4" : ""}`} />
      </button>
      <span className="font-medium">
        <span className="block text-sm">{title}</span>
        {description ? <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{description}</span> : null}
      </span>
    </label>
  );
}
