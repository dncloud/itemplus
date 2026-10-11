"use client";

import { useState } from "react";
import clsx from "clsx";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ArrowLeftRight, Box, CircleCheck, ClipboardList, Ellipsis, Printer, Trash2, Wrench, X } from "lucide-react";
import type { CheckoutRequest, Item, Property } from "@/lib/api";
import {
  formatCurrency,
  formatPropShort,
  formatQuantityMeta,
  getListPropValues,
  quantityValueTone,
} from "@/app/(app)/items/items-page-utils";
import { buildPaginationPages } from "@/app/(app)/items/items-page-navigation";
import { MarkdownView } from "@/components/ui/markdown";
import { ColorChip } from "@/components/ui/color-chip";

function renderRequestBadge(
  itemId: number,
  pendingRequestsByItem: Record<number, CheckoutRequest[]>,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const requests = pendingRequestsByItem[itemId];
  if (!requests?.length) return null;
  const names = requests.map((request) => request.user_name || t("users.deletedUser"));
  const label = requests.length === 1 ? names[0] : `${names[0]} +${requests.length - 1}`;
  return (
    <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 shrink-0">
      {t("items.requestBy", { user: label })}
    </span>
  );
}

// A badge that says something is going on with the item. Where the reader
// may see more, it is the way there: the loans or the maintenance of this item.
function BadgeLink({ className, title, onOpen, children }: { className: string; title: string; onOpen?: () => void; children: React.ReactNode }) {
  const shape = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium shrink-0";
  if (!onOpen) return <span className={clsx(shape, className)}>{children}</span>;
  return (
    <button
      type="button"
      title={title}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      className={clsx(shape, className, "cursor-pointer hover:inset-ring hover:inset-ring-current/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600")}
    >
      {children}
    </button>
  );
}

function renderCheckoutBadge(item: Item, t: (key: string, vars?: Record<string, string | number>) => string, onOpen?: () => void) {
  if (!item.checked_out_to) return null;
  const users = item.checked_out_to.users || [];
  const primaryName = users[0]?.user_name?.trim() || item.checked_out_to.user_name?.trim() || t("users.deletedUser");
  const label = users.length > 1 ? `${primaryName} +${users.length - 1}` : primaryName;
  return (
    <BadgeLink className="bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" title={t("nav.checkouts")} onOpen={onOpen}>
      {t("items.checkedOutToLabel", { user: label })}
    </BadgeLink>
  );
}

function renderMaintenanceBadge(item: Item, fmtDate: (value: string) => string, t: (key: string, vars?: Record<string, string | number>) => string, onOpen?: () => void) {
  const summary = item.maintenance;
  const dueCount = summary?.due_count || 0;
  const overdueCount = summary?.overdue_count || 0;
  if (dueCount <= 0 && overdueCount <= 0) return null;
  const label = overdueCount > 0
    ? t("maintenance.badgeOverdue", { count: overdueCount })
    : t("maintenance.badgeDue", { count: dueCount });
  const className = overdueCount > 0
    ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
    : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
  return (
    <BadgeLink className={className} title={t("maintenance.title")} onOpen={onOpen}>
      <Wrench className="h-3.5 w-3.5" />
      {label}
    </BadgeLink>
  );
}

