"use client";

import clsx from "clsx";
import { CheckCircleIcon, PencilIcon, PrinterIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { CheckoutRequest, Item, Property } from "@/lib/api";
import {
  formatCurrency,
  formatPropShort,
  formatQuantityMeta,
  getListPropValues,
  quantityValueTone,
} from "@/app/(app)/items/items-page-utils";
import { buildPaginationPages } from "@/app/(app)/items/items-page-navigation";

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
      Anfrage: {label}
    </span>
  );
}

function renderCheckoutBadge(item: Item, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (!item.checked_out_to) return null;
  const users = item.checked_out_to.users || [];
  const primaryName = users[0]?.user_name?.trim() || item.checked_out_to.user_name?.trim() || t("users.deletedUser");
  const label = users.length > 1 ? `${primaryName} +${users.length - 1}` : primaryName;
  return (
    <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 shrink-0">
      {t("items.checkedOutToLabel", { user: label })}
    </span>
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

export function ItemsGrid({
  items,
  pendingRequestsByItem,
  serverURL,
  isDark,
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
  filterCategory,
  filterLocation,
  catName,
  catColor,
  locName,
  locColor,
  canWrite,
  canDelete,
  canPrint,
  pendingDelete,
  onOpenItem,
  onOpenEdit,
  onFilter,
  onPrint,
  onRemove,
}: {
  items: Item[];
  pendingRequestsByItem: Record<number, CheckoutRequest[]>;
  serverURL: string;
  isDark: boolean;
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
  filterCategory?: number;
  filterLocation?: number;
  catName: (id?: number) => string;
  catColor: (id?: number) => string | undefined;
  locName: (id?: number) => string;
  locColor: (id?: number) => string | undefined;
  canWrite: boolean;
  canDelete: boolean;
  canPrint: boolean;
  pendingDelete: number | null;
  onOpenItem: (itemId: number) => void;
  onOpenEdit: (item: Item) => void;
  onFilter: (category?: number, location?: number) => void;
  onPrint: (item: Item) => void;
  onRemove: (itemId: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-900/5 transition hover:bg-gray-50 dark:bg-gray-800/50 dark:outline-white/10 dark:hover:bg-white/2.5"
          onClick={() => onOpenItem(item.id)}
        >
          {showItemImages && (() => {
            const img = item.attachments?.find((a) => a.gallery && (a.file_path || a.download_url) && /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(a.filename));
            if (!img && !showItemPlaceholders) return null;
            return (
              <div className="h-44 w-full shrink-0 overflow-hidden bg-gray-100 sm:h-40 xl:h-44 dark:bg-white/5">
                <img
                  src={img ? (img.download_url ? `${serverURL}${img.download_url}` : `${serverURL}/uploads/${img.file_path}`) : (isDark ? "/item-placeholder-dark.svg" : "/item-placeholder.svg")}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            );
          })()}
          <div className="flex flex-1 flex-col p-4">
            <div className="min-w-0">
              {(item.is_bundle || item.parentBundle || pendingRequestsByItem[item.id]?.length || item.checked_out_to || (item.item_status && item.item_status !== "active")) ? (
                <div className="mb-2 flex flex-wrap items-start gap-1.5">
                  {renderBundleBadge(item, t)}
                  {renderStatusBadge(item, t)}
                  {renderRequestBadge(item.id, pendingRequestsByItem, t)}
                  {renderCheckoutBadge(item, t)}
                </div>
              ) : null}
              <div className="flex flex-wrap items-start gap-1.5">
                <h4 className="min-w-0 flex-1 break-words text-sm font-bold leading-6 text-gray-900 line-clamp-2 dark:text-white" style={{ hyphens: "auto" }}>
                  {item.name}
                </h4>
              </div>
              <div className="mt-2 flex flex-wrap items-start gap-1.5" onClick={(e) => e.stopPropagation()}>
                {showItemCategory && item.category_id && (
                  <button
                    onClick={() => onFilter(item.category_id, filterLocation)}
                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${!catColor(item.category_id) ? "bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-300" : ""}`}
                    style={catColor(item.category_id) ? { backgroundColor: `${catColor(item.category_id)}15`, color: catColor(item.category_id) } : undefined}
                  >
                    {catName(item.category_id)}
                  </button>
                )}
                {showItemLocation && item.location_id && (
                  <button
                    onClick={() => onFilter(filterCategory, item.location_id)}
                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${!locColor(item.location_id) ? "bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-300" : ""}`}
                    style={locColor(item.location_id) ? { backgroundColor: `${locColor(item.location_id)}15`, color: locColor(item.location_id) } : undefined}
                  >
                    {locName(item.location_id)}
                  </button>
                )}
              </div>
            </div>

            {showItemDescription && item.description ? (
              <p className="mt-2 break-words text-xs text-gray-500 line-clamp-4 dark:text-gray-400">{item.description}</p>
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
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Menge:</span>{" "}
                    <span className={clsx("whitespace-normal font-medium", quantityValueTone(item, itemStockWarningPercent, itemStockCriticalPercent))}>
                      {formatQuantityMeta(item)}
                    </span>
                  </div>
                )}
                {showItemConsumable && (
                  <div className="break-words">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Verbrauchbar:</span>{" "}
                    <span className="whitespace-normal">{item.is_consumable ? (locale === "en" ? "Yes" : "Ja") : (locale === "en" ? "No" : "Nein")}</span>
                  </div>
                )}
                {showItemPrice && item.purchase_price != null && (
                  <div className="break-words">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Preis:</span>{" "}
                    <span className="whitespace-normal">{formatCurrency(item.purchase_price, item.purchase_currency)}</span>
                  </div>
                )}
                {showItemTotal && item.purchase_price != null && (
                  <div className="break-words">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Gesamt:</span>{" "}
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
                    <div key={p.name} className="break-words">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{p.name}:</span>{" "}
                      <span className="whitespace-normal">{formatPropShort(p.value, p.type, locale)}{p.unit ? ` ${p.unit}` : ""}</span>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
          </div>

          <div className="flex items-center justify-end gap-1 border-t border-gray-200 px-4 py-3 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="mr-auto flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              {showItemActivity ? (
                (item.updated_at && item.created_at && item.updated_at !== item.created_at) ? (
                  <span>{t("common.updated")} {formatListDate(locale, item.updated_at)}</span>
                ) : (
                  <span>{t("common.created")} {formatListDate(locale, item.created_at)}</span>
                )
              ) : null}
            </div>
            {(canWrite || canDelete || canPrint) && (
              <div className="flex items-center justify-end gap-1">
                {canPrint && (
                  <button onClick={() => onPrint(item)} className="rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-white/10" title={t("common.print")}>
                    <PrinterIcon className="h-4 w-4 text-gray-400" />
                  </button>
                )}
                {canWrite && (
                  <button onClick={() => onOpenEdit(item)} className="rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-white/10" title={t("common.edit")}>
                    <PencilIcon className="h-4 w-4 text-gray-400" />
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => onRemove(item.id)} disabled={pendingDelete === item.id} className="rounded-md p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50" title={t("common.delete")}>
                    {pendingDelete === item.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                    ) : (
                      <TrashIcon className="h-4 w-4 text-red-400" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
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
                    <XMarkIcon className="size-6 text-red-400" />
                  ) : (
                    <CheckCircleIcon className="size-6 text-green-400" />
                  )}
                </div>
                <div className="ml-3 w-0 flex-1 pt-0.5">
                  <p className="text-sm font-medium text-white">{notification.title}</p>
                  {notification.message ? <p className="mt-1 text-sm text-gray-400">{notification.message}</p> : null}
                </div>
                <div className="ml-4 flex shrink-0">
                  <button type="button" onClick={onClose} className="inline-flex rounded-md text-gray-400 hover:text-white focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-indigo-500">
                    <span className="sr-only">{t("common.close")}</span>
                    <XMarkIcon className="size-5" />
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
