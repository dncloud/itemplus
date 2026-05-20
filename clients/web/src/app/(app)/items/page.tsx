"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, type Category, type CheckoutRequest, type Item, type Location, type Property } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { wsClient } from "@/lib/ws";
import { ConfirmDelete, useDeleteFlow } from "@/components/confirm-delete";
import { fetchItemsReferenceData, fetchPendingRequestsByItem } from "@/app/(app)/items/items-page-data";
import { buildItemsPageUrl } from "@/app/(app)/items/items-page-navigation";
import { ItemsPageHeader, ItemsPageToolbar } from "@/app/(app)/items/items-page-sections";
import { ItemsGrid, ItemsNotification, ItemsPagination } from "@/app/(app)/items/items-page-view";

export default function ItemsPage({ pageOverride }: { pageOverride?: number } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    realm,
    serverURL,
    can,
    locale,
    isDark,
    printItemQR,
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
    itemsPerPage,
    t,
  } = useApp();

  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [totalQty, setTotalQty] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [barcodeCapturePending, setBarcodeCapturePending] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message?: string; tone: "success" | "error" } | null>(null);
  const [pendingRequestsByItem, setPendingRequestsByItem] = useState<Record<number, CheckoutRequest[]>>({});

  const page = pageOverride ?? (Number(searchParams.get("page")) || 1);
  const filterCategory = searchParams.get("category") ? Number(searchParams.get("category")) : undefined;
  const filterLocation = searchParams.get("location") ? Number(searchParams.get("location")) : undefined;
  const filterStatus = searchParams.get("status") || undefined;
  const sortField = searchParams.get("sort") || "id";
  const sortOrder = searchParams.get("order") || "desc";
  const activeSearchQuery = searchParams.get("q") || "";

  const setPage = (nextPage: number) => {
    router.push(buildItemsPageUrl({
      page: nextPage,
      q: activeSearchQuery || undefined,
      category: filterCategory,
      location: filterLocation,
      status: filterStatus,
      sort: sortField,
      order: sortOrder,
    }));
  };

  const setFilter = (category?: number, location?: number, status?: string) => {
    router.push(buildItemsPageUrl({
      page: 1,
      q: activeSearchQuery || undefined,
      category,
      location,
      status,
      sort: sortField,
      order: sortOrder,
    }));
  };

  const setSort = (field: string, order: string) => {
    router.push(buildItemsPageUrl({
      page: 1,
      q: activeSearchQuery || undefined,
      category: filterCategory,
      location: filterLocation,
      status: filterStatus,
      sort: field,
      order,
    }));
  };

  const submitSearch = useCallback(() => {
    router.push(buildItemsPageUrl({
      page: 1,
      q: search.trim() || undefined,
      category: filterCategory,
      location: filterLocation,
      status: filterStatus,
      sort: sortField,
      order: sortOrder,
    }));
  }, [router, search, filterCategory, filterLocation, filterStatus, sortField, sortOrder]);

  const clearSearch = useCallback(() => {
    setSearch("");
    router.push(buildItemsPageUrl({
      page: 1,
      category: filterCategory,
      location: filterLocation,
      status: filterStatus,
      sort: sortField,
      order: sortOrder,
    }));
  }, [router, filterCategory, filterLocation, filterStatus, sortField, sortOrder]);

  const resetAllFilters = useCallback(() => {
    setSearch("");
    router.push("/items");
  }, [router]);

  useEffect(() => {
    void fetchItemsReferenceData().then(({ categories, locations, properties }) => {
      setCategories(categories);
      setLocations(locations);
      setAllProperties(properties);
    });
  }, [realm]);

  useEffect(() => {
    if (!can("checkout.manage")) {
      void Promise.resolve().then(() => setPendingRequestsByItem({}));
      return;
    }
    void fetchPendingRequestsByItem(realm)
      .then((grouped) => setPendingRequestsByItem(grouped))
      .catch(() => setPendingRequestsByItem({}));
  }, [realm, can]);

  const loadingRef = useRef(false);
  const loadItems = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await api.getItems(page, activeSearchQuery || undefined, filterCategory, filterLocation, filterStatus, sortField, sortOrder, itemsPerPage);
      setItems(res.items || []);
      setTotal(res.total || 0);
      setTotalQty(res.total_quantity || 0);
      setTotalValue(res.total_value || 0);
    } catch {
      // keep current state
    }
    setLoading(false);
    loadingRef.current = false;
  }, [page, activeSearchQuery, filterCategory, filterLocation, filterStatus, sortField, sortOrder, itemsPerPage]);

  useEffect(() => {
    void Promise.resolve().then(loadItems);
  }, [loadItems, realm]);

  useEffect(() => {
    setSearch(activeSearchQuery);
  }, [activeSearchQuery]);

  const showNotification = useCallback((title: string, message?: string, tone: "success" | "error" = "success") => {
    setNotification({ title, message, tone });
  }, []);

  useEffect(() => {
    if (!notification) return;
    const timeout = window.setTimeout(() => setNotification(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  const deleteFlow = useDeleteFlow({
    realm,
    onDeleted: useCallback((entityId: number) => {
      setItems((prev) => prev.filter((item) => item.id !== entityId));
      setTotal((prev) => prev - 1);
    }, []),
  });

  const pendingDelete = deleteFlow.pending?.id ?? null;

  useEffect(() => {
    const unsubScanned = wsClient.on("barcode.scanned", (data) => {
      const code = typeof data.code === "string" ? data.code : "";
      const symbology = typeof data.symbology === "string" ? data.symbology : null;
      if (!code) return;
      setBarcodeCapturePending(false);
      const params = new URLSearchParams({ barcode: code });
      if (symbology) params.set("symbology", symbology);
      router.push(`/items/new?${params.toString()}`);
    });

    const unsubUnavailable = wsClient.on("barcode.capture_unavailable", () => {
      setBarcodeCapturePending(false);
      showNotification(t("items.barcodeUnavailable"), undefined, "error");
    });

    return () => {
      unsubScanned();
      unsubUnavailable();
    };
  }, [router, showNotification, t]);

  const catName = (id?: number) => categories.find((category) => category.id === id)?.name || "—";
  const catColor = (id?: number) => categories.find((category) => category.id === id)?.color;
  const locName = (id?: number) => locations.find((location) => location.id === id)?.name || "—";
  const locColor = (id?: number) => locations.find((location) => location.id === id)?.color;
  const listProps = allProperties.filter((property) => property.show_in_list);

  return (
    <div className="space-y-6">
      <ItemsPageHeader
        realm={realm}
        t={t}
        canWrite={can("items.write")}
        barcodeCapturePending={barcodeCapturePending}
        onRequestBarcodeCapture={() => {
          setBarcodeCapturePending(true);
          wsClient.send("barcode.capture_request", {
            realm,
            from_session: wsClient.sessionId ?? undefined,
          });
        }}
        onOpenNew={() => router.push("/items/new")}
      />

      <ItemsPageToolbar
        t={t}
        search={search}
        setSearch={setSearch}
        activeSearch={activeSearchQuery}
        submitSearch={submitSearch}
        clearSearch={clearSearch}
        resetAllFilters={resetAllFilters}
        filterOpen={filterOpen}
        setFilterOpen={setFilterOpen}
        filterCategory={filterCategory}
        filterLocation={filterLocation}
        filterStatus={filterStatus}
        sortField={sortField}
        sortOrder={sortOrder}
        setSort={setSort}
        setFilter={setFilter}
        categories={categories}
        locations={locations}
        total={total}
        totalQty={totalQty}
        totalValue={totalValue}
        loading={loading}
        getCategoryName={catName}
        getLocationName={locName}
        getStatusLabel={(status) => {
          switch (status) {
            case "active":
              return t("items.status.active");
            case "checked_out":
              return t("items.status.checkedOut");
            case "reserved":
              return t("items.status.reserved");
            case "for_sale":
              return t("items.status.forSale");
            case "sold":
              return t("items.status.sold");
            default:
              return status;
          }
        }}
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : (
        <>
          <ItemsGrid
            items={items}
            pendingRequestsByItem={pendingRequestsByItem}
            serverURL={serverURL}
            isDark={isDark}
            locale={locale}
            t={t}
            showItemImages={showItemImages}
            showItemPlaceholders={showItemPlaceholders}
            showItemCategory={showItemCategory}
            showItemLocation={showItemLocation}
            showItemDescription={showItemDescription}
            showItemStock={showItemStock}
            showItemConsumable={showItemConsumable}
            showItemPrice={showItemPrice}
            showItemTotal={showItemTotal}
            showItemProperties={showItemProperties}
            showItemActivity={showItemActivity}
            itemStockWarningPercent={itemStockWarningPercent}
            itemStockCriticalPercent={itemStockCriticalPercent}
            listProps={listProps}
            filterCategory={filterCategory}
            filterLocation={filterLocation}
            catName={catName}
            catColor={catColor}
            locName={locName}
            locColor={locColor}
            canWrite={can("items.write")}
            canDelete={can("items.delete")}
            canPrint={can("print")}
            pendingDelete={pendingDelete}
            onOpenItem={(itemId) => router.push(`/items/${itemId}`)}
            onOpenEdit={(item) => router.push(`/items/${item.id}?edit=1`)}
            onFilter={setFilter}
            onPrint={async (item) => { try { await printItemQR(item.id); } catch {} }}
            onRemove={(itemId) => {
              const item = items.find((entry) => entry.id === itemId);
              deleteFlow.requestDelete(itemId, item?.name || "", "item");
            }}
          />
          {items.length === 0 ? <p className="py-10 text-center text-gray-500">{t("items.notFound")}</p> : null}
        </>
      )}

      <ItemsPagination page={page} total={total} itemsPerPage={itemsPerPage} t={t} onPage={setPage} />

      {deleteFlow.confirm ? (
        <ConfirmDelete
          name={deleteFlow.confirm.name}
          t={t}
          onConfirm={async () => {
            try {
              await api.deleteItem(deleteFlow.confirm!.id);
            } catch {
              // keep dialog flow stable even if the request fails
            }
            deleteFlow.cancelConfirm();
            loadItems();
          }}
          onCancel={() => deleteFlow.cancelConfirm()}
        />
      ) : null}

      <ItemsNotification notification={notification} t={t} onClose={() => setNotification(null)} />
    </div>
  );
}
