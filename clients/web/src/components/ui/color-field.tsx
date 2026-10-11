"use client";

import { Check } from "lucide-react";
import { ColorChip } from "@/components/ui/color-chip";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

// Colours that work as a chip on a light and on a dark page.
const SWATCHES = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#64748b",
];

/**
 * Colour of a category or location: quick picks, any other colour through
 * the system picker, and the chip as the app will draw it, on a light and on
 * a dark page side by side.
 */
export function ColorField({ value, onChange, previewLabel, t }: {
  value?: string | null;
  onChange: (color: string | undefined) => void;
  previewLabel: string;
  t: Translate;
}) {
  const current = (value || "").toLowerCase();
  const isCustom = !!current && !SWATCHES.includes(current);

  return (
    <div>
      <span className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("common.color")}</span>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <div role="radiogroup" aria-label={t("common.color")} className="flex flex-wrap gap-2">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                role="radio"
                aria-checked={current === swatch}
                aria-label={swatch}
                onClick={() => onChange(swatch)}
                style={{ backgroundColor: swatch }}
                className="inline-flex size-7 items-center justify-center rounded-full text-white outline-offset-2 outline-indigo-600 aria-checked:outline-2 dark:outline-indigo-500"
              >
                {current === swatch ? <Check aria-hidden="true" className="size-4" /> : null}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="color"
                value={current || "#6b7280"}
                onChange={(event) => onChange(event.target.value)}
                className={`h-7 w-9 cursor-pointer rounded border bg-transparent ${isCustom ? "border-indigo-600 dark:border-indigo-500" : "border-gray-300 dark:border-gray-700"}`}
              />
              {t("common.colorCustom")}
            </label>
            {current ? (
              <button type="button" onClick={() => onChange(undefined)} className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                {t("common.colorNone")}
              </button>
            ) : null}
          </div>
        </div>

        <div>
          {/* Both sides are fixed colours on purpose: this shows the other mode too. */}
          <div className="grid grid-cols-2 overflow-hidden rounded-lg outline-1 -outline-offset-1 outline-gray-300 dark:outline-white/10">
            <div className="flex flex-col items-start gap-2 bg-white p-3">
              <span className="text-xs text-gray-500">{t("common.colorPreviewLight")}</span>
              <ColorChip label={previewLabel} color={current || undefined} theme="light" />
            </div>
            <div className="flex flex-col items-start gap-2 bg-gray-900 p-3">
              <span className="text-xs text-gray-400">{t("common.colorPreviewDark")}</span>
              <ColorChip label={previewLabel} color={current || undefined} theme="dark" />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t("common.colorPreviewHint")}</p>
        </div>
      </div>
    </div>
  );
}
