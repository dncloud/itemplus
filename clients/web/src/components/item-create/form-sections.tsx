"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { Item, ItemComponent, Property } from "@/lib/api";
import { BooleanToggle, ConsumableToggle } from "@/components/item-create/form-controls";
import { Field, ModalSection, SuggestionRow, TWPStringSelect } from "@/components/item-create/ui";
import PropertyField from "@/components/property-field/field";
import { normalizePropertyValue } from "@/lib/property-values";

export function InventorySection({
  t,
  editItem,
  itemComponents,
  aiSuggestedItem,
  valuesEqual,
  applySuggestedField,
  setEditItem,
  realm,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  realm: "archive" | "collection";
  editItem: Partial<Item>;
  itemComponents: ItemComponent[];
  aiSuggestedItem: Partial<Item>;
  valuesEqual: (left: unknown, right: unknown) => boolean;
  applySuggestedField: <K extends keyof Item>(field: K) => void;
  setEditItem: (value: Partial<Item>) => void;
}) {
  const itemStatus = editItem.item_status || "active";
  const selectedComponentIDs = useMemo(() => new Set(editItem.componentItemIds || []), [editItem.componentItemIds]);
  const bundleLockedByParent = !!editItem.parentBundle;
  const selectedComponents = itemComponents.filter((component) => selectedComponentIDs.has(component.id));
  const [componentSearch, setComponentSearch] = useState("");
  // Quantity, minimum, consumable and bundle are everyday fields in the
  // inventory. In a collection they are rarely touched, so they are folded
  // away unless the item already uses them.
  const usesStockFields = (editItem.quantity ?? 1) !== 1 || editItem.minimum_quantity != null || !!editItem.is_consumable || !!editItem.is_bundle;
  const [moreOpen, setMoreOpen] = useState(false);
  const showStockFields = realm === "archive" || usesStockFields || moreOpen;
  const currentItemID = typeof editItem.id === "number" ? editItem.id : undefined;

  const getComponentHelper = (component: ItemComponent, isSelected: boolean) => {
    const lockedByOtherParent = !!component.parent_item_id && component.parent_item_id !== currentItemID && !isSelected;
    const lockedBecauseBundle = !!component.is_bundle;
    if (lockedByOtherParent && component.parent_item_name) {
      return t("items.componentAssignedTo", { name: component.parent_item_name });
    }
    if (lockedBecauseBundle) {
      return t("items.componentBundleLocked");
    }
    return "";
  };

  const isComponentDisabled = (component: ItemComponent, isSelected: boolean) =>
    ((!!component.parent_item_id && component.parent_item_id !== currentItemID && !isSelected) || !!component.is_bundle);

  const filteredComponents = useMemo(() => {
    const query = componentSearch.trim().toLowerCase();
    const queryTokens = query.split(/\s+/).filter(Boolean);
    const availableComponents = itemComponents.filter((component) => !selectedComponentIDs.has(component.id));

    if (queryTokens.length === 0) {
      return availableComponents.slice(0, 5);
    }

    const matchesQuery = (component: ItemComponent) => {
      const haystack = [
        component.name,
        component.parent_item_name,
        component.item_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return queryTokens.every((token) => haystack.includes(token));
    };

    return availableComponents
      .filter(matchesQuery)
      .slice(0, 12);
  }, [componentSearch, itemComponents, selectedComponentIDs]);

  const toggleComponent = (componentID: number) => {
    const nextIDs = selectedComponentIDs.has(componentID)
      ? (editItem.componentItemIds || []).filter((id) => id !== componentID)
      : [...(editItem.componentItemIds || []), componentID];
    setEditItem({
      ...editItem,
      is_bundle: nextIDs.length > 0 ? true : !!editItem.is_bundle,
      componentItemIds: nextIDs,
    });
  };

  return (
    <ModalSection id="item-stock" title={t("items.modalInventoryTitle")} description={t("items.modalInventoryDescription")}>
      <div className="w-full space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <TWPStringSelect
            label={t("items.itemStatus")}
            value={itemStatus}
            onChange={(v) => {
              const nextStatus = (v || "active") as Item["item_status"];
              const nextItem: Partial<Item> = { ...editItem, item_status: nextStatus };
              if (nextStatus === "active" || nextStatus === "reserved") {
                nextItem.salesPlatformId = undefined;
                nextItem.askingPrice = undefined;
                nextItem.sold_price = undefined;
                nextItem.sold_at = undefined;
              } else if (nextStatus === "for_sale") {
                nextItem.sold_price = undefined;
                nextItem.sold_at = undefined;
              }
              setEditItem(nextItem);
            }}
            options={[
              { value: "active", label: t("items.status.active") },
              { value: "reserved", label: t("items.status.reserved") },
              { value: "for_sale", label: t("items.status.forSale") },
              { value: "sold", label: t("items.status.sold") },
            ]}
          />
          {showStockFields ? <BooleanToggle
            label={t("items.bundle")}
            yesLabel={t("common.yes")}
            noLabel={t("common.no")}
            checked={!!editItem.is_bundle}
            disabled={bundleLockedByParent}
            onChange={() => {
              const nextBundle = !editItem.is_bundle;
              setEditItem({
                ...editItem,
                is_bundle: nextBundle,
                componentItemIds: nextBundle ? editItem.componentItemIds || [] : [],
              });
            }}
          /> : null}
        </div>
        {bundleLockedByParent && editItem.parentBundle ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t("items.bundleLockedByParent", { name: editItem.parentBundle.name })}
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Field
              label={t("items.purchasePrice")}
              type="number"
              value={String(editItem.purchase_price ?? "")}
              onChange={(v) => setEditItem({ ...editItem, purchase_price: v ? Number(v) : undefined })}
            />
            {typeof aiSuggestedItem.purchase_price === "number" &&
            !valuesEqual(editItem.purchase_price, aiSuggestedItem.purchase_price) ? (
              <SuggestionRow
                value={String(aiSuggestedItem.purchase_price)}
                onApply={() => applySuggestedField("purchase_price")}
                label={t("common.apply")}
              />
            ) : null}
          </div>
          <div>
            <Field
              label={t("items.currency")}
              value={editItem.purchase_currency || "EUR"}
              onChange={(v) => setEditItem({ ...editItem, purchase_currency: v })}
            />
            {typeof aiSuggestedItem.purchase_currency === "string" &&
            !valuesEqual(editItem.purchase_currency, aiSuggestedItem.purchase_currency) ? (
              <SuggestionRow
                value={aiSuggestedItem.purchase_currency}
                onApply={() => applySuggestedField("purchase_currency")}
                label={t("common.apply")}
              />
            ) : null}
          </div>
          <Field
            label={t("items.purchaseDate")}
            type="date"
            value={editItem.purchase_date || ""}
            onChange={(v) => setEditItem({ ...editItem, purchase_date: v || undefined })}
          />
        </div>
        {showStockFields ? <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Field
              label={t("items.quantity")}
              type="number"
              value={String(editItem.quantity ?? 1)}
              onChange={(v) => setEditItem({ ...editItem, quantity: Number(v) })}
            />
            {typeof aiSuggestedItem.quantity === "number" && !valuesEqual(editItem.quantity, aiSuggestedItem.quantity) ? (
              <SuggestionRow
                value={String(aiSuggestedItem.quantity)}
                onApply={() => applySuggestedField("quantity")}
                label={t("common.apply")}
              />
            ) : null}
          </div>
          <Field
            label={t("items.minQuantity")}
            type="number"
            value={String(editItem.minimum_quantity ?? "")}
            onChange={(v) => setEditItem({ ...editItem, minimum_quantity: v ? Number(v) : undefined })}
          />
          <ConsumableToggle
            t={t}
            checked={!!editItem.is_consumable}
            onChange={() => setEditItem({ ...editItem, is_consumable: !editItem.is_consumable })}
          />
        </div> : (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            {t("items.moreStockFields")}
          </button>
        )}
        {(itemStatus === "for_sale" || itemStatus === "sold") ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field
              label={t("items.askingPrice")}
              type="number"
              value={String(editItem.askingPrice ?? "")}
              onChange={(v) => setEditItem({ ...editItem, askingPrice: v ? Number(v) : undefined })}
            />
            {itemStatus === "sold" ? (
              <>
                <Field
                  label={t("items.soldPrice")}
                  type="number"
                  value={String(editItem.sold_price ?? "")}
                  onChange={(v) => setEditItem({ ...editItem, sold_price: v ? Number(v) : undefined })}
                />
                <Field
                  label={t("items.soldAt")}
                  type="date"
                  value={editItem.sold_at || ""}
                  onChange={(v) => setEditItem({ ...editItem, sold_at: v || undefined })}
                />
              </>
            ) : null}
          </div>
        ) : null}
        {editItem.is_bundle && !bundleLockedByParent ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm/6 font-medium text-gray-900 dark:text-white">{t("items.components")}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("items.componentsHint")}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-xs text-gray-600 dark:border-white/10 dark:bg-gray-900/30 dark:text-gray-300">
              {selectedComponents.length > 0 ? (
                <div className="space-y-2">
                  <p className="font-medium text-gray-700 dark:text-gray-200">
                    {t("items.bundleContainsCount", { count: selectedComponents.length })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedComponents.map((component) => (
                      <button
                        key={`selected-${component.id}`}
                        type="button"
                        onClick={() => toggleComponent(component.id)}
                        className="inline-flex items-center gap-2 rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                      >
                        {component.name}
                        <span className="text-indigo-500 dark:text-indigo-300">×</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p>{t("items.bundleEmptyHint")}</p>
              )}
            </div>
            <div className="space-y-3">
              <Field
                label={t("common.search")}
                value={componentSearch}
                onChange={setComponentSearch}
              />
              <div className="rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900/40">
                {filteredComponents.length > 0 ? (
                  <div className="divide-y divide-gray-100 dark:divide-white/10">
                    {filteredComponents.map((component) => {
                      const isSelected = selectedComponentIDs.has(component.id);
                      const disabled = isComponentDisabled(component, isSelected);
                      const helper = getComponentHelper(component, isSelected);

                      return (
                        <button
                          key={component.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleComponent(component.id)}
                          className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition ${
                            disabled
                              ? "cursor-not-allowed opacity-60"
                              : "hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{component.name}</p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {t(`items.status.${component.item_status === "for_sale" ? "forSale" : component.item_status || "active"}`)}
                            </p>
                            {helper ? <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{helper}</p> : null}
                          </div>
                          <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-gray-300 text-[11px] font-semibold text-gray-500 dark:border-white/15 dark:text-gray-300">
                            +
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {componentSearch.trim() ? t("items.noSearchResults") : t("items.noRecentComponents")}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ModalSection>
  );
}

export function PropertiesSection({
  t,
  catProperties,
  propValues,
  aiSuggestedPropValues,
  valuesEqual,
  formatSuggestionValue,
  applySuggestedProperty,
  setPropValues,
  collapseEmpty = false,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  // Fold the properties that are empty, as when editing an existing item.
  collapseEmpty?: boolean;
  catProperties: Property[];
  propValues: Record<string, unknown>;
  aiSuggestedPropValues: Record<string, unknown>;
  valuesEqual: (left: unknown, right: unknown) => boolean;
  formatSuggestionValue: (value: unknown, property?: Property) => string;
  applySuggestedProperty: (propertyId: string) => void;
  setPropValues: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleProperties = catProperties.filter((property) => {
    const catalog = property.options?.game_catalog;
    const key = catalog && typeof catalog === "object" && !Array.isArray(catalog) ? (catalog as Record<string, unknown>).property_key : undefined;
    return key !== "developer" && key !== "publisher";
  });
  if (visibleProperties.length === 0) return null;

  // A catalog category can have dozens of properties. When editing, the ones
  // that are filled in, required or have a suggestion waiting are shown; the
  // rest wait behind one button. A new item shows all of them.
  const matters = (property: Property) =>
    property.required ||
    normalizePropertyValue(propValues[String(property.id)]) != null ||
    typeof aiSuggestedPropValues[String(property.id)] !== "undefined";
  const folded = collapseEmpty && !showAll ? visibleProperties.filter((property) => !matters(property)) : [];
  const shown = visibleProperties.filter((property) => !folded.includes(property));
  const spanClass = (property: Property) =>
    property.property_type === "textblock" || property.display_width === "full"
      ? "sm:col-span-6"
      : property.display_width === "half"
        ? "sm:col-span-3"
        : "sm:col-span-2";

  return (
    <ModalSection id="item-properties" title={t("items.properties")} description={t("items.modalPropertiesDescription")}>
      <div className="grid w-full grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-6">
        {shown.map((prop) => {
          const suggestion = aiSuggestedPropValues[String(prop.id)];
          const showSuggestion = typeof suggestion !== "undefined" && !valuesEqual(propValues[String(prop.id)], suggestion);
          return (
            <div key={prop.id} className={clsx("min-w-0", spanClass(prop))}>
              <PropertyField
                property={prop}
                value={propValues[String(prop.id)]}
                onChange={(val) => setPropValues((prev) => ({ ...prev, [String(prop.id)]: val }))}
              />
              {showSuggestion ? (
                <SuggestionRow
                  value={formatSuggestionValue(suggestion, prop)}
                  onApply={() => applySuggestedProperty(String(prop.id))}
                  label={t("common.apply")}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {collapseEmpty && (folded.length > 0 || showAll) ? (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          {showAll ? t("items.hideEmptyProperties") : t("items.showMoreProperties", { count: folded.length })}
        </button>
      ) : null}
    </ModalSection>
  );
}
