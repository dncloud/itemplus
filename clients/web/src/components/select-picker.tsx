"use client";

import { useRef, useState, useEffect } from "react";

interface SelectPickerProps {
  label?: string;
  value?: number | string | null;
  onChange: (v: number | string | null | undefined) => void;
  options: { id: number | string; name: string }[];
  placeholder?: string;
  clearLabel?: string;
  searchable?: boolean;
}

export default function SelectPicker({ label, value, onChange, options, placeholder = "—", clearLabel = "—", searchable = true }: SelectPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = search
    ? options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    : options;

  const selectedName = options.find((o) => o.id === value)?.name;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(""); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="w-full h-[38px] flex items-center justify-between rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-left transition hover:border-gray-400 dark:hover:border-gray-500"
      >
        <span className={`truncate ${selectedName ? "text-gray-900 dark:text-gray-400" : "text-gray-400 dark:text-gray-500"}`}>
          {selectedName || placeholder}
        </span>
        <svg className={`h-4 w-4 shrink-0 text-gray-400 transition ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl overflow-hidden">
          {searchable && options.length > 5 && (
            <div className="p-2 border-b border-gray-100 dark:border-gray-700">
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suchen..."
                className="w-full rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition ${
                value == null ? "text-gray-500 dark:text-gray-400 font-medium" : "text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {clearLabel}
            </button>
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">Keine Ergebnisse</p>
            )}
            {filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => { onChange(opt.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm transition ${
                  value === opt.id
                    ? "bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 font-medium"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                {opt.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
