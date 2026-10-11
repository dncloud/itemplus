"use client";

import React from "react";
import { isSafeUrl, type Vendor } from "@/lib/api";
import { Search, Pencil } from "lucide-react";
import { RowMenu, iconButtonClass } from "@/components/ui/list-controls";
import type { EntityType } from "./vendors-types";
import { TABS } from "./vendors-types";

const vendorInputClass =
  "w-full h-[38px] rounded-md bg-white px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500";

export function VendorLogoThumb({
  logo,
  background,
  sizeClass,
  imageClassName,
  fallback,
}: {
  logo?: string;
  background?: string;
  sizeClass: string;
  imageClassName?: string;
  fallback: React.ReactNode;
}) {
  const style = background ? { backgroundColor: background } : undefined;
  return (
    <div
      className={`${sizeClass} overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 ${background ? "" : "bg-gray-100 dark:bg-white/5"} flex items-center justify-center`}
      style={style}
    >
      {logo ? <img src={logo} alt="" className={`h-full w-full object-contain p-1 ${imageClassName || ""}`.trim()} /> : fallback}
    </div>
  );
}

export function VendorTabs({
  tab,
  onSelect,
  t,
}: {
  tab: EntityType;
  onSelect: (tab: EntityType) => void;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map(({ key, labelKey, icon: Icon }) => (
        <button
          key={key}
          type="button"
          aria-current={tab === key ? "page" : undefined}
          onClick={() => onSelect(key)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition ${
            tab === key
              ? "bg-indigo-100 font-medium text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
              : "font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
  t,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1">
        <div className="-mr-px grid grow grid-cols-1 focus-within:relative">
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("common.search")}
            aria-label={t("common.search")}
            className="col-start-1 row-start-1 block w-full rounded-l-md bg-white py-1.5 pr-3 pl-10 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:pl-9 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
          />
          <Search className="pointer-events-none col-start-1 row-start-1 ml-3 size-5 self-center text-gray-400 sm:size-4" />
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center rounded-r-md bg-white px-3 py-2 text-sm font-semibold text-gray-700 outline-1 -outline-offset-1 outline-gray-300 hover:bg-gray-50 focus:relative focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/10 dark:text-white dark:outline-white/5 dark:hover:bg-white/20 dark:focus:outline-indigo-500"
          title={t("common.search")}
          aria-label={t("common.search")}
        >
          <Search className="h-4 w-4 text-gray-400 dark:text-gray-300" />
        </button>
      </div>
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

export function VendorField({
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

export function VendorList({
  items,
  currentTabIcon: CurrentTabIcon,
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
  onEdit: (item: Vendor) => void;
  onDelete: (id: number) => void;
  pendingDeleteId?: number | null;
  canEdit?: boolean;
  canDelete?: boolean;
  renderEditor: (item: Vendor) => React.ReactNode;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="overflow-hidden divide-y divide-gray-100 bg-white shadow-xs outline outline-1 -outline-offset-1 outline-gray-900/5 sm:rounded-xl dark:divide-white/5 dark:bg-gray-800/50 dark:outline-white/10">
      {items.map((item) => (
        <div key={item.id} className="overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50 sm:px-6 dark:hover:bg-white/2.5">
            <VendorLogoThumb
              logo={item.logo}
              background={item.logo_background}
              sizeClass="h-12 w-12"
              fallback={<CurrentTabIcon className="h-6 w-6 text-gray-400" />}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm/6 font-semibold text-gray-900 dark:text-white truncate">{item.name}</p>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                {item.website ? <WebsiteLink website={item.website} /> : null}
                {item.email ? <a href={`mailto:${item.email}`} className="hover:text-blue-500 transition">{item.email}</a> : null}
                {item.phone ? <a href={`tel:${item.phone}`} className="hover:text-blue-500 transition">{item.phone}</a> : null}
                {item.contact_person ? <span>{item.contact_person}</span> : null}
              </div>
            </div>
            {canEdit || canDelete ? (
              <div className="flex gap-1 shrink-0">
                {canEdit ? (
                  <button type="button" onClick={() => onEdit(item)} title={t("common.edit")} aria-label={t("common.edit")} className={iconButtonClass}>
                    <Pencil className="h-4 w-4" />
                  </button>
                ) : null}
                {canDelete ? <RowMenu t={t} pending={pendingDeleteId === item.id} onDelete={() => onDelete(item.id)} /> : null}
              </div>
            ) : null}
          </div>
          {renderEditor(item)}
        </div>
      ))}
    </div>
  );
}
