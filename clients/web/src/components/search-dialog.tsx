"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogPanel, Transition, TransitionChild } from "@headlessui/react";
import { MagnifyingGlassIcon, CubeIcon, TagIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { api, type Item, type Category, type Location } from "@/lib/api";
import { useApp } from "@/lib/app-context";

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
      Promise.all([api.getCategories(), api.getLocations()])
        .then(([c, l]) => { setCategories(c); setLocations(l); setLoaded(true); })
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
        const res = await api.getItems(1, query);
        setItems(res.items.slice(0, 8));
      } catch { setItems([]); }
      setLoading(false);
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  const q = query.toLowerCase();
  const filteredCats = useMemo(
    () => (q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories),
    [categories, q],
  );
  const filteredLocs = useMemo(
    () => (q ? locations.filter((l) => l.name.toLowerCase().includes(q)) : locations),
    [locations, q],
  );
  const visibleItems = useMemo(() => (open && query.trim() ? items : []), [items, open, query]);

  const go = (path: string) => {
    setQuery("");
    setItems([]);
    onClose();
    router.push(path);
  };

  const hasResults = visibleItems.length > 0 || filteredCats.length > 0 || filteredLocs.length > 0;

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </TransitionChild>
        <div className="fixed inset-0 flex items-start justify-center pt-[15vh] px-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
            leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-xl rounded-xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 shrink-0" />
                <input
                  ref={inputRef}
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("common.search")}
                  className="flex-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                />
                <kbd className="text-xs text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5">Esc</kbd>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto">
                {/* Items */}
                {visibleItems.length > 0 && (
                  <div className="p-2">
                    <SectionHeader icon={<CubeIcon className="h-3.5 w-3.5" />} label={t("nav.items")} />
                    {visibleItems.map((item) => (
                      <ResultRow
                        key={`i-${item.id}`}
                        onClick={() => go(`/items/${item.id}`)}
                        label={item.name}
                        detail={item.purchase_price != null ? `${item.purchase_price.toLocaleString("de-DE", { style: "currency", currency: item.purchase_currency || "EUR" })} · ×${item.quantity}` : `×${item.quantity}`}
                      />
                    ))}
                  </div>
                )}

                {/* Categories */}
                {filteredCats.length > 0 && (
                  <div className={`p-2 ${items.length > 0 ? "border-t border-gray-100 dark:border-gray-800" : ""}`}>
                    <SectionHeader icon={<TagIcon className="h-3.5 w-3.5" />} label={t("nav.categories")} />
                    {filteredCats.slice(0, q ? 10 : 5).map((cat) => (
                      <ResultRow
                        key={`c-${cat.id}`}
                        onClick={() => go(`/items?category=${cat.id}`)}
                        label={cat.name}
                        detail={cat.description || undefined}
                        accent="blue"
                      />
                    ))}
                  </div>
                )}

                {/* Locations */}
                {filteredLocs.length > 0 && (
                  <div className={`p-2 ${(items.length > 0 || filteredCats.length > 0) ? "border-t border-gray-100 dark:border-gray-800" : ""}`}>
                    <SectionHeader icon={<MapPinIcon className="h-3.5 w-3.5" />} label={t("nav.locations")} />
                    {filteredLocs.slice(0, q ? 10 : 5).map((loc) => (
                      <ResultRow
                        key={`l-${loc.id}`}
                        onClick={() => go(`/items?location=${loc.id}`)}
                        label={loc.name}
                        detail={loc.description || undefined}
                        accent="green"
                      />
                    ))}
                  </div>
                )}

                {/* No results */}
                {query && !loading && !hasResults && (
                  <p className="p-6 text-sm text-gray-500 text-center">{t("items.notFound")}</p>
                )}

                {/* Empty state — no query */}
                {!query && !loaded && (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  </div>
                )}
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
      {icon}
      {label}
    </div>
  );
}

function ResultRow({ onClick, label, detail, accent }: {
  onClick: () => void; label: string; detail?: string; accent?: "blue" | "green";
}) {
  const dotColor = accent === "blue" ? "bg-blue-400" : accent === "green" ? "bg-green-400" : "bg-gray-300 dark:bg-gray-600";

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition"
    >
      <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
      <span className="truncate flex-1">{label}</span>
      {detail && <span className="text-xs text-gray-400 shrink-0 max-w-[40%] truncate">{detail}</span>}
    </button>
  );
}
