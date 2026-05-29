"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { type Vendor } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { useDeleteFlow, ConfirmDelete } from "@/components/confirm-delete";
import {
  type EntityType,
  TABS,
  VendorInlineForm,
  VendorList,
  VendorSearchBar,
  VendorTabs,
} from "./vendors-sections";
import {
  deleteVendorDraft,
  fetchVendorsPageData,
  filterVendors,
  saveVendorDraft,
  validateVendorDraft,
} from "./vendors-page-utils";

export default function VendorsPage() {
  const { realm, fmtDateTime, t, can } = useApp();
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
      setAllItems(await fetchVendorsPageData(tab));
    } catch {}
    setLoading(false);
    loadingRef.current = false;
  }, [tab]);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        const data = await fetchVendorsPageData(tab);
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
    () => filterVendors(allItems, search),
    [allItems, search],
  );

  const [validationError, setValidationError] = useState<string | null>(null);
  const canWriteVendors = can("vendors.write");
  const canDeleteVendors = can("vendors.delete");

  const save = async () => {
    if (!canWriteVendors) return;
    if (!editItem?.name) return;
    const error = validateVendorDraft(editItem, t);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    try {
      await saveVendorDraft({ realm, tab, draft: editItem, isNew });
      setEditItem(null);
      load();
    } catch {}
  };

  const remove = (id: number) => {
    if (!canDeleteVendors) return;
    const item = allItems.find((i) => i.id === id);
    deleteFlow.requestDelete(id, item?.name || `#${id}`, tab === "sales-platforms" ? "sales_platform" : tab.slice(0, -1));
  };

  const currentTab = TABS.find((t) => t.key === tab)!;
  const tabLabel = t(currentTab.labelKey);

  return (
    <div className="space-y-6">
      <div className="mb-4 text-center sm:flex sm:items-center sm:justify-between sm:border-b sm:border-gray-200 sm:text-left lg:mb-8 dark:border-white/10">
        <div className="space-y-1 py-3">
          <nav className="text-sm font-medium dark:text-gray-100">
            <ol className="flex items-center justify-center sm:justify-start">
              <li>
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">
                  {t("nav.dashboard")}
                </Link>
              </li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRightIcon className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-500 dark:text-gray-400">{realm === "archive" ? t("realm.archive") : t("realm.collection")}</li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRightIcon className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-900 dark:text-white">{t("vendors.title")}</li>
            </ol>
          </nav>
          <h2 className="text-2xl font-bold">{t("vendors.title")}</h2>
        </div>
      </div>

      {/* Tabs */}
      <VendorTabs tab={tab} onSelect={(nextTab) => { setTab(nextTab); setSearch(""); }} t={t} />

      <VendorSearchBar
        search={search}
        onSearchChange={setSearch}
        onCreate={() => { setEditItem({ name: "" }); setIsNew(true); }}
        canCreate={canWriteVendors}
        t={t}
      />

      {canWriteVendors && editItem && isNew ? (
        <div className="overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-900/5 dark:bg-gray-800/50 dark:outline-white/10">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-white/10">
            <h3 className="font-semibold text-gray-900 dark:text-white">{t("common.new")} {tabLabel}</h3>
          </div>
          <div className="px-4 py-4 sm:px-6">
            <VendorInlineForm
              editItem={editItem}
              setEditItem={setEditItem}
              isNew={isNew}
              tab={tab}
              currentTabIcon={currentTab.icon}
              validationError={validationError}
              setValidationError={setValidationError}
              save={save}
              onCancel={() => { setEditItem(null); setValidationError(null); }}
              t={t}
            />
          </div>
        </div>
      ) : null}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-gray-500 py-10">{t("vendors.none")}</p>
      ) : (
        <VendorList
          items={items}
          currentTabIcon={currentTab.icon}
          fmtDateTime={fmtDateTime}
          onEdit={(item) => {
            if (!canWriteVendors) return;
            if (editItem?.id === item.id && !isNew) {
              setEditItem(null);
              setValidationError(null);
              return;
            }
            setEditItem({ ...item });
            setIsNew(false);
            setValidationError(null);
          }}
          onDelete={remove}
          canEdit={canWriteVendors}
          canDelete={canDeleteVendors}
          renderEditor={(item) => canWriteVendors && editItem?.id === item.id && !isNew ? (
            <div className="border-t border-gray-100 px-4 py-4 sm:px-6 dark:border-white/10">
              <VendorInlineForm
                editItem={editItem}
                setEditItem={setEditItem}
                isNew={isNew}
                tab={tab}
                currentTabIcon={currentTab.icon}
                validationError={validationError}
                setValidationError={setValidationError}
                save={save}
                onCancel={() => { setEditItem(null); setValidationError(null); }}
                t={t}
              />
            </div>
          ) : null}
          t={t}
        />
      )}

      {/* Confirm Delete */}
      {canDeleteVendors && deleteFlow.confirm && (
        <ConfirmDelete
          name={deleteFlow.confirm.name}
          t={t}
          onConfirm={async () => {
            try {
              await deleteVendorDraft(realm, tab, deleteFlow.confirm!.id);
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
