"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Plus, ChevronRight } from "lucide-react";
import { ConfirmDelete, inUseMessage, readInUseInfo, useDeleteFlow, type InUseInfo } from "@/components/ui/confirm-delete";
import { FloatingNotification, type FloatingNotificationState } from "@/components/ui/floating-notification";
import {
  LocationInlineForm,
  RecursiveNestedLocation,
  SortableLocation,
  SortableNestedLocation,
  wouldCreateCycle,
} from "./locations-sections";
import {
  fetchLocationsPageData,
  getChildLocations,
  getRootLocations,
  getSiblingLocations,
  persistLocationSiblingOrder,
} from "./locations-page-utils";
import { pageActionClass } from "@/components/ui/list-controls";

export default function LocationsPage() {
  const { realm, can, printLocationQR, printerBridgeStatus, showPrintFeatures, t } = useApp();
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
      const data = await fetchLocationsPageData();
      setLocations(data.locations);
      setUsers(data.users);
    } catch {}
    loadingRef.current = false;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        const { locations, users } = await fetchLocationsPageData();
        if (!cancelled) {
          setLocations(locations);
          setUsers(users);
        }
      } catch {}
    };

    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, [realm]);

  const [notification, setNotification] = useState<FloatingNotificationState>(null);
  useEffect(() => {
    if (!notification) return;
    const timeout = window.setTimeout(() => setNotification(null), 7000);
    return () => window.clearTimeout(timeout);
  }, [notification]);
  const reportInUse = useCallback((info: InUseInfo) => {
    setNotification({ title: t("locations.deleteRefused"), message: inUseMessage(t, info), tone: "error" });
  }, [t]);

  const deleteFlow = useDeleteFlow({
    realm,
    onInUse: reportInUse,
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

  const closeLocation = (id: number) => {
    setExpanded((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const save = async () => {
    if (!editLoc?.name) return;
    if (!isNew && editLoc.id && editLoc.parent_id) {
      if (editLoc.parent_id === editLoc.id) {
        alert(t("locations.cycleError"));
        return;
      }
      if (wouldCreateCycle(editLoc.id, editLoc.parent_id, locations)) {
        alert(t("locations.circularError"));
        return;
      }
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
    // Known to be refused: say so right away instead of asking for confirmation first.
    const items = loc?.item_count ?? 0;
    const children = locations.filter((l) => l.parent_id === id).length;
    if (items > 0 || children > 0) {
      reportInUse({ type: "location", items, children });
      return;
    }
    deleteFlow.requestDelete(id, loc?.name || `#${id}`, "location");
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeLoc = locations.find((l) => l.id === active.id);
    const overLoc = locations.find((l) => l.id === over.id);
    if (!activeLoc || !overLoc || activeLoc.parent_id !== overLoc.parent_id) return;

    const parentId = activeLoc.parent_id ?? null;
    const siblings = getSiblingLocations(locations, parentId);
    const oldIdx = siblings.findIndex((l) => l.id === active.id);
    const newIdx = siblings.findIndex((l) => l.id === over.id);
    const reordered = arrayMove(siblings, oldIdx, newIdx);
    await persistLocationSiblingOrder(reordered);
    load();
  };

  const roots = getRootLocations(locations);
  const childrenOf = (parentId: number) => getChildLocations(locations, parentId);
  const canPrintActions = can("print") && showPrintFeatures && printerBridgeStatus === "connected";
  const pendingDeleteLocationId = deleteFlow.pending?.type === "location" ? deleteFlow.pending.id : null;

  const startEditLocation = (loc: Location) => {
    if (editLoc?.id === loc.id && !isNew) {
      setEditLoc(null);
      closeLocation(loc.id);
      return;
    }
    setEditLoc({ ...loc });
    setIsNew(false);
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(loc.id);
      return next;
    });
  };

  const renderLevel = (locs: Location[]) => (
    <SortableContext items={locs.map((l) => l.id)} strategy={verticalListSortingStrategy}>
      {locs.map((loc) => {
        const children = childrenOf(loc.id);
        const isOpen = expanded.has(loc.id);
        return (
          <SortableLocation
            key={loc.id}
            location={loc}
            childCount={children.length}
            isOpen={isOpen}
            managerName={loc.manager_id ? users.find((u) => u.id === loc.manager_id)?.name : undefined}
            onToggle={() => toggle(loc.id)}
            onEdit={() => startEditLocation(loc)}
            onDelete={() => remove(loc.id)}
            pendingDelete={pendingDeleteLocationId === loc.id}
            onPrintQR={() => {
              void printLocationQR(loc.id);
            }}
            canWrite={can("locations.write")}
            canDelete={can("locations.delete")}
            canPrint={canPrintActions}
            t={t}
          >
            {(editLoc?.id === loc.id && !isNew) || (isOpen && children.length > 0) ? (
              <div>
                {editLoc?.id === loc.id && !isNew ? (
                  <div className="px-4 py-4 sm:px-6">
                    <LocationInlineForm
                      location={editLoc}
                      onChange={setEditLoc}
                      onCancel={() => setEditLoc(null)}
                      onSave={save}
                      locations={locations}
                      users={users}
                      t={t}
                    />
                  </div>
                ) : null}

                {isOpen && children.length > 0 ? (
                  <div className="border-t border-gray-100 px-4 pt-5 pb-6 sm:px-6 dark:border-white/10">
                    <h4 className="mb-3 text-sm/6 font-medium text-gray-900 dark:text-white">{t("locations.children")}</h4>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                      <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                        {children.map((child) => (
                          <SortableNestedLocation
                            key={child.id}
                            location={child}
                            childCount={childrenOf(child.id).length}
                            isOpen={expanded.has(child.id)}
                            onToggle={() => toggle(child.id)}
                            onEdit={() => startEditLocation(child)}
                            onDelete={() => remove(child.id)}
                            pendingDelete={pendingDeleteLocationId === child.id}
                            onPrintQR={() => {
                              void printLocationQR(child.id);
                            }}
                            canWrite={can("locations.write")}
                            canDelete={can("locations.delete")}
                            canPrint={canPrintActions}
                            t={t}
                          >
                            {editLoc?.id === child.id && !isNew ? (
                              <div className="pt-1 pb-3">
                                <LocationInlineForm
                                  location={editLoc}
                                  onChange={setEditLoc}
                                  onCancel={() => setEditLoc(null)}
                                  onSave={save}
                                  locations={locations}
                                  users={users}
                                  t={t}
                                />
                              </div>
                            ) : null}

                            {expanded.has(child.id) && childrenOf(child.id).length > 0 ? (
                              <div className="ml-3 border-l border-gray-200 pl-4 dark:border-gray-700">
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
                                        onEdit={startEditLocation}
                                        onDelete={(id) => remove(id)}
                                        pendingDeleteId={pendingDeleteLocationId}
                                        onPrintQR={(id) => {
                                          void printLocationQR(id);
                                        }}
                                        canWrite={can("locations.write")}
                                        canDelete={can("locations.delete")}
                                        canPrint={canPrintActions}
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
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                ) : null}
              </div>
            ) : null}
          </SortableLocation>
        );
      })}
    </SortableContext>
  );

  return (
    <div className="space-y-6">
      <FloatingNotification notification={notification} onClose={() => setNotification(null)} t={t} />
      <div className="mb-4 text-center sm:flex sm:items-center sm:justify-between sm:text-left lg:mb-8">
        <div className="space-y-1 py-3">
          <nav className="text-sm font-medium dark:text-gray-100">
            <ol className="flex items-center justify-center sm:justify-start">
              <li>
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">
                  {t("nav.dashboard")}
                </Link>
              </li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRight className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-500 dark:text-gray-400">{realm === "archive" ? t("realm.archive") : t("realm.collection")}</li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRight className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-900 dark:text-white">{t("locations.title")}</li>
            </ol>
          </nav>
          <h2 className="text-2xl font-bold">{t("locations.title")}</h2>
        </div>

        <div className="flex items-center justify-center gap-2 rounded-sm px-2 py-3 sm:justify-end sm:bg-transparent sm:px-0">
          {can("locations.write") ? (
            <button
              type="button"
              onClick={() => {
                setEditLoc({ name: "" });
                setIsNew(true);
              }}
              className={pageActionClass}
            >
              <Plus aria-hidden="true" className="-ml-0.5 size-4" />
              {t("locations.newLocation")}
            </button>
          ) : null}
        </div>
      </div>

      {editLoc && isNew ? (
        <div className="overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-900/5 dark:bg-gray-800/50 dark:outline-white/10">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-white/10">
            <h3 className="font-semibold text-gray-900 dark:text-white">{t("locations.newLocation")}</h3>
          </div>
          <div className="px-4 py-4 sm:px-6">
            <LocationInlineForm
              location={editLoc}
              onChange={setEditLoc}
              onCancel={() => setEditLoc(null)}
              onSave={save}
              locations={locations}
              users={users}
              t={t}
            />
          </div>
        </div>
      ) : null}

      {roots.length > 0 ? (
        <div className="divide-y divide-gray-100 bg-white shadow-xs outline outline-1 -outline-offset-1 outline-gray-900/5 sm:rounded-xl dark:divide-white/5 dark:bg-gray-800/50 dark:outline-white/10">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            {renderLevel(roots)}
          </DndContext>
        </div>
      ) : (
        <p className="py-10 text-center text-gray-500">{t("locations.none")}</p>
      )}

      {deleteFlow.confirm ? (
        <ConfirmDelete
          name={deleteFlow.confirm.name}
          t={t}
          onConfirm={async () => {
            try {
              await api.deleteLocation(deleteFlow.confirm!.id);
            } catch (error) {
              // A location that still holds items or sub-locations stays; say why.
              const inUse = readInUseInfo(error);
              if (!inUse) throw error;
              reportInUse(inUse);
            }
            deleteFlow.cancelConfirm();
            load();
          }}
          onCancel={() => deleteFlow.cancelConfirm()}
        />
      ) : null}
    </div>
  );
}
