"use client";

import { useEffect, useRef, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { ArrowDownWideNarrow, Sparkles } from "lucide-react";
import ColorPreviewBadge from "@/components/ui/color-preview-badge";
import SelectPicker from "@/components/ui/select-picker";
import type { Category, Property } from "@/lib/api";
import { getPropertyOptionConfig } from "@/lib/property-options";
import { SortableChoice } from "./categories-sortables-private";
import { TYPES_WITH_CHOICES, TYPES_WITH_UNIT } from "./categories-property-meta";

const categoryInputClass =
  "w-full h-[38px] rounded-md bg-white px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500";

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={categoryInputClass} />
    </div>
  );
}

function ChoicesEditor({
  property,
  onChange,
  t,
}: {
  property: Partial<Property>;
  onChange: (next: Partial<Property>) => void;
  t: (k: string) => string;
}) {
  const optionConfig = getPropertyOptionConfig(property.options);
  const choices = optionConfig.choices;
  const [newChoice, setNewChoice] = useState("");
  const initialChoiceOrderRef = useRef<string[]>(choices);
  const initialChoiceKeyRef = useRef<string | number | undefined>(property.id);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (initialChoiceKeyRef.current !== property.id) {
      initialChoiceKeyRef.current = property.id;
      initialChoiceOrderRef.current = choices;
      return;
    }
    for (const choice of choices) {
      if (!initialChoiceOrderRef.current.includes(choice)) {
        initialChoiceOrderRef.current.push(choice);
      }
    }
  }, [choices, property.id]);

  const updateOptions = (next: { choices?: string[]; allowCustom?: boolean; customLabel?: string; withCount?: boolean; countLabel?: string }) => {
    const current = getPropertyOptionConfig(property.options);
    onChange({
      ...property,
      options: {
        choices: next.choices ?? current.choices,
        allow_custom: next.allowCustom ?? current.allowCustom,
        custom_label: next.customLabel ?? current.customLabel,
        with_count: next.withCount ?? current.withCount,
        count_label: next.countLabel ?? current.countLabel ?? t("categories.selectCountPlaceholder"),
      },
    });
  };

  const add = () => {
    const trimmed = newChoice.trim();
    if (!trimmed || choices.includes(trimmed)) return;
    updateOptions({ choices: [...choices, trimmed] });
    setNewChoice("");
  };

  const sortByName = () => {
    updateOptions({
      choices: [...choices].sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })),
    });
  };

  const sortByOriginalOrder = () => {
    const ranks = new Map(initialChoiceOrderRef.current.map((choice, index) => [choice, index]));
    updateOptions({
      choices: [...choices].sort((left, right) => {
        const leftRank = ranks.get(left) ?? Number.MAX_SAFE_INTEGER;
        const rightRank = ranks.get(right) ?? Number.MAX_SAFE_INTEGER;
        if (leftRank !== rightRank) return leftRank - rightRank;
        return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
      }),
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = Number(String(active.id).replace("choice-", ""));
    const newIdx = Number(String(over.id).replace("choice-", ""));
    if (Number.isNaN(oldIdx) || Number.isNaN(newIdx)) return;
    updateOptions({ choices: arrayMove(choices, oldIdx, newIdx) });
  };

  return (
    <div>
      <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("categories.choices")}</label>
      <div className="space-y-1.5 mb-2">
        {choices.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={choices.map((_, index) => `choice-${index}`)} strategy={verticalListSortingStrategy}>
              {choices.map((choice, index) => (
                <SortableChoice
                  key={`choice-${index}`}
                  id={`choice-${index}`}
                  value={choice}
                  onChange={(next) => updateOptions({ choices: choices.map((entry, entryIndex) => (entryIndex === index ? next : entry)) })}
                  onRemove={() => updateOptions({ choices: choices.filter((_, idx) => idx !== index) })}
                  placeholder={t("categories.choicePlaceholder")}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <p className="text-xs text-gray-400">{t("categories.noChoices")}</p>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={newChoice}
          onChange={(e) => setNewChoice(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={t("categories.addChoice")}
          className={`flex-1 ${categoryInputClass}`}
        />
        <button type="button" onClick={add} className="rounded-lg bg-blue-500 text-white px-3 py-1.5 text-sm font-medium hover:bg-blue-600">+</button>
        <button type="button" onClick={sortByName} disabled={choices.length < 2} title={t("categories.sortChoicesByName")} aria-label={t("categories.sortChoicesByName")} className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"><ArrowDownWideNarrow className="h-5 w-5" /></button>
        <button type="button" onClick={sortByOriginalOrder} disabled={choices.length < 2} title={t("categories.sortChoicesById")} aria-label={t("categories.sortChoicesById")} className="inline-flex h-[38px] min-w-[38px] items-center justify-center rounded-lg border border-gray-300 bg-white px-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10">ID</button>
      </div>
      <div className="mt-4 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer text-sm/6 font-medium text-gray-900 dark:text-white">
          <span>{t("categories.allowCustomChoice")}</span>
          <button type="button" onClick={() => updateOptions({ allowCustom: !optionConfig.allowCustom })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${optionConfig.allowCustom ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${optionConfig.allowCustom ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </label>
        {optionConfig.allowCustom ? <Field label={t("categories.customChoiceLabel")} value={optionConfig.customLabel} onChange={(value) => updateOptions({ customLabel: value })} /> : null}
        {property.property_type === "select" ? (
          <>
            <label className="flex items-center gap-3 cursor-pointer text-sm/6 font-medium text-gray-900 dark:text-white">
              <span>{t("categories.selectCount")}</span>
              <button type="button" onClick={() => updateOptions({ withCount: !optionConfig.withCount })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${optionConfig.withCount ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${optionConfig.withCount ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </label>
            {optionConfig.withCount ? <Field label={t("categories.selectCountLabel")} value={optionConfig.countLabel} onChange={(value) => updateOptions({ countLabel: value })} placeholder={t("categories.selectCountPlaceholder")} /> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

export function CategoryInlineForm({
  category,
  onChange,
  onCancel,
  onSave,
  showAIButton = false,
  aiBusy = false,
  onRunAI,
  t,
}: {
  category: Partial<Category>;
  onChange: (next: Partial<Category>) => void;
  onCancel: () => void;
  onSave: () => void;
  showAIButton?: boolean;
  aiBusy?: boolean;
  onRunAI?: () => void;
  t: (k: string) => string;
}) {
  return (
    <div className="space-y-4">
      <Field label={t("vendors.name")} value={category.name || ""} onChange={(v) => onChange({ ...category, name: v })} />
      <div>
        <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("common.color")}</label>
        <div className="flex items-center gap-2">
          <input type="color" value={category.color || "#6b7280"} onChange={(e) => onChange({ ...category, color: e.target.value })} className="h-8 w-10 rounded border border-gray-300 dark:border-gray-700 cursor-pointer" />
          <ColorPreviewBadge color={category.color} label={t("common.preview")} />
          {category.color ? (
            <button type="button" onClick={() => onChange({ ...category, color: undefined })} className="text-xs text-gray-400 hover:text-red-500">
              {t("common.remove")}
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {showAIButton && onRunAI ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRunAI}
              disabled={aiBusy}
              className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
              title={aiBusy ? t("categories.aiRunning") : t("categories.aiSuggestProperties")}
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">{t("common.cancel")}</button>
        <button onClick={onSave} className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600">{t("common.save")}</button>
      </div>
    </div>
  );
}

export function PropertyInlineForm({
  property,
  onChange,
  onCancel,
  onSave,
  propertyTypes,
  showAIButton = false,
  aiBusy = false,
  onRunAI,
  t,
}: {
  property: Partial<Property>;
  onChange: (next: Partial<Property>) => void;
  onCancel: () => void;
  onSave: () => void;
  propertyTypes: { value: string; label: string }[];
  showAIButton?: boolean;
  aiBusy?: boolean;
  onRunAI?: () => void;
  t: (k: string) => string;
}) {
  return (
    <div className="space-y-4">
      <Field label={t("vendors.name")} value={property.name || ""} onChange={(v) => onChange({ ...property, name: v })} />
      <SelectPicker
        label={t("categories.propertyType")}
        value={property.property_type || "text"}
        onChange={(v) => onChange({ ...property, property_type: v as string })}
        options={propertyTypes.map((pt) => ({ id: pt.value, name: pt.label }))}
        placeholder={t("categories.types.text")}
        searchable={false}
      />
      {property.property_type && TYPES_WITH_UNIT.has(property.property_type) ? (
        <Field label={t("categories.unit")} value={property.unit || ""} onChange={(v) => onChange({ ...property, unit: v || undefined })} placeholder={t("categories.unitPlaceholder")} />
      ) : null}
      {property.property_type && TYPES_WITH_CHOICES.has(property.property_type) ? <ChoicesEditor property={property} onChange={onChange} t={t} /> : null}
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-3 cursor-pointer text-sm/6 font-medium text-gray-900 dark:text-white">
          <span>{t("categories.requiredField")}</span>
          <button type="button" onClick={() => onChange({ ...property, required: !property.required })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${property.required ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${property.required ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </label>
        <label className="flex items-center gap-3 cursor-pointer text-sm/6 font-medium text-gray-900 dark:text-white">
          <span>{t("categories.showInList")}</span>
          <button type="button" onClick={() => onChange({ ...property, show_in_list: !property.show_in_list })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${property.show_in_list ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${property.show_in_list ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </label>
      </div>
      <div>
        <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("categories.displayWidth")}</label>
        <div className="flex rounded-lg bg-white p-0.5 outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-white/5 dark:outline-white/10">
          {([
            { value: "third", label: t("categories.width.third") },
            { value: "half", label: t("categories.width.half") },
            { value: "full", label: t("categories.width.full") },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...property, display_width: opt.value })}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm/6 font-medium transition ${
                (property.display_width || "third") === opt.value
                  ? "bg-gray-50 text-gray-900 shadow-xs dark:bg-white/10 dark:text-white dark:shadow-none"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {showAIButton && onRunAI ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRunAI}
              disabled={aiBusy}
              className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
              title={aiBusy ? t("categories.aiRunning") : t("categories.aiImproveProperty")}
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">{t("common.cancel")}</button>
        <button onClick={onSave} className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600">{t("common.save")}</button>
      </div>
    </div>
  );
}
