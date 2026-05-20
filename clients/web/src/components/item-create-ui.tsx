"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { BarcodePreview } from "@/components/item-create-barcode-preview";

export { BarcodePreview };

export function Field({
  label,
  value,
  onChange,
  multiline,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  type?: string;
}) {
  const cls =
    "block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500";
  const dateCls =
    cls + " [color-scheme:light] dark:[color-scheme:dark] dark:[&::-webkit-calendar-picker-indicator]:opacity-90";

  return (
    <div>
      <label className="block text-sm/6 font-medium text-gray-900 dark:text-white">{label}</label>
      <div className="mt-2">
        {multiline ? (
          <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={cls} />
        ) : type === "date" ? (
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <CalendarDaysIcon className="size-4 text-gray-400" />
            </div>
            <input
              type={type}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={dateCls + " pl-9"}
            />
          </div>
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={type === "date" ? dateCls : cls}
          />
        )}
      </div>
    </div>
  );
}

export function ModalSection({
  title,
  description,
  children,
  noTopBorder = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  noTopBorder?: boolean;
}) {
  return (
    <div
      className={clsx(
        "grid grid-cols-1 gap-x-8 gap-y-6 border-t border-gray-200 pt-8 md:grid-cols-[16rem_minmax(0,1fr)] first:border-t-0 first:pt-0 dark:border-white/10",
        noTopBorder && "border-t-0 pt-0",
      )}
    >
      <div>
        <h3 className="text-base/7 font-semibold text-gray-900 dark:text-white">{title}</h3>
        {description ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p> : null}
      </div>
      <div className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
        <div className="space-y-6 px-4 py-6 sm:p-8 md:max-w-4xl">{children}</div>
      </div>
    </div>
  );
}

