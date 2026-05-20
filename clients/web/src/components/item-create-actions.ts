import { api, type Item } from "@/lib/api";
import { collectPendingPropertyFiles } from "@/components/item-create-helpers";

export function applySuggestedItemField<K extends keyof Item>(
  item: Partial<Item>,
  suggestedItem: Partial<Item>,
  field: K,
) {
  const value = suggestedItem[field];
  if (typeof value === "undefined") {
    return { nextItem: item, nextSuggestedItem: suggestedItem, changed: false };
  }

  const nextSuggestedItem = { ...suggestedItem };
  delete nextSuggestedItem[field];

  return {
    nextItem: { ...item, [field]: value },
    nextSuggestedItem,
    changed: true,
  };
}

export function applySuggestedPropertyValue(
  propValues: Record<string, unknown>,
  suggestedPropValues: Record<string, unknown>,
  propertyId: string,
) {
  if (!(propertyId in suggestedPropValues)) {
    return { nextPropValues: propValues, nextSuggestedPropValues: suggestedPropValues, changed: false };
  }

  const nextSuggestedPropValues = { ...suggestedPropValues };
  delete nextSuggestedPropValues[propertyId];

  return {
    nextPropValues: { ...propValues, [propertyId]: suggestedPropValues[propertyId] },
    nextSuggestedPropValues,
    changed: true,
  };
}

export function applyAllSuggestedValues(
  item: Partial<Item>,
  propValues: Record<string, unknown>,
  suggestedItem: Partial<Item>,
  suggestedPropValues: Record<string, unknown>,
) {
  return {
    nextItem: { ...item, ...suggestedItem },
    nextPropValues: { ...propValues, ...suggestedPropValues },
  };
}

type PersistItemOptions = {
  isEditMode: boolean;
  itemId?: number;
  item: Partial<Item>;
  propValues: Record<string, unknown>;
  pendingImage: File | null;
};

export async function persistItemWithUploads(options: PersistItemOptions): Promise<number> {
  const { cleanProps, pendingFiles } = collectPendingPropertyFiles(options.propValues);
  const payload = {
    ...options.item,
    properties: Object.keys(cleanProps).length > 0 ? cleanProps : undefined,
  };

  const resolvedItemId =
    options.isEditMode && options.itemId
      ? await updateExistingItem(options.itemId, payload, options.pendingImage, pendingFiles)
      : await createNewItem(payload, options.pendingImage, pendingFiles);

  return resolvedItemId;
}

async function updateExistingItem(
  itemId: number,
  payload: Partial<Item>,
  pendingImage: File | null,
  pendingFiles: Array<{ propId: string; file: File }>,
) {
  await api.updateItem(itemId, payload);
  if (pendingImage) await api.uploadAttachment(itemId, pendingImage);
  for (const { propId, file } of pendingFiles) {
    await api.uploadPropertyFile(itemId, Number(propId), file);
  }
  return itemId;
}

async function createNewItem(
  payload: Partial<Item>,
  pendingImage: File | null,
  pendingFiles: Array<{ propId: string; file: File }>,
) {
  const created = await api.createItem(payload);
  if (pendingImage) await api.uploadAttachment(created.id, pendingImage);
  for (const { propId, file } of pendingFiles) {
    await api.uploadPropertyFile(created.id, Number(propId), file);
  }
  return created.id;
}
