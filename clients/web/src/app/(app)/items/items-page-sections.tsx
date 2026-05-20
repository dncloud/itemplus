"use client";

import clsx from "clsx";
import Link from "next/link";
import { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, FunnelIcon, MagnifyingGlassIcon, PlusIcon, QrCodeIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { FunnelIcon as FunnelSolid } from "@heroicons/react/24/solid";
import { type Category, type Location } from "@/lib/api";
import { ItemsFilterPicker as FilterPicker } from "@/app/(app)/items/items-filter-picker";

type Translator = (key: string, vars?: Record<string, string | number>) => string;

export function ItemsPageHeader({
  realm,
  t,
  canWrite,
  barcodeCapturePending,
  onRequestBarcodeCapture,
  onOpenNew,
}: {
  realm: "archive" | "collection";
  t: Translator;
  canWrite: boolean;
  barcodeCapturePending: boolean;
  onRequestBarcodeCapture: () => void;
  onOpenNew: () => void;
}) {
  return (
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
            <li className="text-gray-900 dark:text-white">{t("items.title")}</li>
          </ol>
        </nav>
        <h2 className="text-2xl font-bold">{t("items.title")}</h2>
      </div>

      <div className="flex items-center justify-center gap-2 rounded-sm px-2 py-3 sm:justify-end sm:bg-transparent sm:px-0">
        {canWrite && (
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
            <QrCodeIcon className="h-4 w-4" />
          </button>
        )}
        {canWrite && (
          <button
            onClick={onOpenNew}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-sm transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            title={t("common.new")}
          >
            <PlusIcon className="h-4 w-4" />
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

  return (
    <>
      <div className="border-b border-gray-200 pb-5 dark:border-white/10">
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
                  <MagnifyingGlassIcon className="pointer-events-none col-start-1 row-start-1 ml-3 size-5 self-center text-gray-400 sm:size-4" />
                </div>
                <button
                  type="submit"
                  className="inline-flex shrink-0 items-center justify-center border-y border-l-0 border-r-0 border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                  title={t("common.search")}
                >
                  <MagnifyingGlassIcon className="h-4 w-4" />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setFilterOpen(!filterOpen)}
                    className="flex shrink-0 items-center gap-x-1.5 rounded-r-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-1 -outline-offset-1 outline-gray-300 hover:bg-gray-50 focus:relative focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/10 dark:text-white dark:outline-white/5 dark:hover:bg-white/20 dark:focus:outline-indigo-500"
                  >
                    {(filterCategory || filterLocation || filterStatus || sortField !== "id")
                      ? <FunnelSolid className="-ml-0.5 size-4 text-gray-400 dark:text-gray-300" />
                      : <FunnelIcon className="-ml-0.5 size-4 text-gray-400 dark:text-gray-300" />}
                    {t("common.filter")}
                  </button>
                  {filterOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
                      <div className="absolute right-0 top-full z-50 mt-2 w-72 space-y-3 rounded-md bg-white p-4 shadow-lg outline-1 outline-gray-900/5 dark:bg-gray-800 dark:outline-white/10">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">{t("items.sortBy")}</label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {([
                              { field: "name", label: t("items.sortName"), defaultOrd: "asc" },
                              { field: "price", label: t("items.sortPrice"), defaultOrd: "desc" },
                              { field: "quantity", label: t("items.sortQuantity"), defaultOrd: "desc" },
                              { field: "id", label: t("items.sortNewest"), defaultOrd: "desc" },
                            ] as const).map(({ field, label, defaultOrd }) => {
                              const active = sortField === field;
                              return (
                                <button
                                  key={field}
                                  type="button"
                                  onClick={() => setSort(field, active && sortOrder === defaultOrd ? (defaultOrd === "desc" ? "asc" : "desc") : defaultOrd)}
                                  className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition ${
                                    active ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300" : "bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10"
                                  }`}
                                >
                                  {label}
                                  {active && (sortOrder === "asc" ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <hr className="border-gray-100 dark:border-white/10" />

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
                        {(filterCategory || filterLocation || filterStatus || sortField !== "id") && (
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
            </form>

            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span><strong className="text-gray-700 dark:text-gray-300">{total}</strong> {total === 1 ? "Item" : "Items"}</span>
              {totalValue > 0 && (
                <span><strong className="text-gray-700 dark:text-gray-300">{totalValue.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</strong> {t("items.totalValue")}</span>
              )}
              {filterLocation && (() => {
                const location = locations.find((entry) => entry.id === filterLocation);
                return location?.capacity ? (
                  <span><strong className="text-gray-700 dark:text-gray-300">{totalQty}/{location.capacity}</strong> Kapazität</span>
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
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {filterCategory && (
              <button
                onClick={() => setFilter(undefined, filterLocation, filterStatus)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
              >
                {t("items.category")}: {getCategoryName(filterCategory)}
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            )}
            {filterLocation && (
              <button
                onClick={() => setFilter(filterCategory, undefined, filterStatus)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
              >
                {t("items.location")}: {getLocationName(filterLocation)}
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            )}
            {filterStatus && (
              <button
                onClick={() => setFilter(filterCategory, filterLocation, undefined)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
              >
                {t("items.itemStatus")}: {getStatusLabel(filterStatus)}
                <XMarkIcon className="h-3.5 w-3.5" />
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
