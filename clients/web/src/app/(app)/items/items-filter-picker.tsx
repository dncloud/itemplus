"use client";

import { useRef, useState } from "react";

export function ItemsFilterPicker({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value?: number;
  onChange: (v: number | undefined) => void;
  items: { id: number; name: string; depth?: number }[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = search
    ? items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  const selectedName = items.find((item) => item.id === value)?.name;

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setSearch("");
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm text-left transition ${
          value
            ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400"
            : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400"
        }`}
      >
        <span className="truncate">{selectedName || "Alle"}</span>
        <svg className={`h-4 w-4 shrink-0 text-gray-400 transition ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-100 p-2 dark:border-gray-800">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen..."
              className="w-full rounded-lg border-none bg-gray-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900"
            />
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm transition ${
                !value ? "bg-blue-50 dark:bg-blue-900/10 text-blue-600 font-medium" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              Alle
            </button>

            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-gray-400">Keine Ergebnisse</p>
            )}

            {filtered.map((item) => {
              const active = value === item.id;
              const depth = item.depth || 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition flex items-center gap-1.5 ${
                    active
                      ? "bg-blue-50 dark:bg-blue-900/10 text-blue-600 font-medium"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                  style={{ paddingLeft: `${12 + depth * 16}px` }}
                >
                  {depth > 0 && <span className="text-xs text-gray-300 dark:text-gray-600">└</span>}
                  {item.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  );
}