function renderStatusBadge(item: Item, t: (key: string, vars?: Record<string, string | number>) => string) {
  const status = item.item_status || "active";
  if (status === "active") return null;

  const styleMap: Record<string, string> = {
    reserved: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
    for_sale: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
    sold: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  };
  const labelMap: Record<string, string> = {
    reserved: t("items.status.reserved"),
    for_sale: t("items.status.forSale"),
    sold: t("items.status.sold"),
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium shrink-0 ${styleMap[status] || styleMap.reserved}`}>
      {labelMap[status] || status}
    </span>
  );
}

function renderBundleBadge(item: Item, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (!item.is_bundle) return null;
  const componentCount = item.components?.length || item.componentItemIds?.length || 0;
  const label = componentCount > 0
    ? t("items.bundleWithCount", { count: componentCount })
    : t("items.bundle");
  return (
    <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 shrink-0">
      {label}
    </span>
  );
}

function formatListDate(locale: string, value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(locale === "en" ? "en-US" : "de-DE");
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function itemImage(item: Item) {
  return item.attachments?.find((attachment) => attachment.gallery && (attachment.file_path || attachment.download_url) && /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(attachment.filename));
}

function itemImageURL(serverURL: string, image: NonNullable<ReturnType<typeof itemImage>>) {
  return image.download_url ? `${serverURL}${image.download_url}` : `${serverURL}/uploads/${image.file_path}`;
}

// The actions of one item, the same in the cards and in the table. Printing
// labels is done row after row and stays an icon; the ways to the stock, the
// loans and the maintenance of the item are named in the menu, with deleting
// last so it is not the loudest thing on the page.
function ItemActions({
  item,
  t,
  canReadInventory,
  canManageCheckouts,
  canReadMaintenance,
  canDelete,
  canPrint,
  pendingDelete,
  onOpenInventory,
  onOpenCheckouts,
  onOpenMaintenance,
  onPrint,
  onRemove,
}: {
  item: Item;
  t: Translate;
  canReadInventory: boolean;
  canManageCheckouts: boolean;
  canReadMaintenance: boolean;
  canDelete: boolean;
  canPrint: boolean;
  pendingDelete: number | null;
  onOpenInventory: (item: Item) => void;
  onOpenCheckouts: (item: Item) => void;
  onOpenMaintenance: (item: Item) => void;
  onPrint: (item: Item) => void;
  onRemove: (itemId: number) => void;
}) {
  const links = [
    canReadInventory ? { label: t("nav.inventoryMovements"), icon: ClipboardList, open: onOpenInventory } : null,
    canManageCheckouts ? { label: t("nav.checkouts"), icon: ArrowLeftRight, open: onOpenCheckouts } : null,
    canReadMaintenance ? { label: t("nav.maintenance"), icon: Wrench, open: onOpenMaintenance } : null,
  ].filter((entry) => entry !== null);
  if (links.length === 0 && !canDelete && !canPrint) return null;
  const iconButtonClass = "rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-200";
  const menuEntryClass = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm";

  return (
    <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
      {canPrint ? (
        <button type="button" onClick={() => onPrint(item)} className={iconButtonClass} title={t("common.print")} aria-label={t("common.print")}>
          <Printer className="h-4 w-4" />
        </button>
      ) : null}
      {pendingDelete === item.id ? (
        <span className="p-1.5">
          <span className="block h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
        </span>
      ) : links.length > 0 || canDelete ? (
        <Menu as="div" className="relative">
          <MenuButton className={iconButtonClass} title={t("items.moreActions")} aria-label={t("items.moreActions")}>
            <Ellipsis className="h-4 w-4" />
          </MenuButton>
          <MenuItems
            anchor="bottom end"
            transition
            className="z-50 mt-1 w-48 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg outline-1 outline-black/5 transition data-[closed]:scale-95 data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 dark:divide-white/10 dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
          >
            {links.length > 0 ? (
              <div className="py-1">
                {links.map((entry) => (
                  <MenuItem key={entry.label}>
                    <button
                      type="button"
                      onClick={() => entry.open(item)}
                      className={clsx(menuEntryClass, "text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-gray-900 data-[focus]:outline-hidden dark:text-gray-300 dark:data-[focus]:bg-white/5 dark:data-[focus]:text-white")}
                    >
                      <entry.icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      {entry.label}
                    </button>
                  </MenuItem>
                ))}
              </div>
            ) : null}
            {canDelete ? (
              <div className="py-1">
                <MenuItem>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className={clsx(menuEntryClass, "text-red-600 data-[focus]:bg-red-50 data-[focus]:outline-hidden dark:text-red-400 dark:data-[focus]:bg-red-500/10")}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("common.delete")}
                  </button>
                </MenuItem>
              </div>
            ) : null}
          </MenuItems>
        </Menu>
      ) : null}
    </div>
  );
}

function itemActivityLabel(item: Item, locale: string, t: Translate) {
  const edited = item.updated_at && item.created_at && item.updated_at !== item.created_at;
  return `${edited ? t("common.updated") : t("common.created")} ${formatListDate(locale, edited ? item.updated_at : item.created_at)}`;
}

const WIDE_COVER_RATIO = 1.25;

function coverAspectClass(ratio?: number) {
  if (ratio && ratio >= 0.9) return "aspect-square";
  return "aspect-[4/5]";
}

export function ItemsGrid({
  items,
  pendingRequestsByItem,
  serverURL,
  locale,
  t,
  showItemImages,
  showItemPlaceholders,
  showItemCategory,
  showItemLocation,
  showItemDescription,
  showItemStock,
  showItemConsumable,
  showItemPrice,
  showItemTotal,
  showItemProperties,
  showItemActivity,
  itemStockWarningPercent,
  itemStockCriticalPercent,
  listProps,
  categoryProperties,
  filterCategory,
  filterLocation,
  catName,
  catColor,
  locName,
  locColor,
  canReadInventory,
  canManageCheckouts,
  canReadMaintenance,
  canDelete,
  canPrint,
  pendingDelete,
  onOpenItem,
  onOpenInventory,
  onOpenCheckouts,
  onOpenMaintenance,
  onFilter,
  onPrint,
  onRemove,
}: {
  items: Item[];
  pendingRequestsByItem: Record<number, CheckoutRequest[]>;
  serverURL: string;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  showItemImages: boolean;
  showItemPlaceholders: boolean;
  showItemCategory: boolean;
  showItemLocation: boolean;
  showItemDescription: boolean;
  showItemStock: boolean;
  showItemConsumable: boolean;
  showItemPrice: boolean;
  showItemTotal: boolean;
  showItemProperties: boolean;
  showItemActivity: boolean;
  itemStockWarningPercent: number;
  itemStockCriticalPercent: number;
  listProps: Property[];
  categoryProperties: Property[];
  filterCategory?: number;
  filterLocation?: number;
  catName: (id?: number) => string;
  catColor: (id?: number) => string | undefined;
  locName: (id?: number) => string;
  locColor: (id?: number) => string | undefined;
  canReadInventory: boolean;
  canManageCheckouts: boolean;
  canReadMaintenance: boolean;
  canDelete: boolean;
  canPrint: boolean;
  pendingDelete: number | null;
  onOpenItem: (itemId: number) => void;
  onOpenInventory: (item: Item) => void;
  onOpenCheckouts: (item: Item) => void;
  onOpenMaintenance: (item: Item) => void;
  onFilter: (category?: number, location?: number) => void;
  onPrint: (item: Item) => void;
  onRemove: (itemId: number) => void;
}) {
  const [coverRatios, setCoverRatios] = useState<Record<number, number>>({});

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => {
        const image = itemImage(item);
        const isCatalogItem = categoryProperties.some((property) => {
          if (property.category_id !== item.category_id) return false;
          const catalog = property.options?.game_catalog;
          return !!catalog && typeof catalog === "object" && !Array.isArray(catalog);
        });
        const isCatalogImage = Boolean(image && isCatalogItem);
        const coverRatio = image ? coverRatios[image.id] : undefined;
        const isWideCover = Boolean(coverRatio && coverRatio >= WIDE_COVER_RATIO);
        const useCoverCard = isCatalogImage && !isWideCover;

        return (
          <div
          key={item.id}
          className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-900/5 transition hover:bg-gray-50 dark:bg-gray-800/50 dark:outline-white/10 dark:hover:bg-white/2.5"
          onClick={() => onOpenItem(item.id)}
        >
          {showItemImages && (() => {
            if (!image) {
              // Without a picture a flat strip is enough; a full-size
              // placeholder would be most of the card.
              return showItemPlaceholders ? (
                <div className="flex h-20 w-full shrink-0 items-center justify-center bg-gray-100 text-gray-300 dark:bg-white/5 dark:text-gray-600">
                  <Box className="size-8" />
                </div>
              ) : null;
            }
            return (
              <div className={clsx(
                "w-full shrink-0 overflow-hidden bg-gray-100 dark:bg-white/5",
                useCoverCard ? coverAspectClass(coverRatio) : isWideCover ? "aspect-[4/3]" : "h-44 sm:h-40 xl:h-44",
              )}>
                <img
                  src={itemImageURL(serverURL, image)}
                  alt=""
                  className={isCatalogImage ? "h-full w-full" : "h-full w-full object-cover"}
                  onLoad={isCatalogImage ? (event) => {
                    const { naturalHeight, naturalWidth } = event.currentTarget;
                    if (!naturalWidth || !naturalHeight) return;
                    const ratio = naturalWidth / naturalHeight;
                    setCoverRatios((current) => current[image.id] === ratio ? current : { ...current, [image.id]: ratio });
                  } : undefined}
                />
              </div>
            );
          })()}
          <div className={clsx(
            "flex flex-1 flex-col p-4",
          )}>
            <div className="min-w-0">
              {(item.is_bundle || item.parentBundle || pendingRequestsByItem[item.id]?.length || item.checked_out_to || (item.maintenance?.due_count || 0) > 0 || (item.maintenance?.overdue_count || 0) > 0 || (item.item_status && item.item_status !== "active")) ? (
                <div className="mb-2 flex flex-wrap items-start gap-1.5">
                  {renderBundleBadge(item, t)}
                  {renderStatusBadge(item, t)}
                  {renderRequestBadge(item.id, pendingRequestsByItem, t)}
                  {renderCheckoutBadge(item, t, canManageCheckouts ? () => onOpenCheckouts(item) : undefined)}
                  {renderMaintenanceBadge(item, (value) => formatListDate(locale, value), t, canReadMaintenance ? () => onOpenMaintenance(item) : undefined)}
                </div>
              ) : null}
              <div className="flex flex-wrap items-start gap-1.5">
                <h4 className="min-w-0 flex-1 break-words text-sm font-bold leading-6 text-gray-900 line-clamp-2 dark:text-white" style={{ hyphens: "auto" }}>
                  {item.name}
                </h4>
              </div>
              <div className="mt-2 flex flex-wrap items-start gap-1.5" onClick={(e) => e.stopPropagation()}>
                {showItemCategory && item.category_id ? (
                  <ColorChip label={catName(item.category_id)} color={catColor(item.category_id)} onClick={() => onFilter(item.category_id, filterLocation)} />
                ) : null}
                {showItemLocation && item.location_id ? (
                  <ColorChip label={locName(item.location_id)} color={locColor(item.location_id)} onClick={() => onFilter(filterCategory, item.location_id)} />
                ) : null}
              </div>
            </div>

            {showItemDescription && item.description ? (
              <MarkdownView content={item.description} className="mt-2 line-clamp-2 break-words !text-xs !text-gray-500 dark:!text-gray-400 [&_a]:pointer-events-none [&_a]:!font-normal [&_a]:!text-inherit [&_a]:!no-underline [&_p]:!my-0 [&_p]:!leading-normal [&_img]:hidden" />
            ) : null}

            {item.parentBundle ? (
              <p className="mt-2 break-words text-xs text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-700 dark:text-gray-300">{t("items.partOf")}:</span>{" "}
                <span className="whitespace-normal">{item.parentBundle.name}</span>
              </p>
            ) : null}

            {item.is_bundle && (item.components?.length || item.componentItemIds?.length) ? (
              <p className="mt-2 break-words text-xs text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-700 dark:text-gray-300">{t("items.components")}:</span>{" "}
                <span className="whitespace-normal">
                  {t("items.bundleContainsCount", { count: item.components?.length || item.componentItemIds?.length || 0 })}
                </span>
              </p>
            ) : null}

            {(showItemStock || showItemConsumable || showItemPrice || showItemTotal) && (
              <div className="mt-2 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                {showItemStock && (
                  <div className="break-words">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{t("items.quantity")}:</span>{" "}
                    <span className={clsx("whitespace-normal font-medium", quantityValueTone(item, itemStockWarningPercent, itemStockCriticalPercent))}>
                      {formatQuantityMeta(item)}
                    </span>
                  </div>
                )}
                {showItemConsumable && (
                  <div className="break-words">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{t("items.consumable")}:</span>{" "}
                    <span className="whitespace-normal">{item.is_consumable ? t("common.yes") : t("common.no")}</span>
                  </div>
                )}
                {showItemPrice && item.purchase_price != null && (
                  <div className="break-words">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{t("items.sortPrice")}:</span>{" "}
                    <span className="whitespace-normal">{formatCurrency(item.purchase_price, item.purchase_currency)}</span>
                  </div>
                )}
                {showItemTotal && item.purchase_price != null && (
                  <div className="break-words">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{t("items.sumTotal")}:</span>{" "}
                    <span className="whitespace-normal">{formatCurrency(item.purchase_price * item.quantity, item.purchase_currency)}</span>
                  </div>
                )}
              </div>
            )}

            {showItemProperties && (() => {
              const pv = getListPropValues(item, listProps);
              return pv.length > 0 ? (
                  <div className="mt-2 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {pv.map((p) => (
                    <div key={p.id} className="break-words">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{p.name}:</span>{" "}
                      <span className="whitespace-normal">{formatPropShort(p.value, p.type, locale, p.options)}{p.unit ? ` ${p.unit}` : ""}</span>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-4 py-3 dark:border-white/10">
            {/* Only the date fits on a narrow card; the tooltip says what it is. */}
            <span className="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400" title={showItemActivity ? itemActivityLabel(item, locale, t) : undefined}>
              {showItemActivity ? formatListDate(locale, item.updated_at || item.created_at) : null}
            </span>
            <ItemActions
              item={item}
              t={t}
              canReadInventory={canReadInventory}
              canManageCheckouts={canManageCheckouts}
              canReadMaintenance={canReadMaintenance}
              canDelete={canDelete}
              canPrint={canPrint}
              pendingDelete={pendingDelete}
              onOpenInventory={onOpenInventory}
              onOpenCheckouts={onOpenCheckouts}
              onOpenMaintenance={onOpenMaintenance}
              onPrint={onPrint}
              onRemove={onRemove}
            />
          </div>
          </div>
        );
      })}
    </div>
  );
}

type ItemsListProps = Parameters<typeof ItemsGrid>[0];

// ItemsTable is the compact view of the same list: one line per item, for
// when there are many similar things and the overview matters more than the
// pictures. It follows the same display switches as the cards.
export function ItemsTable({
  items,
  pendingRequestsByItem,
  serverURL,
  locale,
  t,
  showItemImages,
  showItemCategory,
  showItemLocation,
  showItemStock,
  showItemPrice,
  showItemTotal,
  showItemProperties,
  showItemActivity,
  itemStockWarningPercent,
  itemStockCriticalPercent,
  listProps,
  filterCategory,
  filterLocation,
  catName,
  catColor,
  locName,
  locColor,
  canReadInventory,
  canManageCheckouts,
  canReadMaintenance,
  canDelete,
  canPrint,
  pendingDelete,
  onOpenItem,
  onOpenInventory,
  onOpenCheckouts,
  onOpenMaintenance,
  onFilter,
  onPrint,
  onRemove,
}: ItemsListProps) {
  const headClass = "px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white";
  const cellClass = "px-3 py-3 text-sm text-gray-500 dark:text-gray-400";

  return (
    <div className="overflow-x-auto rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-900/5 dark:bg-gray-800/50 dark:outline-white/10">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
        <thead className="bg-gray-50 dark:bg-white/5">
          <tr>
            <th scope="col" className={clsx(headClass, "pl-4 sm:pl-6")}>{t("items.name")}</th>
            {showItemCategory ? <th scope="col" className={clsx(headClass, "hidden md:table-cell")}>{t("items.category")}</th> : null}
            {showItemLocation ? <th scope="col" className={clsx(headClass, "hidden lg:table-cell")}>{t("items.location")}</th> : null}
            {showItemStock ? <th scope="col" className={clsx(headClass, "text-right")}>{t("items.quantity")}</th> : null}
            {showItemPrice ? <th scope="col" className={clsx(headClass, "hidden text-right sm:table-cell")}>{t("items.sortPrice")}</th> : null}
            {showItemTotal ? <th scope="col" className={clsx(headClass, "hidden text-right xl:table-cell")}>{t("items.sumTotal")}</th> : null}
            {showItemActivity ? <th scope="col" className={clsx(headClass, "hidden xl:table-cell")}>{t("items.lastChange")}</th> : null}
            <th scope="col" className="py-3.5 pr-4 pl-3 sm:pr-6">
              <span className="sr-only">{t("common.actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-white/5">
          {items.map((item) => {
            const image = showItemImages ? itemImage(item) : undefined;
            // Only properties that have a value; an empty "Set: · Language:" says nothing.
            const properties = (showItemProperties ? getListPropValues(item, listProps) : [])
              .map((property) => ({ name: property.name, text: `${formatPropShort(property.value, property.type, locale, property.options)}${property.unit ? ` ${property.unit}` : ""}`.trim() }))
              .filter((property) => property.text && property.text !== "—");
            const badges = (
              <>
                {renderBundleBadge(item, t)}
                {renderStatusBadge(item, t)}
                {renderRequestBadge(item.id, pendingRequestsByItem, t)}
                {renderCheckoutBadge(item, t, canManageCheckouts ? () => onOpenCheckouts(item) : undefined)}
                {renderMaintenanceBadge(item, (value) => formatListDate(locale, value), t, canReadMaintenance ? () => onOpenMaintenance(item) : undefined)}
              </>
            );
            return (
              <tr key={item.id} onClick={() => onOpenItem(item.id)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/2.5">
                <td className="py-3 pr-3 pl-4 sm:pl-6">
                  <div className="flex items-center gap-x-3">
                    {showItemImages ? (
                      image ? (
                        <img src={itemImageURL(serverURL, image)} alt="" loading="lazy" className="size-10 flex-none rounded-md bg-gray-100 object-cover dark:bg-white/5" />
                      ) : (
                        <span className="flex size-10 flex-none items-center justify-center rounded-md bg-gray-100 text-gray-300 dark:bg-white/5 dark:text-gray-600">
                          <Box className="size-5" />
                        </span>
                      )
                    ) : null}
                    <div className="min-w-0">
                      <div className="text-sm font-medium break-words text-gray-900 dark:text-white">{item.name}</div>
                      {properties.length > 0 ? (
                        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {properties.map((property) => `${property.name}: ${property.text}`).join(" · ")}
                        </div>
                      ) : null}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 empty:hidden">
                        {badges}
                        {/* On a narrow screen the category has no column of its own. */}
                        {showItemCategory && item.category_id ? (
                          <span className="md:hidden" onClick={(event) => event.stopPropagation()}>
                            <ColorChip label={catName(item.category_id)} color={catColor(item.category_id)} onClick={() => onFilter(item.category_id, filterLocation)} />
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </td>
                {showItemCategory ? (
                  <td className={clsx(cellClass, "hidden md:table-cell")} onClick={(event) => event.stopPropagation()}>
                    {item.category_id ? <ColorChip label={catName(item.category_id)} color={catColor(item.category_id)} onClick={() => onFilter(item.category_id, filterLocation)} /> : "—"}
                  </td>
                ) : null}
                {showItemLocation ? (
                  <td className={clsx(cellClass, "hidden lg:table-cell")} onClick={(event) => event.stopPropagation()}>
                    {item.location_id ? <ColorChip label={locName(item.location_id)} color={locColor(item.location_id)} onClick={() => onFilter(filterCategory, item.location_id)} /> : "—"}
                  </td>
                ) : null}
                {showItemStock ? (
                  <td className={clsx(cellClass, "text-right font-medium whitespace-nowrap tabular-nums", quantityValueTone(item, itemStockWarningPercent, itemStockCriticalPercent))}>
                    {formatQuantityMeta(item)}
                  </td>
                ) : null}
                {showItemPrice ? (
                  <td className={clsx(cellClass, "hidden text-right whitespace-nowrap tabular-nums sm:table-cell")}>
                    {item.purchase_price != null ? formatCurrency(item.purchase_price, item.purchase_currency) : "—"}
                  </td>
                ) : null}
                {showItemTotal ? (
                  <td className={clsx(cellClass, "hidden text-right whitespace-nowrap tabular-nums xl:table-cell")}>
                    {item.purchase_price != null ? formatCurrency(item.purchase_price * item.quantity, item.purchase_currency) : "—"}
                  </td>
                ) : null}
                {showItemActivity ? (
                  <td className={clsx(cellClass, "hidden whitespace-nowrap xl:table-cell")}>
                    {formatListDate(locale, item.updated_at || item.created_at)}
                  </td>
                ) : null}
                <td className="py-3 pr-4 pl-3 sm:pr-6">
                  <ItemActions
                    item={item}
                    t={t}
                    canReadInventory={canReadInventory}
                    canManageCheckouts={canManageCheckouts}
                    canReadMaintenance={canReadMaintenance}
                    canDelete={canDelete}
                    canPrint={canPrint}
                    pendingDelete={pendingDelete}
                    onOpenInventory={onOpenInventory}
                    onOpenCheckouts={onOpenCheckouts}
                    onOpenMaintenance={onOpenMaintenance}
                    onPrint={onPrint}
                    onRemove={onRemove}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ItemsPagination({
  page,
  total,
  itemsPerPage,
  t,
  onPage,
}: {
  page: number;
  total: number;
  itemsPerPage: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.ceil(total / itemsPerPage);
  if (totalPages <= 1) return null;
  const pages = buildPaginationPages(page, totalPages);

  return (
    <nav className="flex items-center justify-between border-t border-gray-200 px-4 dark:border-white/10 sm:px-0" aria-label="Pagination">
      <div className="-mt-px flex w-0 flex-1">
        <button
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="inline-flex items-center border-t-2 border-transparent pt-4 pr-1 text-sm font-medium text-gray-400 hover:border-gray-300 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:border-white/20 dark:hover:text-gray-200"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="mr-3 size-5 text-gray-500">
            <path d="M18 10a.75.75 0 0 1-.75.75H4.66l2.1 1.95a.75.75 0 1 1-1.02 1.1l-3.5-3.25a.75.75 0 0 1 0-1.1l3.5-3.25a.75.75 0 1 1 1.02 1.1l-2.1 1.95h12.59A.75.75 0 0 1 18 10Z" />
          </svg>
          {t("common.previous")}
        </button>
      </div>
      <div className="hidden md:-mt-px md:flex">
        {pages.map((pageNumber, index) =>
          pageNumber === -1 ? (
            <span key={`ellipsis-${index}`} className="inline-flex items-center border-t-2 border-transparent px-4 pt-4 text-sm font-medium text-gray-500">
              ...
            </span>
          ) : (
            <button
              key={pageNumber}
              onClick={() => onPage(pageNumber)}
              aria-current={pageNumber === page ? "page" : undefined}
              className={clsx(
                "inline-flex items-center border-t-2 px-4 pt-4 text-sm font-medium",
                pageNumber === page
                  ? "border-indigo-400 text-indigo-400"
                  : "border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-700 dark:hover:border-white/20 dark:hover:text-gray-200",
              )}
            >
              {pageNumber}
            </button>
          ),
        )}
      </div>
      <div className="-mt-px flex w-0 flex-1 justify-end">
        <button
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="inline-flex items-center border-t-2 border-transparent pt-4 pl-1 text-sm font-medium text-gray-400 hover:border-gray-300 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:border-white/20 dark:hover:text-gray-200"
        >
          {t("common.next")}
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="ml-3 size-5 text-gray-500">
            <path d="M2 10a.75.75 0 0 1 .75-.75h12.59l-2.1-1.95a.75.75 0 1 1 1.02-1.1l3.5 3.25a.75.75 0 0 1 0 1.1l-3.5 3.25a.75.75 0 1 1-1.02-1.1l2.1-1.95H2.75A.75.75 0 0 1 2 10Z" />
          </svg>
        </button>
      </div>
    </nav>
  );
}

export function ItemsNotification({
  notification,
  t,
  onClose,
}: {
  notification: { title: string; message?: string; tone: "success" | "error" } | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onClose: () => void;
}) {
  return (
    <div aria-live="assertive" className="pointer-events-none fixed inset-0 z-[60] flex items-end px-4 py-6 sm:items-start sm:p-6">
      <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
        {notification ? (
          <div className="pointer-events-auto w-full max-w-sm translate-y-0 transform rounded-lg bg-gray-800 opacity-100 shadow-lg outline outline-1 -outline-offset-1 outline-white/10 transition duration-300 ease-out sm:translate-x-0 [@starting-style]:translate-y-2 [@starting-style]:opacity-0 [@starting-style]:sm:translate-x-2 [@starting-style]:sm:translate-y-0">
            <div className="p-4">
              <div className="flex items-start">
                <div className="shrink-0">
                  {notification.tone === "error" ? (
                    <X className="size-6 text-red-400" />
                  ) : (
                    <CircleCheck className="size-6 text-green-400" />
                  )}
                </div>
                <div className="ml-3 w-0 flex-1 pt-0.5">
                  <p className="text-sm font-medium text-white">{notification.title}</p>
                  {notification.message ? <p className="mt-1 text-sm text-gray-400">{notification.message}</p> : null}
                </div>
                <div className="ml-4 flex shrink-0">
                  <button type="button" onClick={onClose} className="inline-flex rounded-md text-gray-400 hover:text-white focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-indigo-500">
                    <span className="sr-only">{t("common.close")}</span>
                    <X className="size-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
