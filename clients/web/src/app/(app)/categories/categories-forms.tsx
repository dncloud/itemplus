"use client";

import { useEffect, useRef, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { ArrowDownWideNarrow, Plus } from "lucide-react";
import { ColorField } from "@/components/ui/color-field";
import { FormFooter, formCardClass } from "@/components/ui/list-controls";
import SelectPicker from "@/components/ui/select-picker";
import type { Category, Property } from "@/lib/api";
import { isMasterDataRoleVisible } from "@/lib/category-master-data";
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

// A switch with its label and one line that says what it does.
function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm/6 font-medium text-gray-900 dark:text-white">{label}</span>
        {hint ? <span className="block text-xs text-gray-500 dark:text-gray-400">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className="group relative inline-flex w-11 shrink-0 rounded-full bg-gray-200 p-0.5 inset-ring inset-ring-gray-900/5 outline-offset-2 outline-indigo-600 transition-colors duration-200 ease-in-out focus-visible:outline-2 aria-checked:bg-indigo-600 dark:bg-white/5 dark:inset-ring-white/10 dark:outline-indigo-500 dark:aria-checked:bg-indigo-500"
      >
        <span className="size-5 rounded-full bg-white shadow-xs ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out group-aria-checked:translate-x-5" />
      </button>
    </div>
  );
}

function RoleVisibilityToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5">
      <span>{label}</span>
      <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-indigo-600 dark:bg-indigo-500" : "bg-gray-300 dark:bg-gray-600"}`}><span className={`inline-block h-3.5 w-3.5 translate-y-[3px] rounded-full bg-white transition ${checked ? "translate-x-[18px]" : "translate-x-[3px]"}`} /></span>
    </button>
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
        <button type="button" onClick={add} title={t("categories.addChoice")} aria-label={t("categories.addChoice")} className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"><Plus className="h-5 w-5" /></button>
        <button type="button" onClick={sortByName} disabled={choices.length < 2} title={t("categories.sortChoicesByName")} aria-label={t("categories.sortChoicesByName")} className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"><ArrowDownWideNarrow className="h-5 w-5" /></button>
        <button type="button" onClick={sortByOriginalOrder} disabled={choices.length < 2} title={t("categories.sortChoicesById")} aria-label={t("categories.sortChoicesById")} className="inline-flex h-[38px] min-w-[38px] items-center justify-center rounded-lg border border-gray-300 bg-white px-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10">ID</button>
      </div>
      <div className="mt-3 divide-y divide-gray-200 dark:divide-white/10">
        <SwitchRow label={t("categories.allowCustomChoice")} checked={optionConfig.allowCustom} onChange={() => updateOptions({ allowCustom: !optionConfig.allowCustom })} />
        {optionConfig.allowCustom ? <div className="py-3"><Field label={t("categories.customChoiceLabel")} value={optionConfig.customLabel} onChange={(value) => updateOptions({ customLabel: value })} /></div> : null}
        {property.property_type === "select" ? (
          <>
            <SwitchRow label={t("categories.selectCount")} checked={optionConfig.withCount} onChange={() => updateOptions({ withCount: !optionConfig.withCount })} />
            {optionConfig.withCount ? <div className="py-3"><Field label={t("categories.selectCountLabel")} value={optionConfig.countLabel} onChange={(value) => updateOptions({ countLabel: value })} placeholder={t("categories.selectCountPlaceholder")} /></div> : null}
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
    <div className={formCardClass}>
     <div className="space-y-4">
      <Field label={t("vendors.name")} value={category.name || ""} onChange={(v) => onChange({ ...category, name: v })} />
      <ColorField value={category.color} onChange={(color) => onChange({ ...category, color })} previewLabel={category.name?.trim() || t("common.preview")} t={t} />
      <div>
        <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("categories.masterDataRoles")}</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <RoleVisibilityToggle label={t("items.manufacturer")} checked={isMasterDataRoleVisible(category as Category, "manufacturer")} onChange={() => onChange({ ...category, show_manufacturer: !isMasterDataRoleVisible(category as Category, "manufacturer") })} />
          <RoleVisibilityToggle label={t("items.supplier")} checked={isMasterDataRoleVisible(category as Category, "supplier")} onChange={() => onChange({ ...category, show_supplier: !isMasterDataRoleVisible(category as Category, "supplier") })} />
          <RoleVisibilityToggle label={t("items.vendor")} checked={isMasterDataRoleVisible(category as Category, "vendor")} onChange={() => onChange({ ...category, show_vendor: !isMasterDataRoleVisible(category as Category, "vendor") })} />
          <RoleVisibilityToggle label={t("items.developer")} checked={isMasterDataRoleVisible(category as Category, "developer")} onChange={() => onChange({ ...category, show_developer: !isMasterDataRoleVisible(category as Category, "developer") })} />
          <RoleVisibilityToggle label={t("items.publisher")} checked={isMasterDataRoleVisible(category as Category, "publisher")} onChange={() => onChange({ ...category, show_publisher: !isMasterDataRoleVisible(category as Category, "publisher") })} />
        </div>
      </div>
     </div>
      <FormFooter
        onCancel={onCancel}
        onSave={onSave}
        ai={showAIButton && onRunAI ? { busy: aiBusy, label: t("categories.aiSuggestProperties"), busyLabel: t("categories.aiRunning"), onRun: onRunAI } : undefined}
        t={t}
      />
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
  const hasUnit = !!property.property_type && TYPES_WITH_UNIT.has(property.property_type);
  const width = property.display_width || "third";

  return (
    <div className={formCardClass}>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-6">
        <div className="sm:col-span-3">
          <Field label={t("vendors.name")} value={property.name || ""} onChange={(v) => onChange({ ...property, name: v })} />
        </div>
        <div className={hasUnit ? "sm:col-span-2" : "sm:col-span-3"}>
          <SelectPicker
            label={t("categories.propertyType")}
            value={property.property_type || "text"}
            onChange={(v) => onChange({ ...property, property_type: v as string })}
            options={propertyTypes.map((pt) => ({ id: pt.value, name: pt.label }))}
            placeholder={t("categories.types.text")}
            searchable={false}
          />
        </div>
        {hasUnit ? (
          <div className="sm:col-span-1">
            <Field label={t("categories.unit")} value={property.unit || ""} onChange={(v) => onChange({ ...property, unit: v || undefined })} placeholder={t("categories.unitPlaceholder")} />
          </div>
        ) : null}

        {property.property_type && TYPES_WITH_CHOICES.has(property.property_type) ? (
          <div className="sm:col-span-6">
            <ChoicesEditor property={property} onChange={onChange} t={t} />
          </div>
        ) : null}

        <div className="sm:col-span-6">
          <span className="block text-sm/6 font-medium text-gray-900 dark:text-white">{t("categories.displayWidth")}</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">{t("categories.displayWidthHint")}</span>
          {/* The three widths drawn to scale on the six-column grid of the item page. */}
          <div role="radiogroup" aria-label={t("categories.displayWidth")} className="mt-2 grid grid-cols-3 gap-2">
            {([
              { value: "third", span: "w-1/3" },
              { value: "half", span: "w-1/2" },
              { value: "full", span: "w-full" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={width === opt.value}
                onClick={() => onChange({ ...property, display_width: opt.value })}
                className="group rounded-md bg-white p-2.5 text-left outline-1 -outline-offset-1 outline-gray-300 hover:bg-gray-50 aria-checked:outline-2 aria-checked:-outline-offset-2 aria-checked:outline-indigo-600 dark:bg-white/5 dark:outline-white/10 dark:hover:bg-white/10 dark:aria-checked:outline-indigo-500"
              >
                <span className="block h-1.5 rounded-full bg-gray-100 dark:bg-white/5">
                  <span className={`block h-1.5 rounded-full bg-gray-300 group-aria-checked:bg-indigo-600 dark:bg-white/20 dark:group-aria-checked:bg-indigo-500 ${opt.span}`} />
                </span>
                <span className="mt-2 block text-sm font-medium text-gray-900 dark:text-white">{t(`categories.width.${opt.value}`)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-gray-200 border-t border-gray-200 sm:col-span-6 dark:divide-white/10 dark:border-white/10">
          <SwitchRow label={t("categories.requiredField")} hint={t("categories.requiredFieldHint")} checked={!!property.required} onChange={() => onChange({ ...property, required: !property.required })} />
          <SwitchRow label={t("categories.showInList")} hint={t("categories.showInListHint")} checked={!!property.show_in_list} onChange={() => onChange({ ...property, show_in_list: !property.show_in_list })} />
        </div>
      </div>
      <FormFooter
        onCancel={onCancel}
        onSave={onSave}
        ai={showAIButton && onRunAI ? { busy: aiBusy, label: t("categories.aiImproveProperty"), busyLabel: t("categories.aiRunning"), onRun: onRunAI } : undefined}
        t={t}
      />
    </div>
  );
}
