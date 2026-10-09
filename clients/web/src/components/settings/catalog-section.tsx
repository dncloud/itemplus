"use client";

import { useEffect, useState } from "react";
import { Check, Gamepad2, LoaderCircle } from "lucide-react";
import { api, type GameCatalogProfile, type Property } from "@/lib/api";
import { useApp } from "@/lib/app-context";

function localized(value: { name: string; translations?: Record<string, { name: string }> }, locale: string) {
  return value.translations?.[locale]?.name || value.name;
}

function marker(profileKey: string, propertyKey: string) {
  return { source: "itemplus-game-catalog", profile_key: profileKey, property_key: propertyKey };
}

function catalogOptions(profile: GameCatalogProfile, property: GameCatalogProfile["properties"][number]) {
  return { ...(property.options || {}), game_catalog: marker(profile.key, property.key) };
}

export function SettingsCatalogSection({ t, primaryButtonClass }: { t: (key: string, vars?: Record<string, string | number>) => string; primaryButtonClass: string; secondaryButtonClass: string }) {
  const { locale } = useApp();
  const [profiles, setProfiles] = useState<GameCatalogProfile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getCollectionGameCatalogProfiles().then((contract) => setProfiles(contract.profiles)).catch((err: unknown) => setError(err instanceof Error ? err.message : t("gameCatalog.unavailable")));
  }, [t]);

  const install = async (profile: GameCatalogProfile) => {
    setBusy(profile.key); setError("");
    try {
      const categories = await api.getCollectionCategories();
      const categoryName = localized(profile.category, locale);
      const categoryDefaults = { show_developer: true, show_publisher: true };
      const existingCategory = categories.find((entry) => entry.name === categoryName);
      const category = existingCategory
        ? await api.updateCollectionCategory(existingCategory.id, categoryDefaults)
        : await api.createCollectionCategory({ name: categoryName, description: profile.category.translations?.[locale]?.description || profile.category.description, ...categoryDefaults });
      const existing = await api.getCollectionProperties(category.id);
      const byKey = new Map(existing.map((entry) => [String((entry.options?.game_catalog as Record<string, unknown> | undefined)?.property_key || ""), entry]));
      const defaults = profile.properties.filter((property) => !["description", "developer", "publisher"].includes(property.key));
      const created = await Promise.all(defaults.filter((property) => !byKey.has(property.key)).map((property, index) => api.createCollectionProperty({
        category_id: category.id, name: localized(property, locale), property_type: property.property_type,
        options: catalogOptions(profile, property), required: property.required, show_in_list: property.show_in_list,
        display_width: property.display_width || "third", position: existing.length + index,
      })));
      const current = [...existing, ...created] as Property[];
      await Promise.all(defaults.flatMap((property) => {
        const entry = byKey.get(property.key) || current.find((candidate) => candidate.id === created.find((item) => String((item.options?.game_catalog as Record<string, unknown> | undefined)?.property_key || "") === property.key)?.id);
        if (!entry) return [];
        const nextOptions = catalogOptions(profile, property);
        return [api.updateCollectionProperty(entry.id, { options: nextOptions, required: property.required, show_in_list: property.show_in_list, display_width: property.display_width || "third" })];
      }));
      setDone((current) => [...current, profile.key]);
    } catch (err) { setError(err instanceof Error ? err.message : t("settings.catalogProfileFailed")); }
    finally { setBusy(null); }
  };

  return <section id="catalogs" className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[16rem_minmax(0,1fr)]">
    <div><h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">{t("settings.catalogTitle")}</h2><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("settings.catalogDescription")}</p></div>
    <div className="rounded-md bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
      <div className="divide-y divide-gray-200 dark:divide-white/10">
        {profiles.map((profile) => <div key={profile.key} className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-500"><Gamepad2 className="size-4" /></span><div><h3 className="text-sm font-semibold text-gray-900 dark:text-white">{localized(profile.category, locale)}</h3><p className="text-xs text-gray-500 dark:text-gray-400">{profile.properties.filter((property) => !["description", "developer", "publisher"].includes(property.key)).length} Eigenschaften</p></div></div>
          <button type="button" disabled={busy !== null} onClick={() => { void install(profile); }} className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}>{busy === profile.key ? <LoaderCircle className="size-4 animate-spin" /> : done.includes(profile.key) ? <Check className="size-4" /> : <Gamepad2 className="size-4" />}{done.includes(profile.key) ? t("settings.catalogProfileDone") : t("settings.catalogProfileAction")}</button>
        </div>)}
        {profiles.length === 0 && !error ? <div className="px-6 py-5 text-sm text-gray-500 dark:text-gray-400">{t("gameCatalog.unavailable")}</div> : null}
      </div>{error ? <p className="px-6 py-3 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  </section>;
}
