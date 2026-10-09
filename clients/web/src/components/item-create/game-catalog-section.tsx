"use client";

import { useEffect, useState } from "react";
import { Check, CheckCheck, Gamepad2, ImagePlus, Images, LoaderCircle } from "lucide-react";
import { api, type GameCatalogAsset, type GameCatalogGame, type GameCatalogProfile, type GameCatalogSearchResult, type Item, type Property } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import SelectPicker from "@/components/ui/select-picker";
import { catalogMediaTitle, catalogMediaCaption, prepareCatalogMedia } from "@/components/item-create/game-catalog-media";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;
type MediaFilter = string;

const catalogMeta = (property: Property) => property.options?.game_catalog as Record<string, unknown> | undefined;
const label = (value: { name: string; translations?: Record<string, { name: string }> }, locale: string) => value.translations?.[locale]?.name || value.name;
const firstName = (value: unknown) => Array.isArray(value) ? value.find((entry): entry is string => typeof entry === "string" && Boolean(entry.trim())) : typeof value === "string" ? value : "";

function catalogErrorMessage(error: unknown, t: TranslateFn, fallback = "gameCatalog.unavailable") {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Game catalog is currently unavailable")) return t("gameCatalog.unavailable");
  if (message.includes("Game catalog resource not found")) return t("gameCatalog.notFound");
  if (message.includes("Select a valid catalog platform")) return t("gameCatalog.selectPlatform");
  return message || t(fallback);
}

function assetLabel(asset: GameCatalogAsset, locale: string) {
  const title = catalogMediaTitle(asset, locale);
  const countries = asset.countries?.map((country) => country.code?.toUpperCase()).filter(Boolean).join(", ");
  const platforms = asset.platforms?.map((platform) => platform.name).join(", ");
  return [title, countries, platforms].filter(Boolean).join(" · ");
}

function orderedAssets(assets: Array<GameCatalogAsset | null | undefined>) {
  const unique = new Map<number, GameCatalogAsset>();
  for (const asset of assets) if (asset) unique.set(asset.media_id, asset);
  return [...unique.values()].sort((left, right) => {
    const leftCountry = left.countries?.map((country) => country.code).sort().join(",") || "ZZ";
    const rightCountry = right.countries?.map((country) => country.code).sort().join(",") || "ZZ";
    return leftCountry.localeCompare(rightCountry) || (left.sequence || 0) - (right.sequence || 0) || left.media_id - right.media_id;
  });
}

function assetMatchesFilter(asset: GameCatalogAsset, filter: MediaFilter) {
  if (filter === "all") return true;
  const descriptor = [asset.kind, asset.role, asset.label, asset.image_text].filter(Boolean).join(" ").toLocaleLowerCase();
  if (filter === "screenshots") return /screenshot|in[ -]?game|gameplay/.test(descriptor);
  const countries = new Set(asset.countries?.map((country) => (country.code || "").toUpperCase()).filter(Boolean));
  return countries.has(filter);
}

function mediaGroupLabel(asset: GameCatalogAsset, locale: string) {
  const normalizedKind = asset.kind?.trim().toLocaleLowerCase();
  const mediaType = normalizedKind && normalizedKind !== "image" && normalizedKind !== "media"
    ? asset.kind
    : catalogMediaTitle(asset, locale);
  const platforms = asset.platforms?.map((platform) => platform.name).filter(Boolean).join(", ");
  return [mediaType, platforms].filter(Boolean).join(" · ");
}

function groupMediaAssets(assets: GameCatalogAsset[], locale: string) {
  const groups = new Map<string, GameCatalogAsset[]>();
  for (const asset of assets) {
    const label = mediaGroupLabel(asset, locale);
    groups.set(label, [...(groups.get(label) || []), asset]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, groupedAssets]) => ({ label, assets: groupedAssets }));
}

