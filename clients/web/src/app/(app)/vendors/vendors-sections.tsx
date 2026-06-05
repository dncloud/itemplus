"use client";

import type React from "react";
import { isSafeUrl, type Vendor } from "@/lib/api";
import {
  BuildingOffice2Icon,
  BuildingStorefrontIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PlusIcon,
  TagIcon,
  TrashIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";

const vendorInputClass = "w-full h-[38px] rounded-md bg-white px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500";

export type EntityType = "manufacturers" | "suppliers" | "vendors" | "sales-platforms";

export const TABS: { key: EntityType; labelKey: string; icon: React.ElementType }[] = [
  { key: "manufacturers", labelKey: "vendors.manufacturers", icon: BuildingOffice2Icon },
  { key: "suppliers", labelKey: "vendors.suppliers", icon: TruckIcon },
  { key: "vendors", labelKey: "vendors.vendors", icon: BuildingStorefrontIcon },
  { key: "sales-platforms", labelKey: "vendors.salesPlatforms", icon: TagIcon },
];

export function VendorTabs({
  tab,
  onSelect,
  t,
}: {
  tab: EntityType;
  onSelect: (tab: EntityType) => void;
  t: (k: string) => string;
}) {
  return (
    <div className="flex gap-2">
      {TABS.map(({ key, labelKey, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
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
  );
}

export function VendorSearchBar({
  search,
  onSearchChange,
  onCreate,
  canCreate = true,
  t,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  canCreate?: boolean;
  t: (k: string) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("common.search")}
          className="w-full h-[38px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {canCreate ? (
        <button
          onClick={onCreate}
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-sm transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          title={t("common.new")}
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export function VendorList({
  items,
  currentTabIcon: CurrentTabIcon,
  fmtDateTime,
  onEdit,
  onDelete,
  pendingDeleteId = null,
  canEdit = true,
  canDelete = true,
  renderEditor,
  t,
}: {
  items: Vendor[];
  currentTabIcon: React.ElementType;
  fmtDateTime: (value: string) => string;
  onEdit: (item: Vendor) => void;
  onDelete: (id: number) => void;
  pendingDeleteId?: number | null;
  canEdit?: boolean;
  canDelete?: boolean;
  renderEditor: (item: Vendor) => React.ReactNode;
  t: (k: string) => string;
}) {
  return (
    <div className="overflow-hidden divide-y divide-gray-100 bg-white shadow-xs outline outline-1 -outline-offset-1 outline-gray-900/5 sm:rounded-xl dark:divide-white/5 dark:bg-gray-800/50 dark:outline-white/10">
      {items.map((item) => (
        <div key={item.id} className="overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-5 hover:bg-gray-50 sm:px-6 dark:hover:bg-white/2.5">
            {item.logo ? (
              <img src={item.logo} alt="" className="h-9 w-9 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                <CurrentTabIcon className="h-5 w-5 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm/6 font-semibold text-gray-900 dark:text-white truncate">{item.name}</p>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                {item.website ? <WebsiteLink website={item.website} /> : null}
                {item.email ? <a href={`mailto:${item.email}`} className="hover:text-blue-500 transition">{item.email}</a> : null}
                {item.phone ? <a href={`tel:${item.phone}`} className="hover:text-blue-500 transition">{item.phone}</a> : null}
                {item.contact_person ? <span>{item.contact_person}</span> : null}
              </div>
              {item.created_at ? (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t("common.created")} {fmtDateTime(item.created_at)}
                  {item.updated_at && item.updated_at !== item.created_at ? <> · {t("common.updated")} {fmtDateTime(item.updated_at)}</> : null}
                </p>
              ) : null}
            </div>
            {canEdit || canDelete ? (
              <div className="flex gap-1 shrink-0">
                {canEdit ? (
                  <button onClick={() => onEdit(item)} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/10">
                    <PencilIcon className="h-4 w-4 text-gray-400" />
                  </button>
                ) : null}
                {canDelete ? (
                  <button
                    onClick={() => onDelete(item.id)}
                    disabled={pendingDeleteId === item.id}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:hover:bg-red-900/20"
                  >
                    {pendingDeleteId === item.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                    ) : (
                      <TrashIcon className="h-4 w-4 text-red-400" />
                    )}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {renderEditor(item)}
        </div>
      ))}
    </div>
  );
}

function WebsiteLink({ website }: { website: string }) {
  const href = website.startsWith("http") ? website : `https://${website}`;
  const label = website.replace(/^https?:\/\//, "");
  return isSafeUrl(href)
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 transition">{label}</a>
    : <span>{label}</span>;
}

export function VendorInlineForm({
  editItem,
  setEditItem,
  tab,
  currentTabIcon: CurrentTabIcon,
  validationError,
  setValidationError,
  save,
  onCancel,
  t,
}: {
  editItem: Partial<Vendor>;
  setEditItem: (next: Partial<Vendor> | null) => void;
  isNew: boolean;
  tab: EntityType;
  currentTabIcon: React.ElementType;
  validationError: string | null;
  setValidationError: (next: string | null) => void;
  save: () => void;
  onCancel: () => void;
  t: (k: string) => string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("vendors.logo")}</label>
        <div className="flex items-center gap-3">
          {editItem.logo ? (
            <img src={editItem.logo} alt="" className="h-16 w-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center border border-gray-200 dark:border-gray-700">
              <CurrentTabIcon className="h-7 w-7 text-gray-300" />
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
                  if (file.size > 500 * 1024) {
                    alert("Logo zu groß (max 500 KB)");
                    return;
                  }
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
            {editItem.logo ? <button type="button" onClick={() => setEditItem({ ...editItem, logo: null as unknown as string })} className="text-xs text-blue-500 hover:text-blue-600">{t("common.remove")}</button> : null}
          </div>
        </div>
      </div>

      <VendorField label={`${t("vendors.name")} *`} value={editItem.name || ""} onChange={(v) => setEditItem({ ...editItem, name: v })} />
      <VendorField label={t("vendors.website")} value={editItem.website || ""} onChange={(v) => setEditItem({ ...editItem, website: v || undefined })} placeholder="https://..." type="url" />

      <div className="grid grid-cols-2 gap-4">
        <VendorField label={t("vendors.email")} value={editItem.email || ""} onChange={(v) => setEditItem({ ...editItem, email: v || undefined })} type="email" />
        <VendorField label={t("vendors.phone")} value={editItem.phone || ""} onChange={(v) => setEditItem({ ...editItem, phone: v || undefined })} type="tel" />
      </div>

      {(tab === "suppliers" || tab === "vendors" || tab === "sales-platforms") ? <VendorField label={t("vendors.contactPerson")} value={editItem.contact_person || ""} onChange={(v) => setEditItem({ ...editItem, contact_person: v || undefined })} /> : null}
      {tab === "suppliers" ? <VendorField label={t("vendors.accountManager")} value={editItem.account_manager || ""} onChange={(v) => setEditItem({ ...editItem, account_manager: v || undefined })} /> : null}
      {(tab === "vendors" || tab === "sales-platforms") ? <VendorField label={t("vendors.customerNumber")} value={editItem.customer_number || ""} onChange={(v) => setEditItem({ ...editItem, customer_number: v || undefined })} /> : null}

      <div className="space-y-2">
        <label className="block text-sm/6 font-medium text-gray-900 dark:text-white">{t("vendors.address")}</label>
        <div className="grid grid-cols-3 gap-2">
          <input value={editItem.address?.street || ""} onChange={(e) => setEditItem({ ...editItem, address: { ...(editItem.address || {}), street: e.target.value } })} placeholder={t("vendors.street")} className={`col-span-2 ${vendorInputClass}`} />
          <input value={editItem.address?.house_number || ""} onChange={(e) => setEditItem({ ...editItem, address: { ...(editItem.address || {}), house_number: e.target.value } })} placeholder={t("vendors.houseNo")} className={vendorInputClass} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input value={editItem.address?.zip || ""} onChange={(e) => setEditItem({ ...editItem, address: { ...(editItem.address || {}), zip: e.target.value } })} placeholder={t("vendors.zip")} className={vendorInputClass} />
          <input value={editItem.address?.city || ""} onChange={(e) => setEditItem({ ...editItem, address: { ...(editItem.address || {}), city: e.target.value } })} placeholder={t("vendors.city")} className={`col-span-2 ${vendorInputClass}`} />
        </div>
      </div>

      {tab === "manufacturers" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <VendorField label={t("vendors.supportEmail")} value={editItem.support_email || ""} onChange={(v) => setEditItem({ ...editItem, support_email: v || undefined })} />
            <VendorField label={t("vendors.supportPhone")} value={editItem.support_phone || ""} onChange={(v) => setEditItem({ ...editItem, support_phone: v || undefined })} />
          </div>
          <VendorField label={t("vendors.supportUrl")} value={editItem.support_url || ""} onChange={(v) => setEditItem({ ...editItem, support_url: v || undefined })} placeholder="https://..." />
        </div>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        {validationError ? <p className="text-xs text-red-500 flex-1">{validationError}</p> : null}
        <button onClick={() => { onCancel(); setValidationError(null); }} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">{t("common.cancel")}</button>
        <button onClick={save} className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600">{t("common.save")}</button>
      </div>
    </div>
  );
}

function VendorField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={vendorInputClass} />
    </div>
  );
}
