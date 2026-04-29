"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, isSafeUrl, type Item, type Category, type Location, type Property, type Vendor } from "@/lib/api";
import PropertyField, { ALL_AGE_RATINGS, CONDITIONS, PRIORITIES } from "@/components/property-field";
import { MarkdownView, MarkdownEditor } from "@/components/markdown";
import AttachmentManager from "@/components/attachment-manager";
import SelectPicker from "@/components/select-picker";
import { useApp } from "@/lib/app-context";
import { wsClient } from "@/lib/ws";
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  DevicePhoneMobileIcon,
  ArrowsRightLeftIcon,
  PrinterIcon,
  QrCodeIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { realm, serverURL, can, fmtDate, fmtDateTime, printItemQR, t } = useApp();
  const [item, setItem] = useState<Item | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [manufacturers, setManufacturers] = useState<Vendor[]>([]);
  const [suppliers, setSuppliers] = useState<Vendor[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Item>>({});
  const [propValues, setPropValues] = useState<Record<string, unknown>>({});
  const [photoRequested, setPhotoRequested] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printDone, setPrintDone] = useState(false);
  const [checkoutDays, setCheckoutDays] = useState(7);
  const [checkoutNote, setCheckoutNote] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutSent, setCheckoutSent] = useState(false);
  const [checkoutBlocked, setCheckoutBlocked] = useState(false);

  const load = useCallback(async () => {
    try {
      const i = await api.getItem(Number(id));
      setItem(i);
      setEditData(i);
      setPropValues(i.properties || {});

      // Load properties for display
      if (i.category_id) {
        api.getProperties(i.category_id).then((p) => setProperties(p.sort((a, b) => a.position - b.position))).catch(() => {});
      }

      // Check checkout status
      api.getCheckoutRequests().catch(() => []).then((requests) => {
        const pendingForItem = requests.filter((r: { item_id: number; status: string }) => r.item_id === Number(id) && r.status === "pending");
        const alreadyCheckedOut = !!i.checked_out_to;
        setCheckoutBlocked(alreadyCheckedOut || pendingForItem.length >= i.quantity);
        setCheckoutSent(pendingForItem.length > 0);
      });
    } catch {
      router.push("/items");
    }
  }, [id, router]);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        const i = await api.getItem(Number(id));
        if (cancelled) return;
        setItem(i);
        setEditData(i);
        setPropValues(i.properties || {});

        if (i.category_id) {
          api.getProperties(i.category_id)
            .then((p) => {
              if (!cancelled) setProperties(p.sort((a, b) => a.position - b.position));
            })
            .catch(() => {});
        }

        api.getCheckoutRequests().catch(() => []).then((requests) => {
          if (cancelled) return;
          const pendingForItem = requests.filter((r: { item_id: number; status: string }) => r.item_id === Number(id) && r.status === "pending");
          const alreadyCheckedOut = !!i.checked_out_to;
          setCheckoutBlocked(alreadyCheckedOut || pendingForItem.length >= i.quantity);
          setCheckoutSent(pendingForItem.length > 0);
        });
      } catch {
        if (!cancelled) router.push("/items");
      }
    };

    void loadInitial();
    return () => { cancelled = true; };
  }, [id, realm, router]);

  // Load categories + locations for color display
  useEffect(() => {
    Promise.all([
      api.getCategories().catch(() => []),
      api.getLocations().catch(() => []),
    ]).then(([cats, locs]) => {
      setCategories(cats);
      setLocations(locs);
    });
  }, [realm]);

  // Load edit-only data (categories, locations, vendors) when editing starts
  const [editDataLoaded, setEditDataLoaded] = useState(false);
  useEffect(() => {
    if (!editing || editDataLoaded) return;
    Promise.all([
      api.getCategories().catch(() => []),
      api.getLocations().catch(() => []),
      api.getManufacturers().catch(() => []),
      api.getSuppliers().catch(() => []),
      api.getVendors().catch(() => []),
    ]).then(([cats, locs, mfrs, sups, vends]) => {
      setCategories(cats); setLocations(locs);
      setManufacturers(mfrs); setSuppliers(sups); setVendors(vends);
      setEditDataLoaded(true);
    });
  }, [editing, editDataLoaded]);

  // Reload properties when category changes during edit
  const editCatId = editData.category_id;
  useEffect(() => {
    if (!editing || !editCatId) return;
    api.getProperties(editCatId).then((p) => setProperties(p.sort((a, b) => a.position - b.position))).catch(() => {});
  }, [editCatId, editing]);

  const save = async () => {
    if (!editData.name) return;
    try {
      // Separate pending file uploads from property values
      const cleanProps: Record<string, unknown> = {};
      const pendingFiles: { propId: string; file: File }[] = [];
      for (const [k, v] of Object.entries(propValues)) {
        if (v && typeof v === "object" && "_pendingFile" in (v as Record<string, unknown>)) {
          const obj = v as Record<string, unknown>;
          if (obj._pendingFile instanceof File) {
            pendingFiles.push({ propId: k, file: obj._pendingFile as File });
          }
        } else {
          cleanProps[k] = v;
        }
      }

      const { name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency } = editData;
      await api.updateItem(Number(id), { name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, properties: cleanProps });

      // Upload pending property files
      for (const { propId, file } of pendingFiles) {
        await api.uploadPropertyFile(Number(id), Number(propId), file);
      }

      setEditing(false);
      load();
    } catch (e) {
      console.error("Save failed:", e);
    }
  };

  const [pendingDelete, setPendingDelete] = useState(false);

  const remove = () => {
    wsClient.send("delete.request", { item_id: Number(id), item_name: item?.name || "", realm });
    setPendingDelete(true);
    setTimeout(() => setPendingDelete(false), 30000);
  };

  useEffect(() => {
    const unsub1 = wsClient.on("delete.done", (data) => {
      if (data.item_id === Number(id)) router.push("/items");
    });
    const unsub2 = wsClient.on("delete.rejected", (data) => {
      if (data.item_id === Number(id)) setPendingDelete(false);
    });
    const unsub3 = wsClient.on("delete.no_device", (data) => {
      if (data.item_id === Number(id)) {
        setPendingDelete(false);
        alert(t("items.noDeviceForDelete"));
      }
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [id, router, t]);

  const requestCheckout = async () => {
    try {
      await api.createCheckoutRequest({
        realm,
        item_id: Number(id),
        requested_duration_days: checkoutDays,
        notes: checkoutNote || undefined,
      });
      setCheckoutSent(true);
      setShowCheckout(false);
    } catch {}
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

  const requestPhotoFromPhone = () => {
    wsClient.send("photo.request", { item_id: Number(id), item_name: item?.name, realm });
    setPhotoRequested(true);
    setTimeout(() => setPhotoRequested(false), 30000); // Reset after 30s
  };

  if (!item) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  const catObj = categories.find((c) => c.id === item.category_id);
  const locObj = locations.find((l) => l.id === item.location_id);

  return (
    <div className="w-full max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{item.name}</h1>
          <div className="flex gap-2 mt-1 text-sm text-gray-500">
            {item.category_name && (
              <span
                className={`px-2 py-0.5 rounded flex items-center gap-1.5 ${!catObj?.color ? "bg-gray-100 dark:bg-gray-700" : ""}`}
                style={catObj?.color ? { backgroundColor: `${catObj.color}15`, color: catObj.color } : undefined}
              >
                {catObj?.color && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: catObj.color }} />}
                {item.category_name}
              </span>
            )}
            {item.location_name && (
              <span
                className={`px-2 py-0.5 rounded flex items-center gap-1.5 ${!locObj?.color ? "bg-gray-100 dark:bg-gray-700" : ""}`}
                style={locObj?.color ? { backgroundColor: `${locObj.color}15`, color: locObj.color } : undefined}
              >
                {locObj?.color && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: locObj.color }} />}
                {item.location_name}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowCheckout(!showCheckout)}
          disabled={checkoutSent || checkoutBlocked}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition ${
            checkoutSent
              ? "bg-green-100 dark:bg-green-900/20 text-green-700 cursor-default"
              : checkoutBlocked
                ? "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                : "border border-blue-300 dark:border-blue-700 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          }`}
        >
          {checkoutSent ? <><CheckIcon className="h-4 w-4" /> {t("itemDetail.requested")}</>
            : checkoutBlocked ? <><ArrowsRightLeftIcon className="h-4 w-4" /> {t("itemDetail.notAvailable")}</>
            : <><ArrowsRightLeftIcon className="h-4 w-4" /> {t("itemDetail.requestCheckout")}</>}
        </button>
        {(can("print") || can("attachments.write")) && (
          <>
            {can("print") && <button
              onClick={printQR}
              disabled={printing || printDone}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${
                printDone
                  ? "border-green-300 dark:border-green-700 text-green-600"
                  : "border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
              title="QR-Code drucken"
            >
              {printing ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              ) : printDone ? (
                <QrCodeIcon className="h-4 w-4 text-green-500" />
              ) : (
                <PrinterIcon className="h-4 w-4" />
              )}
            </button>}
            {can("attachments.write") && <button
              onClick={requestPhotoFromPhone}
              disabled={photoRequested}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${
                photoRequested
                  ? "border-green-300 dark:border-green-700 text-green-600 animate-pulse"
                  : "border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
              title={t("attachments.upload")}
            >
              <DevicePhoneMobileIcon className="h-4 w-4" />
            </button>}
          </>
        )}
        {can("items.write") && (
          <button onClick={() => setEditing(!editing)} className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
            <PencilIcon className="h-4 w-4" /> {editing ? t("itemDetail.cancel") : t("itemDetail.edit")}
          </button>
        )}
        {can("items.delete") && (
          <button onClick={remove} disabled={pendingDelete} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50">
            {pendingDelete ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
            ) : (
              <TrashIcon className="h-5 w-5 text-red-500" />
            )}
          </button>
        )}
      </div>

      {/* Checkout Request Panel */}
      {showCheckout && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-4 space-y-3">
          <h3 className="text-sm font-semibold">{t("itemDetail.requestTitle")}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("itemDetail.duration")}</label>
              <input
                type="number"
                min={1}
                value={checkoutDays}
                onChange={(e) => setCheckoutDays(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("itemDetail.note")}</label>
              <input
                value={checkoutNote}
                onChange={(e) => setCheckoutNote(e.target.value)}
                placeholder={t("itemDetail.noteHint")}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={requestCheckout} className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition">
              {t("itemDetail.sendRequest")}
            </button>
            <button onClick={() => setShowCheckout(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Attachments */}
      <AttachmentManager itemId={Number(id)} attachments={item.attachments || []} onChange={load} readOnly={!can("attachments.write")} />

      {/* Details — View or Edit */}
      {editing ? (
        <EditForm
          data={editData} setData={setEditData}
          propValues={propValues} setPropValues={setPropValues}
          properties={properties} categories={categories} locations={locations}
          manufacturers={manufacturers} suppliers={suppliers} vendors={vendors}
          t={t}
          onSave={save} onCancel={() => { setEditing(false); setEditData(item); setPropValues(item.properties || {}); }}
        />
      ) : (
        <ViewDetails item={item} properties={properties} serverURL={serverURL} realm={realm} can={can} fmtDate={fmtDate} fmtDateTime={fmtDateTime} t={t} onReload={load} />
      )}
    </div>
  );
}

function ViewDetails({ item, properties, serverURL, realm, can, fmtDate, fmtDateTime, t, onReload }: {
  item: Item; properties: Property[]; serverURL: string; realm: string;
  can: (p: string) => boolean; fmtDate: (s: string | null | undefined) => string; fmtDateTime: (s: string | null | undefined) => string;
  t: (k: string) => string; onReload: () => void;
}) {
  const qrPrefix = realm === "archive" ? "a" : "c";
  const fmt = (v: number, c?: string) => v.toLocaleString("de-DE", { style: "currency", currency: c || "EUR" });

  const hasVendors = item.manufacturer_id || item.supplier_id || item.vendor_id;

  return (
    <div className="space-y-6">

      {/* Checkout Status + Return Button */}
      {item.checked_out_to && (
        <section className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-5 py-4 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {t("itemDetail.checkedOutTo")} {item.checked_out_to.user_name || `User #${item.checked_out_to.user_id}`}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {item.checked_out_to.since && `${t("itemDetail.since")} ${fmtDate(item.checked_out_to.since)}`}
              {item.checked_out_to.due_date && ` · ${t("itemDetail.dueDate")} ${fmtDate(item.checked_out_to.due_date)}`}
            </p>
          </div>
          {can("checkout.manage") && (
            <button
              onClick={async () => {
                try {
                  await api.checkinItem(item.id);
                  onReload();
                } catch {}
              }}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-green-500 text-white hover:bg-green-600 transition"
            >
              <ArrowsRightLeftIcon className="h-4 w-4" />
              {t("itemDetail.returnItem")}
            </button>
          )}
        </section>
      )}

      {/* Main Card */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        {/* Header row — description + QR */}
        <div className="p-6 flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            {item.description ? <MarkdownView content={item.description} /> : <p className="text-sm text-gray-400 italic">Keine Beschreibung</p>}
          </div>
          <div className="shrink-0 hidden sm:block" title={`itp://${qrPrefix}/i/${String(item.id).padStart(8, "0")}`}>
            <img src={`${serverURL}/api/print/qr/${realm}/item/${item.id}.svg?color=000000`} alt="QR" className="w-16 h-16 opacity-40 hover:opacity-70 transition dark:hidden" />
            <img src={`${serverURL}/api/print/qr/${realm}/item/${item.id}.svg?color=ffffff`} alt="QR" className="w-16 h-16 opacity-30 hover:opacity-60 transition hidden dark:block" />
          </div>
        </div>

        {/* Key metrics — 2x2 on mobile, 4 on desktop */}
        <div className="border-t border-gray-100 dark:border-gray-700">
          <div className="grid grid-cols-2 sm:grid-cols-4">
            <div className="border-b sm:border-b-0 border-r border-gray-100 dark:border-gray-700"><MetricCell label={t("items.quantity")} value={String(item.quantity)} sub={item.minimum_quantity != null ? `Min. ${item.minimum_quantity}` : undefined} /></div>
            <div className="border-b sm:border-b-0 sm:border-r border-gray-100 dark:border-gray-700"><MetricCell label={t("items.consumable")} value={item.is_consumable ? t("common.yes") : t("common.no")} /></div>
            <div className="border-b sm:border-b-0 border-r border-gray-100 dark:border-gray-700"><MetricCell label={t("items.purchasePrice")} value={item.purchase_price != null ? fmt(item.purchase_price, item.purchase_currency) : "—"} /></div>
            <div><MetricCell label={t("items.purchaseDate")} value={item.purchase_date ? fmtDate(item.purchase_date) : "—"} /></div>
          </div>
        </div>

        {/* Vendors — stacked on mobile, 3-col on desktop */}
        {hasVendors && (
          <div className="border-t border-gray-100 dark:border-gray-700">
            <div className="grid grid-cols-1 sm:grid-cols-3">
              {item.manufacturer_id ? (
                <div className="border-b sm:border-b-0 sm:border-r border-gray-100 dark:border-gray-700">
                  <VendorCell label={t("items.manufacturer")} name={item.manufacturer_name} info={(item as unknown as Record<string, unknown>).manufacturer_info as Record<string, string>} />
                </div>
              ) : <div className="hidden sm:block" />}
              {item.supplier_id ? (
                <div className="border-b sm:border-b-0 sm:border-r border-gray-100 dark:border-gray-700">
                  <VendorCell label={t("items.supplier")} name={item.supplier_name} info={(item as unknown as Record<string, unknown>).supplier_info as Record<string, string>} />
                </div>
              ) : <div className="hidden sm:block" />}
              {item.vendor_id ? (
                <div>
                  <VendorCell label={t("items.vendor")} name={item.vendor_name} info={(item as unknown as Record<string, unknown>).vendor_info as Record<string, string>} />
                </div>
              ) : <div className="hidden sm:block" />}
            </div>
          </div>
        )}
      </section>

      {/* Properties */}
      {properties.length > 0 && item.properties && Object.keys(item.properties).length > 0 && (() => {
        const filled = properties.filter((p) => item.properties?.[String(p.id)] != null);

        // Build rows using a 6-column grid system:
        // third = 2 units, half = 3 units, full = 6 units
        const widthUnits: Record<string, number> = { third: 2, half: 3, full: 6 };
        const rows: { prop: typeof filled[0]; span: number }[][] = [];
        let currentRow: typeof rows[0] = [];
        let currentUnits = 0;

        for (const prop of filled) {
          const w = prop.display_width || "third";
          const units = widthUnits[w] || 2;

          if (units === 6) {
            // Full width — flush current row, then own row
            if (currentRow.length > 0) { rows.push(currentRow); currentRow = []; currentUnits = 0; }
            rows.push([{ prop, span: 6 }]);
          } else if (currentUnits + units > 6) {
            // Doesn't fit — start new row
            rows.push(currentRow);
            currentRow = [{ prop, span: units }];
            currentUnits = units;
          } else {
            currentRow.push({ prop, span: units });
            currentUnits += units;
          }
        }
        if (currentRow.length > 0) rows.push(currentRow);

        const sections: React.ReactNode[] = [];
        const spanClass = (s: number) => s === 6 ? "sm:col-span-6" : s === 3 ? "sm:col-span-3" : "sm:col-span-2";

        rows.forEach((row, ri) => {
          const isFull = row.length === 1 && row[0].span === 6;
          sections.push(
            <div key={ri} className={`text-sm ${!isFull ? "grid grid-cols-1 sm:grid-cols-6" : ""}`}>
              {row.map((cell, ci) => (
                <div
                  key={cell.prop.id}
                  className={`px-6 py-4 ${!isFull ? spanClass(cell.span) : ""} ${
                    ci < row.length - 1 ? "border-b sm:border-b-0 sm:border-r" : ""
                  } border-gray-100 dark:border-gray-700`}
                >
                  <PropDisplay prop={cell.prop} val={item.properties![String(cell.prop.id)]} />
                </div>
              ))}
            </div>
          );
        });

        return (
          <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            {sections.map((s, i) => (
              <div key={i}>
                {i > 0 && <hr className="border-gray-100 dark:border-gray-700" />}
                {s}
              </div>
            ))}
          </section>
        );
      })()}

      {/* Timestamps */}
      {(item.created_at || item.updated_at) && (
        <div className="flex items-center gap-4 text-[11px] text-gray-400 px-1">
          {item.created_at && <span>{t("common.created")}: {fmtDateTime(item.created_at)}</span>}
          {item.updated_at && item.updated_at !== item.created_at && <span>{t("common.updated")}: {fmtDateTime(item.updated_at)}</span>}
        </div>
      )}
    </div>
  );
}

function MetricCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-6 py-4">
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function VendorCell({ label, name, info }: { label: string; name?: string; info?: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const hasInfo = info && (info.website || info.email || info.phone || info.contact_person);

  return (
    <div className="px-6 py-4 relative">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="text-sm font-semibold mt-1">{name || "—"}</p>
        </div>
        {hasInfo && (
          <button onClick={() => setOpen(!open)} className="mt-1 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition shrink-0">
            <svg className={`h-4 w-4 text-gray-400 transition ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        )}
      </div>
      {open && info && (
        <div className="mt-3 space-y-2 text-xs">
          {info.website && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-14 shrink-0">URL</span>
              <a href={(() => { const href = info.website.startsWith("http") ? info.website : `https://${info.website}`; return isSafeUrl(href) ? href : "#"; })()} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate">
                {info.website.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}
          {info.email && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-14 shrink-0">E-Mail</span>
              <a href={`mailto:${info.email}`} className="text-blue-500 hover:underline">{info.email}</a>
            </div>
          )}
          {info.phone && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-14 shrink-0">Telefon</span>
              <a href={`tel:${info.phone}`} className="text-blue-500 hover:underline">{info.phone}</a>
            </div>
          )}
          {info.contact_person && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-14 shrink-0">Kontakt</span>
              <span className="text-gray-700 dark:text-gray-300">{info.contact_person}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PropDisplay({ prop, val: rawVal }: { prop: Property; val: unknown }) {
  const { locale, t } = useApp();
  // Auto-parse JSON strings (e.g. "[\"A\",\"B\"]" → ["A","B"], "{\"value\":5}" → {value:5})
  let val = rawVal;
  if (typeof val === "string") {
    if (val.startsWith("[") || val.startsWith("{")) {
      try { val = JSON.parse(val); } catch {}
    }
    // Double-encoded: parse again if result is still a string starting with [ or {
    if (typeof val === "string" && (val.startsWith("[") || val.startsWith("{"))) {
      try { val = JSON.parse(val); } catch {}
    }
  }

  const lbl = <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">{prop.name}</p>;
  const unitSuffix = prop.unit ? ` ${prop.unit}` : "";
  const badge = "inline-flex items-center px-2.5 py-1 rounded text-xs font-medium";

  switch (prop.property_type) {
    case "age_rating": {
      const ratings = Array.isArray(val) ? val as string[] : [String(val)];
      const matched = ratings.map((v) => ALL_AGE_RATINGS.find((r) => r.value === v)).filter(Boolean);
      if (matched.length === 0) return null;
      return (
        <div>
          {lbl}
          <div className="flex flex-wrap gap-2">
            {matched.map((r) => (
              r!.img ? (
                <img key={r!.value} src={r!.img} alt={`${r!.system} ${r!.label}`} className="h-10 w-auto" title={`${r!.system} ${r!.label}`} />
              ) : (
                <span key={r!.value} className={`${badge} bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300`}>
                  <span className="text-gray-400 mr-1">{r!.system}</span>{r!.label}
                </span>
              )
            ))}
          </div>
        </div>
      );
    }
    case "condition": {
      const c = CONDITIONS.find((x) => x.value === String(val));
      return (
        <div>{lbl}
          <span className={`${badge} bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300`}>{c ? c.label[locale] : String(val)}</span>
        </div>
      );
    }
    case "priority": {
      const p = PRIORITIES.find((x) => x.value === String(val));
      return (
        <div>{lbl}
          {p ? (
            <span className={`${badge} text-white ${p.color}`}>{p.label[locale]}</span>
          ) : <p className="font-medium">{String(val)}</p>}
        </div>
      );
    }
    case "rating": {
      const n = Number(val);
      return (
        <div>{lbl}
          <div className="flex gap-0.5 text-lg">
            {[1, 2, 3, 4, 5].map((s) => (
              <span key={s} className={s <= n ? "text-amber-400" : "text-gray-300 dark:text-gray-600"}>★</span>
            ))}
          </div>
        </div>
      );
    }
    case "weight": {
      if (typeof val === "object" && val) {
        const w = val as Record<string, unknown>;
        return <div>{lbl}<p className="font-medium">{String(w.value)} {String(w.unit || "g")}</p></div>;
      }
      return <div>{lbl}<p className="font-medium">{String(val)}</p></div>;
    }
    case "boolean":
      return <div>{lbl}<p className="font-medium">{val === true || val === "true" ? t("common.yes") : t("common.no")}</p></div>;
    case "dimensions": {
      if (typeof val === "object" && val) {
        const d = val as Record<string, unknown>;
        return <div>{lbl}<p className="font-medium">{[d.length, d.width, d.height].filter((v) => v != null).join(" × ")}{unitSuffix}</p></div>;
      }
      return <div>{lbl}<p className="font-medium">{String(val)}{unitSuffix}</p></div>;
    }
    case "number":
      return <div>{lbl}<p className="font-medium">{String(val)}{unitSuffix}</p></div>;
    case "textblock":
      return <div>{lbl}<MarkdownView content={String(val)} /></div>;
    default: {
      let display = val;
      // Parse JSON string arrays (e.g. "[\"A\",\"B\"]")
      if (typeof val === "string" && val.startsWith("[")) {
        try { display = JSON.parse(val); } catch {}
      }
      return <div>{lbl}<p className="font-medium">{Array.isArray(display) ? display.join(", ") : String(display)}{unitSuffix}</p></div>;
    }
  }
}

// ── Edit Form (reuses PropertyField from items page logic) ──

function EditForm({ data, setData, propValues, setPropValues, properties, categories, locations, manufacturers, suppliers, vendors, t, onSave, onCancel }: {
  data: Partial<Item>; setData: (d: Partial<Item>) => void;
  propValues: Record<string, unknown>; setPropValues: (p: Record<string, unknown>) => void;
  properties: Property[]; categories: Category[]; locations: Location[];
  manufacturers: Vendor[]; suppliers: Vendor[]; vendors: Vendor[];
  t: (k: string) => string;
  onSave: () => void; onCancel: () => void;
}) {
  const inputCls = "w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
      <h2 className="text-lg font-semibold">{t("common.edit")}</h2>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">{t("items.name")}</label>
        <input value={data.name || ""} onChange={(e) => setData({ ...data, name: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">{t("items.description")}</label>
        <MarkdownEditor value={data.description || ""} onChange={(v) => setData({ ...data, description: v })} rows={4} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SelectPicker label={t("items.category")} value={data.category_id} onChange={(v) => setData({ ...data, category_id: v as number | undefined })} options={categories.map((c) => ({ id: c.id, name: c.name }))} />
        <SelectPicker label={t("items.location")} value={data.location_id} onChange={(v) => setData({ ...data, location_id: v as number | undefined })} options={locations.map((l) => ({ id: l.id, name: l.name }))} />
      </div>

      {/* Manufacturer / Supplier / Vendor */}
      <div className="grid grid-cols-3 gap-4">
        <SelectPicker label={t("items.manufacturer")} value={data.manufacturer_id} onChange={(v) => setData({ ...data, manufacturer_id: v as number | undefined })} options={manufacturers.map((m) => ({ id: m.id, name: m.name }))} />
        <SelectPicker label={t("items.supplier")} value={data.supplier_id} onChange={(v) => setData({ ...data, supplier_id: v as number | undefined })} options={suppliers.map((s) => ({ id: s.id, name: s.name }))} />
        <SelectPicker label={t("items.vendor")} value={data.vendor_id} onChange={(v) => setData({ ...data, vendor_id: v as number | undefined })} options={vendors.map((v) => ({ id: v.id, name: v.name }))} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t("items.purchasePrice")}</label>
          <input type="number" value={data.purchase_price ?? ""} onChange={(e) => setData({ ...data, purchase_price: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t("items.currency")}</label>
          <input value={data.purchase_currency || "EUR"} onChange={(e) => setData({ ...data, purchase_currency: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t("items.purchaseDate")}</label>
          <input type="date" value={data.purchase_date || ""} onChange={(e) => setData({ ...data, purchase_date: e.target.value || undefined })} className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t("items.quantity")}</label>
          <input type="number" value={data.quantity ?? 1} onChange={(e) => setData({ ...data, quantity: Number(e.target.value) })} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t("items.minQuantity")}</label>
          <input type="number" value={data.minimum_quantity ?? ""} onChange={(e) => setData({ ...data, minimum_quantity: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-3 cursor-pointer text-sm text-gray-700 dark:text-gray-400">
            <span>{t("items.consumable")}</span>
            <button type="button" onClick={() => setData({ ...data, is_consumable: !data.is_consumable })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${data.is_consumable ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${data.is_consumable ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </label>
        </div>
      </div>

      {/* Properties */}
      {properties.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase">{t("itemDetail.properties")}</h3>
          {properties.map((prop) => (
            <PropertyField
              key={prop.id}
              property={prop}
              value={propValues[String(prop.id)]}
              onChange={(val) => setPropValues({ ...propValues, [String(prop.id)]: val })}
            />
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">{t("common.cancel")}</button>
        <button onClick={onSave} className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600">{t("common.save")}</button>
      </div>
    </div>
  );
}
