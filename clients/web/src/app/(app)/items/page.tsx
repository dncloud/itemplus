"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, type Item, type Category, type Location, type Property, type Vendor, type CheckoutRequest } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { MarkdownEditor } from "@/components/markdown";
import { useDeleteFlow, ConfirmDelete } from "@/components/confirm-delete";
import SelectPicker from "@/components/select-picker";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  TableCellsIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  PhotoIcon,
  FunnelIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
import { FunnelIcon as FunnelSolid } from "@heroicons/react/24/solid";
import PropertyField from "@/components/property-field";

export default function ItemsPage({ pageOverride }: { pageOverride?: number } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { realm, serverURL, can, locale, printItemQR, t } = useApp();
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [totalQty, setTotalQty] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const page = pageOverride ?? (Number(searchParams.get("page")) || 1);
  const filterCategory = searchParams.get("category") ? Number(searchParams.get("category")) : undefined;
  const filterLocation = searchParams.get("location") ? Number(searchParams.get("location")) : undefined;
  const sortField = searchParams.get("sort") || "updated";
  const sortOrder = searchParams.get("order") || "desc";

  const buildUrl = (opts: { page?: number; q?: string; category?: number; location?: number; sort?: string; order?: string }) => {
    const params = new URLSearchParams();
    if (opts.q) params.set("q", opts.q);
    if (opts.category) params.set("category", String(opts.category));
    if (opts.location) params.set("location", String(opts.location));
    if (opts.sort && opts.sort !== "updated") params.set("sort", opts.sort);
    if (opts.order && opts.order !== "desc") params.set("order", opts.order);
    const queryString = params.toString() ? `?${params.toString()}` : "";
    const p = opts.page ?? 1;
    return p === 1 ? `/items${queryString}` : `/items/page/${p}${queryString}`;
  };

  const setPage = (p: number) => {
    router.push(buildUrl({ page: p, q: search || undefined, category: filterCategory, location: filterLocation, sort: sortField, order: sortOrder }));
  };

  const setFilter = (cat?: number, loc?: number) => {
    router.push(buildUrl({ page: 1, q: search || undefined, category: cat, location: loc, sort: sortField, order: sortOrder }));
  };

  const setSort = (field: string, ord: string) => {
    router.push(buildUrl({ page: 1, q: search || undefined, category: filterCategory, location: filterLocation, sort: field, order: ord }));
  };
  const [view, _setView] = useState<"grid" | "table">("grid");
  const setView = (v: "grid" | "table") => {
    _setView(v);
    if (typeof window !== "undefined") localStorage.setItem("itemplus_items_view", v);
  };
  // Restore view from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("itemplus_items_view") as "grid" | "table" | null;
    if (saved) _setView(saved);
  }, []);
  const [editItem, setEditItem] = useState<Partial<Item> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const [manufacturers, setManufacturers] = useState<Vendor[]>([]);
  const [suppliers, setSuppliers] = useState<Vendor[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [pendingRequestsByItem, setPendingRequestsByItem] = useState<Record<number, CheckoutRequest[]>>({});

  // All properties (for CSV export) and category-specific (for modal)
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [catProperties, setCatProperties] = useState<Property[]>([]);
  const [propValues, setPropValues] = useState<Record<string, unknown>>({});

  // Load reference data once per realm
  useEffect(() => {
    Promise.all([
      api.getCategories().catch(() => []), api.getLocations().catch(() => []), api.getProperties().catch(() => []),
      api.getManufacturers().catch(() => []), api.getSuppliers().catch(() => []), api.getVendors().catch(() => []),
    ]).then(([c, l, p, mfrs, sups, vends]) => {
      setCategories(c); setLocations(l); setAllProperties(p);
      setManufacturers(mfrs); setSuppliers(sups); setVendors(vends);
    });
  }, [realm]);

  useEffect(() => {
    if (!can("checkout.manage")) {
      setPendingRequestsByItem({});
      return;
    }
    api.getCheckoutRequests()
      .then((requests) => {
        const grouped = requests
          .filter((request) => request.realm === realm && request.status === "pending")
          .reduce<Record<number, CheckoutRequest[]>>((acc, request) => {
            if (!acc[request.item_id]) acc[request.item_id] = [];
            acc[request.item_id].push(request);
            return acc;
          }, {});
        setPendingRequestsByItem(grouped);
      })
      .catch(() => setPendingRequestsByItem({}));
  }, [realm, can]);

  // Load items when filters/page/search change (debounced to avoid double-fire)
  const loadingRef = useRef(false);
  const loadItems = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await api.getItems(page, search || undefined, filterCategory, filterLocation, sortField, sortOrder);
      setItems(res.items || []); setTotal(res.total || 0); setTotalQty(res.total_quantity || 0); setTotalValue(res.total_value || 0);
    } catch {}
    setLoading(false);
    loadingRef.current = false;
  }, [page, search, filterCategory, filterLocation, sortField, sortOrder]);

  useEffect(() => { loadItems(); }, [loadItems, realm]);

  const load = loadItems; // alias for edit/delete callbacks

  // Debounced search → reset to page 1 + update URL (skip initial mount)
  const initialSearchRef = useRef(search);
  useEffect(() => {
    if (search === initialSearchRef.current) return;
    const t = setTimeout(() => {
      const path = search ? `/items?q=${encodeURIComponent(search)}` : "/items";
      router.replace(path);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Load properties when category changes in modal
  const selectedCategoryId = editItem?.category_id;
  useEffect(() => {
    if (!selectedCategoryId) {
      setCatProperties([]);
      return;
    }
    api.getProperties(selectedCategoryId).then((props) => {
      setCatProperties(props.sort((a, b) => a.position - b.position));
    }).catch(() => setCatProperties([]));
  }, [selectedCategoryId]);

  const openEdit = (item: Item) => {
    setEditItem({ ...item });
    setPropValues(item.properties || {});
    setPendingImage(null);
    // Show existing image if any
    const existingImg = item.attachments?.find((a) => a.gallery && /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(a.filename));
    setImagePreview(existingImg ? `${serverURL}/uploads/${existingImg.file_path}` : null);
    setIsNew(false);
  };

  const openNew = () => {
    setEditItem({ name: "", quantity: 1 });
    setPropValues({});
    setPendingImage(null);
    setImagePreview(null);
    setIsNew(true);
  };

  const save = async () => {
    if (!editItem?.name) return;
    try {
      // Strip _pendingFile from property values before sending to API
      const cleanProps: Record<string, unknown> = {};
      const pendingFiles: { propId: string; file: File }[] = [];
      for (const [k, v] of Object.entries(propValues)) {
        if (v && typeof v === "object" && "_pendingFile" in (v as Record<string, unknown>)) {
          const obj = v as Record<string, unknown>;
          pendingFiles.push({ propId: k, file: obj._pendingFile as File });
          // Don't send _pendingFile to API — will be uploaded separately
        } else {
          cleanProps[k] = v;
        }
      }

      const data = { ...editItem, properties: Object.keys(cleanProps).length > 0 ? cleanProps : undefined };
      let itemId: number;
      if (isNew) {
        const created = await api.createItem(data);
        itemId = created.id;
      } else {
        itemId = editItem.id!;
        await api.updateItem(itemId, data);
      }

      // Upload pending main image
      if (pendingImage) {
        await api.uploadAttachment(itemId, pendingImage);
      }

      // Upload pending property files
      for (const { propId, file } of pendingFiles) {
        await api.uploadPropertyFile(itemId, Number(propId), file);
      }

      setEditItem(null);
      setPendingImage(null);
      setImagePreview(null);
      load();
    } catch {}
  };

  const deleteFlow = useDeleteFlow({
    realm,
    onDeleted: useCallback((entityId: number) => {
      setItems((prev) => prev.filter((i) => i.id !== entityId));
      setTotal((prev) => prev - 1);
    }, []),
  });

  const remove = (id: number) => {
    const item = items.find((i) => i.id === id);
    deleteFlow.requestDelete(id, item?.name || "", "item");
  };
  const pendingDelete = deleteFlow.pending?.id ?? null;

  const catName = (id?: number) => categories.find((c) => c.id === id)?.name || "—";
  const catColor = (id?: number) => categories.find((c) => c.id === id)?.color;
  const locName = (id?: number) => locations.find((l) => l.id === id)?.name || "—";
  const locColor = (id?: number) => locations.find((l) => l.id === id)?.color;

  // Properties marked as show_in_list
  const listProps = allProperties.filter((p) => p.show_in_list);
  const getListPropValues = (item: Item) => {
    if (!item.properties) return [];
    return listProps
      .filter((p) => p.category_id === item.category_id && item.properties?.[String(p.id)] != null)
      .map((p) => ({ name: p.name, unit: p.unit, value: item.properties![String(p.id)], type: p.property_type }));
  };
  const formatPropShort = (val: unknown, type: string): string => {
    if (val == null) return "";
    if (typeof val === "boolean") return val ? (locale === "en" ? "Yes" : "Ja") : (locale === "en" ? "No" : "Nein");
    if (type === "rating") return "★".repeat(Number(val));
    if (type === "condition") {
      const labels: Record<string, string> = locale === "en"
        ? { new: "New", like_new: "Like new", very_good: "Very good", good: "Good", acceptable: "Acceptable", poor: "Poor", defective: "Defective" }
        : { new: "Neu", like_new: "Wie neu", very_good: "Sehr gut", good: "Gut", acceptable: "Akzeptabel", poor: "Schlecht", defective: "Defekt" };
      return labels[String(val)] || String(val);
    }
    if (type === "priority") {
      const labels: Record<string, string> = locale === "en"
        ? { low: "Low", medium: "Medium", high: "High", critical: "Critical" }
        : { low: "Niedrig", medium: "Mittel", high: "Hoch", critical: "Kritisch" };
      return labels[String(val)] || String(val);
    }
    if (type === "weight" && typeof val === "object") {
      const w = val as Record<string, unknown>;
      return `${w.value} ${w.unit || "g"}`;
    }
    if (Array.isArray(val)) return val.join(", ");
    if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      if (obj.length != null) return [obj.length, obj.width, obj.height].filter((v) => v != null).join("×");
      return "";
    }
    return String(val);
  };

  const renderRequestBadge = (itemId: number) => {
    const requests = pendingRequestsByItem[itemId];
    if (!requests?.length) return null;
    const names = requests.map((request) => request.user_name || `User #${request.user_id}`);
    const label = requests.length === 1 ? names[0] : `${names[0]} +${requests.length - 1}`;
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shrink-0 font-medium">
        Anfrage: {label}
      </span>
    );
  };

  const renderQuantityBadge = (item: Item) => {
    if (item.minimum_quantity != null && item.minimum_quantity > 0) {
      const ratio = item.quantity / item.minimum_quantity;
      const tone =
        ratio < 0.25
          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
          : ratio < 1
            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
            : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400";

      return (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-medium ${tone}`}>
          {item.quantity}/{item.minimum_quantity}
        </span>
      );
    }

    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
        {item.quantity}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <h1 className="text-2xl font-bold flex-1">{t("items.title")}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 sm:flex-initial">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search")}
              className="w-full sm:w-64 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${
                filterCategory || filterLocation || sortField !== "updated"
                  ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                  : "border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {(filterCategory || filterLocation || sortField !== "updated")
                ? <FunnelSolid className="h-4 w-4" />
                : <FunnelIcon className="h-4 w-4" />}
              Filter
            </button>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl z-50 p-4 space-y-3">
                  {/* Sort */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("items.sortBy")}</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([
                        { field: "name", label: t("items.sortName"), defaultOrd: "asc" },
                        { field: "price", label: t("items.sortPrice"), defaultOrd: "desc" },
                        { field: "quantity", label: t("items.sortQuantity"), defaultOrd: "desc" },
                        { field: "created", label: t("items.sortNewest"), defaultOrd: "desc" },
                      ] as const).map(({ field, label, defaultOrd }) => {
                        const active = sortField === field;
                        return (
                          <button
                            key={field}
                            onClick={() => setSort(field, active && sortOrder === defaultOrd ? (defaultOrd === "desc" ? "asc" : "desc") : defaultOrd)}
                            className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition ${
                              active ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-medium" : "bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                            }`}
                          >
                            {label}
                            {active && (sortOrder === "asc" ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <hr className="border-gray-100 dark:border-gray-800" />

                  {/* Filter */}
                  <FilterPicker
                    label={t("items.category")}
                    value={filterCategory}
                    onChange={(v) => { setFilter(v, filterLocation); setFilterOpen(false); }}
                    items={categories.map((c) => ({ id: c.id, name: c.name }))}
                  />
                  <FilterPicker
                    label={t("items.location")}
                    value={filterLocation}
                    onChange={(v) => { setFilter(filterCategory, v); setFilterOpen(false); }}
                    items={(() => {
                      const flat: { id: number; name: string; depth: number }[] = [];
                      const roots = locations.filter((l) => !l.parent_id).sort((a, b) => a.position - b.position);
                      const walk = (locs: typeof locations, depth: number) => {
                        for (const l of locs) {
                          flat.push({ id: l.id, name: l.name, depth });
                          walk(locations.filter((c) => c.parent_id === l.id).sort((a, b) => a.position - b.position), depth + 1);
                        }
                      };
                      walk(roots, 0);
                      return flat;
                    })()}
                  />
                  {(filterCategory || filterLocation || sortField !== "updated") && (
                    <button
                      onClick={() => { setSort("updated", "desc"); setFilter(undefined, undefined); setFilterOpen(false); }}
                      className="w-full text-xs text-gray-500 hover:text-blue-500 transition"
                    >
                      {t("items.resetFilters")}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-700">
            <button onClick={() => setView("grid")} className={`p-2 ${view === "grid" ? "bg-gray-100 dark:bg-gray-800" : ""}`}>
              <Squares2X2Icon className="h-4 w-4" />
            </button>
            <button onClick={() => setView("table")} className={`p-2 ${view === "table" ? "bg-gray-100 dark:bg-gray-800" : ""}`}>
              <TableCellsIcon className="h-4 w-4" />
            </button>
          </div>
          {can("items.write") && (
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 transition"
            >
              <PlusIcon className="h-4 w-4" /> {t("common.new")}
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Pills + Stats */}
      {(filterCategory || filterLocation || search) && !loading && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {filterCategory && (
              <button
                onClick={() => setFilter(undefined, filterLocation)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
              >
                {t("items.category")}: {catName(filterCategory)}
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            )}
            {filterLocation && (
              <button
                onClick={() => setFilter(filterCategory, undefined)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
              >
                {t("items.location")}: {locName(filterLocation)}
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span><strong className="text-gray-700 dark:text-gray-300">{total}</strong> {total === 1 ? "Item" : "Items"}</span>
            {totalQty !== total && (
              <span>×<strong className="text-gray-700 dark:text-gray-300">{totalQty}</strong> {t("items.quantity")}</span>
            )}
            {totalValue > 0 && (
              <span><strong className="text-gray-700 dark:text-gray-300">{totalValue.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</strong> {t("items.totalValue")}</span>
            )}
            {filterLocation && (() => {
              const loc = locations.find((l) => l.id === filterLocation);
              return loc?.capacity ? (
                <span><strong className="text-gray-700 dark:text-gray-300">{totalQty}/{loc.capacity}</strong> Kapazität</span>
              ) : null;
            })()}
          </div>
        </div>
      )}

      {/* Grid View */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="group rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden hover:shadow-md transition cursor-pointer"
              onClick={() => router.push(`/items/${item.id}`)}
            >
              {/* Thumbnail */}
              {(() => {
                const img = item.attachments?.find((a) => a.gallery && a.file_path && /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(a.filename));
                return img ? (
                  <div className="aspect-video bg-gray-100 dark:bg-gray-800">
                    <img src={`${serverURL}/uploads/${img.file_path}`} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : null;
              })()}
              <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h3 className="font-medium text-sm truncate">{item.name}</h3>
                  {renderRequestBadge(item.id)}
                  {item.checked_out_to && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 shrink-0">⇄</span>}
                </div>
                <div className="ml-2 shrink-0">
                  {renderQuantityBadge(item)}
                </div>
              </div>
              {item.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>}
              {/* show_in_list properties */}
              {(() => {
                const pv = getListPropValues(item);
                return pv.length > 0 ? (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
                    {pv.map((p) => (
                      <span key={p.name} className="text-xs text-gray-500">
                        <span className="text-gray-400">{p.name}:</span> {formatPropShort(p.value, p.type)}{p.unit ? ` ${p.unit}` : ""}
                      </span>
                    ))}
                  </div>
                ) : null;
              })()}
              <div className="mt-3 space-y-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
                {item.category_id && (() => {
                  const cc = catColor(item.category_id);
                  return (
                    <div className="flex items-start gap-2 text-gray-400">
                      <span className="w-12 shrink-0">{t("items.category")}</span>
                      <button
                        onClick={() => setFilter(item.category_id, filterLocation)}
                        className="min-w-0 hover:text-blue-500 transition rounded px-1.5 py-0.5 flex items-center gap-1 text-left"
                        style={cc ? { backgroundColor: `${cc}15`, color: cc } : undefined}
                      >
                        {cc && <span className="mt-[3px] inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cc }} />}
                        <span className="truncate">{catName(item.category_id)}</span>
                      </button>
                    </div>
                  );
                })()}
                {item.location_id && (() => {
                  const lc = locColor(item.location_id);
                  return (
                    <div className="flex items-start gap-2 text-gray-400">
                      <span className="w-12 shrink-0">{t("items.location")}</span>
                      <button
                        onClick={() => setFilter(filterCategory, item.location_id)}
                        className="min-w-0 hover:text-blue-500 transition rounded px-1.5 py-0.5 flex items-center gap-1 text-left"
                        style={lc ? { backgroundColor: `${lc}15`, color: lc } : undefined}
                      >
                        {lc && <span className="mt-[3px] inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: lc }} />}
                        <span className="truncate">{locName(item.location_id)}</span>
                      </button>
                    </div>
                  );
                })()}
                {item.purchase_price != null && (
                  <div className="flex items-start gap-2 text-gray-400">
                    <span className="w-12 shrink-0">{t("items.purchasePrice")}</span>
                    <span className="text-gray-500">
                      {item.purchase_price.toLocaleString("de-DE", { style: "currency", currency: item.purchase_currency || "EUR" })}
                    </span>
                  </div>
                )}
              </div>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="col-span-full text-center text-gray-500 py-10">{t("items.notFound")}</p>}
        </div>
      ) : (
        /* Row View — multi-line cards */
        <div className="space-y-2">
          {items.map((item) => {
            const pv = getListPropValues(item);
            const img = item.attachments?.find((a) => a.gallery && a.file_path && /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(a.filename));
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition"
                onClick={() => router.push(`/items/${item.id}`)}
              >
                {/* Thumbnail */}
                <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                  {img ? (
                    <img src={`${serverURL}/uploads/${img.file_path}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <PhotoIcon className="h-5 w-5 text-gray-300 dark:text-gray-600" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Row 1: Name, Badges, Price, Actions */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <span className="text-sm font-medium">{item.name}</span>
                      {renderRequestBadge(item.id)}
                      {item.checked_out_to && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 shrink-0">⇄ {item.checked_out_to.user_name}</span>}
                    </div>
                    {item.category_id && (() => {
                      const cc = catColor(item.category_id);
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); setFilter(item.category_id, filterLocation); }}
                          className={`text-xs px-2 py-0.5 rounded shrink-0 hover:opacity-80 transition flex items-center gap-1 ${!cc ? "text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800" : ""}`}
                          style={cc
                            ? { backgroundColor: `${cc}15`, color: cc }
                            : undefined}
                        >
                          {cc && <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cc }} />}
                          {catName(item.category_id)}
                        </button>
                      );
                    })()}
                    {item.location_id && (() => {
                      const lc = locColor(item.location_id);
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); setFilter(filterCategory, item.location_id); }}
                          className={`text-xs px-2 py-0.5 rounded shrink-0 hidden sm:inline-flex items-center gap-1 hover:opacity-80 transition ${!lc ? "text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800" : ""}`}
                          style={lc
                            ? { backgroundColor: `${lc}15`, color: lc }
                            : undefined}
                        >
                          {lc && <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: lc }} />}
                          {locName(item.location_id)}
                        </button>
                      );
                    })()}
                    {renderQuantityBadge(item)}
                    <span className="text-xs font-medium text-gray-500 w-20 text-right shrink-0">{item.purchase_price != null ? item.purchase_price.toLocaleString("de-DE", { style: "currency", currency: item.purchase_currency || "EUR" }) : ""}</span>
                    {(can("items.write") || can("items.delete") || can("print")) && (
                      <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {can("print") && (
                          <button onClick={async () => { try { await printItemQR(item.id); } catch {} }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                            <PrinterIcon className="h-4 w-4 text-gray-400" />
                          </button>
                        )}
                        {can("items.write") && (
                          <button onClick={() => openEdit(item)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                            <PencilIcon className="h-4 w-4 text-gray-400" />
                          </button>
                        )}
                        {can("items.delete") && (
                          <button onClick={() => remove(item.id)} disabled={pendingDelete === item.id} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50">
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

                  {/* Row 2: Description (if exists) */}
                  {item.description && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">{item.description}</p>
                  )}

                  {/* Row 3: Properties (show_in_list) */}
                  {pv.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                      {pv.map((p) => (
                        <span key={p.name} className="text-xs">
                          <span className="text-gray-400">{p.name}:</span>{" "}
                          <span className="text-gray-600 dark:text-gray-300">{formatPropShort(p.value, p.type)}{p.unit ? ` ${p.unit}` : ""}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {items.length === 0 && <p className="text-center text-gray-500 py-10">{t("items.notFound")}</p>}
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (() => {
        const totalPages = Math.ceil(total / 50);
        return (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">
              {t("common.previous")}
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-500">
              {t("items.page")} {page} / {totalPages} <span className="text-gray-400">({total} {t("items.perPage")})</span>
            </span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">
              {t("common.next")}
            </button>
          </div>
        );
      })()}

      {/* Edit/Create Modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{isNew ? t("items.new") : t("items.edit")}</h2>
              <button onClick={() => setEditItem(null)}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
            </div>

            <Field label={t("items.name")} value={editItem.name || ""} onChange={(v) => setEditItem({ ...editItem, name: v })} />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("items.description")}</label>
              <MarkdownEditor value={editItem.description || ""} onChange={(v) => setEditItem({ ...editItem, description: v })} rows={3} />
            </div>

            {/* Image */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("items.image")}</label>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="" className="h-32 rounded-lg border border-gray-200 dark:border-gray-700 object-cover" />
                  <button
                    type="button"
                    onClick={() => { setPendingImage(null); setImagePreview(null); }}
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center hover:bg-blue-600"
                  >×</button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 cursor-pointer hover:border-blue-400 transition text-sm text-gray-400">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPendingImage(file);
                        setImagePreview(URL.createObjectURL(file));
                      }
                      e.target.value = "";
                    }}
                  />
                  {t("items.selectImage")}
                </label>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <SelectPicker label={t("items.category")} value={editItem.category_id} onChange={(v) => { setEditItem({ ...editItem, category_id: v as number | undefined }); if (!v) setPropValues({}); }} options={categories.map((c) => ({ id: c.id, name: c.name }))} />
              <SelectPicker label={t("items.location")} value={editItem.location_id} onChange={(v) => setEditItem({ ...editItem, location_id: v as number | undefined })} options={locations.map((l) => ({ id: l.id, name: l.name }))} />
            </div>

            {/* Manufacturer / Supplier / Vendor */}
            <div className="grid grid-cols-3 gap-4">
              <SelectPicker label={t("items.manufacturer")} value={editItem.manufacturer_id} onChange={(v) => setEditItem({ ...editItem, manufacturer_id: v as number | undefined })} options={manufacturers.map((m) => ({ id: m.id, name: m.name }))} />
              <SelectPicker label={t("items.supplier")} value={editItem.supplier_id} onChange={(v) => setEditItem({ ...editItem, supplier_id: v as number | undefined })} options={suppliers.map((s) => ({ id: s.id, name: s.name }))} />
              <SelectPicker label={t("items.vendor")} value={editItem.vendor_id} onChange={(v) => setEditItem({ ...editItem, vendor_id: v as number | undefined })} options={vendors.map((v) => ({ id: v.id, name: v.name }))} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field label={t("items.purchasePrice")} type="number" value={String(editItem.purchase_price ?? "")} onChange={(v) => setEditItem({ ...editItem, purchase_price: v ? Number(v) : undefined })} />
              <Field label={t("items.currency")} value={editItem.purchase_currency || "EUR"} onChange={(v) => setEditItem({ ...editItem, purchase_currency: v })} />
              <Field label={t("items.purchaseDate")} type="date" value={editItem.purchase_date || ""} onChange={(v) => setEditItem({ ...editItem, purchase_date: v || undefined })} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field label={t("items.quantity")} type="number" value={String(editItem.quantity ?? 1)} onChange={(v) => setEditItem({ ...editItem, quantity: Number(v) })} />
              <Field label={t("items.minQuantity")} type="number" value={String(editItem.minimum_quantity ?? "")} onChange={(v) => setEditItem({ ...editItem, minimum_quantity: v ? Number(v) : undefined })} />
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer text-sm text-gray-700 dark:text-gray-400">
                  <span>{t("items.consumable")}</span>
                  <button type="button" onClick={() => setEditItem({ ...editItem, is_consumable: !editItem.is_consumable })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${editItem.is_consumable ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${editItem.is_consumable ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </label>
              </div>
            </div>

            {/* Dynamic Properties */}
            {catProperties.length > 0 && (
              <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase">{t("items.properties")}</h3>
                {catProperties.map((prop) => (
                  <PropertyField
                    key={prop.id}
                    property={prop}
                    value={propValues[String(prop.id)]}
                    onChange={(val) => setPropValues((prev) => ({ ...prev, [String(prop.id)]: val }))}
                  />
                ))}
              </div>
            )}

            <div className="flex justify-between pt-2">
              {!isNew && (
                <button onClick={() => { remove(editItem.id!); setEditItem(null); }} className="text-sm text-red-500 hover:text-red-600">
                  {t("common.delete")}
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setEditItem(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                  {t("common.cancel")}
                </button>
                <button onClick={save} className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600">
                  {t("common.save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {deleteFlow.confirm && (
        <ConfirmDelete
          name={deleteFlow.confirm.name}
          t={t}
          onConfirm={async () => {
            try { await api.deleteItem(deleteFlow.confirm!.id); } catch {}
            deleteFlow.cancelConfirm();
            loadItems();
          }}
          onCancel={() => deleteFlow.cancelConfirm()}
        />
      )}
    </div>
  );
}

function Field({ label, value, onChange, multiline, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; type?: string;
}) {
  const cls = "w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={cls} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}

function FilterPicker({ label, value, onChange, items }: {
  label: string;
  value?: number;
  onChange: (v: number | undefined) => void;
  items: { id: number; name: string; depth?: number }[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = search
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  const selectedName = items.find((i) => i.id === value)?.name;

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <button
        onClick={() => { setOpen(!open); setSearch(""); setTimeout(() => inputRef.current?.focus(), 50); }}
        className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm text-left transition ${
          value
            ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400"
            : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400"
        }`}
      >
        <span className="truncate">{selectedName || "Alle"}</span>
        <svg className={`h-4 w-4 shrink-0 text-gray-400 transition ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-800">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen..."
              className="w-full rounded-lg bg-gray-50 dark:bg-gray-900 border-none px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Options */}
          <div className="max-h-64 overflow-y-auto py-1">
            {/* Clear option */}
            <button
              onClick={() => { onChange(undefined); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition ${
                !value ? "bg-blue-50 dark:bg-blue-900/10 text-blue-600 font-medium" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              Alle
            </button>

            {filtered.length === 0 && (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">Keine Ergebnisse</p>
            )}

            {filtered.map((item) => {
              const active = value === item.id;
              const depth = item.depth || 0;
              return (
                <button
                  key={item.id}
                  onClick={() => { onChange(item.id); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm transition flex items-center gap-1.5 ${
                    active
                      ? "bg-blue-50 dark:bg-blue-900/10 text-blue-600 font-medium"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                  style={{ paddingLeft: `${12 + depth * 16}px` }}
                >
                  {depth > 0 && <span className="text-gray-300 dark:text-gray-600 text-xs">└</span>}
                  {item.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Click-outside close */}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  );
}
