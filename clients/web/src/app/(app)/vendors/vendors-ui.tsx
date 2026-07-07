"use client";

import React from "react";
import { isSafeUrl, type Vendor } from "@/lib/api";
import { Search, Pencil, Plus, Trash2 } from "lucide-react";
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
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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
          <Plus className="h-4 w-4" />
        </button>
      ) : null}
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
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="overflow-hidden divide-y divide-gray-100 bg-white shadow-xs outline outline-1 -outline-offset-1 outline-gray-900/5 sm:rounded-xl dark:divide-white/5 dark:bg-gray-800/50 dark:outline-white/10">
      {items.map((item) => (
        <div key={item.id} className="overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-5 hover:bg-gray-50 sm:px-6 dark:hover:bg-white/2.5">
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
                    <Pencil className="h-4 w-4 text-gray-400" />
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
                      <Trash2 className="h-4 w-4 text-red-400" />
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
