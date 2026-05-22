"use client";

import type { Item, Vendor } from "@/lib/api";
import { ModalSection, TWPSelect } from "@/components/item-create-ui";

export function VendorsSection({
  t,
  editItem,
  manufacturers,
  suppliers,
  vendors,
  salesPlatforms,
  setEditItem,
}: {
  t: (key: string) => string;
  editItem: Partial<Item>;
  manufacturers: Vendor[];
  suppliers: Vendor[];
  vendors: Vendor[];
  salesPlatforms: Vendor[];
  setEditItem: (value: Partial<Item>) => void;
}) {
  const itemStatus = editItem.item_status || "active";

  return (
    <ModalSection title={t("items.modalVendorsTitle")} description={t("items.modalVendorsDescription")}>
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TWPSelect
          label={t("items.manufacturer")}
          value={editItem.manufacturer_id}
          onChange={(v) => setEditItem({ ...editItem, manufacturer_id: v })}
          options={manufacturers.map((m) => ({ id: m.id, name: m.name }))}
        />
        <TWPSelect
          label={t("items.supplier")}
          value={editItem.supplier_id}
          onChange={(v) => setEditItem({ ...editItem, supplier_id: v })}
          options={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        />
        <TWPSelect
          label={t("items.vendor")}
          value={editItem.vendor_id}
          onChange={(v) => setEditItem({ ...editItem, vendor_id: v })}
          options={vendors.map((vendor) => ({ id: vendor.id, name: vendor.name }))}
        />
        <TWPSelect
          label={t("items.salesPlatform")}
          value={editItem.salesPlatformId}
          onChange={(v) => setEditItem({ ...editItem, salesPlatformId: v || undefined })}
          disabled={itemStatus !== "for_sale"}
          options={salesPlatforms.map((platform) => ({ id: platform.id, name: platform.name }))}
        />
      </div>
    </ModalSection>
  );
}
