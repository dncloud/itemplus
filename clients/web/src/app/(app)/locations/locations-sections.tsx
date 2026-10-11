"use client";

import type React from "react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Printer } from "lucide-react";
import clsx from "clsx";
import { ColorField } from "@/components/ui/color-field";
import { DragLines, ExpandMarker, FormFooter, RowMenu, dragHandleClass, formCardClass, iconButtonClass } from "@/components/ui/list-controls";
import SelectPicker from "@/components/ui/select-picker";
import type { Location } from "@/lib/api";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

const locationInputClass = "w-full rounded-md bg-white px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500";

type RowProps = {
  location: Location;
  childCount: number;
  isOpen: boolean;
  managerName?: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPrintQR: () => void;
  canWrite: boolean;
  canDelete: boolean;
  pendingDelete?: boolean;
  canPrint: boolean;
  t: Translate;
  children?: React.ReactNode;
};

// One location, on the top level or nested: what is stored there, how many
// sub-locations it has, and the arrow in front when there is something to open.
function LocationRow({ location: loc, childCount, isOpen, managerName, onToggle, onEdit, onDelete, onPrintQR, canWrite, canDelete, pendingDelete = false, canPrint, t, children, nested }: RowProps & { nested: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: loc.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const itemCount = loc.item_count ?? 0;
  const summary = [
    itemCount === 1 ? t("categories.itemCountOne") : t("categories.itemCount", { count: itemCount }),
    childCount === 1 ? t("locations.childCountOne") : childCount > 1 ? t("locations.childCount", { count: childCount }) : "",
    loc.capacity != null ? `${t("locations.capacity")} ${loc.capacity}` : "",
  ].filter(Boolean).join(" · ");
  // A location that still holds items or sub-locations cannot be deleted.
  const blockedReason = [
    itemCount > 0 ? t("locations.inUseItems", { count: itemCount }) : "",
    childCount > 0 ? t("locations.inUseChildren", { count: childCount }) : "",
  ].filter(Boolean).join(" ") || undefined;
  const iconSize = nested ? "h-3.5 w-3.5" : "h-4 w-4";

  const label = (
    <span className="min-w-0">
      <span className={clsx("flex items-center gap-1.5 text-gray-900 dark:text-white", nested ? "text-sm font-medium" : "text-sm/6 font-semibold")}>
        {loc.color ? <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: loc.color }} /> : null}
        <span className="truncate">{loc.name}</span>
      </span>
      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{summary}</span>
    </span>
  );

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "z-20 opacity-90 shadow-lg" : ""}>
      <div
        className={clsx(
          "relative flex items-center",
          nested ? "gap-2 py-2" : "px-4 py-4 sm:px-6",
          !nested && (isOpen && childCount > 0 ? "bg-gray-50 dark:bg-white/5" : "hover:bg-gray-50 dark:hover:bg-white/2.5"),
        )}
      >
        {canWrite ? (
          <button {...attributes} {...listeners} title={t("categories.move")} aria-label={t("categories.move")} className={clsx(dragHandleClass, !nested && "mr-2")}>
            <DragLines className="h-4 w-4" />
          </button>
        ) : null}
        {childCount > 0 ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            title={isOpen ? t("locations.collapse") : t("locations.expand")}
            className="group flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <ExpandMarker open={isOpen} small={nested} />
            {label}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* Keeps the names in one line with the rows that have an arrow. */}
            <span aria-hidden="true" className={clsx("shrink-0", nested ? "size-6" : "size-7")} />
            {label}
          </div>
        )}
        {managerName ? <span className="mr-2 hidden rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 sm:inline dark:bg-white/5 dark:text-gray-300">{managerName}</span> : null}
        <div className="flex shrink-0 items-center gap-1">
          {canPrint ? (
            <button type="button" onClick={onPrintQR} title={t("locations.printLabel")} aria-label={t("locations.printLabel")} className={iconButtonClass}>
              <Printer className={iconSize} />
            </button>
          ) : null}
          {canWrite ? (
            <button type="button" onClick={onEdit} title={t("common.edit")} aria-label={t("common.edit")} className={iconButtonClass}>
              <Pencil className={iconSize} />
            </button>
          ) : null}
          {canDelete ? <RowMenu t={t} pending={pendingDelete} onDelete={onDelete} blockedReason={blockedReason} small={nested} /> : null}
        </div>
      </div>
      {!isDragging ? children : null}
    </div>
  );
}

