"use client";

import { Fragment } from "react";
import type { Property } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { MarkdownEditor } from "@/components/markdown";
import { CalendarDaysIcon, ClockIcon } from "@heroicons/react/24/outline";
import { AgeRatingField, ALL_AGE_RATINGS } from "@/components/property-field-age-rating";
import { MultiSelectDropdown, SelectDropdown } from "@/components/property-field-selects";
import { getPropertyOptionConfig } from "@/lib/property-options";
import {
  CONDITION_BADGE_CLASS,
  CONDITIONS,
  PRIORITIES,
  PRIORITY_BADGE_CLASS,
} from "@/components/property-field-data";

const inputCls =
  "block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500";
const dateInputCls =
  inputCls +
  " [color-scheme:light] dark:[color-scheme:dark] dark:[&::-webkit-calendar-picker-indicator]:opacity-90";
const timeInputCls =
  inputCls +
  " [color-scheme:light] dark:[color-scheme:dark] dark:[&::-webkit-calendar-picker-indicator]:opacity-90";

export { ALL_AGE_RATINGS, CONDITIONS, PRIORITIES, PRIORITY_BADGE_CLASS };

/** Renders the right input for each property type */
export default function PropertyField({ property: prop, value, onChange }: {
  property: Property; value: unknown; onChange: (v: unknown) => void;
}) {
  const { locale, t } = useApp();

  const label = (
    <label className="mb-1 inline-block text-sm/6 font-medium text-gray-900 dark:text-white">
      {prop.name}
      {prop.unit && <span className="ml-1 text-gray-400">({prop.unit})</span>}
      {prop.required ? <span className="ml-0.5 text-red-400">*</span> : null}
    </label>
  );

  const strVal = value != null ? String(value) : "";

  switch (prop.property_type) {
    case "boolean": {
      const isOn = value === true || value === "true";
      return (
        <div>
          <span className="block text-sm/6 font-medium text-gray-900 dark:text-white">{prop.name}</span>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div
              className={`group relative inline-flex w-11 shrink-0 rounded-full p-0.5 inset-ring inset-ring-gray-900/5 outline-offset-2 outline-indigo-600 transition-colors duration-200 ease-in-out has-focus-within:outline-2 ${
                isOn
                  ? "bg-indigo-600 dark:bg-indigo-500 dark:inset-ring-white/10 dark:outline-indigo-500"
                  : "bg-gray-200 dark:bg-white/5 dark:inset-ring-white/10 dark:outline-indigo-500"
              }`}
            >
              <span
                className={`relative size-5 rounded-full bg-white shadow-xs ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out ${
                  isOn ? "translate-x-5" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 flex size-full items-center justify-center transition-opacity duration-200 ease-in ${
                    isOn ? "opacity-0 duration-100 ease-out" : "opacity-100"
                  }`}
                >
                  <svg viewBox="0 0 12 12" fill="none" className="size-3 text-gray-400 dark:text-gray-600">
                    <path d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 flex size-full items-center justify-center transition-opacity duration-100 ease-out ${
                    isOn ? "opacity-100 duration-200 ease-in" : "opacity-0"
                  }`}
                >
                  <svg viewBox="0 0 12 12" fill="currentColor" className="size-3 text-indigo-600 dark:text-indigo-500">
                    <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
                  </svg>
                </span>
              </span>
              <input
                type="checkbox"
                checked={isOn}
                onChange={() => onChange(!isOn)}
                className="absolute inset-0 size-full cursor-pointer appearance-none focus:outline-hidden"
              />
            </div>
            <div className="text-sm">
              <span className="font-medium text-gray-900 dark:text-white">
                {isOn ? t("common.yes") : t("common.no")}
              </span>
            </div>
          </div>
        </div>
      );
    }

    case "number":
      return <div>{label}<input type="number" value={strVal} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} className={inputCls} /></div>;

    case "date":
      return (
        <div>
          {label}
          <div className="relative mt-2">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <CalendarDaysIcon className="size-4 text-gray-400" />
            </div>
            <input
              type="date"
              value={strVal}
              onChange={(e) => onChange(e.target.value)}
              className={dateInputCls + " pl-9"}
            />
          </div>
        </div>
      );

    case "time":
      return (
        <div>
          {label}
          <div className="relative mt-2">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <ClockIcon className="size-4 text-gray-400" />
            </div>
            <input
              type="time"
              step={1}
              value={strVal}
              onChange={(e) => onChange(e.target.value)}
              className={timeInputCls + " pl-9"}
            />
          </div>
        </div>
      );

    case "textblock":
      return <div>{label}<MarkdownEditor value={strVal} onChange={(v) => onChange(v)} rows={3} /></div>;

    case "select": {
      const optionConfig = getPropertyOptionConfig(prop.options, locale);
      return (
        <div>
          {label}
          <SelectDropdown
            label={prop.name}
            value={strVal}
            options={optionConfig.choices}
            allowCustom={optionConfig.allowCustom}
            customLabel={optionConfig.customLabel}
            customPlaceholder={t("categories.customValuePlaceholder")}
            onChange={(next) => onChange(next)}
          />
        </div>
      );
    }

    case "multiselect": {
      const optionConfig = getPropertyOptionConfig(prop.options, locale);
      const selected: string[] = Array.isArray(value) ? value : [];
      return (
        <div>
          {label}
          <MultiSelectDropdown
            label={prop.name}
            values={selected}
            options={optionConfig.choices}
            allowCustom={optionConfig.allowCustom}
            customLabel={optionConfig.customLabel}
            customPlaceholder={t("categories.customValuePlaceholder")}
            onChange={(next) => onChange(next)}
          />
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
      const dimensionKeys = ["length", "width", "height"] as const;
      return (
        <div>{label}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-end">
            {dimensionKeys.map((d, index) => (
              <Fragment key={d}>
                <div>
                  <label className="mb-1 inline-block text-sm/6 font-medium text-gray-500 dark:text-gray-400">
                    {d === "length" ? t("property.length") : d === "width" ? t("property.width") : t("property.height")}
                  </label>
                  <div className="relative">
                    <input type="number" step="0.1"
                      value={dim[d] != null ? String(dim[d]) : ""}
                      onChange={(e) => onChange({ ...dim, [d]: e.target.value ? Number(e.target.value) : null })}
                      placeholder={d === "length" ? t("property.length") : d === "width" ? t("property.width") : t("property.height")}
                      className={inputCls + (prop.unit ? " pr-11" : "")}
                    />
                    {prop.unit ? (
                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-gray-400">
                        {prop.unit}
                      </span>
                    ) : null}
                  </div>
                </div>
                {index < dimensionKeys.length - 1 ? (
                  <span aria-hidden="true" className="hidden sm:flex sm:items-center sm:justify-center sm:pb-2 sm:text-lg sm:text-gray-400">
                    ×
                  </span>
                ) : null}
              </Fragment>
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
      return <AgeRatingField label={label} selected={selected} onToggle={toggle} />;
    }

    // ── Condition — same pill style as priority ──
    case "condition":
      return (
        <div>{label}
          <div className="mt-2 flex flex-wrap gap-2">
            {CONDITIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => onChange(strVal === c.value ? "" : c.value)}
                className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium transition ${
                  strVal === c.value ? CONDITION_BADGE_CLASS[c.value].active : CONDITION_BADGE_CLASS[c.value].idle
                }`}
              >
                {c.label[locale]}
              </button>
            ))}
          </div>
        </div>
      );

    // ── Priority ──
    case "priority":
      return (
        <div>{label}
          <div className="mt-2 flex flex-wrap gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange(strVal === p.value ? "" : p.value)}
                className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium transition ${
                  strVal === p.value ? PRIORITY_BADGE_CLASS[p.value].active : PRIORITY_BADGE_CLASS[p.value].idle
                }`}
              >
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <input type="number" step="0.1"
              value={numVal != null ? String(numVal) : ""}
              onChange={(e) => onChange(e.target.value ? { value: Number(e.target.value), unit } : null)}
              className={inputCls + " flex-1"}
            />
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {["g", "kg", "t"].map((u) => (
                <button key={u} type="button"
                  onClick={() => onChange({ value: numVal ?? 0, unit: u })}
                  className={`inline-flex min-h-[38px] min-w-12 items-center justify-center rounded-md px-3 py-1.5 text-sm/6 font-medium transition ${
                    unit === u
                      ? "bg-indigo-400/10 text-indigo-600 inset-ring inset-ring-indigo-400/30 dark:text-indigo-400"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-400/10 dark:text-gray-400 dark:hover:bg-gray-400/15"
                  }`}
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
