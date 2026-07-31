"use client";

import {
  ArrowLeftRight,
  Building2,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Settings,
  Box,
  House,
  MapPin,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { SelectField, ToggleRow } from "@/components/settings/ui";
import type { SidebarFavorite } from "@/lib/api";
import type { DateFormat } from "@/lib/app-context-storage";
import type { Locale } from "@/lib/i18n-data";

function AppSettingsSection({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[16rem_minmax(0,1fr)]">
      <div>
        <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">{title}</h2>
        {description ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p> : null}
      </div>
      <div className="rounded-xl bg-white px-4 py-6 outline outline-1 -outline-offset-1 outline-gray-200 sm:p-8 dark:bg-gray-800/50 dark:outline-white/10">
        {children}
      </div>
    </section>
  );
}

export function SettingsAppSection({
  t,
  isAdmin,
  can,
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
  inventoryCheckoutAffectsMovementQuantity,
  setInventoryCheckoutAffectsMovementQuantity,
  inventorySettingsSaving,
  onSaveInventorySettings,
  maintenanceLeadDays,
  setMaintenanceLeadDays,
  maintenanceSettingsSaving,
  onSaveMaintenanceSettings,
  sidebarFavorites,
  setSidebarFavorites,
  sidebarFavoritesSaving,
  onSaveSidebarFavorites,
  localeOptions,
}: {
  t: (key: string) => string;
  isAdmin: boolean;
  can: (perm: string) => boolean;
  locale: Locale;
  setLocale: (value: Locale) => void;
  dateFormat: DateFormat;
  setDateFormat: (value: DateFormat) => void;
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
  inventoryCheckoutAffectsMovementQuantity?: boolean;
  setInventoryCheckoutAffectsMovementQuantity?: (value: boolean) => void;
  inventorySettingsSaving?: boolean;
  onSaveInventorySettings?: () => void;
  maintenanceLeadDays?: number;
  setMaintenanceLeadDays?: (value: number) => void;
  maintenanceSettingsSaving?: boolean;
  onSaveMaintenanceSettings?: () => void;
  sidebarFavorites: SidebarFavorite[];
  setSidebarFavorites: (value: SidebarFavorite[]) => void;
  sidebarFavoritesSaving?: boolean;
  onSaveSidebarFavorites: () => void;
  localeOptions: { value: Locale; label: string }[];
}) {
  const defaultSidebarFavorites: SidebarFavorite[] = isAdmin || can("items.read")
    ? [{ id: "items", label: "Items", icon: "items", href: "/items" }]
    : [{ id: "dashboard", label: t("nav.dashboard"), icon: "dashboard", href: "/dashboard" }];

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

  const maintenanceLeadValues = [0, 1, 2, 3, 7, 14, 30, 60, 90];
  if (maintenanceLeadDays !== undefined && !maintenanceLeadValues.includes(maintenanceLeadDays)) {
    maintenanceLeadValues.push(maintenanceLeadDays);
    maintenanceLeadValues.sort((a, b) => a - b);
  }
  const maintenanceLeadOptions = maintenanceLeadValues.map((days) => ({
    value: days,
    label: days === 0 ? t("settings.maintenanceLeadSameDay") : t("settings.maintenanceLeadDaysOption").replace("{days}", String(days)),
  }));

  const favoriteTargetOptions = [
    { value: "/dashboard", label: t("nav.dashboard") },
    ...(isAdmin || can("items.read") ? [{ value: "/items", label: t("nav.items") }] : []),
    ...(isAdmin || can("items.write") ? [{ value: "/items/new", label: t("items.new") }] : []),
    ...(isAdmin || can("categories.read") ? [{ value: "/categories", label: t("nav.categories") }] : []),
    ...(isAdmin || can("locations.read") ? [{ value: "/locations", label: t("nav.locations") }] : []),
    ...(isAdmin || can("vendors.read") ? [{ value: "/vendors", label: t("nav.vendors") }] : []),
    ...(isAdmin || can("inventory.read") ? [{ value: "/inventory-checks", label: t("nav.inventoryChecks") }] : []),
    ...(isAdmin || can("inventory.read") ? [{ value: "/inventory-movements", label: t("nav.inventoryMovements") }] : []),
    ...(isAdmin || can("maintenance.read") ? [{ value: "/maintenance", label: t("nav.maintenance") }] : []),
    ...(isAdmin || can("checkout.manage") ? [{ value: "/checkouts", label: t("nav.checkouts") }] : []),
    ...(isAdmin ? [{ value: "/chat", label: t("nav.chat") }] : []),
    ...(isAdmin ? [{ value: "/ai-usage", label: t("nav.aiUsage") }] : []),
    ...(isAdmin ? [{ value: "/users", label: t("nav.users") }] : []),
    { value: "/settings", label: t("nav.settings") },
  ];

  const favoriteIconDefinitions = [
    { value: "dashboard", label: t("settings.sidebarFavoriteIconDashboard"), icon: House },
    { value: "items", label: t("settings.sidebarFavoriteIconItems"), icon: Box },
    { value: "plus", label: t("settings.sidebarFavoriteIconPlus"), icon: Plus },
    { value: "categories", label: t("settings.sidebarFavoriteIconCategories"), icon: Tag },
    { value: "locations", label: t("settings.sidebarFavoriteIconLocations"), icon: MapPin },
    { value: "vendors", label: t("settings.sidebarFavoriteIconVendors"), icon: Building2 },
    { value: "movements", label: t("settings.sidebarFavoriteIconMovements"), icon: ClipboardList },
    { value: "maintenance", label: t("settings.sidebarFavoriteIconMaintenance"), icon: CalendarDays },
    { value: "checkouts", label: t("settings.sidebarFavoriteIconCheckouts"), icon: ArrowLeftRight },
    { value: "chat", label: t("settings.sidebarFavoriteIconChat"), icon: Sparkles },
    { value: "ai", label: t("settings.sidebarFavoriteIconAI"), icon: BarChart3 },
    { value: "users", label: t("settings.sidebarFavoriteIconUsers"), icon: Users },
    { value: "settings", label: t("settings.sidebarFavoriteIconSettings"), icon: Settings },
  ];

  const favoriteIconOptions = favoriteIconDefinitions.map((option) => ({
    value: option.value,
    label: (
      <span className="flex items-center gap-2">
        <option.icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <span>{option.label}</span>
      </span>
    ),
  }));

  const addSidebarFavorite = () => {
    if (sidebarFavorites.length >= 16) return;
    setSidebarFavorites([
      ...sidebarFavorites,
      { id: `favorite-${Date.now()}`, label: "", icon: "dashboard", href: "/dashboard" },
    ]);
  };

  const updateSidebarFavorite = (index: number, patch: Partial<SidebarFavorite>) => {
    setSidebarFavorites(
      sidebarFavorites.map((favorite, currentIndex) => (currentIndex === index ? { ...favorite, ...patch } : favorite)),
    );
  };

  const removeSidebarFavorite = (index: number) => {
    setSidebarFavorites(sidebarFavorites.filter((_, currentIndex) => currentIndex !== index));
  };

  const resetSidebarFavorites = () => {
    setSidebarFavorites(defaultSidebarFavorites);
  };

  const inputClass =
    "h-[38px] w-full rounded-md bg-white px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 transition focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:focus:outline-indigo-500";

  const secondaryButtonClass =
    "inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:inset-ring-white/5 dark:hover:bg-white/20";

  const primaryButtonClass =
    "inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="space-y-10">
      <AppSettingsSection id="app" title={t("settings.sectionApp")} description={t("settings.appDescription")}>
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <SelectField
              label={t("settings.language")}
              value={locale}
              onChange={(value) => setLocale(value as Locale)}
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
      </AppSettingsSection>

      <AppSettingsSection title={t("settings.itemListImages")} description={t("settings.itemListImagesHint")}>
        <div className="space-y-4">
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
        </div>
      </AppSettingsSection>

      <AppSettingsSection title={t("settings.itemListFields")} description={t("settings.itemListFieldsHint")}>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {itemFieldToggles.map((toggle) => (
            <div key={String(toggle.title)}>
              <ToggleRow title={toggle.title} checked={toggle.checked} onToggle={toggle.onToggle} />
            </div>
          ))}
        </div>
      </AppSettingsSection>

      <AppSettingsSection title={t("settings.itemStockColorThresholds")} description={t("settings.itemStockColorThresholdsHint")}>
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
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
      </AppSettingsSection>

      {inventoryCheckoutAffectsMovementQuantity !== undefined && setInventoryCheckoutAffectsMovementQuantity && onSaveInventorySettings ? (
        <AppSettingsSection title={t("settings.inventoryCheckoutMovementTitle")} description={t("settings.inventoryCheckoutMovementHint")}>
          <div className="space-y-4">
            <ToggleRow
              title={t("settings.inventoryCheckoutMovementToggle")}
              description={t("settings.inventoryCheckoutMovementToggleHint")}
              checked={inventoryCheckoutAffectsMovementQuantity}
              onToggle={() => setInventoryCheckoutAffectsMovementQuantity(!inventoryCheckoutAffectsMovementQuantity)}
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onSaveInventorySettings}
                disabled={inventorySettingsSaving}
                className={primaryButtonClass}
              >
                {inventorySettingsSaving ? t("settings.saving") : t("common.save")}
              </button>
            </div>
          </div>
        </AppSettingsSection>
      ) : null}

      {maintenanceLeadDays !== undefined && setMaintenanceLeadDays && onSaveMaintenanceSettings ? (
        <AppSettingsSection title={t("settings.maintenanceReminderLeadTitle")} description={t("settings.maintenanceReminderLeadHint")}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <SelectField
                label={t("settings.maintenanceReminderLeadLabel")}
                value={maintenanceLeadDays}
                onChange={(value) => setMaintenanceLeadDays(Number(value) || 0)}
                options={maintenanceLeadOptions}
              />
            </div>
            <div className="flex items-end gap-3 sm:col-span-3">
              <button
                type="button"
                onClick={onSaveMaintenanceSettings}
                disabled={maintenanceSettingsSaving}
                className={primaryButtonClass}
              >
                {maintenanceSettingsSaving ? t("settings.saving") : t("common.save")}
              </button>
            </div>
          </div>
        </AppSettingsSection>
      ) : null}

      <AppSettingsSection title={t("settings.sidebarFavoritesTitle")} description={t("settings.sidebarFavoritesHint")}>
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={addSidebarFavorite}
                disabled={sidebarFavorites.length >= 16}
                className={secondaryButtonClass}
              >
                {t("settings.sidebarFavoriteAdd")}
              </button>
              <button
                type="button"
                onClick={resetSidebarFavorites}
                className={secondaryButtonClass}
              >
                {t("settings.sidebarFavoritesReset")}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {sidebarFavorites.map((favorite, index) => (
              <div
                key={favorite.id}
                className={index === 0 ? "space-y-4" : "space-y-4 border-t border-gray-200 pt-6 dark:border-white/10"}
              >
                <label className="space-y-1">
                  <span className="text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.sidebarFavoriteLabel")}</span>
                  <input
                    value={favorite.label}
                    onChange={(event) => updateSidebarFavorite(index, { label: event.target.value })}
                    className={inputClass}
                  />
                </label>

                <div className="grid grid-cols-1 gap-4 pt-3 sm:grid-cols-2">
                  <div>
                    <SelectField
                      label={t("settings.sidebarFavoriteTarget")}
                      value={favorite.href}
                      onChange={(value) => updateSidebarFavorite(index, { href: String(value) })}
                      options={favoriteTargetOptions}
                    />
                  </div>

                  <div>
                    <SelectField
                      label={t("settings.sidebarFavoriteIcon")}
                      value={favorite.icon}
                      onChange={(value) => updateSidebarFavorite(index, { icon: String(value) })}
                      options={favoriteIconOptions}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeSidebarFavorite(index)}
                    className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-md bg-white text-red-600 shadow-xs inset-ring inset-ring-red-200 transition hover:bg-red-50 dark:bg-red-500/10 dark:text-red-300 dark:inset-ring-red-500/20 dark:hover:bg-red-500/20"
                    title={t("common.remove")}
                    aria-label={t("common.remove")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onSaveSidebarFavorites}
              disabled={sidebarFavoritesSaving}
              className={primaryButtonClass}
            >
              {sidebarFavoritesSaving ? t("settings.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </AppSettingsSection>
    </div>
  );
}
