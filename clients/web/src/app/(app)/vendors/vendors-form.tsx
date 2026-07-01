"use client";

import type React from "react";
import type { Vendor } from "@/lib/api";
import { Sparkles } from "lucide-react";
import type { EntityType } from "./vendors-types";
import { VendorField, VendorLogoThumb } from "./vendors-ui";

const vendorInputClass =
  "w-full h-[38px] rounded-md bg-white px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500";

export function VendorInlineForm({
  editItem,
  setEditItem,
  tab,
  currentTabIcon: CurrentTabIcon,
  validationError,
  setValidationError,
  logoSourceUrl,
  onLogoSourceUrlChange,
  onImportLogoFromSource,
  logoImportBusy,
  logoImportError,
  showAIButton,
  aiBusy,
  onRunAI,
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
  logoSourceUrl: string;
  onLogoSourceUrlChange: (value: string) => void;
  onImportLogoFromSource: () => void;
  logoImportBusy?: boolean;
  logoImportError?: string | null;
  showAIButton?: boolean;
  aiBusy: boolean;
  onRunAI?: () => void;
  save: () => void;
  onCancel: () => void;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("vendors.logo")}</label>
        <div className="flex items-center gap-3">
          <VendorLogoThumb
            logo={editItem.logo}
            background={editItem.logo_background}
            sizeClass="h-16 w-16"
            fallback={<CurrentTabIcon className="h-7 w-7 text-gray-300" />}
          />
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
        <div className="mt-3 grid gap-3 sm:grid-cols-[auto,1fr,auto] sm:items-center">
          <div className="flex items-center gap-2">
            <input type="color" value={editItem.logo_background || "#ffffff"} onChange={(event) => setEditItem({ ...editItem, logo_background: event.target.value })} className="h-10 w-10 cursor-pointer rounded-lg border border-gray-300 bg-transparent p-1 dark:border-gray-700" aria-label={t("vendors.logoBackground")} />
            <button type="button" onClick={() => setEditItem({ ...editItem, logo_background: undefined })} className="inline-flex h-[38px] items-center justify-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
              {t("vendors.logoBackgroundReset")}
            </button>
          </div>
          <div>
            <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("vendors.logoBackground")}</label>
            <input value={editItem.logo_background || ""} onChange={(event) => setEditItem({ ...editItem, logo_background: event.target.value || undefined })} placeholder="#ffffff" className={vendorInputClass} />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t("vendors.logoBackgroundHint")}</p>
          </div>
        </div>
      </div>

      <VendorField label={`${t("vendors.name")} *`} value={editItem.name || ""} onChange={(v) => setEditItem({ ...editItem, name: v })} />
      <VendorField label={t("vendors.website")} value={editItem.website || ""} onChange={(v) => setEditItem({ ...editItem, website: v || undefined })} placeholder="https://..." type="url" />
      <div>
        <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("vendors.logoSourceUrl")}</label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input value={logoSourceUrl} onChange={(event) => onLogoSourceUrlChange(event.target.value)} placeholder="https://..." type="url" className={`${vendorInputClass} flex-1`} />
          <button type="button" onClick={onImportLogoFromSource} disabled={logoImportBusy || !logoSourceUrl.trim()} className="inline-flex h-[38px] items-center justify-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
            {logoImportBusy ? t("vendors.logoSourceLoading") : t("vendors.logoSourceLoad")}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t("vendors.logoSourceHint")}</p>
        {logoImportError ? <p className="mt-2 text-xs text-red-500">{logoImportError}</p> : null}
      </div>

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
        {showAIButton ? (
          <button type="button" onClick={onRunAI} disabled={aiBusy} className="mr-auto inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20" title={t("vendors.aiButton")}>
            {aiBusy ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current/40 border-t-current" /> : <Sparkles className="h-4 w-4" />}
          </button>
        ) : null}
        <button onClick={() => { onCancel(); setValidationError(null); }} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">{t("common.cancel")}</button>
        <button onClick={save} className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600">{t("common.save")}</button>
      </div>
    </div>
  );
}
