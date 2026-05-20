"use client";

import type { Attachment, Item, Vendor } from "@/lib/api";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { ModalSection, TWPSelect } from "@/components/item-create-ui";

export function ImageSection({
  t,
  imagePreview,
  pendingImage,
  sourceItem,
  getAttachmentPreviewUrl,
  setPendingImage,
  setImagePreview,
}: {
  t: (key: string) => string;
  imagePreview: string | null;
  pendingImage: File | null;
  sourceItem: Item | null;
  getAttachmentPreviewUrl: (attachment: Attachment) => string;
  setPendingImage: (file: File | null) => void;
  setImagePreview: (value: string | null) => void;
}) {
  return (
    <ModalSection title={t("items.image")} description={t("items.modalImageDescription")}>
      <div className="w-full space-y-4">
        {imagePreview ? (
          <div className="space-y-3">
            <img
              src={imagePreview}
              alt=""
              className="max-h-[28rem] w-full max-w-2xl rounded-lg object-contain outline outline-1 -outline-offset-1 outline-gray-300 dark:outline-white/10"
            />
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:inset-ring-white/5 dark:hover:bg-white/20">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setPendingImage(file);
                      setImagePreview(URL.createObjectURL(file));
                    }
                    e.target.value = "";
                  }}
                />
                {t("common.change")}
              </label>
              {pendingImage ? (
                <button
                  type="button"
                  onClick={() => {
                    setPendingImage(null);
                    if (sourceItem) {
                      const firstImage = (sourceItem.attachments || []).find((attachment) => {
                        const filename = attachment.filename?.toLowerCase() || "";
                        return attachment.gallery || /\.(jpg|jpeg|png|gif|webp|svg|bmp|heic|heif|avif|tiff?)$/i.test(filename);
                      });
                      setImagePreview(firstImage ? getAttachmentPreviewUrl(firstImage) : null);
                    } else {
                      setImagePreview(null);
                    }
                  }}
                  className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-gray-200 dark:inset-ring-white/5 dark:hover:bg-white/20"
                >
                  {t("common.remove")}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-300 px-6 py-10 dark:border-white/25">
            <div className="text-center">
              <PhotoIcon className="mx-auto size-12 text-gray-400 dark:text-gray-600" />
              <div className="mt-4 flex justify-center text-sm/6 text-gray-500 dark:text-gray-400">
                <label className="relative cursor-pointer rounded-md bg-transparent font-semibold text-indigo-600 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:focus-within:outline-indigo-500 dark:hover:text-indigo-300">
                  <span>{t("items.selectImage")}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPendingImage(file);
                        setImagePreview(URL.createObjectURL(file));
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="pl-1">{t("common.orDragDrop")}</p>
              </div>
              <p className="text-xs/5 text-gray-500 dark:text-gray-400">PNG, JPG, GIF up to 10MB</p>
            </div>
          </div>
        )}
      </div>
    </ModalSection>
  );
}

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
