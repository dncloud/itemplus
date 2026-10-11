"use client";

import clsx from "clsx";
import Link from "next/link";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ArrowDownUp, Barcode, Check, ChevronRight, Filter, LayoutGrid, Search, Plus, TableProperties, X } from "lucide-react";
import { Filter as FunnelSolid } from "lucide-react";
import { type Category, type Location } from "@/lib/api";
import type { ItemListView } from "@/lib/app-context-storage";
import { ItemsFilterPicker as FilterPicker } from "@/app/(app)/items/items-filter-picker";

type Translator = (key: string, vars?: Record<string, string | number>) => string;

export function ItemsPageHeader({
  realm,
  t,
  canWrite,
  showBarcodeCapture,
  barcodeCapturePending,
  onRequestBarcodeCapture,
  onOpenNew,
}: {
  realm: "archive" | "collection";
  t: Translator;
  canWrite: boolean;
  showBarcodeCapture: boolean;
  barcodeCapturePending: boolean;
  onRequestBarcodeCapture: () => void;
  onOpenNew: () => void;
}) {
  return (
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
            <li className="text-gray-900 dark:text-white">{t("items.title")}</li>
          </ol>
        </nav>
        <h2 className="text-2xl font-bold">{t("items.title")}</h2>
      </div>

      <div className="flex items-center justify-center gap-2 rounded-sm px-2 py-3 sm:justify-end sm:bg-transparent sm:px-0">
        {canWrite && showBarcodeCapture && (
          <button
            onClick={onRequestBarcodeCapture}
            disabled={barcodeCapturePending}
            className={clsx(
              "inline-flex items-center justify-center rounded-lg border p-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-60",
              barcodeCapturePending
                ? "border-green-300 text-green-600 dark:border-green-700 dark:text-green-500"
                : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800",
            )}
            title={barcodeCapturePending ? t("items.barcodeWaiting") : t("items.scanBarcode")}
          >
            <Barcode className="h-4 w-4" />
          </button>
        )}
        {canWrite && (
          <button
            type="button"
            onClick={onOpenNew}
            className="inline-flex items-center gap-x-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500"
          >
            <Plus aria-hidden="true" className="-ml-0.5 size-4" />
            {t("items.new")}
          </button>
        )}
      </div>
    </div>
  );
}

