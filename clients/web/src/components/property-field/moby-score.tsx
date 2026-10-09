import { Star } from "lucide-react";
import type { Property } from "@/lib/api";

function catalogMeta(property: Property) {
  return property.options?.game_catalog as Record<string, unknown> | undefined;
}

export function isMobyScoreProperty(property: Property) {
  const meta = catalogMeta(property);
  return meta?.source === "itemplus-game-catalog" && meta?.property_key === "moby_score";
}

export function getMobyScoreRange(property: Property) {
  const min = Number(property.options?.min);
  const max = Number(property.options?.max);
  const step = Number(property.options?.step);

  return {
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) && max > 0 ? max : 10,
    step: Number.isFinite(step) && step > 0 ? step : 0.1,
  };
}

export function formatMobyScore(value: number, locale: string, max = 10) {
  return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })} / ${max}`;
}

export function MobyScoreStars({ value, max = 10, size = 17 }: { value: number; max?: number; size?: number }) {
  const score = Number.isFinite(value) ? Math.max(0, Math.min(value, max)) : 0;
  const stars = Math.max(1, Math.round(max));

  return (
    <span className="inline-flex items-center gap-px" role="img" aria-label={`${score} von ${max} Sternen`}>
      {Array.from({ length: stars }, (_, index) => {
        const fill = Math.max(0, Math.min(1, score - index));
        return (
          <span key={index} className="relative inline-flex shrink-0 text-gray-300 dark:text-gray-600" style={{ width: size, height: size }}>
            <Star aria-hidden="true" size={size} strokeWidth={1.8} />
            {fill > 0 ? (
              <span className="absolute inset-y-0 left-0 overflow-hidden text-amber-400" style={{ width: `${fill * 100}%` }}>
                <Star aria-hidden="true" size={size} fill="currentColor" strokeWidth={1.8} />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
