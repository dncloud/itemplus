"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, type Item, type Category, type Location, type Property } from "@/lib/api";
import AttachmentManager from "@/components/attachment-manager";
import { useDeleteFlow, ConfirmDelete } from "@/components/confirm-delete";
import { useApp } from "@/lib/app-context";
import { wsClient } from "@/lib/ws";
import { ItemDetailSections } from "@/app/(app)/items/[id]/item-detail-sections";
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
  getBadgeStyle,
  requestConnectedDevices,
} from "@/app/(app)/items/[id]/item-detail-utils";
import {
} from "@heroicons/react/24/outline";

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { realm, serverURL, can, fmtDate, fmtDateTime, printItemQR, t } = useApp();
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
  const [checkoutSent, setCheckoutSent] = useState(false);
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
      setCheckoutSent(data.checkoutState.sent);
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
        setCheckoutSent(data.checkoutState.sent);
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

  const deleteFlow = useDeleteFlow({
    realm,
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
      setCheckoutSent(true);
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

  if (!item) {
    return <ItemDetailLoadingView />;
  }

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
        canWriteAttachments={can("attachments.write")}
        printing={printing}
        printDone={printDone}
        printQR={printQR}
        photoRequested={photoRequested}
        requestPhotoFromPhone={requestPhotoFromPhone}
        editHref={`/items/${id}/edit`}
        canDeleteItems={can("items.delete")}
        pendingDelete={pendingDelete}
        remove={remove}
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

      {checkoutSent && !item.checked_out_to ? <ItemCheckoutPendingBanner t={t} /> : null}

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

      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="flex flex-wrap items-center justify-start gap-2">
            {item.category_name && (
              <span
                className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${!categories.find((c) => c.id === item.category_id)?.color ? "bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-300" : ""}`}
                style={getBadgeStyle(categories.find((c) => c.id === item.category_id)?.color)}
              >
                {item.category_name}
              </span>
            )}
            {item.location_name && (
              <span
                className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${!locations.find((l) => l.id === item.location_id)?.color ? "bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-300" : ""}`}
                style={getBadgeStyle(locations.find((l) => l.id === item.location_id)?.color)}
              >
                {item.location_name}
              </span>
            )}
            {item.item_status && item.item_status !== "active" ? (
              <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${itemStatusStyleMap[item.item_status] || itemStatusStyleMap.reserved}`}>
                {itemStatusLabelMap[item.item_status] || item.item_status}
              </span>
            ) : null}
            <div className="group relative">
              <span className="inline-flex cursor-default items-center rounded-md px-2 py-1 text-xs font-medium bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-300">
                QR-Code
              </span>
              <div className="pointer-events-none fixed top-4 right-4 z-40 rounded-xl bg-white p-2 shadow-xs outline outline-1 -outline-offset-1 outline-gray-200 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-gray-800/95 dark:outline-white/10">
                <div className="rounded-lg bg-gray-50 p-1 dark:bg-gray-900/80">
                  <img src={`${serverURL}/api/print/qr/${realm}/item/${item.id}.svg?color=000000`} alt="QR" className="h-[128px] w-[128px] dark:hidden" />
                  <img src={`${serverURL}/api/print/qr/${realm}/item/${item.id}.svg?color=ffffff`} alt="QR" className="hidden h-[128px] w-[128px] dark:block" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-start justify-end gap-x-6 gap-y-2">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-700 dark:text-gray-300">{t("common.created")}</span>{" "}
                {item.created_at ? fmtDateTime(item.created_at) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-700 dark:text-gray-300">{t("common.updated")}</span>{" "}
                {item.updated_at ? fmtDateTime(item.updated_at) : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <AttachmentManager
        itemId={Number(id)}
        attachments={item.attachments || []}
        onChange={load}
        readOnly
        showUploadActions={false}
        showFiles={false}
      />

      <ItemDetailSections item={item} properties={properties} fmtDate={fmtDate} t={t} />

      {/* Attachments */}
      <AttachmentManager itemId={Number(id)} attachments={item.attachments || []} onChange={load} readOnly showUploadActions={false} showGallery={false} />

      {deleteFlow.confirm?.id === Number(id) && (
        <ConfirmDelete
          name={deleteFlow.confirm.name}
          t={t}
          onConfirm={async () => {
            await api.deleteItem(Number(id));
            deleteFlow.cancelConfirm();
            router.push("/items");
          }}
          onCancel={() => deleteFlow.cancelConfirm()}
        />
      )}
    </div>
  );
}
