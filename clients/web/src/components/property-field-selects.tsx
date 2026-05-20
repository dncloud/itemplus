"use client";

import { useState } from "react";
import {
  DropdownChevron,
  flatSelectedBadgeCls,
  selectButtonCls,
  selectOptionCls,
  selectOptionsCls,
  useDismissibleDropdown,
} from "@/components/property-field-dropdown-base";

export function SelectDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useDismissibleDropdown(open, () => setOpen(false));

  return (
    <div ref={wrapperRef} className="relative mt-2">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={selectButtonCls}>
        <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 pr-6">
          <span className={`size-2 rounded-full ${value ? "bg-indigo-500" : "bg-gray-300 dark:bg-gray-600"}`} />
          <span className="truncate">{value || label}</span>
        </span>
        <DropdownChevron />
      </button>

      {open ? (
        <div role="listbox" className={selectOptionsCls}>
          {options.map((option) => {
            const selected = option === value;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(selected ? "" : option);
                  setOpen(false);
                }}
                className={selectOptionCls}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`size-2 rounded-full ${selected ? "bg-indigo-500" : "bg-gray-300 group-hover:bg-white/70 dark:bg-gray-600 dark:group-hover:bg-white/70"}`} />
                  <span className={`block truncate ${selected ? "font-semibold" : "font-normal"}`}>{option}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function MultiSelectDropdown({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useDismissibleDropdown(open, () => setOpen(false));

  const toggleValue = (option: string) => {
    onChange(values.includes(option) ? values.filter((entry) => entry !== option) : [...values, option]);
  };

  return (
    <div ref={wrapperRef} className="mt-2 space-y-2">
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(values.filter((entry) => entry !== value))}
              className={flatSelectedBadgeCls + " transition hover:opacity-80"}
            >
              <span aria-hidden="true" className="inline-flex w-1.5" />
              {value}
              <span aria-hidden="true" className="inline-flex w-1.5" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={selectButtonCls}>
          <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 pr-6">
            <span className={`size-2 rounded-full ${values.length > 0 ? "bg-transparent" : "bg-gray-300 dark:bg-gray-600"}`} />
            <span className="truncate">{values.length > 0 ? `${values.length} ausgewählt` : label}</span>
          </span>
          <DropdownChevron />
        </button>

        {open ? (
          <div role="listbox" className={selectOptionsCls}>
            {options.map((option, index) => {
              const checked = values.includes(option);
              const inputId = `multiselect-${label}-${index}`;
              return (
                <label key={option} htmlFor={inputId} className="relative flex gap-3 px-3 py-2.5 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500">
                  <div className="min-w-0 flex-1 text-sm/6">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`size-2 rounded-full ${checked ? "bg-indigo-500" : "bg-gray-300 dark:bg-gray-600"}`} />
                      <span className="font-medium text-gray-900 dark:text-white">{option}</span>
                    </span>
                  </div>
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleValue(option)}
                    className="sr-only"
                  />
                </label>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