export function SortableLocation(props: RowProps) {
  return <LocationRow {...props} nested={false} />;
}

export function SortableNestedLocation(props: RowProps) {
  return <LocationRow {...props} nested />;
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
  onPrintQR,
  canWrite,
  canDelete,
  pendingDeleteId,
  canPrint,
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
  onPrintQR: (id: number) => void;
  canWrite: boolean;
  canDelete: boolean;
  pendingDeleteId: number | null;
  canPrint: boolean;
  editLoc: Partial<Location> | null;
  setEditLoc: (next: Partial<Location> | null) => void;
  save: () => void;
  locations: Location[];
  users: { id: number; name: string }[];
  isNew: boolean;
  t: Translate;
}) {
  const children = childrenOf(location.id);
  const isOpen = expanded.has(location.id);
  return (
    <SortableNestedLocation
      location={location}
      childCount={children.length}
      isOpen={isOpen}
      onToggle={() => toggle(location.id)}
      onEdit={() => onEdit(location)}
      onDelete={() => onDelete(location.id)}
      pendingDelete={pendingDeleteId === location.id}
      onPrintQR={() => onPrintQR(location.id)}
      canWrite={canWrite}
      canDelete={canDelete}
      canPrint={canPrint}
      t={t}
    >
      {editLoc?.id === location.id && !isNew ? (
        <div className="pt-1 pb-3">
          <LocationInlineForm location={editLoc} onChange={setEditLoc} onCancel={() => setEditLoc(null)} onSave={save} locations={locations} users={users} t={t} />
        </div>
      ) : null}
      {isOpen && children.length > 0 ? (
        <div className="ml-3 border-l border-gray-200 pl-4 dark:border-gray-700">
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
                  pendingDeleteId={pendingDeleteId}
                  onPrintQR={onPrintQR}
                  canWrite={canWrite}
                  canDelete={canDelete}
                  canPrint={canPrint}
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
  t: Translate;
}) {
  const labelClass = "mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white";
  return (
    <div className={formCardClass}>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-6">
        <div className="sm:col-span-4">
          <label className={labelClass}>{t("vendors.name")}</label>
          <input value={location.name || ""} onChange={(e) => onChange({ ...location, name: e.target.value })} className={`h-[38px] ${locationInputClass}`} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>{t("locations.capacity")}</label>
          <input type="number" value={location.capacity ?? ""} onChange={(e) => onChange({ ...location, capacity: e.target.value ? Number(e.target.value) : undefined })} placeholder={t("locations.capacityHint")} className={`h-[38px] ${locationInputClass}`} />
        </div>
        <div className="sm:col-span-6">
          <label className={labelClass}>{t("items.description")}</label>
          <textarea value={location.description || ""} onChange={(e) => onChange({ ...location, description: e.target.value })} rows={2} className={locationInputClass} />
        </div>
        <div className="sm:col-span-3">
          <SelectPicker
            label={t("locations.parent")}
            value={location.parent_id ?? null}
            onChange={(v) => onChange({ ...location, parent_id: v ? Number(v) : null })}
            options={locations.filter((l) => l.id !== location.id).map((l) => ({ id: l.id, name: l.name }))}
            placeholder={t("locations.noParent")}
            clearLabel={t("locations.noParent")}
          />
        </div>
        <div className="sm:col-span-3">
          <SelectPicker
            label={t("locations.manager")}
            value={location.manager_id ?? null}
            onChange={(v) => onChange({ ...location, manager_id: v ? Number(v) : null })}
            options={users.map((u) => ({ id: u.id, name: u.name }))}
            placeholder={t("locations.noManager")}
            clearLabel={t("locations.noManager")}
          />
        </div>
        <div className="sm:col-span-6">
          <ColorField value={location.color} onChange={(color) => onChange({ ...location, color })} previewLabel={location.name?.trim() || t("common.preview")} t={t} />
        </div>
      </div>
      <FormFooter onCancel={onCancel} onSave={onSave} t={t} />
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
