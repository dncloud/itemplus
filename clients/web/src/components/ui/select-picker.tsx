"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useApp } from "@/lib/app-context";

interface SelectPickerProps {
  label?: string;
  value?: number | string | null;
  onChange: (v: number | string | null | undefined) => void;
  options: { id: number | string; name: string }[];
  placeholder?: string;
  clearLabel?: string;
  searchable?: boolean;
  allowClear?: boolean;
  disabled?: boolean;
  menuTitle?: string;
}

export default function SelectPicker({
  label,
  value,
  onChange,
  options,
  placeholder = "—",
  clearLabel = "—",
  searchable = true,
  allowClear = true,
  disabled = false,
  menuTitle,
}: SelectPickerProps) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedValue = value ?? null;
  void menuTitle;

  const filtered = search
    ? options.filter((option) => option.name.toLowerCase().includes(search.toLowerCase()))
    : options;

  const selected = options.find((option) => option.id === normalizedValue);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className={clsx("relative", open && "z-[60]")} ref={containerRef}>
      {label ? <label className="mb-2 inline-block text-sm/6 font-medium text-gray-900 dark:text-white">{label}</label> : null}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
          setSearch("");
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={clsx(
          "group flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left leading-6 focus:border-gray-500 focus:ring-3 focus:ring-gray-500/50 focus:outline-hidden dark:border-gray-600 dark:bg-gray-800 dark:focus:border-gray-500",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span className={clsx("truncate text-sm", selected ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400")}>
          {selected?.name || placeholder}
        </span>
        <svg
          className="inline-block h-5 w-5 flex-none opacity-40 transition group-hover:opacity-60 group-active:scale-90"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <ul
          className="absolute inset-x-0 z-[70] mt-2 max-h-60 overflow-y-auto rounded-lg bg-white py-2.5 shadow-xl ring-1 ring-black/5 focus:outline-hidden dark:bg-gray-800 dark:shadow-gray-900 dark:ring-gray-700"
          role="listbox"
          tabIndex={0}
        >
          {searchable && options.length > 5 ? (
            <li className="px-2 pb-2">
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("common.search")}
                className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm leading-6 placeholder-gray-400 focus:border-gray-500 focus:ring-3 focus:ring-gray-500/50 dark:border-gray-600 dark:bg-gray-800 dark:placeholder-gray-400 dark:focus:border-gray-500"
              />
            </li>
          ) : null}

          {allowClear ? (
            <li
              className={clsx(
                "group flex cursor-pointer items-center justify-between gap-2 border-y border-transparent px-3 text-sm focus:outline-hidden",
                normalizedValue == null
                  ? "font-semibold text-gray-950 hover:bg-gray-50 focus:bg-gray-50 dark:font-medium dark:text-white dark:hover:bg-gray-700/75 dark:focus:bg-gray-700/75"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-950 focus:bg-gray-50 focus:text-gray-950 active:border-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/75 dark:hover:text-white dark:focus:bg-gray-700/75 dark:focus:text-white dark:active:border-gray-600",
              )}
              role="option"
              aria-selected={normalizedValue == null}
              tabIndex={-1}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <div className="grow truncate py-1.5">{clearLabel === "—" ? t("common.all") : clearLabel}</div>
              <div className={clsx("pointer-events-none size-5 flex-none text-gray-600 dark:text-gray-500", normalizedValue == null ? "visible" : "invisible")} aria-hidden="true">
                <svg className="inline-block h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </li>
          ) : null}

          {filtered.length === 0 ? (
            <li className="px-3 py-4 text-center text-xs text-gray-400">{t("common.noResults")}</li>
          ) : null}

          {filtered.map((option) => {
            const active = normalizedValue === option.id;
            return (
              <li
                key={option.id}
                className={clsx(
                  "group flex cursor-pointer items-center justify-between gap-2 border-y border-transparent px-3 text-sm focus:outline-hidden",
                  active
                    ? "font-semibold text-gray-950 hover:bg-gray-50 focus:bg-gray-50 dark:font-medium dark:text-white dark:hover:bg-gray-700/75 dark:focus:bg-gray-700/75"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-950 focus:bg-gray-50 focus:text-gray-950 active:border-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/75 dark:hover:text-white dark:focus:bg-gray-700/75 dark:focus:text-white dark:active:border-gray-600",
                )}
                role="option"
                aria-selected={active}
                tabIndex={-1}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
              >
                <div className="grow truncate py-1.5">{option.name}</div>
                <div className={clsx("pointer-events-none size-5 flex-none text-gray-600 dark:text-gray-500", active ? "visible" : "invisible")} aria-hidden="true">
                  <svg className="inline-block h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
