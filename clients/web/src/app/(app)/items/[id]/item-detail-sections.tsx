"use client";

import Link from "next/link";
import { MarkdownView } from "@/components/ui/markdown";
import type { Item, Property } from "@/lib/api";
import { buildPropertyRows, PropDisplay } from "./item-detail-property-display";
import { DetailSection, ItemInventoryMovementsPreview } from "./item-detail-section-ui";

export { ItemMaintenancePanel } from "./item-detail-maintenance-panel";

export function ItemDetailSections({
  item,
  properties,
  fmtDate,
  t,
  canViewInventory,
}: {
  item: Item;
  properties: Property[];
  fmtDate: (s: string | null | undefined) => string;
  t: (k: string, vars?: Record<string, string | number>) => string;
  canViewInventory: boolean;
}) {
  const formatCurrency = (value: number, currency?: string) =>
    value.toLocaleString("de-DE", { style: "currency", currency: currency || "EUR" });
  const totalPrice = item.purchase_price != null ? item.purchase_price * item.quantity : null;
  const itemStatusLabelMap: Record<string, string> = {
    active: t("items.status.active"),
    reserved: t("items.status.reserved"),
    for_sale: t("items.status.forSale"),
    sold: t("items.status.sold"),
  };
  const inventoryEntries = [
    { label: t("items.itemStatus"), value: itemStatusLabelMap[item.item_status || "active"] || t("items.status.active") },
    { label: t("items.quantity"), value: String(item.quantity) },
    { label: t("items.consumable"), value: item.is_consumable ? t("common.yes") : t("common.no") },
    { label: t("items.purchasePrice"), value: item.purchase_price != null ? formatCurrency(item.purchase_price, item.purchase_currency) : "—" },
    { label: t("items.totalValue"), value: totalPrice != null ? formatCurrency(totalPrice, item.purchase_currency) : "—" },
    { label: t("items.purchaseDate"), value: item.purchase_date ? fmtDate(item.purchase_date) : "—" },
  ];
  const saleEntries =
    item.item_status === "for_sale" || item.item_status === "sold"
      ? [
          { label: t("items.salesPlatform"), value: item.salesPlatformName || "—" },
          { label: t("items.askingPrice"), value: item.askingPrice != null ? formatCurrency(item.askingPrice, item.purchase_currency) : "—" },
          { label: t("items.soldPrice"), value: item.sold_price != null ? formatCurrency(item.sold_price, item.purchase_currency) : "—" },
          { label: t("items.soldAt"), value: item.sold_at ? fmtDate(item.sold_at) : "—" },
        ]
      : [];
  const vendorEntries = [
    { label: t("items.manufacturer"), value: item.manufacturer_name || "—" },
    { label: t("items.vendor"), value: item.vendor_name || "—" },
    { label: t("items.supplier"), value: item.supplier_name || "—" },
  ];
  const inventoryRows = [inventoryEntries.slice(0, 3), inventoryEntries.slice(3, 6)];
  const saleRows = [saleEntries.slice(0, 2), saleEntries.slice(2, 4)].filter((row) => row.length > 0);
  const propertyRows = item.properties ? buildPropertyRows(properties, item.properties) : [];
  const checkedOutComponentIDs = new Set(item.checked_out_to?.component_ids || []);

  return (
    <div className="space-y-6">
      <DetailSection title={t("items.modalInventoryTitle")}>
        {inventoryRows.map((row, rowIndex) => (
          <div key={`inventory-row-${rowIndex}`}>
            {rowIndex > 0 && <hr className="border-gray-100 dark:border-white/5" />}
            <div className="grid grid-cols-1 sm:grid-cols-6">
              {row.map((entry, cellIndex) => (
                <div
                  key={`${entry.label}-${cellIndex}`}
                  className={`px-6 py-4 sm:col-span-2 ${
                    cellIndex < row.length - 1 ? "border-b sm:border-b-0 sm:border-r" : ""
                  } border-gray-100 dark:border-gray-700`}
                >
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{entry.label}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{entry.value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </DetailSection>

      {canViewInventory ? (
        <ItemInventoryMovementsPreview itemID={item.id} movements={item.inventory_movements || []} fmtDate={fmtDate} t={t} />
      ) : null}

      {saleEntries.length > 0 ? (
        <DetailSection title={t("items.sale")}>
          {saleRows.map((row, rowIndex) => (
            <div key={`sale-row-${rowIndex}`}>
              {rowIndex > 0 && <hr className="border-gray-100 dark:border-white/5" />}
              <div className="grid grid-cols-1 sm:grid-cols-6">
                {row.map((entry, cellIndex) => (
                  <div
                    key={`${entry.label}-${cellIndex}`}
                    className={`px-6 py-4 sm:col-span-3 ${
                      cellIndex < row.length - 1 ? "border-b sm:border-b-0 sm:border-r" : ""
                    } border-gray-100 dark:border-gray-700`}
                  >
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{entry.label}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{entry.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </DetailSection>
      ) : null}

      {item.parentBundle ? (
        <DetailSection title={t("items.partOf")}>
          <div className="space-y-1 px-6 py-4">
            <Link
              href={`/items/${item.parentBundle.id}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              {item.parentBundle.name}
            </Link>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("items.partOfHint")}</p>
          </div>
        </DetailSection>
      ) : null}

      {item.components && item.components.length > 0 ? (
        <DetailSection title={t("items.components")}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-6 py-3 text-xs text-gray-500 dark:border-white/5 dark:text-gray-400">
            <span>{t("items.bundleContainsCount", { count: item.components.length })}</span>
            {item.is_bundle ? (
              <span className="inline-flex items-center rounded-full border border-indigo-400/30 bg-indigo-400/10 px-2.5 py-1 text-[11px] font-medium text-indigo-300">
                {t("items.bundle")}
              </span>
            ) : null}
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {item.components.map((component) => (
              <div key={component.id} className="flex items-center justify-between gap-3 px-6 py-4">
                <div className="min-w-0">
                  <Link
                    href={`/items/${component.id}`}
                    className="truncate text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    {component.name}
                  </Link>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {component.item_status === "for_sale"
                      ? t("items.status.forSale")
                      : t(`items.status.${component.item_status || "active"}`)}
                  </p>
                </div>
                {checkedOutComponentIDs.has(component.id) ? (
                  <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                    {t("itemDetail.includedInLoan")}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </DetailSection>
      ) : null}

      <DetailSection title={t("items.modalVendorsTitle")}>
        <div className="grid grid-cols-1 sm:grid-cols-6">
          {vendorEntries.map((entry, index) => (
            <div
              key={entry.label}
              className={`px-6 py-4 sm:col-span-2 border-gray-100 dark:border-gray-700 ${
                index < vendorEntries.length - 1 ? "border-b sm:border-b-0" : ""
              } ${index < vendorEntries.length - 1 ? "sm:border-r" : ""}`}
            >
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{entry.label}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{entry.value}</p>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection title={t("items.description")}>
        <div className="px-4 py-5 sm:px-6">
          <div className="min-w-0 text-xs text-gray-500 dark:text-gray-400">
            {item.description ? (
              <MarkdownView
                content={item.description}
                className="prose-p:text-xs prose-li:text-xs prose-ul:text-xs prose-ol:text-xs prose-blockquote:text-xs prose-headings:text-xs prose-headings:font-semibold prose-headings:text-gray-700 dark:prose-headings:text-gray-300 prose-strong:text-gray-700 dark:prose-strong:text-gray-300"
              />
            ) : (
              <p className="text-xs italic text-gray-400">Keine Beschreibung</p>
            )}
          </div>
        </div>
      </DetailSection>

      {properties.length > 0 && item.properties && Object.keys(item.properties).length > 0 ? (
        <DetailSection title={t("itemDetail.properties")}>
          {propertyRows.map((row, rowIndex) => {
            const isFull = row.length === 1 && row[0].span === 6;
            const spanClass = (span: number) => (span === 6 ? "sm:col-span-6" : span === 3 ? "sm:col-span-3" : "sm:col-span-2");
            return (
              <div key={rowIndex}>
                <hr className="border-gray-100 dark:border-white/5" />
                <div className={`text-sm ${!isFull ? "grid grid-cols-1 sm:grid-cols-6" : ""}`}>
                  {row.map((cell, index) => (
                    <div
                      key={cell.prop.id}
                      className={`px-6 py-4 ${!isFull ? spanClass(cell.span) : ""} ${
                        index < row.length - 1 ? "border-b sm:border-b-0 sm:border-r" : ""
                      } border-gray-100 dark:border-gray-700`}
                    >
                      <PropDisplay prop={cell.prop} val={item.properties![String(cell.prop.id)]} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </DetailSection>
      ) : null}
    </div>
  );
}