export function TWPSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value?: number;
  onChange: (v: number | undefined) => void;
  options: Array<{ id: number; name: string }>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.id === value);

  useEffect(() => {
    if (!open || disabled) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
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
  }, [disabled, open]);

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm/6 font-medium text-gray-900 dark:text-white">{label}</label>
      <div className="mt-2 block">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen((current) => !current);
          }}
          className="grid w-full cursor-default grid-cols-1 rounded-md bg-white py-1.5 pr-2 pl-3 text-left text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:focus-visible:outline-indigo-500"
        >
          <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 pr-6">
            <span className={`size-2 rounded-full ${selected ? "bg-indigo-500" : "bg-gray-300 dark:bg-gray-600"}`} />
            <span className="truncate">{selected?.name || label}</span>
          </span>
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
            className="col-start-1 row-start-1 size-5 self-center justify-self-end text-gray-500 sm:size-4 dark:text-gray-400"
          >
            <path
              d="M5.22 10.22a.75.75 0 0 1 1.06 0L8 11.94l1.72-1.72a.75.75 0 1 1 1.06 1.06l-2.25 2.25a.75.75 0 0 1-1.06 0l-2.25-2.25a.75.75 0 0 1 0-1.06ZM10.78 5.78a.75.75 0 0 1-1.06 0L8 4.06 6.28 5.78a.75.75 0 0 1-1.06-1.06l2.25-2.25a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1 0 1.06Z"
              clipRule="evenodd"
              fillRule="evenodd"
            />
          </svg>
        </button>

        {open && !disabled ? (
          <div
            role="listbox"
            className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg outline-1 outline-black/5 sm:text-sm dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10 [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[scrollbar-color:theme(colors.gray.400)_transparent] dark:[scrollbar-width:auto] dark:[&::-webkit-scrollbar-thumb]:bg-gray-400/80 dark:[&::-webkit-scrollbar-thumb]:border-[3px] dark:[&::-webkit-scrollbar-thumb]:border-solid dark:[&::-webkit-scrollbar-thumb]:border-gray-800"
          >
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              className="group relative block w-full cursor-default py-2 pr-9 pl-3 text-left text-gray-900 select-none hover:bg-indigo-600 hover:text-white focus:bg-indigo-600 focus:text-white focus:outline-hidden dark:text-white dark:hover:bg-indigo-500 dark:focus:bg-indigo-500"
            >
              <span className="block truncate font-normal">Bitte auswählen</span>
            </button>
            {options.map((option) => {
              const selectedOption = option.id === value;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className="group relative block w-full cursor-default py-2 pr-9 pl-3 text-left text-gray-900 select-none hover:bg-indigo-600 hover:text-white focus:bg-indigo-600 focus:text-white focus:outline-hidden dark:text-white dark:hover:bg-indigo-500 dark:focus:bg-indigo-500"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={clsx("size-2 rounded-full", selectedOption ? "bg-indigo-500" : "bg-gray-300 group-hover:bg-white/70 dark:bg-gray-600 dark:group-hover:bg-white/70")} />
                    <span className={clsx("block truncate font-normal", selectedOption && "font-semibold")}>
                      {option.name}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TWPStringSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
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
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm/6 font-medium text-gray-900 dark:text-white">{label}</label>
      <div className="mt-2 block">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="grid w-full cursor-default grid-cols-1 rounded-md bg-white py-1.5 pr-2 pl-3 text-left text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:focus-visible:outline-indigo-500"
        >
          <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 pr-6">
            <span className={`size-2 rounded-full ${selected ? "bg-indigo-500" : "bg-gray-300 dark:bg-gray-600"}`} />
            <span className="truncate">{selected?.label || label}</span>
          </span>
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
            className="col-start-1 row-start-1 size-5 self-center justify-self-end text-gray-500 sm:size-4 dark:text-gray-400"
          >
            <path
              d="M5.22 10.22a.75.75 0 0 1 1.06 0L8 11.94l1.72-1.72a.75.75 0 1 1 1.06 1.06l-2.25 2.25a.75.75 0 0 1-1.06 0l-2.25-2.25a.75.75 0 0 1 0-1.06ZM10.78 5.78a.75.75 0 0 1-1.06 0L8 4.06 6.28 5.78a.75.75 0 0 1-1.06-1.06l2.25-2.25a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1 0 1.06Z"
              clipRule="evenodd"
              fillRule="evenodd"
            />
          </svg>
        </button>

        {open ? (
          <div
            role="listbox"
            className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg outline-1 outline-black/5 sm:text-sm dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10 [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[scrollbar-color:theme(colors.gray.400)_transparent] dark:[scrollbar-width:auto] dark:[&::-webkit-scrollbar-thumb]:bg-gray-400/80 dark:[&::-webkit-scrollbar-thumb]:border-[3px] dark:[&::-webkit-scrollbar-thumb]:border-solid dark:[&::-webkit-scrollbar-thumb]:border-gray-800"
          >
            {options.map((option) => {
              const selectedOption = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className="group relative block w-full cursor-default py-2 pr-9 pl-3 text-left text-gray-900 select-none hover:bg-indigo-600 hover:text-white focus:bg-indigo-600 focus:text-white focus:outline-hidden dark:text-white dark:hover:bg-indigo-500 dark:focus:bg-indigo-500"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={clsx("size-2 rounded-full", selectedOption ? "bg-indigo-500" : "bg-gray-300 group-hover:bg-white/70 dark:bg-gray-600 dark:group-hover:bg-white/70")} />
                    <span className={clsx("block truncate font-normal", selectedOption && "font-semibold")}>
                      {option.label}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SuggestionRow({
  value,
  onApply,
  label,
  multiline = false,
}: {
  value: string;
  onApply: () => void;
  label: string;
  multiline?: boolean;
}) {
  return (
    <div className="mt-2 flex items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
      <div className={clsx("min-w-0", multiline && "whitespace-pre-wrap")}>{value}</div>
      <button
        type="button"
        onClick={onApply}
        className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-medium text-emerald-700 shadow-xs ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100 dark:bg-white/10 dark:text-emerald-200 dark:ring-white/10 dark:hover:bg-white/20"
      >
        {label}
      </button>
    </div>
  );
}
