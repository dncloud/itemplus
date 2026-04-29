"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Location } from "@/lib/api";
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
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, ChevronRightIcon, Bars3Icon, CubeIcon, PrinterIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useDeleteFlow, ConfirmDelete } from "@/components/confirm-delete";
import SelectPicker from "@/components/select-picker";

export default function LocationsPage() {
  const { realm, can, fmtDateTime, printLocationQR, t } = useApp();
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [editLoc, setEditLoc] = useState<Partial<Location> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const loadingRef = useRef(false);
  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const [locs, us] = await Promise.all([api.getLocations(), api.getUsersLookup()]);
      setLocations(locs.sort((a, b) => a.position - b.position));
      setUsers(us);
    } catch {}
    loadingRef.current = false;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        const [locs, us] = await Promise.all([api.getLocations(), api.getUsersLookup()]);
        if (!cancelled) {
          setLocations(locs.sort((a, b) => a.position - b.position));
          setUsers(us);
        }
      } catch {}
    };

    void loadInitial();
    return () => { cancelled = true; };
  }, [realm]);

  const deleteFlow = useDeleteFlow({
    realm,
    onDeleted: useCallback(() => {
      load();
    }, [load]),
  });

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!editLoc?.name) return;
    if (!isNew && editLoc.id && editLoc.parent_id) {
      if (editLoc.parent_id === editLoc.id) { alert(t("locations.cycleError")); return; }
      if (wouldCreateCycle(editLoc.id, editLoc.parent_id, locations)) { alert(t("locations.circularError")); return; }
    }
    const payload = {
      ...editLoc,
      parent_id: editLoc.parent_id ?? null,
      manager_id: editLoc.manager_id ?? null,
    };
    if (isNew) await api.createLocation({ ...payload, position: locations.length });
    else if (editLoc.id) await api.updateLocation(editLoc.id, payload);
    setEditLoc(null);
    load();
  };

  const remove = (id: number) => {
    const loc = locations.find((l) => l.id === id);
    deleteFlow.requestDelete(id, loc?.name || `#${id}`, "location");
  };

  // Reorder within same parent level
  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeLoc = locations.find((l) => l.id === active.id);
    const overLoc = locations.find((l) => l.id === over.id);
    if (!activeLoc || !overLoc || activeLoc.parent_id !== overLoc.parent_id) return;

    // Get siblings of this parent level
    const parentId = activeLoc.parent_id;
    const siblings = locations.filter((l) => l.parent_id === parentId).sort((a, b) => a.position - b.position);
    const oldIdx = siblings.findIndex((l) => l.id === active.id);
    const newIdx = siblings.findIndex((l) => l.id === over.id);
    const reordered = arrayMove(siblings, oldIdx, newIdx);

    // Update positions
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].position !== i) await api.updateLocation(reordered[i].id, { position: i });
    }
    load();
  };

  const roots = locations.filter((l) => !l.parent_id).sort((a, b) => a.position - b.position);
  const childrenOf = (parentId: number) => locations.filter((l) => l.parent_id === parentId).sort((a, b) => a.position - b.position);

  const renderLevel = (locs: Location[]) => (
    <SortableContext items={locs.map((l) => l.id)} strategy={verticalListSortingStrategy}>
      {locs.map((loc) => {
        const children = childrenOf(loc.id);
        const isOpen = expanded.has(loc.id);
        return (
          <div key={loc.id}>
            <SortableLocation
              location={loc}
              hasChildren={children.length > 0}
              isOpen={isOpen}
              managerName={loc.manager_id ? users.find((u) => u.id === loc.manager_id)?.name : undefined}
              onToggle={() => toggle(loc.id)}
              onEdit={() => { setEditLoc({ ...loc }); setIsNew(false); }}
              onDelete={() => remove(loc.id)}
              onShowItems={() => router.push(`/items?location=${loc.id}`)}
              onPrintQR={() => { void printLocationQR(loc.id); }}
              canWrite={can("locations.write")}
              canDelete={can("locations.delete")}
              canPrint={can("print")}
              fmtDateTime={fmtDateTime}
              t={t}
            >
              {isOpen && children.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Untergeordnete Standorte</h4>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                      {children.map((child) => (
                        <SortableNestedLocation
                          key={child.id}
                          location={child}
                          hasChildren={childrenOf(child.id).length > 0}
                          isOpen={expanded.has(child.id)}
                          onToggle={() => toggle(child.id)}
                          onEdit={() => { setEditLoc({ ...child }); setIsNew(false); }}
                          onDelete={() => remove(child.id)}
                          onShowItems={() => router.push(`/items?location=${child.id}`)}
                          onPrintQR={() => { void printLocationQR(child.id); }}
                          canWrite={can("locations.write")}
                          canDelete={can("locations.delete")}
                          canPrint={can("print")}
                          t={t}
                        >
                          {expanded.has(child.id) && childrenOf(child.id).length > 0 && (
                            <div className="mt-2 ml-5 space-y-2 border-l border-gray-200 pl-3 dark:border-gray-700">
                              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                                <SortableContext items={childrenOf(child.id).map((c) => c.id)} strategy={verticalListSortingStrategy}>
                                  {childrenOf(child.id).map((nested) => (
                                    <RecursiveNestedLocation
                                      key={nested.id}
                                      location={nested}
                                      childrenOf={childrenOf}
                                      sensors={sensors}
                                      onDragEnd={onDragEnd}
                                      expanded={expanded}
                                      toggle={toggle}
                                      onEdit={(loc) => { setEditLoc({ ...loc }); setIsNew(false); }}
                                      onDelete={(id) => remove(id)}
                                      onShowItems={(id) => router.push(`/items?location=${id}`)}
                                      onPrintQR={(id) => { void printLocationQR(id); }}
                                      canWrite={can("locations.write")}
                                      canDelete={can("locations.delete")}
                                      canPrint={can("print")}
                                      t={t}
                                    />
                                  ))}
                                </SortableContext>
                              </DndContext>
                            </div>
                          )}
                        </SortableNestedLocation>
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </SortableLocation>
          </div>
        );
      })}
    </SortableContext>
  );

  return (
    <div className="w-full max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("locations.title")}</h1>
        {can("locations.write") && (
          <button
            onClick={() => { setEditLoc({ name: "" }); setIsNew(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 transition"
          >
            <PlusIcon className="h-4 w-4" /> {t("common.new")}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {roots.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            {renderLevel(roots)}
          </DndContext>
        ) : (
          <p className="p-6 text-center text-gray-500">{t("locations.none")}</p>
        )}
      </div>

      {/* Edit Modal */}
      {editLoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{isNew ? t("common.new") : t("common.edit")}</h2>
              <button onClick={() => setEditLoc(null)}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("vendors.name")}</label>
              <input
                value={editLoc.name || ""}
                onChange={(e) => setEditLoc({ ...editLoc, name: e.target.value })}
                className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("items.description")}</label>
              <textarea
                value={editLoc.description || ""}
                onChange={(e) => setEditLoc({ ...editLoc, description: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <SelectPicker
              label={t("locations.parent")}
              value={editLoc.parent_id ?? null}
              onChange={(v) => setEditLoc({ ...editLoc, parent_id: v ? Number(v) : null })}
              options={locations.filter((l) => l.id !== editLoc.id).map((l) => ({ id: l.id, name: l.name }))}
              placeholder={t("locations.noParent")}
              clearLabel={t("locations.noParent")}
            />

            <SelectPicker
              label={t("locations.manager")}
              value={editLoc.manager_id ?? null}
              onChange={(v) => setEditLoc({ ...editLoc, manager_id: v ? Number(v) : null })}
              options={users.map((u) => ({ id: u.id, name: u.name }))}
              placeholder={t("locations.noManager")}
              clearLabel={t("locations.noManager")}
            />

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("common.color")}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={editLoc.color || "#6b7280"}
                  onChange={(e) => setEditLoc({ ...editLoc, color: e.target.value })}
                  className="h-8 w-10 rounded border border-gray-300 dark:border-gray-700 cursor-pointer"
                />
                {editLoc.color && (
                  <button
                    type="button"
                    onClick={() => setEditLoc({ ...editLoc, color: undefined })}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    {t("common.remove")}
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("locations.capacity")}</label>
              <input
                type="number"
                value={editLoc.capacity ?? ""}
                onChange={(e) => setEditLoc({ ...editLoc, capacity: e.target.value ? Number(e.target.value) : undefined })}
                placeholder={t("locations.capacityHint")}
                className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditLoc(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">{t("common.cancel")}</button>
              <button onClick={save} className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600">{t("common.save")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {deleteFlow.confirm && (
        <ConfirmDelete
          name={deleteFlow.confirm.name}
          t={t}
          onConfirm={async () => {
            await api.deleteLocation(deleteFlow.confirm!.id);
            deleteFlow.cancelConfirm();
            load();
          }}
          onCancel={() => deleteFlow.cancelConfirm()}
        />
      )}
    </div>
  );
}

function SortableLocation({ location: loc, hasChildren, isOpen, managerName, onToggle, onEdit, onDelete, onShowItems, onPrintQR, canWrite, canDelete, canPrint, fmtDateTime, t, children }: {
  location: Location; hasChildren: boolean; isOpen: boolean; managerName?: string;
  onToggle: () => void; onEdit: () => void; onDelete: () => void; onShowItems: () => void; onPrintQR: () => void; canWrite: boolean; canDelete: boolean; canPrint: boolean; fmtDateTime: (v: string) => string; t: (k: string) => string; children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: loc.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden ${isDragging ? "z-20 shadow-2xl opacity-90" : ""}`}>
      <div className="flex items-center px-4 py-3">
        <button {...attributes} {...listeners} className="p-1 cursor-grab active:cursor-grabbing mr-2">
          <Bars3Icon className="h-4 w-4 text-gray-400" />
        </button>

        <button onClick={onToggle} className="flex-1 flex items-center gap-2 text-left min-w-0">
          <div className="min-w-0">
            <span className="text-sm font-medium flex items-center gap-1.5">
              {loc.color && <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: loc.color }} />}
              {loc.name}
              {hasChildren && (
                <ChevronRightIcon className={`h-4 w-4 text-gray-400 transition shrink-0 ${isOpen ? "rotate-90" : ""}`} />
              )}
            </span>
            {loc.description && <span className="text-xs text-gray-400 block">{loc.description}</span>}
            {loc.created_at && (
              <span className="text-[11px] text-gray-400 block">
                {t("common.created")}: {fmtDateTime(loc.created_at)}
                {loc.updated_at && loc.updated_at !== loc.created_at && (
                  <> · {t("common.updated")}: {fmtDateTime(loc.updated_at)}</>
                )}
              </span>
            )}
          </div>
        </button>

        {managerName && (
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded mr-2 hidden sm:inline">
            {managerName}
          </span>
        )}
        {loc.capacity != null ? (
          <span className="text-[10px] text-gray-400 mr-2 hidden sm:inline">{t("locations.capacity")} {loc.capacity}</span>
        ) : null}

        <div className="flex items-center gap-1 shrink-0">
          {canPrint && (
            <button onClick={onPrintQR} title="QR drucken" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <PrinterIcon className="h-4 w-4 text-gray-400" />
            </button>
          )}
          <button onClick={onShowItems} title="Items" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <CubeIcon className="h-4 w-4 text-gray-400" />
          </button>
          {canWrite && (
            <button onClick={onEdit} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <PencilIcon className="h-4 w-4 text-gray-400" />
            </button>
          )}
          {canDelete && (
            <button onClick={onDelete} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
              <TrashIcon className="h-4 w-4 text-red-400" />
            </button>
          )}
        </div>
      </div>
      {!isDragging ? children : null}
    </div>
  );
}

function SortableNestedLocation({ location: child, hasChildren, isOpen, onToggle, onEdit, onDelete, onShowItems, onPrintQR, canWrite, canDelete, canPrint, t, children }: {
  location: Location; hasChildren: boolean; isOpen: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void; onShowItems: () => void; onPrintQR: () => void; canWrite: boolean; canDelete: boolean; canPrint: boolean; t: (k: string) => string; children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: child.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`${isDragging ? "z-20 shadow-lg opacity-90" : ""}`}>
      <div className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
        <button {...attributes} {...listeners} className="p-0.5 cursor-grab active:cursor-grabbing">
          <Bars3Icon className="h-3.5 w-3.5 text-gray-400" />
        </button>
        <button onClick={hasChildren ? onToggle : onShowItems} className="flex-1 min-w-0 text-left hover:text-blue-500 transition">
          <span className="text-sm font-medium flex items-center gap-1.5">
            {child.color && <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: child.color }} />}
            {child.name}
            {hasChildren && (
              <ChevronRightIcon className={`h-3.5 w-3.5 text-gray-400 transition shrink-0 ${isOpen ? "rotate-90" : ""}`} />
            )}
          </span>
        </button>
        {canPrint && (
          <button onClick={onPrintQR} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" title="QR drucken">
            <PrinterIcon className="h-3.5 w-3.5 text-gray-400" />
          </button>
        )}
        {child.capacity != null ? <span className="text-[10px] text-gray-400 shrink-0">{t("locations.capacity")} {child.capacity}</span> : null}
        {canWrite && (
          <button onClick={onEdit} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
            <PencilIcon className="h-3.5 w-3.5 text-gray-400" />
          </button>
        )}
        {canDelete && (
          <button onClick={onDelete} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
            <TrashIcon className="h-3.5 w-3.5 text-red-400" />
          </button>
        )}
      </div>
      {!isDragging ? children : null}
    </div>
  );
}

function RecursiveNestedLocation({ location, childrenOf, sensors, onDragEnd, expanded, toggle, onEdit, onDelete, onShowItems, onPrintQR, canWrite, canDelete, canPrint, t }: {
  location: Location;
  childrenOf: (parentId: number) => Location[];
  sensors: ReturnType<typeof useSensors>;
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
      t={t}
    >
      {isOpen && children.length > 0 && (
        <div className="mt-2 ml-5 space-y-2 border-l border-gray-200 pl-3 dark:border-gray-700">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
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
                  t={t}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </SortableNestedLocation>
  );
}

function wouldCreateCycle(nodeId: number, newParentId: number, locations: Location[]): boolean {
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
