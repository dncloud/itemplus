"use client";

import { useState } from "react";
import type { Property } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { MarkdownEditor } from "@/components/markdown";

const inputCls = "w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

// ── Age Rating Systems ──
const AGE_RATINGS: { system: string; label: string; ratings: { value: string; label: string; img?: string }[] }[] = [
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

const ALL_AGE_RATINGS = AGE_RATINGS.flatMap((s) => s.ratings.map((r) => ({ ...r, system: s.system })));

// ── Condition levels — dezent, einheitlicher Stil ──
const CONDITIONS = [
  { value: "new", label: { de: "Neu", en: "New" } },
  { value: "like_new", label: { de: "Wie neu", en: "Like new" } },
  { value: "very_good", label: { de: "Sehr gut", en: "Very good" } },
  { value: "good", label: { de: "Gut", en: "Good" } },
  { value: "acceptable", label: { de: "Akzeptabel", en: "Acceptable" } },
  { value: "poor", label: { de: "Schlecht", en: "Poor" } },
  { value: "defective", label: { de: "Defekt", en: "Defective" } },
];

// ── Priority levels ──
const PRIORITIES = [
  { value: "low", label: { de: "Niedrig", en: "Low" }, color: "bg-blue-400" },
  { value: "medium", label: { de: "Mittel", en: "Medium" }, color: "bg-yellow-400" },
  { value: "high", label: { de: "Hoch", en: "High" }, color: "bg-orange-500" },
  { value: "critical", label: { de: "Kritisch", en: "Critical" }, color: "bg-red-600" },
];

export { ALL_AGE_RATINGS, CONDITIONS, PRIORITIES };

// ── Pill button style (shared by select, multiselect, condition, age_rating) ──
const pillActive = "border-transparent border-b-blue-500 bg-transparent text-blue-600 dark:text-blue-400 font-medium";
const pillInactive = "border-transparent border-b-gray-300 dark:border-b-gray-600 bg-transparent text-gray-500 dark:text-gray-400 hover:border-b-gray-400 dark:hover:border-b-gray-500";

/** Renders the right input for each property type */
export default function PropertyField({ property: prop, value, onChange }: {
  property: Property; value: unknown; onChange: (v: unknown) => void;
}) {
  const { locale, t } = useApp();

  const label = (
    <label className="block text-xs font-medium text-gray-500 mb-1">
      {prop.name}
      {prop.unit && <span className="text-gray-400 ml-1">({prop.unit})</span>}
      {prop.required ? <span className="text-red-400 ml-0.5">*</span> : null}
    </label>
  );

  const strVal = value != null ? String(value) : "";

  switch (prop.property_type) {
    case "boolean": {
      const isOn = value === true || value === "true";
      return (
        <label className="flex items-center gap-3 cursor-pointer text-gray-700 dark:text-gray-400">
          <span className="text-sm">{prop.name}</span>
          <button
            type="button"
            onClick={() => onChange(!isOn)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${isOn ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isOn ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </label>
      );
    }

    case "number":
      return <div>{label}<input type="number" value={strVal} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} className={inputCls} /></div>;

    case "date":
      return <div>{label}<input type="date" value={strVal} onChange={(e) => onChange(e.target.value)} className={inputCls} /></div>;

    case "textblock":
      return <div>{label}<MarkdownEditor value={strVal} onChange={(v) => onChange(v)} rows={3} /></div>;

    case "select": {
      const options: string[] = (prop.options as Record<string, unknown>)?.choices as string[] || [];
      return (
        <div>{label}
          <div className="flex flex-wrap gap-1.5">
            {options.map((o) => (
              <button key={o} type="button" onClick={() => onChange(strVal === o ? "" : o)}
                className={`px-3 py-1.5 text-xs border-b-2 transition ${strVal === o ? pillActive : pillInactive}`}
              >{o}</button>
            ))}
          </div>
        </div>
      );
    }

    case "multiselect": {
      const options: string[] = (prop.options as Record<string, unknown>)?.choices as string[] || [];
      const selected: string[] = Array.isArray(value) ? value : [];
      return (
        <div>{label}
          <div className="flex flex-wrap gap-1.5">
            {options.map((o) => {
              const active = selected.includes(o);
              return (
                <button key={o} type="button" onClick={() => onChange(active ? selected.filter((s) => s !== o) : [...selected, o])}
                  className={`px-3 py-1.5 text-xs border-b-2 transition ${active ? pillActive : pillInactive}`}
                >{o}</button>
              );
            })}
          </div>
        </div>
      );
    }

    case "rating": {
      const numVal = typeof value === "number" ? value : 0;
      return (
        <div>{label}
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" onClick={() => onChange(star === numVal ? 0 : star)}
                className={`text-xl transition ${star <= numVal ? "text-amber-400" : "text-gray-300 dark:text-gray-600 hover:text-amber-200"}`}
              >★</button>
            ))}
          </div>
        </div>
      );
    }

    case "dimensions": {
      const dim = typeof value === "object" && value ? (value as Record<string, unknown>) : {};
      return (
        <div>{label}
          <div className="grid grid-cols-3 gap-2">
            {(["length", "width", "height"] as const).map((d) => (
              <input key={d} type="number" step="0.1"
                value={dim[d] != null ? String(dim[d]) : ""}
                onChange={(e) => onChange({ ...dim, [d]: e.target.value ? Number(e.target.value) : null })}
                placeholder={d === "length" ? t("property.length") : d === "width" ? t("property.width") : t("property.height")}
                className={inputCls}
              />
            ))}
          </div>
        </div>
      );
    }

    // ── Age Rating — compact dropdown per system ──
    case "age_rating": {
      const selected: string[] = Array.isArray(value) ? value : (strVal ? [strVal] : []);
      const toggle = (v: string) => {
        const next = selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v];
        onChange(next.length > 0 ? next : null);
      };
      return (
        <div>{label}
          {/* Selected badges */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selected.map((v) => {
                const r = ALL_AGE_RATINGS.find((x) => x.value === v);
                return r ? (
                  <button key={v} type="button" onClick={() => toggle(v)} className="flex items-center gap-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 transition hover:bg-blue-100">
                    {r.img ? <img src={r.img} alt="" className="h-6 w-auto" /> : <span className="text-xs font-bold">{r.label}</span>}
                    <span className="text-[10px] text-blue-400">✕</span>
                  </button>
                ) : null;
              })}
            </div>
          )}
          {/* System + Rating dropdowns */}
          <AgeRatingPicker selected={selected} onToggle={toggle} />
        </div>
      );
    }

    // ── Condition — same pill style as priority ──
    case "condition":
      return (
        <div>{label}
          <div className="flex flex-wrap gap-1.5">
            {CONDITIONS.map((c) => (
              <button key={c.value} type="button" onClick={() => onChange(strVal === c.value ? "" : c.value)}
                className={`px-3 py-1.5 text-xs border-b-2 transition ${strVal === c.value ? pillActive : pillInactive}`}
              >{c.label[locale]}</button>
            ))}
          </div>
        </div>
      );

    // ── Priority ──
    case "priority":
      return (
        <div>{label}
          <div className="flex flex-wrap gap-1.5">
            {PRIORITIES.map((p) => (
              <button key={p.value} type="button" onClick={() => onChange(strVal === p.value ? "" : p.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-b-2 transition ${strVal === p.value ? `border-transparent ${p.color} text-white font-medium` : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"}`}
              >
                <span className={`w-2 h-2 rounded-full ${strVal === p.value ? "bg-white" : p.color}`} />
                {p.label[locale]}
              </button>
            ))}
          </div>
        </div>
      );

    // ── Weight ──
    case "weight": {
      const numVal = typeof value === "number" ? value : (typeof value === "object" && value ? (value as Record<string, unknown>).value as number : null);
      const unit = typeof value === "object" && value ? ((value as Record<string, unknown>).unit as string || "g") : (prop.unit || "g");
      return (
        <div>{label}
          <div className="flex gap-2">
            <input type="number" step="0.1"
              value={numVal != null ? String(numVal) : ""}
              onChange={(e) => onChange(e.target.value ? { value: Number(e.target.value), unit } : null)}
              className={inputCls + " flex-1"}
            />
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
              {["g", "kg", "t"].map((u) => (
                <button key={u} type="button"
                  onClick={() => onChange({ value: numVal ?? 0, unit: u })}
                  className={`px-3 py-2 text-xs font-medium transition ${unit === u ? "bg-blue-500 text-white" : "bg-white dark:bg-gray-900 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                >{u}</button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // text and fallback
    default:
      return <div>{label}<input type="text" value={strVal} onChange={(e) => onChange(e.target.value)} className={inputCls} /></div>;
  }
}

// ── Age Rating Picker (compact: system dropdown + rating dropdown with images) ──

function AgeRatingPicker({ selected, onToggle }: { selected: string[]; onToggle: (v: string) => void }) {
  const [system, setSystem] = useState(AGE_RATINGS[0].system);
  const [open, setOpen] = useState(false);

  const currentSys = AGE_RATINGS.find((s) => s.system === system) || AGE_RATINGS[0];

  return (
    <div className="space-y-2">
      {/* System tabs */}
      <div className="flex rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-0.5">
        {AGE_RATINGS.map((sys) => (
          <button
            key={sys.system}
            type="button"
            onClick={() => { setSystem(sys.system); setOpen(true); }}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition ${
              system === sys.system
                ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {sys.system}
          </button>
        ))}
      </div>

      {/* Rating picker dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
        >
          <span className="text-gray-500">{currentSys.label} — Bewertung wählen</span>
          <svg className={`h-4 w-4 text-gray-400 transition ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-2 space-y-1 max-h-72 overflow-y-auto">
              {currentSys.ratings.map((r) => {
                const active = selected.includes(r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => onToggle(r.value)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition ${
                      active
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    {r.img ? (
                      <img src={r.img} alt="" className="h-8 w-auto shrink-0" />
                    ) : (
                      <span className="text-sm font-bold w-8 text-center shrink-0">{r.label}</span>
                    )}
                    <span className="text-sm flex-1">{currentSys.system} {r.label}</span>
                    {active && <span className="text-blue-500 text-sm">✓</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
