import type { GameCatalogAsset } from "@/lib/api";

export function catalogMediaTitle(asset: GameCatalogAsset, locale: string) {
  const german = locale.toLowerCase().startsWith("de");
  return (german ? asset.label_de || asset.presentation?.label_de || asset.asset_type_de : undefined)
    || asset.label || asset.presentation?.label || asset.asset_type || asset.role || String(asset.media_id);
}

export function catalogMediaCaption(asset: GameCatalogAsset, locale: string) {
  return (locale.toLowerCase().startsWith("de") ? asset.comment_de || asset.image_text_de || asset.presentation?.description_de : undefined)
    || asset.comment || asset.image_text || asset.presentation?.description || "";
}

export function prepareCatalogMedia(assets: GameCatalogAsset[], primaryID: number | undefined, locale: string) {
  return [...assets].sort((left, right) => Number(right.media_id === primaryID) - Number(left.media_id === primaryID))
    .map((asset) => ({ ...asset, label: catalogMediaTitle(asset, locale) }));
}
