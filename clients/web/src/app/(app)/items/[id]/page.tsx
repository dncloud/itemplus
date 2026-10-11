"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, type CheckoutRequest, type Item, type Category, type Location, type Property } from "@/lib/api";
import AttachmentManager from "@/components/attachments/attachment-manager";
import { useDeleteFlow, ConfirmDelete, inUseMessage, readInUseInfo, type InUseInfo } from "@/components/ui/confirm-delete";
import { useApp } from "@/lib/app-context";
import { wsClient } from "@/lib/ws";
import clsx from "clsx";
import { ItemDescription, ItemDetailSections, ItemSummaryFacts } from "@/app/(app)/items/[id]/item-detail-sections";
import {
  ItemCheckoutActiveBanner,
  ItemCheckoutPendingBanner,
  ItemCheckoutRequestPanel,
  ItemDetailHeader,
  ItemDetailLoadingView,
  ItemDetailNotification,
} from "@/app/(app)/items/[id]/item-detail-chrome";
import {
  fetchItemDetailData,
  fetchItemDisplayMeta,
  requestConnectedDevices,
} from "@/app/(app)/items/[id]/item-detail-utils";
import { ColorChip } from "@/components/ui/color-chip";

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    realm,
    serverURL,
    can,
    currentUserId,
    fmtDate,
    fmtDateTime,
    iosBridgeStatus,
    printerBridgeStatus,
    printItemQR,
    showAttachmentUploadOnItemDetail,
    showPrintFeatures,
    t,
  } = useApp();
  const [item, setItem] = useState<Item | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [photoRequested, setPhotoRequested] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printDone, setPrintDone] = useState(false);
  const [checkoutDays, setCheckoutDays] = useState(7);
  const [checkoutNote, setCheckoutNote] = useState("");
  const [selectedCheckoutComponentIDs, setSelectedCheckoutComponentIDs] = useState<number[]>([]);
  const [checkoutUsers, setCheckoutUsers] = useState<{ id: number; name: string }[]>([]);
  const [selectedCheckoutUserID, setSelectedCheckoutUserID] = useState<number | "">("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<CheckoutRequest[]>([]);
  const [justRequested, setJustRequested] = useState(false);
  const [checkoutBlocked, setCheckoutBlocked] = useState(false);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [returningCheckoutID, setReturningCheckoutID] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ title: string; message?: string; tone: "success" | "error" } | null>(null);
  const itemStatusLabelMap: Record<string, string> = {
    active: t("items.status.active"),
    reserved: t("items.status.reserved"),
    for_sale: t("items.status.forSale"),
    sold: t("items.status.sold"),
  };
  const itemStatusStyleMap: Record<string, string> = {
    reserved: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
    for_sale: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
    sold: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  };

  const load = useCallback(async () => {
    try {
      const data = await fetchItemDetailData(Number(id));
      setItem(data.item);
      setSelectedCheckoutComponentIDs(data.item.componentItemIds || []);
      setProperties(data.properties);
      setCheckoutBlocked(data.checkoutState.blocked);
      setPendingRequests(data.pendingRequests);
    } catch {
      router.push("/items");
    }
  }, [id, router]);

  useEffect(() => {
    let cancelled = false;

    const loadCurrentItem = async () => {
      try {
        const data = await fetchItemDetailData(Number(id));
        if (cancelled) return;
        setItem(data.item);
        setSelectedCheckoutComponentIDs(data.item.componentItemIds || []);
        setProperties(data.properties);
        setCheckoutBlocked(data.checkoutState.blocked);
        setPendingRequests(data.pendingRequests);
      } catch {
        if (!cancelled) router.push("/items");
      }
    };

    void loadCurrentItem();
    return () => {
      cancelled = true;
    };
  }, [id, realm, router]);

  // Load categories + locations for color display
  useEffect(() => {
    void fetchItemDisplayMeta().then(({ categories, locations }) => {
      setCategories(categories);
      setLocations(locations);
    });
  }, [realm]);

  const showNotification = useCallback((title: string, message?: string, tone: "success" | "error" = "success") => {
    setNotification({ title, message, tone });
  }, []);

  useEffect(() => {
    if (!notification) return;
    const timeout = window.setTimeout(() => setNotification(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  useEffect(() => {
    if (!showCheckout || !can("checkout.manage")) return;
    let cancelled = false;
    void api.getUsersLookup().then((users) => {
      if (!cancelled) setCheckoutUsers(users);
    }).catch(() => {
      if (!cancelled) setCheckoutUsers([]);
    });
    return () => {
      cancelled = true;
    };
  }, [showCheckout, can]);

  // An item that is lent out stays until it has been returned.
  const reportInUse = useCallback((info: InUseInfo) => {
    setNotification({ title: t("items.deleteRefused"), message: inUseMessage(t, info), tone: "error" });
  }, [t]);

  const deleteFlow = useDeleteFlow({
    realm,
    onInUse: reportInUse,
    onDeleted: useCallback((entityId: number) => {
      if (entityId === Number(id)) router.push("/items");
    }, [id, router]),
  });
  const pendingDelete = deleteFlow.pending?.id === Number(id);

  const remove = () => {
    deleteFlow.requestDelete(Number(id), item?.name || "", "item");
  };

  const submitCheckoutRequest = async () => {
    if (checkoutSubmitting) return;
    setCheckoutSubmitting(true);
    try {
      await api.createCheckoutRequest({
        realm,
        item_id: Number(id),
        requested_duration_days: checkoutDays,
        component_item_ids: selectedCheckoutComponentIDs,
        notes: checkoutNote || undefined,
      });
      setJustRequested(true);
      setShowCheckout(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      showNotification(t("itemDetail.requestCheckout"), message, "error");
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const checkoutNow = async () => {
    if (checkoutSubmitting) return;
    setCheckoutSubmitting(true);
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + checkoutDays);
      await api.checkoutItem(Number(id), {
        user_id: selectedCheckoutUserID === "" ? undefined : selectedCheckoutUserID,
        due_date: dueDate.toISOString(),
        notes: checkoutNote || undefined,
        component_item_ids: selectedCheckoutComponentIDs,
      });
      await load();
      setShowCheckout(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      showNotification(t("itemDetail.checkoutNow"), message, "error");
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  // Listen for photo uploads from iPhone
  useEffect(() => {
    const unsub = wsClient.on("photo.uploaded", (data) => {
      if (data.item_id === Number(id)) {
        setPhotoRequested(false);
        load();
      }
    });
    return unsub;
  }, [id, load]);

  const printQR = async () => {
    setPrinting(true);
    try {
      await printItemQR(Number(id));
      setPrintDone(true);
      setTimeout(() => setPrintDone(false), 3000);
    } catch {}
    setPrinting(false);
  };

  const requestPhotoFromPhone = async () => {
    const devices = await requestConnectedDevices();

    const hasIOSDevice = devices.some((device) => device.device_type === "ios");
    if (!hasIOSDevice) {
      showNotification(t("items.noDeviceForPhoto"), undefined, "error");
      return;
    }

    wsClient.send("photo.request", { item_id: Number(id), item_name: item?.name, realm });
    setPhotoRequested(true);
    setTimeout(() => setPhotoRequested(false), 30000); // Reset after 30s
  };

  // A request shows up for the person who made it and for whoever manages
  // loans; the server sends nobody else's.
  const checkoutSent = justRequested || pendingRequests.some((request) => currentUserId != null && request.user_id === currentUserId);
  const othersPending = pendingRequests.filter((request) => currentUserId == null || request.user_id !== currentUserId);

  if (!item) {
    return <ItemDetailLoadingView />;
  }

  const canUploadAttachmentsOnDetail = can("attachments.write") && showAttachmentUploadOnItemDetail;
  const canPrintActions = can("print") && showPrintFeatures && printerBridgeStatus === "connected";
  const canRequestPhoto = can("attachments.write") && iosBridgeStatus === "connected";
  const canReadInventory = can("inventory.read");
  const canReadMaintenance = can("maintenance.read");
  // A game from the catalog is presented by its cover; everything else, in
  // either realm, as an ordinary item. The category decides, as in the list.
  const isGame = properties.some((property) => {
    if (property.category_id !== item.category_id) return false;
    const catalog = property.options?.game_catalog;
    return !!catalog && typeof catalog === "object" && !Array.isArray(catalog);
  });
  const hasImages = (item.attachments || []).some((attachment) => /\.(jpe?g|png|gif|webp|svg|bmp|avif)$/i.test(attachment.filename));
  const edited = item.updated_at && item.created_at && item.updated_at !== item.created_at;
  const meta = [
    item.created_at ? `${t("common.created")} ${fmtDateTime(item.created_at)}` : "",
    edited ? `${t("common.updated")} ${fmtDateTime(item.updated_at as string)}` : "",
  ].filter(Boolean).join(" · ");
  const openMaintenance = canReadMaintenance
    ? item.maintenance_reminders?.filter((reminder) => reminder.status === "open") || []
    : [];
  const dueMaintenanceCount = openMaintenance.filter((reminder) => reminder.is_due || reminder.is_overdue).length;

  return (
    <div className="w-full space-y-6">
      {notification && (
        <ItemDetailNotification notification={notification} clearNotification={() => setNotification(null)} />
      )}

      <ItemDetailHeader
        t={t}
        realm={realm}
        itemName={item.name}
        checkoutSent={checkoutSent}
        checkoutBlocked={checkoutBlocked}
        showCheckout={showCheckout}
        setShowCheckout={setShowCheckout}
        canWriteItems={can("items.write")}
        canViewInventory={canReadInventory}
        inventoryHref={`/inventory-movements?realm=${realm}&item_id=${id}`}
        canViewMaintenance={canReadMaintenance}
        maintenanceHref={`/maintenance/item/${id}`}
        maintenanceDueCount={dueMaintenanceCount}
        canPrintActions={canPrintActions}
        canRequestPhoto={canRequestPhoto}
        printing={printing}
        printDone={printDone}
        printQR={printQR}
        photoRequested={photoRequested}
        requestPhotoFromPhone={requestPhotoFromPhone}
        editHref={`/items/${id}/edit`}
        canDeleteItems={can("items.delete")}
        pendingDelete={pendingDelete}
        remove={remove}
        meta={meta}
        qrCodeURL={`${serverURL}/api/print/qr/${realm}/item/${item.id}.svg?color={color}`}
      />

      {showCheckout && (
        <ItemCheckoutRequestPanel
          t={t}
          item={item}
          canManageCheckout={can("checkout.manage")}
          checkoutDays={checkoutDays}
          setCheckoutDays={setCheckoutDays}
          checkoutNote={checkoutNote}
          setCheckoutNote={setCheckoutNote}
          selectedComponentIDs={selectedCheckoutComponentIDs}
          setSelectedComponentIDs={setSelectedCheckoutComponentIDs}
          checkoutUsers={checkoutUsers}
          selectedCheckoutUserID={selectedCheckoutUserID}
          setSelectedCheckoutUserID={setSelectedCheckoutUserID}
          checkoutSubmitting={checkoutSubmitting}
          requestCheckout={submitCheckoutRequest}
          checkoutNow={can("checkout.manage") ? checkoutNow : undefined}
          close={() => setShowCheckout(false)}
        />
      )}

      {!item.checked_out_to && (checkoutSent || othersPending.length > 0) ? (
        <ItemCheckoutPendingBanner
          t={t}
          own={checkoutSent}
          others={othersPending.map((request) => request.user_name || t("users.deletedUser"))}
          href={`/checkouts?realm=${realm}&item_id=${item.id}${can("checkout.manage") ? "&filter=pending" : ""}`}
        />
      ) : null}

      {item.checked_out_to ? (
        <ItemCheckoutActiveBanner
          item={item}
          canManageCheckout={can("checkout.manage")}
          fmtDate={fmtDate}
          t={t}
          returningCheckoutID={returningCheckoutID}
          checkinItem={async (checkoutID?: number) => {
            setReturningCheckoutID(checkoutID ?? -1);
            try {
              await api.checkinItem(item.id, checkoutID ? { checkout_id: checkoutID } : undefined);
              await load();
            } catch (error) {
              const message = error instanceof Error ? error.message : undefined;
              showNotification(t("itemDetail.returnItem"), message, "error");
            } finally {
              setReturningCheckoutID(null);
            }
          }}
        />
      ) : null}

      {(() => {
        const chips = (
          <div className="flex flex-wrap items-center justify-start gap-2 empty:hidden">
            {item.category_name && (
              <ColorChip label={item.category_name} color={categories.find((c) => c.id === item.category_id)?.color} />
            )}
            {item.location_name && (
              <ColorChip label={item.location_name} color={locations.find((l) => l.id === item.location_id)?.color} />
            )}
            {item.item_status && item.item_status !== "active" ? (
              <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${itemStatusStyleMap[item.item_status] || itemStatusStyleMap.reserved}`}>
                {itemStatusLabelMap[item.item_status] || item.item_status}
              </span>
            ) : null}
          </div>
        );
        const detailProps = {
          item,
          properties,
          category: categories.find((category) => category.id === item.category_id),
          realm,
          isGame,
          fmtDate,
          t,
        };
        // A game's cover is shown whole; an ordinary photo fills its frame.
        const presentation = isGame ? "catalog-cover" : "standard";
        const summary = (
          <section className="space-y-5 self-start rounded-xl bg-white px-6 py-5 shadow-xs outline outline-1 -outline-offset-1 outline-gray-900/5 dark:bg-gray-800/50 dark:outline-white/10">
            {chips}
            <ItemSummaryFacts {...detailProps} />
            {item.description ? <ItemDescription description={item.description} /> : null}
          </section>
        );
        return (
          <>
            {hasImages ? (
              <div className={clsx("grid grid-cols-1 gap-6", isGame ? "lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]")}>
                <AttachmentManager
                  itemId={Number(id)}
                  attachments={item.attachments || []}
                  onChange={load}
                  readOnly
                  showUploadActions={false}
                  showFiles={false}
                  galleryPresentation={presentation}
                  galleryPart="cover"
                />
                {summary}
              </div>
            ) : summary}
            <ItemDetailSections {...detailProps} />
            <AttachmentManager
              itemId={Number(id)}
              attachments={item.attachments || []}
              onChange={load}
              readOnly
              showUploadActions={false}
              showFiles={false}
              galleryPresentation={presentation}
              galleryPart="rest"
            />
          </>
        );
      })()}

      {/* Attachments */}
      <AttachmentManager
        itemId={Number(id)}
        attachments={item.attachments || []}
        onChange={load}
        readOnly
        showUploadActions={canUploadAttachmentsOnDetail}
        showGallery={false}
      />

      {deleteFlow.confirm?.id === Number(id) && (
        <ConfirmDelete
          name={deleteFlow.confirm.name}
          t={t}
          onConfirm={async () => {
            try {
              await api.deleteItem(Number(id));
            } catch (error) {
              const inUse = readInUseInfo(error);
              if (!inUse) throw error;
              reportInUse(inUse);
              deleteFlow.cancelConfirm();
              return;
            }
            deleteFlow.cancelConfirm();
            router.push("/items");
          }}
          onCancel={() => deleteFlow.cancelConfirm()}
        />
      )}
    </div>
  );
}
