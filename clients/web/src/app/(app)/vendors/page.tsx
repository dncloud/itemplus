"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, isSafeUrl, type Vendor } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  BuildingOffice2Icon,
  TruckIcon,
  BuildingStorefrontIcon,
} from "@heroicons/react/24/outline";
import { useDeleteFlow, ConfirmDelete } from "@/components/confirm-delete";

type EntityType = "manufacturers" | "suppliers" | "vendors";

const TABS: { key: EntityType; labelKey: string; icon: React.ElementType }[] = [
  { key: "manufacturers", labelKey: "vendors.manufacturers", icon: BuildingOffice2Icon },
  { key: "suppliers", labelKey: "vendors.suppliers", icon: TruckIcon },
  { key: "vendors", labelKey: "vendors.vendors", icon: BuildingStorefrontIcon },
];

export default function VendorsPage() {
  const { realm, fmtDateTime, t } = useApp();
  const [tab, setTab] = useState<EntityType>("manufacturers");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Partial<Vendor> | null>(null);
  const [isNew, setIsNew] = useState(false);

  const [allItems, setAllItems] = useState<Vendor[]>([]);

  const loadingRef = useRef(false);
  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const fetcher = tab === "manufacturers" ? api.getManufacturers : tab === "suppliers" ? api.getSuppliers : api.getVendors;
      const data = await fetcher();
      setAllItems(data);
    } catch {}
    setLoading(false);
    loadingRef.current = false;
  }, [tab]);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        const fetcher = tab === "manufacturers" ? api.getManufacturers : tab === "suppliers" ? api.getSuppliers : api.getVendors;
        const data = await fetcher();
        if (!cancelled) {
          setAllItems(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    void loadInitial();
    return () => { cancelled = true; };
  }, [tab]);

  const deleteFlow = useDeleteFlow({
    realm,
    onDeleted: useCallback(() => {
      load();
    }, [load]),
  });
  const items = useMemo(
    () => (search ? allItems.filter((d) => d.name.toLowerCase().includes(search.toLowerCase())) : allItems),
    [allItems, search],
  );

  const [validationError, setValidationError] = useState<string | null>(null);

  const save = async () => {
    if (!editItem?.name) return;
    // Validate
    if (editItem.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editItem.email)) {
      setValidationError("Ungültige E-Mail-Adresse");
      return;
    }
    if (editItem.website && !/^https?:\/\/.+/.test(editItem.website)) {
      setValidationError("URL muss mit http:// oder https:// beginnen");
      return;
    }
    if (editItem.support_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editItem.support_email)) {
      setValidationError("Ungültige Support E-Mail");
      return;
    }
    if (editItem.support_url && !/^https?:\/\/.+/.test(editItem.support_url)) {
      setValidationError("Support URL muss mit http:// oder https:// beginnen");
      return;
    }
    setValidationError(null);
    try {
      const endpoint = `/${realm}/${tab}`;
      if (isNew) {
        await fetch(`${api.baseURL}/api${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(editItem),
        });
      } else if (editItem.id) {
        await fetch(`${api.baseURL}/api${endpoint}/${editItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(editItem),
        });
      }
      setEditItem(null);
      load();
    } catch {}
  };

  const remove = (id: number) => {
    const item = allItems.find((i) => i.id === id);
    deleteFlow.requestDelete(id, item?.name || `#${id}`, tab);
  };

  const currentTab = TABS.find((t) => t.key === tab)!;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("vendors.title")}</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map(({ key, labelKey, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setSearch(""); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition ${
              tab === key
                ? "bg-blue-500 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            <Icon className="h-4 w-4" /> {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Search + New */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("common.search")}
            className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => { setEditItem({ name: "" }); setIsNew(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 transition"
        >
          <PlusIcon className="h-4 w-4" /> {t("common.new")}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-gray-500 py-10">{t("vendors.none")}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden hover:bg-gray-50 dark:hover:bg-gray-800/50">
              {item.logo ? (
                <img src={item.logo} alt="" className="h-9 w-9 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
              ) : (
                <div className="h-9 w-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <currentTab.icon className="h-5 w-5 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <div className="flex gap-3 text-xs text-gray-400">
                  {item.website && (() => { const href = item.website!.startsWith("http") ? item.website! : `https://${item.website!}`; return isSafeUrl(href) ? <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 transition">{item.website!.replace(/^https?:\/\//, "")}</a> : <span>{item.website!.replace(/^https?:\/\//, "")}</span>; })()}
                  {item.email && <a href={`mailto:${item.email}`} className="hover:text-blue-500 transition">{item.email}</a>}
                  {item.phone && <a href={`tel:${item.phone}`} className="hover:text-blue-500 transition">{item.phone}</a>}
                  {item.contact_person && <span>{item.contact_person}</span>}
                </div>
                {item.created_at && (
                  <p className="text-[11px] text-gray-400">
                    {t("common.created")}: {fmtDateTime(item.created_at)}
                    {item.updated_at && item.updated_at !== item.created_at && (
                      <> · {t("common.updated")}: {fmtDateTime(item.updated_at)}</>
                    )}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => { setEditItem({ ...item }); setIsNew(false); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <PencilIcon className="h-4 w-4 text-gray-400" />
                </button>
                <button onClick={() => remove(item.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                  <TrashIcon className="h-4 w-4 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{isNew ? t("common.new") : t("common.edit")}</h2>
              <button onClick={() => setEditItem(null)}><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
            </div>

            {/* Logo */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("vendors.logo")}</label>
              <div className="flex items-center gap-3">
                {editItem.logo ? (
                  <img src={editItem.logo} alt="" className="h-16 w-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center border border-gray-200 dark:border-gray-700">
                    <currentTab.icon className="h-7 w-7 text-gray-300" />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="cursor-pointer rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 500 * 1024) { alert("Logo zu groß (max 500 KB)"); return; }
                        // Resize to max 256px and convert to base64
                        const dataUrl = await new Promise<string>((resolve) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(reader.result as string);
                          reader.readAsDataURL(file);
                        });
                        const resized = await new Promise<string>((resolve) => {
                          const img = new Image();
                          img.onload = () => {
                            const max = 256;
                            const ratio = Math.min(max / img.width, max / img.height, 1);
                            const canvas = document.createElement("canvas");
                            canvas.width = img.width * ratio;
                            canvas.height = img.height * ratio;
                            canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
                            resolve(canvas.toDataURL("image/png", 0.9));
                          };
                          img.src = dataUrl;
                        });
                        setEditItem({ ...editItem, logo: resized });
                        e.target.value = "";
                      }}
                    />
                    {t("vendors.selectLogo")}
                  </label>
                  {editItem.logo && (
                    <button
                      type="button"
                      onClick={() => setEditItem({ ...editItem, logo: null as unknown as string })}
                      className="text-xs text-blue-500 hover:text-blue-600"
                    >
                      {t("common.remove")}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <VendorField label={`${t("vendors.name")} *`} value={editItem.name || ""} onChange={(v) => setEditItem({ ...editItem, name: v })} />
            <VendorField label={t("vendors.website")} value={editItem.website || ""} onChange={(v) => setEditItem({ ...editItem, website: v || undefined })} placeholder="https://..." type="url" />

            <div className="grid grid-cols-2 gap-4">
              <VendorField label={t("vendors.email")} value={editItem.email || ""} onChange={(v) => setEditItem({ ...editItem, email: v || undefined })} type="email" />
              <VendorField label={t("vendors.phone")} value={editItem.phone || ""} onChange={(v) => setEditItem({ ...editItem, phone: v || undefined })} type="tel" />
            </div>

            {(tab === "suppliers" || tab === "vendors") && (
              <VendorField label={t("vendors.contactPerson")} value={editItem.contact_person || ""} onChange={(v) => setEditItem({ ...editItem, contact_person: v || undefined })} />
            )}

            {tab === "suppliers" && (
              <VendorField label={t("vendors.accountManager")} value={editItem.account_manager || ""} onChange={(v) => setEditItem({ ...editItem, account_manager: v || undefined })} />
            )}
            {tab === "vendors" && (
              <VendorField label={t("vendors.customerNumber")} value={editItem.customer_number || ""} onChange={(v) => setEditItem({ ...editItem, customer_number: v || undefined })} />
            )}

            {/* Address — separated UI fields, stored as dict */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500">{t("vendors.address")}</label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={editItem.address?.street || ""}
                  onChange={(e) => setEditItem({ ...editItem, address: { ...(editItem.address || {}), street: e.target.value } })}
                  placeholder={t("vendors.street")}
                  className="col-span-2 h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  value={editItem.address?.house_number || ""}
                  onChange={(e) => setEditItem({ ...editItem, address: { ...(editItem.address || {}), house_number: e.target.value } })}
                  placeholder={t("vendors.houseNo")}
                  className="h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={editItem.address?.zip || ""}
                  onChange={(e) => setEditItem({ ...editItem, address: { ...(editItem.address || {}), zip: e.target.value } })}
                  placeholder={t("vendors.zip")}
                  className="h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  value={editItem.address?.city || ""}
                  onChange={(e) => setEditItem({ ...editItem, address: { ...(editItem.address || {}), city: e.target.value } })}
                  placeholder={t("vendors.city")}
                  className="col-span-2 h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Support fields — only for manufacturers */}
            {tab === "manufacturers" && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase">{t("vendors.support")}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <VendorField label={t("vendors.supportEmail")} value={editItem.support_email || ""} onChange={(v) => setEditItem({ ...editItem, support_email: v || undefined })} />
                  <VendorField label={t("vendors.supportPhone")} value={editItem.support_phone || ""} onChange={(v) => setEditItem({ ...editItem, support_phone: v || undefined })} />
                </div>
                <VendorField label={t("vendors.supportUrl")} value={editItem.support_url || ""} onChange={(v) => setEditItem({ ...editItem, support_url: v || undefined })} placeholder="https://..." />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              {validationError && <p className="text-xs text-red-500 flex-1">{validationError}</p>}
              <button onClick={() => { setEditItem(null); setValidationError(null); }} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                {t("common.cancel")}
              </button>
              <button onClick={save} className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600">
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {deleteFlow.confirm && (
        <ConfirmDelete
          name={deleteFlow.confirm.name}
          t={t}
          onConfirm={async () => {
            try {
              await fetch(`${api.baseURL}/api/${realm}/${tab}/${deleteFlow.confirm!.id}`, {
                method: "DELETE",
                credentials: "include",
              });
              load();
            } catch {}
            deleteFlow.cancelConfirm();
          }}
          onCancel={() => deleteFlow.cancelConfirm()}
        />
      )}
    </div>
  );
}

function VendorField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
