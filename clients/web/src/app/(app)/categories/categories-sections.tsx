"use client";

import { useState } from "react";
import type React from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Bars3Icon,
  ChevronDownIcon,
  CubeIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import SelectPicker from "@/components/select-picker";
import type { Category, Property } from "@/lib/api";

const categoryInputClass = "w-full h-[38px] rounded-md bg-white px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500";

export const TYPES_WITH_UNIT = new Set(["number", "dimensions"]);
export const TYPES_WITH_CHOICES = new Set(["select", "multiselect"]);

export function getPropertyTypes(t: (key: string) => string): { value: string; label: string }[] {
  return [
    { value: "text", label: t("categories.types.text") },
    { value: "textblock", label: t("categories.types.textblock") },
    { value: "number", label: t("categories.types.number") },
    { value: "boolean", label: t("categories.types.boolean") },
    { value: "date", label: t("categories.types.date") },
    { value: "time", label: t("categories.types.time") },
    { value: "select", label: t("categories.types.select") },
    { value: "multiselect", label: t("categories.types.multiselect") },
    { value: "rating", label: t("categories.types.rating") },
    { value: "dimensions", label: t("categories.types.dimensions") },
    { value: "age_rating", label: t("categories.types.ageRating") },
    { value: "condition", label: t("categories.types.condition") },
    { value: "priority", label: t("categories.types.priority") },
    { value: "weight", label: t("categories.types.weight") },
  ];
}

export function SortableProperty({
  property: prop,
  propertyTypeLabel,
  fmtDateTime,
  onEdit,
  onDelete,
  onToggleVisibility,
  t,
  children,
}: {
  property: Property;
  propertyTypeLabel: string;
  fmtDateTime: (v: string) => string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
  t: (k: string) => string;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: prop.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg">
      <div className="flex items-center gap-2 px-3 py-2">
        <button {...attributes} {...listeners} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-white/10 cursor-grab active:cursor-grabbing">
          <Bars3Icon className="h-3.5 w-3.5 text-gray-400" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{prop.name}</span>
            {prop.unit ? <span className="text-xs text-gray-400">({prop.unit})</span> : null}
            <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-400 dark:bg-gray-700">{propertyTypeLabel}</span>
            {prop.required ? <span className="shrink-0 text-xs text-red-400">*</span> : null}
            {prop.display_width && prop.display_width !== "third" ? (
              <span className="shrink-0 rounded bg-gray-200 px-1 py-0.5 text-[10px] text-gray-400 dark:bg-gray-700">
                {prop.display_width === "full" ? t("categories.width.full") : t("categories.width.half")}
              </span>
            ) : null}
          </div>
          {prop.created_at ? (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("common.created")} {fmtDateTime(prop.created_at)}
              <> · {t("common.updated")} {fmtDateTime(prop.updated_at || prop.created_at)}</>
            </p>
          ) : null}
        </div>
        <button onClick={onToggleVisibility} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-white/10" title={prop.show_in_list ? "👁" : "👁‍🗨"}>
          {prop.show_in_list ? <EyeIcon className="h-3.5 w-3.5 text-blue-500" /> : <EyeSlashIcon className="h-3.5 w-3.5 text-gray-300" />}
        </button>
        <button onClick={onEdit} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-white/10">
          <PencilIcon className="h-3.5 w-3.5 text-gray-400" />
        </button>
        <button onClick={onDelete} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-red-50 dark:border-gray-700 dark:hover:bg-red-900/20">
          <TrashIcon className="h-3.5 w-3.5 text-red-400" />
        </button>
      </div>
      {children}
    </div>
  );
}

