"use client";

import type { Category, Item, Vendor } from "@/lib/api";
import { isMasterDataRoleVisible } from "@/lib/category-master-data";
import { ModalSection, TWPSelect } from "@/components/item-create/ui";

export function VendorsSection({
  t,
  editItem,
  manufacturers,
  suppliers,
  vendors,
  developers,
  publishers,
  salesPlatforms,
  category,
  setEditItem,
}: {
  t: (key: string) => string;
  editItem: Partial<Item>;
  manufacturers: Vendor[];
  suppliers: Vendor[];
  vendors: Vendor[];
  developers: Vendor[];
  publishers: Vendor[];
  salesPlatforms: Vendor[];
  category?: Category;
  setEditItem: (value: Partial<Item>) => void;
}) {
  const itemStatus = editItem.item_status || "active";
  const showManufacturer = isMasterDataRoleVisible(category, "manufacturer");
  const showSupplier = isMasterDataRoleVisible(category, "supplier");
  const showVendor = isMasterDataRoleVisible(category, "vendor");
  const showDeveloper = isMasterDataRoleVisible(category, "developer");
  const showPublisher = isMasterDataRoleVisible(category, "publisher");

  return (
    <ModalSection id="item-vendors" title={t("items.modalVendorsTitle")} description={t("items.modalVendorsDescription")}>
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {showManufacturer ? <TWPSelect
          label={t("items.manufacturer")}
          value={editItem.manufacturer_id}
          onChange={(v) => setEditItem({ ...editItem, manufacturer_id: v })}
          options={manufacturers.map((m) => ({
            id: m.id,
            name: m.name,
            logo: m.logo,
            logoBackground: m.logo_background,
          }))}
        /> : null}
        {showSupplier ? <TWPSelect
          label={t("items.supplier")}
          value={editItem.supplier_id}
          onChange={(v) => setEditItem({ ...editItem, supplier_id: v })}
          options={suppliers.map((s) => ({
            id: s.id,
            name: s.name,
            logo: s.logo,
            logoBackground: s.logo_background,
          }))}
        /> : null}
        {showVendor ? <TWPSelect
          label={t("items.vendor")}
          value={editItem.vendor_id}
          onChange={(v) => setEditItem({ ...editItem, vendor_id: v })}
          options={vendors.map((vendor) => ({
            id: vendor.id,
            name: vendor.name,
            logo: vendor.logo,
            logoBackground: vendor.logo_background,
          }))}
        /> : null}
        {showDeveloper ? <TWPSelect
          label={t("items.developer")}
          value={editItem.developer_id}
          onChange={(v) => setEditItem({ ...editItem, developer_id: v })}
          options={developers.map((developer) => ({ id: developer.id, name: developer.name, logo: developer.logo, logoBackground: developer.logo_background }))}
        /> : null}
        {showPublisher ? <TWPSelect
          label={t("items.publisher")}
          value={editItem.publisher_id}
          onChange={(v) => setEditItem({ ...editItem, publisher_id: v })}
          options={publishers.map((publisher) => ({ id: publisher.id, name: publisher.name, logo: publisher.logo, logoBackground: publisher.logo_background }))}
        /> : null}
        <TWPSelect
          label={t("items.salesPlatform")}
          value={editItem.salesPlatformId}
          onChange={(v) => setEditItem({ ...editItem, salesPlatformId: v || undefined })}
          disabled={itemStatus !== "for_sale"}
          options={salesPlatforms.map((platform) => ({
            id: platform.id,
            name: platform.name,
            logo: platform.logo,
            logoBackground: platform.logo_background,
          }))}
        />
      </div>
    </ModalSection>
  );
}
