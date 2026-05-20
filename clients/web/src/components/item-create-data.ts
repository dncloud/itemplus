import { api, type Attachment, type Category, type Item, type ItemComponent, type Location, type Property, type Vendor } from "@/lib/api";

export type ItemCreateReferenceData = {
  categories: Category[];
  locations: Location[];
  allProperties: Property[];
  manufacturers: Vendor[];
  suppliers: Vendor[];
  vendors: Vendor[];
  salesPlatforms: Vendor[];
  itemComponents: ItemComponent[];
};

export async function fetchItemCreateReferenceData(itemId?: number): Promise<ItemCreateReferenceData> {
  const [categories, locations, allProperties, manufacturers, suppliers, vendors, salesPlatforms, itemComponents] = await Promise.all([
    api.getCategories().catch(() => []),
    api.getLocations().catch(() => []),
    api.getProperties().catch(() => []),
    api.getManufacturers().catch(() => []),
    api.getSuppliers().catch(() => []),
    api.getVendors().catch(() => []),
    api.getSalesPlatforms().catch(() => []),
    api.getItemsLookup(itemId).catch(() => []),
  ]);

  return {
    categories,
    locations,
    allProperties,
    manufacturers,
    suppliers,
    vendors,
    salesPlatforms,
    itemComponents,
  };
}

export async function fetchEditItemData(itemId: number): Promise<Item> {
  return api.getItem(itemId);
}

export async function fetchCategoryProperties(categoryId: number): Promise<Property[]> {
  const properties = await api.getProperties(categoryId);
  return properties.sort((a, b) => a.position - b.position);
}

export function findFirstImageAttachment(attachments: Attachment[]): Attachment | null {
  return (
    attachments.find((attachment) => {
      const filename = attachment.filename?.toLowerCase() || "";
      return attachment.gallery || /\.(jpg|jpeg|png|gif|webp|svg|bmp|heic|heif|avif|tiff?)$/i.test(filename);
    }) || null
  );
}