export function GameCatalogSection({ t, profile, platform, categoryId, categoryProperties, query, onQueryChange, onPropertiesCreated, onApply, onSave, initialResult }: {
  initialResult?: GameCatalogSearchResult;
  t: TranslateFn;
  profile?: GameCatalogProfile;
  platform?: string;
  categoryId?: number;
  categoryProperties: Property[];
  query: string;
  onQueryChange: (value: string) => void;
  onPropertiesCreated: (properties: Property[]) => void;
  onApply: (game: GameCatalogGame, values: Record<string, unknown>, assets: GameCatalogAsset[], itemPatch: Partial<Item>) => void;
  onSave: () => Promise<void>;
}) {
  const { locale, serverURL } = useApp();
  const [results, setResults] = useState<GameCatalogSearchResult[]>([]);
  const [detail, setDetail] = useState<GameCatalogGame | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [applied, setApplied] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<GameCatalogAsset[]>([]);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [nextAssetOffset, setNextAssetOffset] = useState(0);
  const [loadingMoreAssets, setLoadingMoreAssets] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<GameCatalogAsset[]>([]);
  useEffect(() => {
    if (initialResult && profile && categoryId && (!profile.platform_selection?.required || platform)) void select(initialResult);
    // Runs once per handed-over search hit; `select` and `profile` are new objects on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialResult, profile?.key, categoryId, platform]);
  useEffect(() => {
    if (!profile || (profile.key === "pc-games" && !profile.platform_selection) || (profile.platform_selection?.required && !platform) || query.trim().length < 3 || selectedName === query) { setResults([]); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      setBusy(true); setError("");
      api.searchGameCatalog(profile.key, query.trim(), locale, platform)
        .then((page) => { if (active) setResults(page.items); })
        .catch((err: unknown) => { if (active) setError(catalogErrorMessage(err, t)); })
        .finally(() => { if (active) setBusy(false); });
    }, 260);
    return () => { active = false; window.clearTimeout(timer); };
  }, [selectedName, profile, query, t, locale, platform]);

  useEffect(() => {
    if (applied && detail) onApply(detail, {}, prepareCatalogMedia(selectedAssets, detail.itemplus.assets.primary?.media_id, locale), {});
  }, [applied, detail, selectedAssets, onApply, locale]);

  const select = async (result: GameCatalogSearchResult) => {
    if (!profile) return;
    setApplied(false);
    setBusy(true); setError("");
    try {
      const game = await api.getGameCatalogGame(profile.key, result.id, locale, platform);
      if (result.matched_title) game.itemplus.item.name = result.matched_title;
      setDetail(game); setSelectedName(game.itemplus.item.name); onQueryChange(game.itemplus.item.name); setResults([]);
      const assets = orderedAssets([game.itemplus.assets.primary, ...game.itemplus.assets.gallery]);
      setMediaAssets(assets);
      setMediaFilter(assets.some((asset) => assetMatchesFilter(asset, locale.toUpperCase())) ? locale.toUpperCase() : "all");
      setNextAssetOffset(game.itemplus.assets.gallery.length);
      setSelectedAssets(game.itemplus.assets.primary ? [game.itemplus.assets.primary] : []);
    } catch (err) { setError(catalogErrorMessage(err, t)); }
    finally { setBusy(false); }
  };

  const apply = async () => {
    if (!detail || !profile || !categoryId) return;
    setBusy(true); setError("");
    try {
      const defaults = profile.properties.filter((property) => !["description", "developer", "publisher"].includes(property.key));
      const existingKeys = new Set(categoryProperties.map((property) => String(catalogMeta(property)?.property_key || "")));
      const created = await Promise.all(defaults.filter((property) => !existingKeys.has(property.key)).map((property, index) => api.createProperty({ category_id: categoryId, name: label(property, locale), property_type: property.property_type, options: { ...(property.options || {}), game_catalog: { source: "itemplus-game-catalog", profile_key: profile.key, property_key: property.key } }, required: property.required, show_in_list: property.show_in_list, display_width: property.display_width || "third", position: categoryProperties.length + index })));
      if (created.length) onPropertiesCreated(created);
      const all = [...categoryProperties, ...created];
      const byKey = new Map(all.map((property) => [String(catalogMeta(property)?.property_key || ""), property]));
      const values: Record<string, unknown> = Object.fromEntries(all.filter((property) => catalogMeta(property)?.profile_key === profile.key).map((property) => [String(property.id), null]));
      for (const [key, value] of Object.entries(detail.itemplus.property_values)) { const property = byKey.get(key); if (property) values[String(property.id)] = value; }
      const itemPatch: Partial<Item> = { developer_id: undefined, publisher_id: undefined };
      const description = detail.itemplus.item.description_markdown ?? detail.itemplus.property_values.description;
      if (typeof description === "string" && description.trim()) itemPatch.description = description.trim();
      const developerName = firstName(detail.itemplus.property_values.developer);
      if (developerName) { const developers = await api.getDevelopers(); const developer = developers.find((entry) => entry.name.trim().toLocaleLowerCase() === developerName.trim().toLocaleLowerCase()) || await api.createDeveloper({ name: developerName.trim() }); itemPatch.developer_id = developer.id; }
      const publisherName = firstName(detail.itemplus.property_values.publisher);
      if (publisherName) { const publishers = await api.getPublishers(); const publisher = publishers.find((entry) => entry.name.trim().toLocaleLowerCase() === publisherName.trim().toLocaleLowerCase()) || await api.createPublisher({ name: publisherName.trim() }); itemPatch.publisher_id = publisher.id; }
      onApply(detail, values, prepareCatalogMedia(selectedAssets, detail.itemplus.assets.primary?.media_id, locale), itemPatch);
      setApplied(true);
      setResults([]);
    } catch (err) { setError(catalogErrorMessage(err, t, "gameCatalog.propertyCreateFailed")); }
    finally { setBusy(false); }
  };

  const loadMoreAssets = async () => {
    if (!detail || !profile || loadingMoreAssets || nextAssetOffset >= detail.itemplus.assets.gallery_total) return;
    setLoadingMoreAssets(true);
    try {
      const page = await api.getGameCatalogAssets(profile.key, detail.id, nextAssetOffset, 100);
      setMediaAssets((current) => orderedAssets([...current, ...page.items]));
      setNextAssetOffset((current) => page.items.length > 0 ? current + page.items.length : detail.itemplus.assets.gallery_total);
    } catch (err) {
      setError(catalogErrorMessage(err, t));
    } finally {
      setLoadingMoreAssets(false);
    }
  };

  const detailAssets = detail ? mediaAssets : [];
  const countryFilters = [...new Set(detailAssets.flatMap((asset) => asset.countries?.map((country) => (country.code || "").toUpperCase()).filter(Boolean) || []))]
    .sort((left, right) => {
      const preferred = locale.toUpperCase();
      return Number(right === preferred) - Number(left === preferred) || left.localeCompare(right);
    });
  const mediaFilters: Array<{ id: MediaFilter; label: string }> = [
    { id: "all", label: t("gameCatalog.allMedia") },
    ...countryFilters.map((country) => ({ id: country, label: country })),
    ...(detailAssets.some((asset) => assetMatchesFilter(asset, "screenshots")) ? [{ id: "screenshots" as const, label: t("gameCatalog.screenshots") }] : []),
  ];
  const visibleAssets = detailAssets.filter((asset) => assetMatchesFilter(asset, mediaFilter));
  const visibleAssetGroups = groupMediaAssets(visibleAssets, locale);
  const canLoadMoreAssets = Boolean(detail && nextAssetOffset < detail.itemplus.assets.gallery_total);
  const remainingAssetCount = detail ? Math.max(0, detail.itemplus.assets.gallery_total - nextAssetOffset) : 0;
  const selectedAssetIDs = new Set(selectedAssets.map((asset) => asset.media_id));
  const allVisibleAssetsSelected = visibleAssets.length > 0 && visibleAssets.every((asset) => selectedAssetIDs.has(asset.media_id));

  const toggleAsset = (asset: GameCatalogAsset) => {
    setSelectedAssets((current) => current.some((selected) => selected.media_id === asset.media_id)
      ? current.filter((selected) => selected.media_id !== asset.media_id)
      : orderedAssets([...current, asset]));
  };

  const toggleVisibleAssets = () => {
    setSelectedAssets((current) => {
      const visibleIDs = new Set(visibleAssets.map((asset) => asset.media_id));
      const currentIDs = new Set(current.map((asset) => asset.media_id));
      if (visibleAssets.every((asset) => currentIDs.has(asset.media_id))) return current.filter((asset) => !visibleIDs.has(asset.media_id));
      return orderedAssets([...current, ...visibleAssets.filter((asset) => !currentIDs.has(asset.media_id))]);
    });
  };
  const saveAppliedItem = async () => {
    setBusy(true);
    try { await onSave(); }
    finally { setBusy(false); }
  };
  if (!categoryId || !profile || (profile.platform_selection?.required && !platform)) return null;
  if (profile.key === "pc-games" && !profile.platform_selection) return <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{t("gameCatalog.backendUpdateRequired")}</p>;
  return <div className="game-catalog-section relative mt-2 space-y-3">
    {busy ? <LoaderCircle className="absolute right-3 top-[-32px] size-4 animate-spin text-gray-400" /> : null}
    {results.length > 0 ? <div className="overflow-hidden rounded-md bg-white shadow-lg outline outline-1 outline-black/5 dark:bg-gray-900 dark:outline-white/10">{results.map((result) => <button key={result.id} type="button" onClick={() => void select(result)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5"><Gamepad2 className="mt-0.5 size-4 shrink-0 text-indigo-500" /><span><span className="block text-sm font-medium text-gray-900 dark:text-white">{result.matched_title || result.canonical_title}</span><span className="block text-xs text-gray-500 dark:text-gray-400">{[result.matched_title && result.matched_title !== result.canonical_title ? result.canonical_title : null, result.first_release_year, result.platforms?.join(", ")].filter(Boolean).join(" · ")}</span></span></button>)}</div> : null}
    {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
    {detail && detail.itemplus.catalog?.titles?.length ? <SelectPicker
      value={detail.itemplus.item.name}
      allowClear={false}
      options={[
        { id: detail.itemplus.item.name, name: detail.itemplus.item.name },
        ...detail.itemplus.catalog.titles.filter((title) => title.title !== detail.itemplus.item.name).map((title) => ({ id: title.title, name: [title.title, title.language?.toUpperCase(), title.country_code, title.platform, locale.startsWith("de") ? title.note_de || title.note : title.note].filter(Boolean).join(" · ") })),
      ]}
      onChange={(value) => {
        if (typeof value !== "string") return;
        setApplied(false);
        setDetail({ ...detail, itemplus: { ...detail.itemplus, item: { ...detail.itemplus.item, name: value } } });
        setSelectedName(value);
        setResults([]);
        onQueryChange(value);
      }}
    /> : null}
    {detail ? <div className="overflow-hidden rounded-md border border-gray-200 dark:border-white/10"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-white/10 dark:bg-white/5"><div><p className="font-medium text-gray-900 dark:text-white">{detail.itemplus.item.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">{detail.itemplus.item.external_id}</p></div><button type="button" onClick={() => void (applied ? saveAppliedItem() : apply())} disabled={busy || !query.trim()} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"><Check className="size-4" />{t(applied ? "common.save" : "gameCatalog.apply")}</button></div><div className="space-y-4 px-4 py-3"><p className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white"><ImagePlus className="size-4" />Medien übernehmen</p><div className="flex flex-wrap items-center gap-2"><div className="flex flex-wrap gap-2">{mediaFilters.map((filter) => <button key={filter.id} type="button" onClick={() => setMediaFilter(filter.id)} className={mediaFilter === filter.id ? "rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white" : "rounded-md bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"}>{filter.label}</button>)}</div><button type="button" onClick={toggleVisibleAssets} disabled={visibleAssets.length === 0} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"><CheckCheck className="size-3.5" />{allVisibleAssetsSelected ? t("gameCatalog.clearVisibleMedia") : t("gameCatalog.selectVisibleMedia")}</button>{canLoadMoreAssets ? <button type="button" onClick={() => void loadMoreAssets()} disabled={loadingMoreAssets} className="ml-auto inline-flex items-center gap-2 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5">{loadingMoreAssets ? <LoaderCircle className="size-3.5 animate-spin" /> : <Images className="size-3.5" />}{t("gameCatalog.loadRemainingMedia", { count: remainingAssetCount })}</button> : null}</div><div className="max-h-[34rem] space-y-4 overflow-y-auto pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{visibleAssetGroups.map((group) => <section key={group.label} className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{group.label}</p><div className="grid gap-2 sm:grid-cols-2">{group.assets.map((asset) => { const selected = selectedAssetIDs.has(asset.media_id); return <label key={asset.media_id} title={catalogMediaCaption(asset, locale) || undefined} className={selected ? "flex cursor-pointer items-start gap-3 rounded-md border border-indigo-500 bg-indigo-50 p-2.5 text-xs transition dark:border-indigo-400 dark:bg-indigo-500/10" : "flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-2.5 text-xs transition hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"}><input className="mt-1" type="checkbox" checked={selected} onChange={() => toggleAsset(asset)} /><span className="flex min-w-0 flex-1 gap-2.5"><span className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-black/20"><img src={`${serverURL}/api/collection/items/game-catalog/media/${asset.media_id}/content`} alt={assetLabel(asset, locale)} loading="lazy" decoding="async" className="h-full w-full object-contain" /></span><span className="min-w-0 pt-0.5"><span className="block font-medium leading-5 text-gray-900 dark:text-white">{assetLabel(asset, locale)}</span>{catalogMediaCaption(asset, locale) ? <span className="mt-1 block line-clamp-2 leading-4 text-gray-500 dark:text-gray-400">{catalogMediaCaption(asset, locale)}</span> : null}</span></span></label>; })}</div></section>)}{visibleAssets.length === 0 ? <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{t("gameCatalog.noMediaForFilter")}</p> : null}</div></div></div> : null}
  </div>;
}
