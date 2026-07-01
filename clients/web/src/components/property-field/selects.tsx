"use client";

import { useState } from "react";
import {
  DropdownChevron,
  flatSelectedBadgeCls,
  selectButtonCls,
  selectOptionCls,
  selectOptionsCls,
  useDismissibleDropdown,
} from "@/components/property-field/dropdown-base";

export function SelectDropdown({
  label,
  value,
  options,
  allowCustom = false,
  customLabel,
  customPlaceholder,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  allowCustom?: boolean;
  customLabel: string;
  customPlaceholder: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const wrapperRef = useDismissibleDropdown(open, () => setOpen(false));
  const isCustomValue = !!value && !options.includes(value);

  const applyCustomValue = () => {
    const trimmed = customValue.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setCustomValue("");
    setShowCustomInput(false);
  };

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
                  setShowCustomInput(false);
                  setCustomValue("");
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
          {allowCustom ? (
            <button
              type="button"
              onClick={() => {
                setCustomValue(isCustomValue ? value : "");
                setShowCustomInput(true);
                setOpen(false);
              }}
              className={selectOptionCls}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={`size-2 rounded-full ${isCustomValue ? "bg-indigo-500" : "bg-gray-300 group-hover:bg-white/70 dark:bg-gray-600 dark:group-hover:bg-white/70"}`} />
                <span className={`block truncate ${isCustomValue ? "font-semibold" : "font-normal"}`}>{customLabel}</span>
              </span>
            </button>
          ) : null}
        </div>
      ) : null}
      {allowCustom ? (
        <button
          type="button"
          onClick={() => {
            setCustomValue(isCustomValue ? value : "");
            setShowCustomInput(true);
          }}
          className="mt-2 inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          {customLabel}
        </button>
      ) : null}
      {allowCustom && showCustomInput ? (
        <div className="mt-2 flex gap-2">
          <input
            value={customValue}
            onChange={(event) => setCustomValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyCustomValue();
              }
            }}
            placeholder={customPlaceholder}
            className="block w-full rounded-md bg-white px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
          />
          <button
            type="button"
            onClick={applyCustomValue}
            className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
          >
            +
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function MultiSelectDropdown({
  label,
  values,
  options,
  allowCustom = false,
  customLabel,
  customPlaceholder,
  onChange,
}: {
  label: string;
  values: string[];
  options: string[];
  allowCustom?: boolean;
  customLabel: string;
  customPlaceholder: string;
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const wrapperRef = useDismissibleDropdown(open, () => setOpen(false));
  const customValues = values.filter((value) => !options.includes(value));

  const toggleValue = (option: string) => {
    const nextValues = values.includes(option) ? values.filter((entry) => entry !== option) : [...values, option];
    onChange(nextValues);
    if (nextValues.filter((entry) => !options.includes(entry)).length === 0) {
      setShowCustomInput(false);
      setCustomValue("");
    }
  };

  const applyCustomValue = () => {
    const trimmed = customValue.trim();
    if (!trimmed || values.includes(trimmed)) return;
    onChange([...values, trimmed]);
    setCustomValue("");
    setShowCustomInput(false);
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
            {allowCustom ? (
              <button
                type="button"
                onClick={() => {
                  setShowCustomInput(true);
                  setOpen(false);
                }}
                className={selectOptionCls}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`size-2 rounded-full ${customValues.length > 0 ? "bg-indigo-500" : "bg-gray-300 group-hover:bg-white/70 dark:bg-gray-600 dark:group-hover:bg-white/70"}`} />
                  <span className={`block truncate ${customValues.length > 0 ? "font-semibold" : "font-normal"}`}>{customLabel}</span>
                </span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {allowCustom && showCustomInput ? (
        <div className="flex gap-2">
          <input
            value={customValue}
            onChange={(event) => setCustomValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyCustomValue();
              }
            }}
            placeholder={customPlaceholder}
            className="block w-full rounded-md bg-white px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
          />
          <button
            type="button"
            onClick={applyCustomValue}
            className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
          >
            +
          </button>
        </div>
      ) : null}
    </div>
  );
}
