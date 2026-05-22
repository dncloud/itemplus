"use client";

import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { SelectField, SettingsCard, ToggleRow } from "@/components/settings-ui";

export function SettingsAppSection({
  t,
  locale,
  setLocale,
  dateFormat,
  setDateFormat,
  itemsPerPage,
  setItemsPerPage,
  iosDeleteConfirm,
  setIosDeleteConfirm,
  showItemImages,
  setShowItemImages,
  showItemPlaceholders,
  setShowItemPlaceholders,
  showItemCategory,
  setShowItemCategory,
  showItemLocation,
  setShowItemLocation,
  showItemDescription,
  setShowItemDescription,
  showItemStock,
  setShowItemStock,
  showItemConsumable,
  setShowItemConsumable,
  showItemPrice,
  setShowItemPrice,
  showItemTotal,
  setShowItemTotal,
  showItemProperties,
  setShowItemProperties,
  showItemActivity,
  setShowItemActivity,
  showAttachmentUploadOnItemDetail,
  setShowAttachmentUploadOnItemDetail,
  itemStockWarningPercent,
  setItemStockWarningPercent,
  itemStockCriticalPercent,
  setItemStockCriticalPercent,
  localeOptions,
}: {
  t: (key: string) => string;
  locale: string;
  setLocale: (value: string) => void;
  dateFormat: "DD.MM.YYYY" | "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  setDateFormat: (value: "DD.MM.YYYY" | "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD") => void;
  itemsPerPage: number;
  setItemsPerPage: (value: number) => void;
  iosDeleteConfirm: boolean;
  setIosDeleteConfirm: (value: boolean) => void;
  showItemImages: boolean;
  setShowItemImages: (value: boolean) => void;
  showItemPlaceholders: boolean;
  setShowItemPlaceholders: (value: boolean) => void;
  showItemCategory: boolean;
  setShowItemCategory: (value: boolean) => void;
  showItemLocation: boolean;
  setShowItemLocation: (value: boolean) => void;
  showItemDescription: boolean;
  setShowItemDescription: (value: boolean) => void;
  showItemStock: boolean;
  setShowItemStock: (value: boolean) => void;
  showItemConsumable: boolean;
  setShowItemConsumable: (value: boolean) => void;
  showItemPrice: boolean;
  setShowItemPrice: (value: boolean) => void;
  showItemTotal: boolean;
  setShowItemTotal: (value: boolean) => void;
  showItemProperties: boolean;
  setShowItemProperties: (value: boolean) => void;
  showItemActivity: boolean;
  setShowItemActivity: (value: boolean) => void;
  showAttachmentUploadOnItemDetail: boolean;
  setShowAttachmentUploadOnItemDetail: (value: boolean) => void;
  itemStockWarningPercent: number;
  setItemStockWarningPercent: (value: number) => void;
  itemStockCriticalPercent: number;
  setItemStockCriticalPercent: (value: number) => void;
  localeOptions: { value: string; label: string }[];
}) {
  const itemFieldToggles = [
    { title: t("settings.itemFieldCategory"), checked: showItemCategory, onToggle: () => setShowItemCategory(!showItemCategory) },
    { title: t("settings.itemFieldLocation"), checked: showItemLocation, onToggle: () => setShowItemLocation(!showItemLocation) },
    { title: t("settings.itemFieldDescription"), checked: showItemDescription, onToggle: () => setShowItemDescription(!showItemDescription) },
    { title: t("settings.itemFieldStock"), checked: showItemStock, onToggle: () => setShowItemStock(!showItemStock) },
    { title: t("settings.itemFieldConsumable"), checked: showItemConsumable, onToggle: () => setShowItemConsumable(!showItemConsumable) },
    { title: t("settings.itemFieldPrice"), checked: showItemPrice, onToggle: () => setShowItemPrice(!showItemPrice) },
    { title: t("settings.itemFieldTotal"), checked: showItemTotal, onToggle: () => setShowItemTotal(!showItemTotal) },
    { title: t("settings.itemFieldProperties"), checked: showItemProperties, onToggle: () => setShowItemProperties(!showItemProperties) },
    { title: t("settings.itemFieldActivity"), checked: showItemActivity, onToggle: () => setShowItemActivity(!showItemActivity) },
  ];

  const percentOptions = Array.from({ length: 21 }, (_, index) => {
    const value = index * 5;
    return { value, label: `${value}%` };
  });

  return (
    <SettingsCard
      sectionId="app"
      icon={Cog6ToothIcon}
      title={t("settings.sectionApp")}
      description={t("settings.appDescription")}
    >
      <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <SelectField
            label={t("settings.language")}
            value={locale}
            onChange={(value) => setLocale(value as string)}
            options={localeOptions}
            hint={t("settings.languageHint")}
          />
        </div>
        <div className="sm:col-span-2">
          <SelectField
            label={t("settings.dateFormat")}
            value={dateFormat}
            onChange={(value) => setDateFormat(value as typeof dateFormat)}
            options={(["DD.MM.YYYY", "MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"] as const).map((fmt) => ({ value: fmt, label: fmt }))}
            hint={t("settings.dateFormatHint")}
          />
        </div>
        <div className="sm:col-span-2">
          <SelectField
            label={t("settings.itemsPerPage")}
            value={itemsPerPage}
            onChange={(value) => setItemsPerPage(Number(value) || 24)}
            options={[12, 24, 48, 96].map((count) => ({ value: count, label: count }))}
            hint={t("settings.itemsPerPageHint")}
          />
        </div>
      </div>

      <ToggleRow
        title={t("settings.iosDeleteConfirm")}
        description={t("settings.iosDeleteConfirmHint")}
        checked={iosDeleteConfirm}
        onToggle={() => setIosDeleteConfirm(!iosDeleteConfirm)}
      />

      <ToggleRow
        title={t("settings.itemListImages")}
        description={t("settings.itemListImagesHint")}
        checked={showItemImages}
        onToggle={() => setShowItemImages(!showItemImages)}
      />

      <ToggleRow
        title={t("settings.itemListPlaceholders")}
        description={t("settings.itemListPlaceholdersHint")}
        checked={showItemPlaceholders}
        onToggle={() => setShowItemPlaceholders(!showItemPlaceholders)}
      />

      <ToggleRow
        title={t("settings.showAttachmentUploadOnItemDetail")}
        description={t("settings.showAttachmentUploadOnItemDetailHint")}
        checked={showAttachmentUploadOnItemDetail}
        onToggle={() => setShowAttachmentUploadOnItemDetail(!showAttachmentUploadOnItemDetail)}
      />

      <div className="space-y-3 pt-2">
        <p className="text-sm font-medium">{t("settings.itemListFields")}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("settings.itemListFieldsHint")}</p>
        <div className="mt-3 grid max-w-2xl grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-6">
          {itemFieldToggles.map((toggle) => (
            <div key={String(toggle.title)} className="sm:col-span-3">
              <ToggleRow title={toggle.title} checked={toggle.checked} onToggle={toggle.onToggle} />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 border-t border-gray-200 pt-6 dark:border-white/10">
        <p className="text-sm font-medium">{t("settings.itemStockColorThresholds")}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("settings.itemStockColorThresholdsHint")}</p>
        <div className="mt-3 grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <SelectField
              label={t("settings.itemStockWarningPercent")}
              value={itemStockWarningPercent}
              onChange={(value) => setItemStockWarningPercent(Number(value) || 0)}
              options={percentOptions}
            />
          </div>
          <div className="sm:col-span-3">
            <SelectField
              label={t("settings.itemStockCriticalPercent")}
              value={itemStockCriticalPercent}
              onChange={(value) => setItemStockCriticalPercent(Number(value) || 0)}
              options={percentOptions}
            />
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}
