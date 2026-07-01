"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogPanel, Transition, TransitionChild } from "@headlessui/react";
import { Search, Box, Tag, MapPin } from "lucide-react";
import { type Item, type Category, type Location } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import {
  fetchSearchDialogReferenceData,
  filterSearchDialogCategories,
  filterSearchDialogLocations,
  hasSearchDialogResults,
  searchDialogItems,
} from "@/components/search/utils";

export default function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { t } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load all categories + locations on first open
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    if (!loaded) {
      fetchSearchDialogReferenceData()
        .then(({ categories, locations }) => { setCategories(categories); setLocations(locations); setLoaded(true); })
        .catch(() => {});
    }
    return () => clearTimeout(timer);
  }, [open, loaded]);

  // Search items when query changes
  useEffect(() => {
    if (!query.trim()) return;
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        setItems(await searchDialogItems(query));
      } catch { setItems([]); }
      setLoading(false);
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  const filteredCats = useMemo(
    () => filterSearchDialogCategories(categories, query),
    [categories, query],
  );
  const filteredLocs = useMemo(
    () => filterSearchDialogLocations(locations, query),
    [locations, query],
  );
  const visibleItems = useMemo(() => (open && query.trim() ? items : []), [items, open, query]);

  const go = (path: string) => {
    setQuery("");
    setItems([]);
    onClose();
    router.push(path);
  };

  const visibleCategories = filteredCats;
  const visibleLocations = filteredLocs;
  const hasResults = hasSearchDialogResults(visibleItems, visibleCategories, visibleLocations);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500/25 backdrop-blur-sm dark:bg-black/40" />
        </TransitionChild>
        <div className="fixed inset-0 flex items-start justify-center pt-[15vh] px-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
            leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl outline-1 outline-black/5 transition-all dark:bg-gray-900 dark:outline-white/10">
              <div className="grid grid-cols-1 border-b border-gray-100 dark:border-white/10">
                <input
                  ref={inputRef}
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("common.search")}
                  className="col-start-1 row-start-1 h-12 w-full pr-20 pl-11 text-base text-gray-900 outline-hidden placeholder:text-gray-400 sm:text-sm dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
                />
                <Search className="pointer-events-none col-start-1 row-start-1 ml-4 h-5 w-5 self-center text-gray-400" />
                <kbd className="col-start-1 row-start-1 mr-4 flex min-w-9 items-center justify-center self-center justify-self-end rounded border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-500">
                  Esc
                </kbd>
              </div>

              <div className="max-h-80 overflow-y-auto pb-2">
                {!query && !loaded ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  </div>
                ) : null}

                {visibleItems.length > 0 ? (
                  <CommandGroup label={t("nav.items")}>
                    {visibleItems.map((item) => (
                      <ResultRow
                        key={`i-${item.id}`}
                        icon={<Box className="h-6 w-6" />}
                        onClick={() => go(`/items/${item.id}`)}
                        label={item.name}
                        detail={item.purchase_price != null ? `${item.purchase_price.toLocaleString("de-DE", { style: "currency", currency: item.purchase_currency || "EUR" })} · ×${item.quantity}` : `×${item.quantity}`}
                      />
                    ))}
                  </CommandGroup>
                ) : null}

                {visibleCategories.length > 0 ? (
                  <CommandGroup label={t("nav.categories")}>
                    {visibleCategories.map((cat) => (
                      <ResultRow
                        key={`c-${cat.id}`}
                        icon={<Tag className="h-6 w-6" />}
                        onClick={() => go(`/items?category=${cat.id}`)}
                        label={cat.name}
                        detail={cat.description || undefined}
                      />
                    ))}
                  </CommandGroup>
                ) : null}

                {visibleLocations.length > 0 ? (
                  <CommandGroup label={t("nav.locations")}>
                    {visibleLocations.map((loc) => (
                      <ResultRow
                        key={`l-${loc.id}`}
                        icon={<MapPin className="h-6 w-6" />}
                        onClick={() => go(`/items?location=${loc.id}`)}
                        label={loc.name}
                        detail={loc.description || undefined}
                      />
                    ))}
                  </CommandGroup>
                ) : null}

                {query && !loading && !hasResults ? (
                  <div className="px-6 py-14 text-center text-sm sm:px-14">
                    <Search className="mx-auto h-6 w-6 text-gray-400" />
                    <p className="mt-4 font-semibold text-gray-900 dark:text-white">{t("items.notFound")}</p>
                    <p className="mt-2 text-gray-500 dark:text-gray-400">{t("common.noResults")}</p>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-y-2 bg-gray-50 px-4 py-2.5 text-xs text-gray-700 dark:bg-white/5 dark:text-gray-300">
                <span>{t("nav.items")}</span>
                <kbd className="mx-2 flex h-6 min-w-10 items-center justify-center rounded-md border border-gray-300 bg-white px-2.5 font-semibold text-gray-900 dark:border-white/10 dark:bg-gray-900 dark:text-white">
                  ↵
                </kbd>
                <span>{t("common.open")}</span>
                <kbd className="mx-2 flex h-6 min-w-10 items-center justify-center rounded-md border border-gray-300 bg-white px-2.5 font-semibold text-gray-900 dark:border-white/10 dark:bg-gray-900 dark:text-white">
                  Esc
                </kbd>
                <span>{t("common.close")}</span>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

function CommandGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pt-2">
      <div className="bg-gray-100 px-4 py-2.5 text-xs font-semibold text-gray-900 dark:bg-white/10 dark:text-white">
        {label}
      </div>
      <div className="mt-2 text-sm text-gray-800 dark:text-gray-200">{children}</div>
    </div>
  );
}

function ResultRow({ onClick, label, detail, icon }: {
  onClick: () => void; label: string; detail?: string; icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center px-4 py-2 text-left select-none focus:outline-hidden hover:bg-gray-50 hover:text-indigo-600 dark:hover:bg-white/5 dark:hover:text-white"
    >
      <span className="flex-none text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-white">{icon}</span>
      <span className="ml-3 flex-auto truncate">{label}</span>
      {detail && (
        <span className="ml-3 hidden max-w-[40%] flex-none truncate text-xs text-gray-400 sm:block group-hover:text-gray-600 dark:group-hover:text-gray-300">
          {detail}
        </span>
      )}
    </button>
  );
}
