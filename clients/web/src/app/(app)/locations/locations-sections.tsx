"use client";

import type React from "react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bars3Icon, ChevronDownIcon, CubeIcon, PencilIcon, PrinterIcon, TrashIcon } from "@heroicons/react/24/outline";
import SelectPicker from "@/components/select-picker";
import type { Location } from "@/lib/api";

const locationInputClass = "w-full rounded-md bg-white px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500";

export function SortableLocation({
  location: loc,
  hasChildren,
  isOpen,
  managerName,
  onToggle,
  onEdit,
  onDelete,
  onShowItems,
  onPrintQR,
  canWrite,
  canDelete,
  canPrint,
  fmtDateTime,
  t,
  children,
}: {
  location: Location;
  hasChildren: boolean;
  isOpen: boolean;
  managerName?: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShowItems: () => void;
  onPrintQR: () => void;
  canWrite: boolean;
  canDelete: boolean;
  canPrint: boolean;
  fmtDateTime: (v: string) => string;
  t: (k: string) => string;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: loc.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`${isDragging ? "z-20 shadow-2xl opacity-90" : ""}`}>
      <div className="relative flex items-center gap-y-4 px-4 py-5 hover:bg-gray-50 sm:px-6 dark:hover:bg-white/2.5">
        <button {...attributes} {...listeners} className="mr-2 inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/10 cursor-grab active:cursor-grabbing">
          <Bars3Icon className="h-4 w-4 text-gray-400" />
        </button>
        <button onClick={onToggle} className="flex-1 flex items-center gap-2 text-left min-w-0">
          <div className="min-w-0">
            <span className="text-sm/6 font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
              {loc.color ? <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: loc.color }} /> : null}
              {loc.name}
              {hasChildren ? <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition shrink-0 ${isOpen ? "rotate-180" : ""}`} /> : null}
            </span>
            {loc.capacity != null ? <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{t("locations.capacity")} {loc.capacity}</span> : null}
            {loc.created_at ? (
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                {t("common.created")} {fmtDateTime(loc.created_at)}
                {loc.updated_at && loc.updated_at !== loc.created_at ? <> · {t("common.updated")} {fmtDateTime(loc.updated_at)}</> : null}
              </span>
            ) : null}
          </div>
        </button>
        {managerName ? <span className="mr-2 hidden rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-white/5 dark:text-gray-300 sm:inline">{managerName}</span> : null}
        <div className="flex items-center gap-1 shrink-0">
          {canPrint ? <button onClick={onPrintQR} title={t("common.print")} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/10"><PrinterIcon className="h-4 w-4 text-gray-400" /></button> : null}
          <button onClick={onShowItems} title="Items" className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/10"><CubeIcon className="h-4 w-4 text-gray-400" /></button>
          {canWrite ? <button onClick={onEdit} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/10"><PencilIcon className="h-4 w-4 text-gray-400" /></button> : null}
          {canDelete ? <button onClick={onDelete} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-red-50 dark:border-gray-700 dark:hover:bg-red-900/20"><TrashIcon className="h-4 w-4 text-red-400" /></button> : null}
        </div>
      </div>
      {!isDragging ? children : null}
    </div>
  );
}

export function SortableNestedLocation({
  location: child,
  hasChildren,
  isOpen,
  onToggle,
  onEdit,
  onDelete,
  onShowItems,
  onPrintQR,
  canWrite,
  canDelete,
  canPrint,
  fmtDateTime,
  t,
  children,
}: {
  location: Location;
  hasChildren: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShowItems: () => void;
  onPrintQR: () => void;
  canWrite: boolean;
  canDelete: boolean;
  canPrint: boolean;
  fmtDateTime: (v: string) => string;
  t: (k: string) => string;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: child.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`${isDragging ? "z-20 shadow-lg opacity-90" : ""}`}>
      <div>
        <div className="flex items-center gap-2 px-3 py-2">
          <button {...attributes} {...listeners} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-white/10 cursor-grab active:cursor-grabbing">
            <Bars3Icon className="h-3.5 w-3.5 text-gray-400" />
          </button>
          <button onClick={hasChildren ? onToggle : onShowItems} className="flex-1 min-w-0 text-left transition">
            <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
              {child.color ? <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: child.color }} /> : null}
              {child.name}
              {hasChildren ? <ChevronDownIcon className={`h-3.5 w-3.5 text-gray-400 transition shrink-0 ${isOpen ? "rotate-180" : ""}`} /> : null}
            </span>
            {child.capacity != null ? <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{t("locations.capacity")} {child.capacity}</span> : null}
            {child.created_at ? (
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                {t("common.created")} {fmtDateTime(child.created_at)}
                {child.updated_at && child.updated_at !== child.created_at ? <> · {t("common.updated")} {fmtDateTime(child.updated_at)}</> : null}
              </span>
            ) : null}
          </button>
          {canPrint ? <button onClick={onPrintQR} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-white/10" title={t("common.print")}><PrinterIcon className="h-3.5 w-3.5 text-gray-400" /></button> : null}
          {canWrite ? <button onClick={onEdit} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-white/10"><PencilIcon className="h-3.5 w-3.5 text-gray-400" /></button> : null}
          {canDelete ? <button onClick={onDelete} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-red-50 dark:border-gray-700 dark:hover:bg-red-900/20"><TrashIcon className="h-3.5 w-3.5 text-red-400" /></button> : null}
        </div>
        {!isDragging ? children : null}
      </div>
    </div>
  );
}

export function RecursiveNestedLocation({
  location,
  childrenOf,
  sensors,
  onDragEnd,
  expanded,
  toggle,
  onEdit,
  onDelete,
  onShowItems,
  onPrintQR,
  canWrite,
  canDelete,
  canPrint,
  fmtDateTime,
  editLoc,
  setEditLoc,
  save,
  locations,
  users,
  isNew,
  t,
}: {
  location: Location;
  childrenOf: (parentId: number) => Location[];
  sensors: unknown;
  onDragEnd: (event: DragEndEvent) => void;
  expanded: Set<number>;
  toggle: (id: number) => void;
  onEdit: (loc: Location) => void;
  onDelete: (id: number) => void;
  onShowItems: (id: number) => void;
  onPrintQR: (id: number) => void;
  canWrite: boolean;
  canDelete: boolean;
  canPrint: boolean;
  fmtDateTime: (v: string) => string;
  editLoc: Partial<Location> | null;
  setEditLoc: (next: Partial<Location> | null) => void;
  save: () => void;
  locations: Location[];
  users: { id: number; name: string }[];
  isNew: boolean;
  t: (k: string) => string;
}) {
  const children = childrenOf(location.id);
  const isOpen = expanded.has(location.id);
  return (
    <SortableNestedLocation
      location={location}
      hasChildren={children.length > 0}
      isOpen={isOpen}
      onToggle={() => toggle(location.id)}
      onEdit={() => onEdit(location)}
      onDelete={() => onDelete(location.id)}
      onShowItems={() => onShowItems(location.id)}
      onPrintQR={() => onPrintQR(location.id)}
      canWrite={canWrite}
      canDelete={canDelete}
      canPrint={canPrint}
      fmtDateTime={fmtDateTime}
      t={t}
    >
      {editLoc?.id === location.id && !isNew ? (
        <div className="border-t border-gray-100 px-3 py-4 dark:border-white/10">
          <LocationInlineForm location={editLoc} onChange={setEditLoc} onCancel={() => setEditLoc(null)} onSave={save} locations={locations} users={users} t={t} />
        </div>
      ) : null}
      {isOpen && children.length > 0 ? (
        <div className="mt-2 ml-5 space-y-2 border-l border-gray-200 pl-3 dark:border-gray-700">
          <DndContext sensors={sensors as never} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {children.map((child) => (
                <RecursiveNestedLocation
                  key={child.id}
                  location={child}
                  childrenOf={childrenOf}
                  sensors={sensors}
                  onDragEnd={onDragEnd}
                  expanded={expanded}
                  toggle={toggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onShowItems={onShowItems}
                  onPrintQR={onPrintQR}
                  canWrite={canWrite}
                  canDelete={canDelete}
                  canPrint={canPrint}
                  fmtDateTime={fmtDateTime}
                  editLoc={editLoc}
                  setEditLoc={setEditLoc}
                  save={save}
                  locations={locations}
                  users={users}
                  isNew={isNew}
                  t={t}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      ) : null}
    </SortableNestedLocation>
  );
}

export function LocationInlineForm({
  location,
  onChange,
  onCancel,
  onSave,
  locations,
  users,
  t,
}: {
  location: Partial<Location>;
  onChange: (next: Partial<Location>) => void;
  onCancel: () => void;
  onSave: () => void;
  locations: Location[];
  users: { id: number; name: string }[];
  t: (k: string) => string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("vendors.name")}</label>
        <input value={location.name || ""} onChange={(e) => onChange({ ...location, name: e.target.value })} className={`h-[38px] ${locationInputClass}`} />
      </div>
      <div>
        <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("items.description")}</label>
        <textarea value={location.description || ""} onChange={(e) => onChange({ ...location, description: e.target.value })} rows={2} className={locationInputClass} />
      </div>
      <SelectPicker
        label={t("locations.parent")}
        value={location.parent_id ?? null}
        onChange={(v) => onChange({ ...location, parent_id: v ? Number(v) : null })}
        options={locations.filter((l) => l.id !== location.id).map((l) => ({ id: l.id, name: l.name }))}
        placeholder={t("locations.noParent")}
        clearLabel={t("locations.noParent")}
      />
      <SelectPicker
        label={t("locations.manager")}
        value={location.manager_id ?? null}
        onChange={(v) => onChange({ ...location, manager_id: v ? Number(v) : null })}
        options={users.map((u) => ({ id: u.id, name: u.name }))}
        placeholder={t("locations.noManager")}
        clearLabel={t("locations.noManager")}
      />
      <div>
        <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("common.color")}</label>
        <div className="flex items-center gap-2">
          <input type="color" value={location.color || "#6b7280"} onChange={(e) => onChange({ ...location, color: e.target.value })} className="h-8 w-10 rounded border border-gray-300 dark:border-gray-700 cursor-pointer" />
          {location.color ? <button type="button" onClick={() => onChange({ ...location, color: undefined })} className="text-xs text-gray-400 hover:text-red-500">{t("common.remove")}</button> : null}
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("locations.capacity")}</label>
        <input type="number" value={location.capacity ?? ""} onChange={(e) => onChange({ ...location, capacity: e.target.value ? Number(e.target.value) : undefined })} placeholder={t("locations.capacityHint")} className={`h-[38px] ${locationInputClass}`} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">{t("common.cancel")}</button>
        <button onClick={onSave} className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600">{t("common.save")}</button>
      </div>
    </div>
  );
}

export function wouldCreateCycle(nodeId: number, newParentId: number, locations: Location[]): boolean {
  let current: number | undefined = newParentId;
  const visited = new Set<number>();
  while (current) {
    if (current === nodeId) return true;
    if (visited.has(current)) return true;
    visited.add(current);
    current = locations.find((l) => l.id === current)?.parent_id ?? undefined;
  }
  return false;
}
