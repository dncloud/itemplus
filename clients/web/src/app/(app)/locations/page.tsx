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
import { PlusIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useDeleteFlow, ConfirmDelete } from "@/components/confirm-delete";
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

export default function LocationsPage() {
  const { realm, can, fmtDateTime, printLocationQR, printerBridgeStatus, showPrintFeatures, t } = useApp();
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
            hasChildren={children.length > 0}
            isOpen={isOpen}
            managerName={loc.manager_id ? users.find((u) => u.id === loc.manager_id)?.name : undefined}
            onToggle={() => toggle(loc.id)}
            onEdit={() => startEditLocation(loc)}
            onDelete={() => remove(loc.id)}
            onShowItems={() => router.push(`/items?location=${loc.id}`)}
            onPrintQR={() => {
              void printLocationQR(loc.id);
            }}
            canWrite={can("locations.write")}
            canDelete={can("locations.delete")}
            canPrint={canPrintActions}
            fmtDateTime={fmtDateTime}
            t={t}
          >
            {(editLoc?.id === loc.id && !isNew) || (isOpen && children.length > 0) ? (
              <div>
                {editLoc?.id === loc.id && !isNew ? (
                  <div className="border-t border-gray-100 px-4 py-4 sm:px-6 dark:border-white/10">
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
                  <div className="border-t border-gray-100 px-4 py-4 sm:px-6 dark:border-white/10 space-y-2">
                    <h4 className="mb-2 text-sm/6 font-medium text-gray-900 dark:text-white">Untergeordnete Standorte</h4>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                      <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                        {children.map((child) => (
                          <SortableNestedLocation
                            key={child.id}
                            location={child}
                            hasChildren={childrenOf(child.id).length > 0}
                            isOpen={expanded.has(child.id)}
                            onToggle={() => toggle(child.id)}
                            onEdit={() => startEditLocation(child)}
                            onDelete={() => remove(child.id)}
                            onShowItems={() => router.push(`/items?location=${child.id}`)}
                            onPrintQR={() => {
                              void printLocationQR(child.id);
                            }}
                            canWrite={can("locations.write")}
                            canDelete={can("locations.delete")}
                            canPrint={canPrintActions}
                            fmtDateTime={fmtDateTime}
                            t={t}
                          >
                            {editLoc?.id === child.id && !isNew ? (
                              <div className="border-t border-gray-100 px-3 py-4 dark:border-white/10">
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
                                        onEdit={startEditLocation}
                                        onDelete={(id) => remove(id)}
                                        onShowItems={(id) => router.push(`/items?location=${id}`)}
                                        onPrintQR={(id) => {
                                          void printLocationQR(id);
                                        }}
                                        canWrite={can("locations.write")}
                                        canDelete={can("locations.delete")}
                                        canPrint={canPrintActions}
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
      <div className="mb-4 text-center sm:flex sm:items-center sm:justify-between sm:border-b sm:border-gray-200 sm:text-left lg:mb-8 dark:border-white/10">
        <div className="space-y-1 py-3">
          <nav className="text-sm font-medium dark:text-gray-100">
            <ol className="flex items-center justify-center sm:justify-start">
              <li>
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">
                  {t("nav.dashboard")}
                </Link>
              </li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRightIcon className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-500 dark:text-gray-400">{realm === "archive" ? t("realm.archive") : t("realm.collection")}</li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRightIcon className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-900 dark:text-white">{t("locations.title")}</li>
            </ol>
          </nav>
          <h2 className="text-2xl font-bold">{t("locations.title")}</h2>
        </div>

        <div className="flex items-center justify-center gap-2 rounded-sm px-2 py-3 sm:justify-end sm:bg-transparent sm:px-0">
          {can("locations.write") ? (
            <button
              onClick={() => {
                setEditLoc({ name: "" });
                setIsNew(true);
              }}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-sm transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              title={t("common.new")}
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {editLoc && isNew ? (
        <div className="overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-900/5 dark:bg-gray-800/50 dark:outline-white/10">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-white/10">
            <h3 className="font-semibold text-gray-900 dark:text-white">{t("common.new")}</h3>
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

      <div className="divide-y divide-gray-100 bg-white shadow-xs outline outline-1 -outline-offset-1 outline-gray-900/5 sm:rounded-xl dark:divide-white/5 dark:bg-gray-800/50 dark:outline-white/10">
        {roots.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            {renderLevel(roots)}
          </DndContext>
        ) : (
          <p className="p-6 text-center text-gray-500">{t("locations.none")}</p>
        )}
      </div>

      {deleteFlow.confirm ? (
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
      ) : null}
    </div>
  );
}
