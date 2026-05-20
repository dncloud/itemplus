"use client";

import { useState } from "react";
import {
  AGE_RATINGS,
  ALL_AGE_RATINGS,
} from "@/components/property-field-data";

export { ALL_AGE_RATINGS };

export function AgeRatingField({
  label,
  selected,
  onToggle,
}: {
  label: React.ReactNode;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      {label}
      {selected.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {selected.map((value) => {
            const rating = ALL_AGE_RATINGS.find((entry) => entry.value === value);
            return rating ? (
              <button
                key={value}
                type="button"
                onClick={() => onToggle(value)}
                className="inline-flex items-center gap-x-1.5 rounded-md transition hover:opacity-80"
              >
                {rating.img ? (
                  <img src={rating.img} alt="" className="h-8 w-auto" />
                ) : (
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{rating.label}</span>
                )}
              </button>
            ) : null;
          })}
        </div>
      ) : null}
      <AgeRatingPicker selected={selected} onToggle={onToggle} />
    </div>
  );
}

function AgeRatingPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [system, setSystem] = useState(AGE_RATINGS[0].system);
  const currentSystem = AGE_RATINGS.find((entry) => entry.system === system) || AGE_RATINGS[0];

  return (
    <div className="space-y-3">
      <nav aria-label="Freigabesystem">
        <ol role="list" className="space-y-2 sm:flex sm:space-x-4 sm:space-y-0">
          {AGE_RATINGS.map((entry) => (
            <li key={entry.system} className="sm:flex-1">
              <button
                type="button"
                onClick={() => setSystem(entry.system)}
                className={`flex w-full flex-col border-l-4 py-2 pl-4 text-left md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4 ${
                  system === entry.system
                    ? "border-indigo-500"
                    : "border-gray-200 hover:border-gray-300 dark:border-white/10 dark:hover:border-white/20"
                }`}
              >
                <span className={`text-sm font-medium ${system === entry.system ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-400"}`}>
                  {entry.system}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{entry.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {currentSystem.ratings.map((rating) => {
          const active = selected.includes(rating.value);
          return (
            <button
              key={rating.value}
              type="button"
              onClick={() => onToggle(rating.value)}
              className={`group relative flex min-h-20 flex-col items-center justify-center rounded-lg px-2 py-2 text-center transition ${
                active
                  ? "bg-indigo-50 inset-ring inset-ring-indigo-400/30 dark:bg-indigo-500/10 dark:inset-ring-indigo-400/30"
                  : "bg-white outline outline-1 -outline-offset-1 outline-gray-300 hover:bg-gray-50 dark:bg-white/5 dark:outline-white/10 dark:hover:bg-white/10"
              }`}
            >
              {rating.img ? (
                <img src={rating.img} alt={rating.label} className="h-8 w-auto shrink-0" />
              ) : (
                <span className="text-sm font-bold text-gray-900 dark:text-white">{rating.label}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
