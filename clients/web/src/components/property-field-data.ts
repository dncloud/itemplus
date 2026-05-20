"use client";

export const AGE_RATINGS: { system: string; label: string; ratings: { value: string; label: string; img?: string }[] }[] = [
  {
    system: "FSK", label: "FSK (Filme, DE)",
    ratings: [
      { value: "fsk0", label: "0", img: "/images/FSK_0.svg" },
      { value: "fsk6", label: "6", img: "/images/FSK_6.svg" },
      { value: "fsk12", label: "12", img: "/images/FSK_12.svg" },
      { value: "fsk16", label: "16", img: "/images/FSK_16.svg" },
      { value: "fsk18", label: "18", img: "/images/FSK_18.svg" },
    ],
  },
  {
    system: "USK", label: "USK (Spiele, DE)",
    ratings: [
      { value: "usk0", label: "0", img: "/images/USK_0.svg" },
      { value: "usk6", label: "6", img: "/images/USK_6.svg" },
      { value: "usk12", label: "12", img: "/images/USK_12.svg" },
      { value: "usk16", label: "16", img: "/images/USK_16.svg" },
      { value: "usk18", label: "18", img: "/images/USK_18.svg" },
    ],
  },
  {
    system: "PEGI", label: "PEGI (EU)",
    ratings: [
      { value: "pegi3", label: "3", img: "/images/PEGI_3.svg" },
      { value: "pegi4", label: "4", img: "/images/PEGI_4.svg" },
      { value: "pegi6", label: "6", img: "/images/PEGI_6.svg" },
      { value: "pegi7", label: "7", img: "/images/PEGI_7.svg" },
      { value: "pegi11", label: "11", img: "/images/PEGI_11.svg" },
      { value: "pegi12", label: "12", img: "/images/PEGI_12.svg" },
      { value: "pegi15", label: "15", img: "/images/PEGI_15.svg" },
      { value: "pegi16", label: "16", img: "/images/PEGI_16.svg" },
      { value: "pegi18", label: "18", img: "/images/PEGI_18.svg" },
    ],
  },
  {
    system: "ESRB", label: "ESRB (US)",
    ratings: [
      { value: "esrb_ec", label: "EC", img: "/images/ESRB_EC.svg" },
      { value: "esrb_e", label: "E", img: "/images/ESRB_E.svg" },
      { value: "esrb_e10", label: "E10+", img: "/images/ESRB_E10.svg" },
      { value: "esrb_t", label: "T", img: "/images/ESRB_T.svg" },
      { value: "esrb_m", label: "M", img: "/images/ESRB_M.svg" },
      { value: "esrb_ao", label: "AO", img: "/images/ESRB_AO.svg" },
      { value: "esrb_rp", label: "RP", img: "/images/ESRB_RP.svg" },
    ],
  },
];

export const ALL_AGE_RATINGS = AGE_RATINGS.flatMap((system) =>
  system.ratings.map((rating) => ({ ...rating, system: system.system })),
);

export const CONDITIONS = [
  { value: "new", label: { de: "Neu", en: "New" } },
  { value: "like_new", label: { de: "Wie neu", en: "Like new" } },
  { value: "very_good", label: { de: "Sehr gut", en: "Very good" } },
  { value: "good", label: { de: "Gut", en: "Good" } },
  { value: "acceptable", label: { de: "Akzeptabel", en: "Acceptable" } },
  { value: "poor", label: { de: "Schlecht", en: "Poor" } },
  { value: "defective", label: { de: "Defekt", en: "Defective" } },
];

export const CONDITION_BADGE_CLASS: Record<string, { idle: string; active: string }> = {
  new: {
    idle: "bg-green-400/10 text-green-400",
    active: "bg-green-400/10 text-green-400 inset-ring inset-ring-green-500/20",
  },
  like_new: {
    idle: "bg-emerald-400/10 text-emerald-400",
    active: "bg-emerald-400/10 text-emerald-400 inset-ring inset-ring-emerald-400/20",
  },
  very_good: {
    idle: "bg-blue-400/10 text-blue-400",
    active: "bg-blue-400/10 text-blue-400 inset-ring inset-ring-blue-400/30",
  },
  good: {
    idle: "bg-indigo-400/10 text-indigo-400",
    active: "bg-indigo-400/10 text-indigo-400 inset-ring inset-ring-indigo-400/30",
  },
  acceptable: {
    idle: "bg-yellow-400/10 text-yellow-500",
    active: "bg-yellow-400/10 text-yellow-500 inset-ring inset-ring-yellow-400/20",
  },
  poor: {
    idle: "bg-orange-400/10 text-orange-400",
    active: "bg-orange-400/10 text-orange-400 inset-ring inset-ring-orange-400/20",
  },
  defective: {
    idle: "bg-red-400/10 text-red-400",
    active: "bg-red-400/10 text-red-400 inset-ring inset-ring-red-400/20",
  },
};

export const PRIORITIES = [
  { value: "low", label: { de: "Niedrig", en: "Low" } },
  { value: "medium", label: { de: "Mittel", en: "Medium" } },
  { value: "high", label: { de: "Hoch", en: "High" } },
  { value: "critical", label: { de: "Kritisch", en: "Critical" } },
];

export const PRIORITY_BADGE_CLASS: Record<string, { idle: string; active: string }> = {
  low: {
    idle: "bg-blue-400/10 text-blue-400",
    active: "bg-blue-400/10 text-blue-400 inset-ring inset-ring-blue-400/30",
  },
  medium: {
    idle: "bg-yellow-400/10 text-yellow-500",
    active: "bg-yellow-400/10 text-yellow-500 inset-ring inset-ring-yellow-400/20",
  },
  high: {
    idle: "bg-orange-400/10 text-orange-400",
    active: "bg-orange-400/10 text-orange-400 inset-ring inset-ring-orange-400/20",
  },
  critical: {
    idle: "bg-red-400/10 text-red-400",
    active: "bg-red-400/10 text-red-400 inset-ring inset-ring-red-400/20",
  },
};

export function formatTimeDuration(value: string, locale: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? "0");
  const parts: string[] = [];
  const hourLabel = locale === "en" ? (hours === 1 ? "hour" : "hours") : (hours === 1 ? "Stunde" : "Stunden");
  const minuteLabel = locale === "en" ? (minutes === 1 ? "minute" : "minutes") : (minutes === 1 ? "Minute" : "Minuten");
  const secondLabel = locale === "en" ? (seconds === 1 ? "second" : "seconds") : (seconds === 1 ? "Sekunde" : "Sekunden");

  if (hours > 0) parts.push(`${hours} ${hourLabel}`);
  if (seconds === 0) {
    if (minutes > 0 || hours > 0) parts.push(`${minutes} ${minuteLabel}`);
    return parts.join(", ") || `0 ${minuteLabel}`;
  }
  if (minutes > 0) parts.push(`${minutes} ${minuteLabel}`);
  if (seconds > 0) parts.push(`${seconds} ${secondLabel}`);
  return parts.join(", ") || `0 ${secondLabel}`;
}
