"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { PlusIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useDeleteFlow, ConfirmDelete } from "@/components/confirm-delete";
import {
  CategoryInlineForm,
  PropertyInlineForm,
  SortableCategory,
  SortableProperty,
  getPropertyTypes,
} from "./categories-sections";
import {
  fetchCategoriesPageData,
  fetchCategoryProperties,
  persistCategoryOrder,
  persistPropertyOrder,
} from "./categories-page-utils";

export default function CategoriesPage() {
  const { realm, fmtDateTime, t, can } = useApp();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [editCat, setEditCat] = useState<Partial<Category> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [editProp, setEditProp] = useState<Partial<Property> | null>(null);
  const [isNewProp, setIsNewProp] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const canWriteCategories = can("categories.write");
  const canDeleteCategories = can("categories.delete");
  const canReadItems = can("items.read");

  const loadingRef = useRef(false);
  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      setCategories(await fetchCategoriesPageData());
    } catch {}
    loadingRef.current = false;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        const cats = await fetchCategoriesPageData();
        if (!cancelled) {
          setCategories(cats);
        }
      } catch {}
    };

    void loadInitial();
    return () => { cancelled = true; };
  }, [realm]);

  const loadProps = async (catId: number) => {
    setProperties(await fetchCategoryProperties(catId));
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
    if (!canWriteCategories) return;
    if (!editCat?.name) return;
    if (isNew) await api.createCategory({ ...editCat, position: categories.length });
    else if (editCat.id) await api.updateCategory(editCat.id, editCat);
    setEditCat(null);
    load();
  };

  const deleteCat = (id: number) => {
    if (!canDeleteCategories) return;
    const cat = categories.find((c) => c.id === id);
    deleteFlow.requestDelete(id, cat?.name || `#${id}`, "category");
  };

  const onCatDragEnd = async (event: DragEndEvent) => {
    if (!canWriteCategories) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = categories.findIndex((c) => c.id === active.id);
    const newIdx = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIdx, newIdx);
    setCategories(reordered);
    await persistCategoryOrder(reordered);
  };

  const onPropDragEnd = async (event: DragEndEvent) => {
    if (!canWriteCategories) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = properties.findIndex((p) => p.id === active.id);
    const newIdx = properties.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(properties, oldIdx, newIdx);
    setProperties(reordered);
    await persistPropertyOrder(reordered);
  };

  const saveProp = async () => {
    if (!canWriteCategories) return;
    if (!editProp?.name || !editProp?.property_type) return;
    if (isNewProp) await api.createProperty({ ...editProp, category_id: expanded!, position: properties.length });
    else if (editProp.id) await api.updateProperty(editProp.id, editProp);
    setEditProp(null);
    if (expanded) loadProps(expanded);
  };

  const deleteProp = (id: number) => {
    if (!canDeleteCategories) return;
    const prop = properties.find((p) => p.id === id);
    deleteFlow.requestDelete(id, prop?.name || `#${id}`, "property");
  };

  const toggleShowInList = async (prop: Property) => {
    if (!canWriteCategories) return;
    await api.updateProperty(prop.id, { show_in_list: !prop.show_in_list });
    if (expanded) loadProps(expanded);
  };

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
              <li className="text-gray-900 dark:text-white">{t("categories.title")}</li>
            </ol>
          </nav>
          <h2 className="text-2xl font-bold">{t("categories.title")}</h2>
        </div>

        {canWriteCategories ? (
          <div className="flex items-center justify-center gap-2 rounded-sm px-2 py-3 sm:justify-end sm:bg-transparent sm:px-0">
            <button
              onClick={() => { setEditCat({ name: "" }); setIsNew(true); }}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-sm transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              title={t("common.new")}
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {canWriteCategories && editCat && isNew ? (
        <div className="overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-900/5 dark:bg-gray-800/50 dark:outline-white/10">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-white/10">
            <h3 className="font-semibold text-gray-900 dark:text-white">{t("common.new")}</h3>
          </div>
          <div className="px-4 py-4 sm:px-6">
            <CategoryInlineForm
              category={editCat}
              onChange={setEditCat}
              onCancel={() => setEditCat(null)}
              onSave={saveCat}
              t={t}
            />
          </div>
        </div>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onCatDragEnd}>
        <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-gray-100 bg-white shadow-xs outline outline-1 -outline-offset-1 outline-gray-900/5 sm:rounded-xl dark:divide-white/5 dark:bg-gray-800/50 dark:outline-white/10">
            {categories.map((cat) => (
              <SortableCategory
                key={cat.id}
                category={cat}
                isExpanded={expanded === cat.id}
                onToggle={() => toggleExpand(cat.id)}
                onEdit={async () => {
                  if (editCat?.id === cat.id && !isNew) {
                    setEditCat(null);
                    if (expanded === cat.id) {
                      setExpanded(null);
                    }
                    return;
                  }
                  setEditCat({ ...cat });
                  setIsNew(false);
                  if (expanded !== cat.id) {
                    setExpanded(cat.id);
                    await loadProps(cat.id);
                  }
                }}
                onDelete={() => deleteCat(cat.id)}
                onShowItems={() => router.push(`/items?category=${cat.id}`)}
                canReorder={canWriteCategories}
                canEdit={canWriteCategories}
                canDelete={canDeleteCategories}
                canShowItems={canReadItems}
                fmtDateTime={fmtDateTime}
                t={t}
              >
                {(editCat?.id === cat.id && !isNew) || expanded === cat.id ? (
                  <div>
                    {canWriteCategories && editCat?.id === cat.id && !isNew ? (
                      <div className="border-t border-gray-100 px-4 py-4 sm:px-6 dark:border-white/10">
                        <CategoryInlineForm
                          category={editCat}
                          onChange={setEditCat}
                          onCancel={() => setEditCat(null)}
                          onSave={saveCat}
                          t={t}
                        />
                      </div>
                    ) : null}

                    {expanded === cat.id ? (
                      <div className="border-t border-gray-100 px-4 py-4 sm:px-6 dark:border-white/10 space-y-2">
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-sm/6 font-medium text-gray-900 dark:text-white">{t("categories.properties")}</h4>
                          {canWriteCategories ? (
                            <button
                              onClick={() => { setEditProp({ name: "", property_type: "text", show_in_list: false }); setIsNewProp(true); }}
                              className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/10"
                              title={t("categories.addProperty")}
                            >
                              <PlusIcon className="h-4 w-4 text-gray-400" />
                            </button>
                          ) : null}
                        </div>

                        {canWriteCategories && editProp && isNewProp ? (
                          <div className="mb-3 border-t border-gray-100 px-4 py-4 dark:border-white/10">
                            <PropertyInlineForm
                              property={editProp}
                              onChange={setEditProp}
                              onCancel={() => setEditProp(null)}
                              onSave={saveProp}
                              propertyTypes={propertyTypes}
                              t={t}
                            />
                          </div>
                        ) : null}

                        {properties.length === 0 && !editProp ? <p className="text-xs text-gray-400">{t("categories.noProperties")}</p> : null}
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onPropDragEnd}>
                          <SortableContext items={properties.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                            {properties.map((prop) => (
                              <SortableProperty
                                key={prop.id}
                                property={prop}
                                propertyTypeLabel={propertyTypes.find((type) => type.value === prop.property_type)?.label || prop.property_type}
                                fmtDateTime={fmtDateTime}
                                onEdit={() => {
                                  if (editProp?.id === prop.id && !isNewProp) {
                                    setEditProp(null);
                                    return;
                                  }
                                  setEditProp({ ...prop });
                                  setIsNewProp(false);
                                }}
                                onDelete={() => deleteProp(prop.id)}
                                onToggleVisibility={() => toggleShowInList(prop)}
                                canReorder={canWriteCategories}
                                canEdit={canWriteCategories}
                                canDelete={canDeleteCategories}
                                canToggleVisibility={canWriteCategories}
                                t={t}
                              >
                                {canWriteCategories && editProp?.id === prop.id && !isNewProp ? (
                                  <div className="border-t border-gray-100 px-3 py-4 dark:border-white/10">
                                    <PropertyInlineForm
                                      property={editProp}
                                      onChange={setEditProp}
                                      onCancel={() => setEditProp(null)}
                                      onSave={saveProp}
                                      propertyTypes={propertyTypes}
                                      t={t}
                                    />
                                  </div>
                                ) : null}
                              </SortableProperty>
                            ))}
                          </SortableContext>
                        </DndContext>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </SortableCategory>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {categories.length === 0 && <p className="text-center text-gray-500 py-10">{t("categories.none")}</p>}

      {/* Confirm Delete */}
      {canDeleteCategories && deleteFlow.confirm && (
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

    </div>
  );
}
