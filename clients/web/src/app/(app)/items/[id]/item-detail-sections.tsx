"use client";

import Link from "next/link";
import clsx from "clsx";
import { MarkdownView } from "@/components/ui/markdown";
import type { Category, Item, Property } from "@/lib/api";
import { isMasterDataRoleVisible } from "@/lib/category-master-data";
import { buildPropertyRows, PropDisplay } from "./item-detail-property-display";
import { normalizePropertyValue } from "@/lib/property-values";
import { DetailSection } from "./item-detail-section-ui";

export { ItemMaintenancePanel } from "./item-detail-maintenance-panel";

// The catalog fields a game is known by. They are shown next to the cover and
// therefore left out of the general list of properties further down.
const gameHeadlineKeys = ["platforms", "release_year", "genres", "moby_score", "usk", "pegi", "esrb"];

function catalogKey(property: Property) {
  const catalog = property.options?.game_catalog;
  return catalog && typeof catalog === "object" && !Array.isArray(catalog) ? String((catalog as Record<string, unknown>).property_key || "") : "";
}

// GameFacts is the summary beside a game's cover: what it is, who made it,
// how it is rated.
export function GameFacts({ item, properties, t }: {
  item: Item;
  properties: Property[];
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const values = item.properties || {};
  const headline = gameHeadlineKeys
    .map((key) => properties.find((property) => catalogKey(property) === key))
    .filter((property): property is Property => !!property && normalizePropertyValue(values[String(property.id)]) != null);
  const makers = [
    item.developer_name ? { label: t("items.developer"), value: item.developer_name } : null,
    item.publisher_name ? { label: t("items.publisher"), value: item.publisher_name } : null,
  ].filter((entry): entry is { label: string; value: string } => entry !== null);
  if (headline.length === 0 && makers.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
      {headline.map((property) => (
        <div key={property.id} className="min-w-0">
          <PropDisplay prop={property} val={values[String(property.id)]} />
        </div>
      ))}
      {makers.map((entry) => (
        <div key={entry.label} className="min-w-0">
          <dt className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">{entry.label}</dt>
          <dd className="text-xs text-gray-500 dark:text-gray-400">{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ItemDescription renders an item's Markdown description in the small type
// of the detail page.
export function ItemDescription({ description }: { description: string }) {
  return (
    <div className="min-w-0 text-xs text-gray-500 dark:text-gray-400">
      <MarkdownView
        content={description}
        className="prose-p:text-xs prose-li:text-xs prose-ul:text-xs prose-ol:text-xs prose-blockquote:text-xs prose-headings:text-xs prose-headings:font-semibold prose-headings:text-gray-700 dark:prose-headings:text-gray-300 prose-strong:text-gray-700 dark:prose-strong:text-gray-300"
      />
    </div>
  );
}

function FactGrid({ entries, flush = false }: { entries: { label: string; value: string }[]; flush?: boolean }) {
  return (
    <dl className={clsx("grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3", !flush && "px-6 py-5")}>
      {entries.map((entry) => (
        <div key={entry.label} className="min-w-0">
          <dt className="text-xs font-semibold text-gray-700 dark:text-gray-300">{entry.label}</dt>
          <dd className="mt-1 text-xs break-words text-gray-500 dark:text-gray-400">{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type DetailProps = {
  item: Item;
  properties: Property[];
  category?: Category;
  realm: "archive" | "collection";
  // A catalog game is summarised by its catalog fields, any other item by
  // its stock and master data.
  isGame?: boolean;
  fmtDate: (s: string | null | undefined) => string;
  t: (k: string, vars?: Record<string, string | number>) => string;
};

// ItemSummaryFacts is what stands beside the picture at the top of every
// item page: for a game its catalog fields, for anything else stock and
// master data. ItemDetailSections below leaves out what is shown here.
export function ItemSummaryFacts(props: DetailProps) {
  if (props.isGame) return <GameFacts item={props.item} properties={props.properties} t={props.t} />;
  const { inventoryEntries, vendorEntries } = itemFacts(props);
  const entries = [...inventoryEntries, ...vendorEntries];
  return entries.length > 0 ? <FactGrid entries={entries} flush /> : null;
}

function itemFacts({ item, category, realm, isGame = false, fmtDate, t }: DetailProps) {
  const formatCurrency = (value: number, currency?: string) =>
    value.toLocaleString("de-DE", { style: "currency", currency: currency || "EUR" });
  const totalPrice = item.purchase_price != null ? item.purchase_price * item.quantity : null;
  const itemStatusLabelMap: Record<string, string> = {
    active: t("items.status.active"),
    reserved: t("items.status.reserved"),
    for_sale: t("items.status.forSale"),
    sold: t("items.status.sold"),
  };
  // Empty fields are left out. In a collection, "quantity 1" and "not a
  // consumable" go without saying; in the inventory they are the point.
  const inCollection = realm === "collection";
  const present = (entries: ({ label: string; value: string } | null)[]) =>
    entries.filter((entry): entry is { label: string; value: string } => entry !== null && entry.value !== "" && entry.value !== "—");
  const inventoryEntries = present([
    item.item_status && item.item_status !== "active" ? { label: t("items.itemStatus"), value: itemStatusLabelMap[item.item_status] || item.item_status } : null,
    inCollection && item.quantity === 1 ? null : { label: t("items.quantity"), value: String(item.quantity) },
    inCollection && !item.is_consumable ? null : { label: t("items.consumable"), value: item.is_consumable ? t("common.yes") : t("common.no") },
    item.purchase_price != null ? { label: t("items.purchasePrice"), value: formatCurrency(item.purchase_price, item.purchase_currency) } : null,
    totalPrice != null && item.quantity !== 1 ? { label: t("items.totalValue"), value: formatCurrency(totalPrice, item.purchase_currency) } : null,
    item.purchase_date ? { label: t("items.purchaseDate"), value: fmtDate(item.purchase_date) } : null,
  ]);
  const saleEntries =
    item.item_status === "for_sale" || item.item_status === "sold"
      ? present([
          { label: t("items.salesPlatform"), value: item.salesPlatformName || "—" },
          { label: t("items.askingPrice"), value: item.askingPrice != null ? formatCurrency(item.askingPrice, item.purchase_currency) : "—" },
          { label: t("items.soldPrice"), value: item.sold_price != null ? formatCurrency(item.sold_price, item.purchase_currency) : "—" },
          { label: t("items.soldAt"), value: item.sold_at ? fmtDate(item.sold_at) : "—" },
        ])
      : [];
  const vendorEntries = present([
    isMasterDataRoleVisible(category, "manufacturer") ? { label: t("items.manufacturer"), value: item.manufacturer_name || "—" } : null,
    isMasterDataRoleVisible(category, "vendor") ? { label: t("items.vendor"), value: item.vendor_name || "—" } : null,
    isMasterDataRoleVisible(category, "supplier") ? { label: t("items.supplier"), value: item.supplier_name || "—" } : null,
    // A game names its developer and publisher beside the cover.
    !isGame && isMasterDataRoleVisible(category, "developer") ? { label: t("items.developer"), value: item.developer_name || "—" } : null,
    !isGame && isMasterDataRoleVisible(category, "publisher") ? { label: t("items.publisher"), value: item.publisher_name || "—" } : null,
  ]);
  return { inventoryEntries, saleEntries, vendorEntries };
}

export function ItemDetailSections(props: DetailProps) {
  const { item, properties, isGame = false, t } = props;
  const facts = itemFacts(props);
  // Stock and master data of an ordinary item are in the summary already.
  const inventoryEntries = isGame ? facts.inventoryEntries : [];
  const vendorEntries = isGame ? facts.vendorEntries : [];
  const saleEntries = facts.saleEntries;
  const visibleProperties = properties.filter((property) => {
    const key = catalogKey(property);
    return key !== "developer" && key !== "publisher" && !(isGame && gameHeadlineKeys.includes(key));
  });
  const propertyRows = item.properties ? buildPropertyRows(visibleProperties, item.properties) : [];
  const checkedOutComponentIDs = new Set(item.checked_out_to?.component_ids || []);

  return (
    <div className="space-y-6">
      {inventoryEntries.length > 0 ? (
        <DetailSection title={t("items.modalInventoryTitle")}>
          <FactGrid entries={inventoryEntries} />
        </DetailSection>
      ) : null}

      {saleEntries.length > 0 ? (
        <DetailSection title={t("items.sale")}>
          <FactGrid entries={saleEntries} />
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

      {vendorEntries.length > 0 ? (
        <DetailSection title={t("items.modalVendorsTitle")}>
          <FactGrid entries={vendorEntries} />
        </DetailSection>
      ) : null}

      {propertyRows.length > 0 ? (
        <DetailSection title={t("itemDetail.properties")}>
          {/* Order and width of each property are set in its category. */}
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 px-6 py-5 sm:grid-cols-6">
            {propertyRows.flat().map((cell) => (
              <div key={cell.prop.id} className={clsx("min-w-0", cell.span === 6 ? "sm:col-span-6" : cell.span === 3 ? "sm:col-span-3" : "sm:col-span-2")}>
                <PropDisplay prop={cell.prop} val={item.properties![String(cell.prop.id)]} />
              </div>
            ))}
          </div>
        </DetailSection>
      ) : null}
    </div>
  );
}