export function SortableCategory({
  category,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onShowItems,
  fmtDateTime,
  t,
  children,
}: {
  category: Category;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShowItems: () => void;
  fmtDateTime: (v: string) => string;
  t: (k: string) => string;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="overflow-hidden">
      <div className="relative flex items-center gap-y-4 px-4 py-5 hover:bg-gray-50 sm:px-6 dark:hover:bg-white/2.5">
        <button {...attributes} {...listeners} className="mr-2 inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/10 cursor-grab active:cursor-grabbing">
          <Bars3Icon className="h-4 w-4 text-gray-400" />
        </button>
        <button onClick={onToggle} className="flex-1 flex items-center gap-2 text-left min-w-0">
          <div className="min-w-0">
            <span className="text-sm/6 font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
              {category.color ? <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: category.color }} /> : null}
              {category.name}
            </span>
            {category.created_at ? (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("common.created")} {fmtDateTime(category.created_at)}
                <> · {t("common.updated")} {fmtDateTime(category.updated_at || category.created_at)}</>
              </p>
            ) : null}
          </div>
          <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
        </button>
        <div className="flex gap-1">
          <button onClick={onShowItems} title="Items" className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/10"><CubeIcon className="h-4 w-4 text-gray-400" /></button>
          <button onClick={onEdit} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/10"><PencilIcon className="h-4 w-4 text-gray-400" /></button>
          <button onClick={onDelete} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-red-50 dark:border-gray-700 dark:hover:bg-red-900/20"><TrashIcon className="h-4 w-4 text-red-400" /></button>
        </div>
      </div>
      {children}
    </div>
  );
}

function SortableChoice({ id, value, onRemove }: { id: string; value: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-1.5">
      <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <Bars3Icon className="h-3.5 w-3.5 text-gray-400" />
      </button>
      <span className="flex-1 text-sm">{value}</span>
      <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-500">
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

export function CategoryInlineForm({
  category,
  onChange,
  onCancel,
  onSave,
  t,
}: {
  category: Partial<Category>;
  onChange: (next: Partial<Category>) => void;
  onCancel: () => void;
  onSave: () => void;
  t: (k: string) => string;
}) {
  return (
    <div className="space-y-4">
      <Field label={t("vendors.name")} value={category.name || ""} onChange={(v) => onChange({ ...category, name: v })} />
      <div>
        <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("common.color")}</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={category.color || "#6b7280"}
            onChange={(e) => onChange({ ...category, color: e.target.value })}
            className="h-8 w-10 rounded border border-gray-300 dark:border-gray-700 cursor-pointer"
          />
          {category.color ? (
            <button type="button" onClick={() => onChange({ ...category, color: undefined })} className="text-xs text-gray-400 hover:text-red-500">
              {t("common.remove")}
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">{t("common.cancel")}</button>
        <button onClick={onSave} className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600">{t("common.save")}</button>
      </div>
    </div>
  );
}

function ChoicesEditor({ choices, onChange, t }: { choices: string[]; onChange: (c: string[]) => void; t: (k: string) => string }) {
  const [newChoice, setNewChoice] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const add = () => {
    const trimmed = newChoice.trim();
    if (!trimmed || choices.includes(trimmed)) return;
    onChange([...choices, trimmed]);
    setNewChoice("");
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = choices.indexOf(String(active.id));
    const newIdx = choices.indexOf(String(over.id));
    onChange(arrayMove(choices, oldIdx, newIdx));
  };

  return (
    <div>
      <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("categories.choices")}</label>
      <div className="space-y-1.5 mb-2">
        {choices.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={choices} strategy={verticalListSortingStrategy}>
              {choices.map((choice, index) => (
                <SortableChoice key={choice} id={choice} value={choice} onRemove={() => onChange(choices.filter((_, idx) => idx !== index))} />
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
        <button type="button" onClick={add} className="rounded-lg bg-blue-500 text-white px-3 py-1.5 text-sm font-medium hover:bg-blue-600">
          +
        </button>
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
  t,
}: {
  property: Partial<Property>;
  onChange: (next: Partial<Property>) => void;
  onCancel: () => void;
  onSave: () => void;
  propertyTypes: { value: string; label: string }[];
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
      {property.property_type && TYPES_WITH_CHOICES.has(property.property_type) ? (
        <ChoicesEditor
          choices={(property.options as Record<string, unknown>)?.choices as string[] || []}
          onChange={(choices) => onChange({ ...property, options: { ...(property.options || {}), choices } })}
          t={t}
        />
      ) : null}
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
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">{t("common.cancel")}</button>
        <button onClick={onSave} className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600">{t("common.save")}</button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={categoryInputClass} />
    </div>
  );
}