export function ItemsPageToolbar({
  t,
  search,
  setSearch,
  activeSearch,
  submitSearch,
  clearSearch,
  resetAllFilters,
  filterOpen,
  setFilterOpen,
  filterCategory,
  filterLocation,
  filterStatus,
  sortField,
  sortOrder,
  setSort,
  view,
  setView,
  setFilter,
  categories,
  locations,
  total,
  totalQty,
  totalValue,
  loading,
  getCategoryName,
  getLocationName,
  getStatusLabel,
}: {
  t: Translator;
  search: string;
  setSearch: (value: string) => void;
  activeSearch: string;
  submitSearch: () => void;
  clearSearch: () => void;
  resetAllFilters: () => void;
  filterOpen: boolean;
  setFilterOpen: (open: boolean) => void;
  filterCategory?: number;
  filterLocation?: number;
  filterStatus?: string;
  sortField: string;
  sortOrder: string;
  setSort: (field: string, order: string) => void;
  view: ItemListView;
  setView: (view: ItemListView) => void;
  setFilter: (category?: number, location?: number, status?: string) => void;
  categories: Category[];
  locations: Location[];
  total: number;
  totalQty: number;
  totalValue: number;
  loading: boolean;
  getCategoryName: (id?: number) => string;
  getLocationName: (id?: number) => string;
  getStatusLabel: (status: string) => string;
}) {
  const statusOptions = [
    { value: "active", label: getStatusLabel("active") },
    { value: "checked_out", label: getStatusLabel("checked_out") },
    { value: "reserved", label: getStatusLabel("reserved") },
    { value: "for_sale", label: getStatusLabel("for_sale") },
    { value: "sold", label: getStatusLabel("sold") },
  ] as const;
  const sortOptions = [
    { field: "id", order: "desc", label: t("items.sortNewestFirst") },
    { field: "id", order: "asc", label: t("items.sortOldestFirst") },
    { field: "name", order: "asc", label: t("items.sortNameAsc") },
    { field: "name", order: "desc", label: t("items.sortNameDesc") },
    { field: "price", order: "desc", label: t("items.sortPriceDesc") },
    { field: "price", order: "asc", label: t("items.sortPriceAsc") },
    { field: "quantity", order: "desc", label: t("items.sortQuantityDesc") },
    { field: "quantity", order: "asc", label: t("items.sortQuantityAsc") },
  ] as const;
  const toolbarButtonClass =
    "flex shrink-0 items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-1 -outline-offset-1 outline-gray-300 hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 dark:bg-white/10 dark:text-white dark:outline-gray-700 dark:hover:bg-white/20 dark:focus-visible:outline-indigo-500";

  return (
    <>
      <div className="pb-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-4">
            <form
              className="flex flex-col sm:flex-row sm:items-center"
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch();
              }}
            >
              <div className="flex flex-1">
                <div className="-mr-px grid grow grid-cols-1 focus-within:relative">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("common.search")}
                    aria-label={t("common.search")}
                    className="col-start-1 row-start-1 block w-full rounded-l-md bg-white py-1.5 pr-3 pl-10 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:pl-9 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                  />
                  <Search className="pointer-events-none col-start-1 row-start-1 ml-3 size-5 self-center text-gray-400 sm:size-4" />
                </div>
                <button
                  type="submit"
                  className="inline-flex shrink-0 items-center justify-center border-y border-l-0 border-r-0 border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                  title={t("common.search")}
                >
                  <Search className="h-4 w-4" />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setFilterOpen(!filterOpen)}
                    className="flex shrink-0 items-center gap-x-1.5 rounded-r-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-1 -outline-offset-1 outline-gray-300 hover:bg-gray-50 focus:relative focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/10 dark:text-white dark:outline-white/5 dark:hover:bg-white/20 dark:focus:outline-indigo-500"
                  >
                    {(filterCategory || filterLocation || filterStatus)
                      ? <FunnelSolid className="-ml-0.5 size-4 text-gray-400 dark:text-gray-300" />
                      : <Filter className="-ml-0.5 size-4 text-gray-400 dark:text-gray-300" />}
                    {t("common.filter")}
                  </button>
                  {filterOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
                      <div className="absolute right-0 top-full z-50 mt-2 w-72 space-y-3 rounded-md bg-white p-4 shadow-lg outline-1 outline-gray-900/5 dark:bg-gray-800 dark:outline-white/10">
                        <FilterPicker
                          label={t("items.category")}
                          value={filterCategory}
                          onChange={(value) => { setFilter(value, filterLocation, filterStatus); setFilterOpen(false); }}
                          items={categories.map((category) => ({ id: category.id, name: category.name }))}
                        />
                        <FilterPicker
                          label={t("items.location")}
                          value={filterLocation}
                          onChange={(value) => { setFilter(filterCategory, value, filterStatus); setFilterOpen(false); }}
                          items={buildFlatLocations(locations)}
                        />
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">{t("items.itemStatus")}</label>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => { setFilter(filterCategory, filterLocation, undefined); setFilterOpen(false); }}
                              className={clsx(
                                "rounded-md px-2.5 py-1.5 text-xs transition",
                                !filterStatus
                                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
                                  : "bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10",
                              )}
                            >
                              {t("common.all")}
                            </button>
                            {statusOptions.map(({ value, label }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => { setFilter(filterCategory, filterLocation, value); setFilterOpen(false); }}
                                className={clsx(
                                  "rounded-md px-2.5 py-1.5 text-xs transition",
                                  filterStatus === value
                                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
                                    : "bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10",
                                )}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {(filterCategory || filterLocation || filterStatus) && (
                          <button
                            type="button"
                            onClick={() => { resetAllFilters(); setFilterOpen(false); }}
                            className="w-full text-xs text-gray-500 transition hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-300"
                          >
                            {t("items.resetFilters")}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 sm:mt-0 sm:ml-3">
                <Menu as="div" className="relative">
                  <MenuButton className={toolbarButtonClass}>
                    <ArrowDownUp aria-hidden="true" className="-ml-0.5 size-4 text-gray-400 dark:text-gray-300" />
                    {t("items.sortBy")}
                  </MenuButton>
                  <MenuItems
                    transition
                    className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-md bg-white py-1 shadow-lg outline-1 outline-black/5 transition data-[closed]:scale-95 data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
                  >
                    {sortOptions.map((option) => {
                      const active = sortField === option.field && sortOrder === option.order;
                      return (
                        <MenuItem key={`${option.field}-${option.order}`}>
                          <button
                            type="button"
                            onClick={() => setSort(option.field, option.order)}
                            className={clsx(
                              "flex w-full items-center justify-between px-4 py-2 text-left text-sm data-[focus]:bg-gray-100 data-[focus]:outline-hidden dark:data-[focus]:bg-white/5",
                              active ? "font-semibold text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300",
                            )}
                          >
                            {option.label}
                            {active ? <Check aria-hidden="true" className="size-4 text-indigo-600 dark:text-indigo-400" /> : null}
                          </button>
                        </MenuItem>
                      );
                    })}
                  </MenuItems>
                </Menu>

                <span className="isolate inline-flex rounded-md">
                  {([
                    { value: "cards", label: t("items.viewCards"), icon: LayoutGrid },
                    { value: "table", label: t("items.viewTable"), icon: TableProperties },
                  ] as const).map((option, index) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setView(option.value)}
                      title={option.label}
                      aria-label={option.label}
                      aria-pressed={view === option.value}
                      className={clsx(
                        "relative inline-flex items-center px-2.5 py-2 outline-1 -outline-offset-1 outline-gray-300 focus:z-10 dark:outline-gray-700",
                        index === 0 ? "rounded-l-md" : "-ml-px rounded-r-md",
                        view === option.value
                          ? "bg-gray-100 text-gray-900 dark:bg-white/20 dark:text-white"
                          : "bg-white text-gray-400 hover:bg-gray-50 dark:bg-white/10 dark:hover:bg-white/20",
                      )}
                    >
                      <option.icon aria-hidden="true" className="size-5" />
                    </button>
                  ))}
                </span>
              </div>
            </form>

            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span><strong className="text-gray-700 dark:text-gray-300">{total}</strong> {t("nav.items")}</span>
              {totalValue > 0 && (
                <span><strong className="text-gray-700 dark:text-gray-300">{totalValue.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</strong> {t("items.totalValue")}</span>
              )}
              {filterLocation && (() => {
                const location = locations.find((entry) => entry.id === filterLocation);
                return location?.capacity ? (
                  <span><strong className="text-gray-700 dark:text-gray-300">{totalQty}/{location.capacity}</strong> {t("locations.capacity")}</span>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      </div>

      {(filterCategory || filterLocation || filterStatus || activeSearch) && !loading && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {activeSearch ? (
              <button
                onClick={clearSearch}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
              >
                {t("common.search")}: {activeSearch}
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {filterCategory && (
              <button
                onClick={() => setFilter(undefined, filterLocation, filterStatus)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
              >
                {t("items.category")}: {getCategoryName(filterCategory)}
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {filterLocation && (
              <button
                onClick={() => setFilter(filterCategory, undefined, filterStatus)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
              >
                {t("items.location")}: {getLocationName(filterLocation)}
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {filterStatus && (
              <button
                onClick={() => setFilter(filterCategory, filterLocation, undefined)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
              >
                {t("items.itemStatus")}: {getStatusLabel(filterStatus)}
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function buildFlatLocations(locations: Location[]) {
  const flat: { id: number; name: string; depth: number }[] = [];
  const roots = locations.filter((location) => !location.parent_id).sort((a, b) => a.position - b.position);
  const walk = (entries: Location[], depth: number) => {
    for (const location of entries) {
      flat.push({ id: location.id, name: location.name, depth });
      walk(
        locations.filter((child) => child.parent_id === location.id).sort((a, b) => a.position - b.position),
        depth + 1,
      );
    }
  };
  walk(roots, 0);
  return flat;
}
