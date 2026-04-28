"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Category, type Property } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlusIcon, Bars3Icon, TrashIcon, PencilIcon, XMarkIcon, ChevronDownIcon, EyeIcon, EyeSlashIcon, CubeIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useDeleteFlow, ConfirmDelete } from "@/components/confirm-delete";
import SelectPicker from "@/components/select-picker";

// Property types where a unit makes sense
const TYPES_WITH_UNIT = new Set(["number", "dimensions"]);

// Property types that need configurable choices
const TYPES_WITH_CHOICES = new Set(["select", "multiselect"]);

function getPropertyTypes(t: (key: string) => string): { value: string; label: string }[] {
  return [
    { value: "text", label: t("categories.types.text") },
    { value: "textblock", label: t("categories.types.textblock") },
    { value: "number", label: t("categories.types.number") },
    { value: "boolean", label: t("categories.types.boolean") },
    { value: "date", label: t("categories.types.date") },
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

export default function CategoriesPage() {
  const { realm, fmtDateTime, t } = useApp();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [editCat, setEditCat] = useState<Partial<Category> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [editProp, setEditProp] = useState<Partial<Property> | null>(null);
  const [isNewProp, setIsNewProp] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const loadingRef = useRef(false);
  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const cats = await api.getCategories();
      setCategories(cats.sort((a, b) => a.position - b.position));
    } catch {}
    loadingRef.current = false;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        const cats = await api.getCategories();
        if (!cancelled) {
          setCategories(cats.sort((a, b) => a.position - b.position));
        }
      } catch {}
    };

    void loadInitial();
    return () => { cancelled = true; };
  }, [realm]);

  const loadProps = async (catId: number) => {
    const props = await api.getProperties(catId);
    setProperties(props.sort((a, b) => a.position - b.position));
  };

  const deleteFlow = useDeleteFlow({
    realm,
    onDeleted: useCallback(() => {
      load();
    }, [load]),
  });

  const propertyTypes = getPropertyTypes(t);

  const toggleExpand = async (catId: number) => {
    if (expanded === catId) { setExpanded(null); return; }
    setExpanded(catId);
    await loadProps(catId);
  };

  const saveCat = async () => {
    if (!editCat?.name) return;
    if (isNew) await api.createCategory({ ...editCat, position: categories.length });
    else if (editCat.id) await api.updateCategory(editCat.id, editCat);
    setEditCat(null);
    load();
  };

  const deleteCat = (id: number) => {
    const cat = categories.find((c) => c.id === id);
    deleteFlow.requestDelete(id, cat?.name || `#${id}`, "category");
  };

  const onCatDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = categories.findIndex((c) => c.id === active.id);
    const newIdx = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIdx, newIdx);
    setCategories(reordered);
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].position !== i) await api.updateCategory(reordered[i].id, { position: i });
    }
  };

  const onPropDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = properties.findIndex((p) => p.id === active.id);
    const newIdx = properties.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(properties, oldIdx, newIdx);
    setProperties(reordered);
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].position !== i) await api.updateProperty(reordered[i].id, { position: i });
    }
  };

  const saveProp = async () => {
    if (!editProp?.name || !editProp?.property_type) return;
    if (isNewProp) await api.createProperty({ ...editProp, category_id: expanded!, position: properties.length });
    else if (editProp.id) await api.updateProperty(editProp.id, editProp);
    setEditProp(null);
    if (expanded) loadProps(expanded);
  };

  const deleteProp = (id: number) => {
    const prop = properties.find((p) => p.id === id);
    deleteFlow.requestDelete(id, prop?.name || `#${id}`, "property");
  };

  const toggleShowInList = async (prop: Property) => {
    await api.updateProperty(prop.id, { show_in_list: !prop.show_in_list });
    if (expanded) loadProps(expanded);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("categories.title")}</h1>
        <button
          onClick={() => { setEditCat({ name: "" }); setIsNew(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 transition"
        >
          <PlusIcon className="h-4 w-4" /> {t("common.new")}
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onCatDragEnd}>
        <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {categories.map((cat) => (
              <SortableCategory
                key={cat.id}
                category={cat}
                isExpanded={expanded === cat.id}
                onToggle={() => toggleExpand(cat.id)}
                onEdit={() => { setEditCat({ ...cat }); setIsNew(false); }}
                onDelete={() => deleteCat(cat.id)}
                onShowItems={() => router.push(`/items?category=${cat.id}`)}
                fmtDateTime={fmtDateTime}
                t={t}
              >
                {expanded === cat.id && (
                  <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase">{t("categories.properties")}</h4>
                      <button
                        onClick={() => { setEditProp({ name: "", property_type: "text", show_in_list: false }); setIsNewProp(true); }}
                        className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                      >
                        {t("categories.addProperty")}
                      </button>
                    </div>
                    {properties.length === 0 && <p className="text-xs text-gray-400">{t("categories.noProperties")}</p>}
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onPropDragEnd}>
                      <SortableContext items={properties.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                        {properties.map((prop) => (
                          <SortableProperty
                            key={prop.id}
                            property={prop}
                            propertyTypeLabel={propertyTypes.find((type) => type.value === prop.property_type)?.label || prop.property_type}
                            onEdit={() => { setEditProp({ ...prop }); setIsNewProp(false); }}
                            onDelete={() => deleteProp(prop.id)}
                            onToggleVisibility={() => toggleShowInList(prop)}
                            t={t}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                )}
              </SortableCategory>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {categories.length === 0 && <p className="text-center text-gray-500 py-10">{t("categories.none")}</p>}

      {/* Category Edit Modal */}
      {editCat && (
        <Modal title={isNew ? t("common.new") : t("common.edit")} onClose={() => setEditCat(null)} onSave={saveCat} t={t}>
          <Field label={t("vendors.name")} value={editCat.name || ""} onChange={(v) => setEditCat({ ...editCat, name: v })} />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Farbe</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={editCat.color || "#6b7280"}
                onChange={(e) => setEditCat({ ...editCat, color: e.target.value })}
                className="h-8 w-10 rounded border border-gray-300 dark:border-gray-700 cursor-pointer"
              />
              {editCat.color && (
                <button
                  type="button"
                  onClick={() => setEditCat({ ...editCat, color: undefined })}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  Entfernen
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Delete */}
      {deleteFlow.confirm && (
        <ConfirmDelete
          name={deleteFlow.confirm.name}
          t={t}
          onConfirm={async () => {
            if (deleteFlow.confirm!.type === "category") {
              await api.deleteCategory(deleteFlow.confirm!.id);
              if (expanded === deleteFlow.confirm!.id) setExpanded(null);
              load();
            } else {
              await api.deleteProperty(deleteFlow.confirm!.id);
              if (expanded) loadProps(expanded);
            }
            deleteFlow.cancelConfirm();
          }}
          onCancel={() => deleteFlow.cancelConfirm()}
        />
      )}

      {/* Property Edit Modal */}
      {editProp && (
        <Modal title={isNewProp ? t("common.new") : t("common.edit")} onClose={() => setEditProp(null)} onSave={saveProp} t={t}>
          <Field label={t("vendors.name")} value={editProp.name || ""} onChange={(v) => setEditProp({ ...editProp, name: v })} />

          <SelectPicker
            label={t("categories.propertyType")}
            value={editProp.property_type || "text"}
            onChange={(v) => setEditProp({ ...editProp, property_type: v as string })}
            options={propertyTypes.map((pt) => ({ id: pt.value, name: pt.label }))}
            placeholder={t("categories.types.text")}
            searchable={false}
          />

          {/* Unit only for types that need it */}
          {editProp.property_type && TYPES_WITH_UNIT.has(editProp.property_type) && (
            <Field label={t("categories.unit")} value={editProp.unit || ""} onChange={(v) => setEditProp({ ...editProp, unit: v || undefined })} placeholder={t("categories.unitPlaceholder")} />
          )}

          {/* Choices editor for select/multiselect */}
          {editProp.property_type && TYPES_WITH_CHOICES.has(editProp.property_type) && (
            <ChoicesEditor
              choices={(editProp.options as Record<string, unknown>)?.choices as string[] || []}
              onChange={(choices) => setEditProp({ ...editProp, options: { ...(editProp.options || {}), choices } })}
              t={t}
            />
          )}

          <div className="flex gap-6">
            <label className="flex items-center gap-3 cursor-pointer text-sm text-gray-700 dark:text-gray-400">
              <span>{t("categories.requiredField")}</span>
              <button type="button" onClick={() => setEditProp({ ...editProp, required: !editProp.required })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${editProp.required ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${editProp.required ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </label>
            <label className="flex items-center gap-3 cursor-pointer text-sm text-gray-700 dark:text-gray-400">
              <span>{t("categories.showInList")}</span>
              <button type="button" onClick={() => setEditProp({ ...editProp, show_in_list: !editProp.show_in_list })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${editProp.show_in_list ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${editProp.show_in_list ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </label>
          </div>

          {/* Display Width */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("categories.displayWidth")}</label>
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
              {([
                { value: "third", label: t("categories.width.third") },
                { value: "half", label: t("categories.width.half") },
                { value: "full", label: t("categories.width.full") },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEditProp({ ...editProp, display_width: opt.value })}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                    (editProp.display_width || "third") === opt.value
                      ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SortableProperty({ property: prop, propertyTypeLabel, onEdit, onDelete, onToggleVisibility, t }: {
  property: Property; propertyTypeLabel: string; onEdit: () => void; onDelete: () => void; onToggleVisibility: () => void; t: (k: string) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: prop.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
      <button {...attributes} {...listeners} className="p-0.5 cursor-grab active:cursor-grabbing">
        <Bars3Icon className="h-3.5 w-3.5 text-gray-400" />
      </button>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium truncate">{prop.name}</span>
        {prop.unit ? <span className="text-xs text-gray-400">({prop.unit})</span> : null}
        <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded shrink-0">{propertyTypeLabel}</span>
        {prop.required ? <span className="text-xs text-red-400 shrink-0">*</span> : null}
        {prop.display_width && prop.display_width !== "third" ? (
          <span className="text-[10px] text-gray-400 bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded shrink-0">
            {prop.display_width === "full" ? t("categories.width.full") : t("categories.width.half")}
          </span>
        ) : null}
      </div>
      <button onClick={onToggleVisibility} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" title={prop.show_in_list ? "👁" : "👁‍🗨"}>
        {prop.show_in_list
          ? <EyeIcon className="h-3.5 w-3.5 text-blue-500" />
          : <EyeSlashIcon className="h-3.5 w-3.5 text-gray-300" />}
      </button>
      <button onClick={onEdit} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
        <PencilIcon className="h-3.5 w-3.5 text-gray-400" />
      </button>
      <button onClick={onDelete} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
        <TrashIcon className="h-3.5 w-3.5 text-red-400" />
      </button>
    </div>
  );
}

function SortableCategory({
  category, isExpanded, onToggle, onEdit, onDelete, onShowItems, fmtDateTime, t, children,
}: {
  category: Category; isExpanded: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void; onShowItems: () => void; fmtDateTime: (v: string) => string; t: (k: string) => string; children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="flex items-center px-4 py-3">
        <button {...attributes} {...listeners} className="p-1 cursor-grab active:cursor-grabbing mr-2">
          <Bars3Icon className="h-4 w-4 text-gray-400" />
        </button>
        <button onClick={onToggle} className="flex-1 flex items-center gap-2 text-left min-w-0">
          <div className="min-w-0">
            <span className="text-sm font-medium flex items-center gap-1.5">
              {category.color && <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: category.color }} />}
              {category.name}
            </span>
            {category.created_at && (
              <p className="text-[11px] text-gray-400">
                {t("common.created")}: {fmtDateTime(category.created_at)}
                {category.updated_at && category.updated_at !== category.created_at && (
                  <> · {t("common.updated")}: {fmtDateTime(category.updated_at)}</>
                )}
              </p>
            )}
          </div>
          <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
        </button>
        <div className="flex gap-1">
          <button onClick={onShowItems} title="Items" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"><CubeIcon className="h-4 w-4 text-gray-400" /></button>
          <button onClick={onEdit} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"><PencilIcon className="h-4 w-4 text-gray-400" /></button>
          <button onClick={onDelete} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><TrashIcon className="h-4 w-4 text-red-400" /></button>
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
      <label className="block text-xs font-medium text-gray-500 mb-1">{t("categories.choices")}</label>
      <div className="space-y-1.5 mb-2">
        {choices.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={choices} strategy={verticalListSortingStrategy}>
              {choices.map((c, i) => (
                <SortableChoice key={c} id={c} value={c} onRemove={() => onChange(choices.filter((_, idx) => idx !== i))} />
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
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-lg bg-blue-500 text-white px-3 py-1.5 text-sm font-medium hover:bg-blue-600"
        >
          +
        </button>
      </div>
    </div>
  );
}

function Modal({ title, onClose, onSave, t, children }: { title: string; onClose: () => void; onSave: () => void; t: (k: string) => string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
        </div>
        {children}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">{t("common.cancel")}</button>
          <button onClick={onSave} className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600">{t("common.save")}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
