"use client";

import { type ReactNode } from "react";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { ChevronsUpDown } from "lucide-react";
import { Check } from "lucide-react";

type SettingsAccent = "blue" | "emerald";

const choiceTileActiveClasses: Record<SettingsAccent, string> = {
  blue: "border-blue-400 bg-blue-50/60 text-blue-700 dark:border-blue-600 dark:bg-blue-900/10 dark:text-blue-300",
  emerald: "border-emerald-400 bg-emerald-50/60 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-300",
};

const choiceTileDotClasses: Record<SettingsAccent, string> = {
  blue: "border-blue-500 bg-blue-500",
  emerald: "border-emerald-500 bg-emerald-500",
};

const toggleActiveClasses: Record<SettingsAccent, string> = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
};

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

export function ChoiceTile({
  active,
  title,
  description,
  onClick,
  accent = "blue",
}: {
  active: boolean;
  title: ReactNode;
  description?: ReactNode;
  onClick: () => void;
  accent?: SettingsAccent;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition ${
        active
          ? choiceTileActiveClasses[accent]
          : "border-gray-200 bg-transparent hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        {description ? <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{description}</span> : null}
      </span>
      <span className={`mt-0.5 h-5 w-5 rounded-full border transition ${active ? choiceTileDotClasses[accent] : "border-gray-300 dark:border-gray-600"}`}>
        {active ? <span className="block h-full w-full scale-50 rounded-full bg-white" /> : null}
      </span>
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
