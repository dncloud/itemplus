"use client";

import { SettingsAppSection } from "@/components/settings/app-section";
import { SettingsAISection } from "@/components/settings/ai-section";
import { SettingsBrandingSection } from "@/components/settings/branding-section";
import { SettingsPrinterSection } from "@/components/settings/printer-section";
import { SettingsStorageSection } from "@/components/settings/storage-section";
import { SettingsSystemSection } from "@/components/settings/system-section";
import { SettingsAccountSection } from "./settings-account-section";
import type { SettingsPageSectionsProps } from "./settings-page-types";

export function SettingsPageSections({
  activeSection,
  me,
  t,
  can,
  isAdmin,
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
  saveInventorySettings,
  maintenanceLeadDays,
  setMaintenanceLeadDays,
  maintenanceSettingsSaving,
  saveMaintenanceSettings,
  sidebarFavorites,
  setSidebarFavorites,
  sidebarFavoritesSaving,
  saveSidebarFavorites,
  localeOptions,
  titleDraft,
  titleSizeDraft,
  titlePositionDraft,
  subtitleDraft,
  footerTextDraft,
  widthDraft,
  logoBackgroundDraft,
  logoPaddingDraft,
  logoRadiusDraft,
  brandingStatus,
  logoInputRef,
  setTitleDraft,
  setTitleSizeDraft,
  setTitlePositionDraft,
  setSubtitleDraft,
  setFooterTextDraft,
  setWidthDraft,
  setLogoBackgroundDraft,
  setLogoPaddingDraft,
  setLogoRadiusDraft,
  setLogoDraft,
  setBrandingStatus,
  onLogoSelect,
  saveBranding,
  resetBranding,
  printMode,
  setPrintMode,
  showPrintFeatures,
  setShowPrintFeatures,
  printer,
  setPrinter,
  templateMeta,
  templates,
  selectedTemplateId,
  setSelectedTemplateId,
  templateDraft,
  setTemplateDraft,
  canManageTemplates,
  createNewTemplate,
  savePrinterConfig,
  calibratePrinter,
  saveTemplate,
  deleteTemplate,
  makeDefaultTemplate,
  printTemplateNow,
  loadDefaultTSPL,
  externalSources,
  selectedExternalSourceId,
  setSelectedExternalSourceId,
  externalSourceDraft,
  setExternalSourceDraft,
  selectedExternalSource,
  externalSourceBusy,
  createNewExternalSource,
  fetchExternalSourceHostKey,
  testExternalSource,
  saveExternalSource,
  deleteExternalSource,
  aiDraft,
  setAiDraft,
  selectedAIProfileId,
  setSelectedAIProfileId,
  aiTesting,
  aiModelsLoading,
  saveAISettings,
  testAISettings,
  loadAIModels,
  backupBusy,
  recoverFile,
  recoverInputRef,
  recoverSelection,
  setRecoverFile,
  setRecoverSelection,
  exportBackupBundle,
  recoverBackupBundle,
  checkLocations,
  locIssues,
  locFixing,
  fixLocations,
  accountInfoRows,
  accountPermissions,
  accountActiveCheckouts,
  accountDeleteDisabled,
  deleteAccountBusy,
  displayNameDraft,
  setDisplayNameDraft,
  avatarInputRef,
  saveAccount,
  uploadAccountAvatar,
  removeAccountAvatar,
  deleteAccount,
  settingsPrimaryButtonClass,
  settingsSecondaryButtonClass,
  settingsDangerButtonClass,
  settingsInputClass,
  settingsMonoTextareaClass,
}: SettingsPageSectionsProps) {
  return (
    <>
      {me && activeSection === "account" ? (
        <SettingsAccountSection
          t={t}
          me={me}
          avatarInputRef={avatarInputRef}
          displayNameDraft={displayNameDraft}
          setDisplayNameDraft={setDisplayNameDraft}
          saveAccount={() => { void saveAccount(); }}
          uploadAccountAvatar={uploadAccountAvatar}
          removeAccountAvatar={removeAccountAvatar}
          accountInfoRows={accountInfoRows}
          accountPermissions={accountPermissions}
          accountActiveCheckouts={accountActiveCheckouts}
          accountDeleteDisabled={accountDeleteDisabled}
          deleteAccountBusy={deleteAccountBusy}
          deleteAccount={deleteAccount}
          settingsInputClass={settingsInputClass}
          settingsPrimaryButtonClass={settingsPrimaryButtonClass}
          settingsSecondaryButtonClass={settingsSecondaryButtonClass}
          settingsDangerButtonClass={settingsDangerButtonClass}
        />
      ) : null}

      {activeSection === "app" && (
        <>
          <SettingsAppSection
            t={t}
            isAdmin={isAdmin}
            can={can}
            locale={locale}
            setLocale={setLocale}
            dateFormat={dateFormat}
            setDateFormat={setDateFormat}
            itemsPerPage={itemsPerPage}
            setItemsPerPage={setItemsPerPage}
            iosDeleteConfirm={iosDeleteConfirm}
            setIosDeleteConfirm={setIosDeleteConfirm}
            showItemImages={showItemImages}
            setShowItemImages={setShowItemImages}
            showItemPlaceholders={showItemPlaceholders}
            setShowItemPlaceholders={setShowItemPlaceholders}
            showItemCategory={showItemCategory}
            setShowItemCategory={setShowItemCategory}
            showItemLocation={showItemLocation}
            setShowItemLocation={setShowItemLocation}
            showItemDescription={showItemDescription}
            setShowItemDescription={setShowItemDescription}
            showItemStock={showItemStock}
            setShowItemStock={setShowItemStock}
            showItemConsumable={showItemConsumable}
            setShowItemConsumable={setShowItemConsumable}
            showItemPrice={showItemPrice}
            setShowItemPrice={setShowItemPrice}
            showItemTotal={showItemTotal}
            setShowItemTotal={setShowItemTotal}
            showItemProperties={showItemProperties}
            setShowItemProperties={setShowItemProperties}
            showItemActivity={showItemActivity}
            setShowItemActivity={setShowItemActivity}
            showAttachmentUploadOnItemDetail={showAttachmentUploadOnItemDetail}
            setShowAttachmentUploadOnItemDetail={setShowAttachmentUploadOnItemDetail}
            itemStockWarningPercent={itemStockWarningPercent}
            setItemStockWarningPercent={setItemStockWarningPercent}
            itemStockCriticalPercent={itemStockCriticalPercent}
            setItemStockCriticalPercent={setItemStockCriticalPercent}
            inventoryCheckoutAffectsMovementQuantity={inventoryCheckoutAffectsMovementQuantity}
            setInventoryCheckoutAffectsMovementQuantity={setInventoryCheckoutAffectsMovementQuantity}
            inventorySettingsSaving={inventorySettingsSaving}
            onSaveInventorySettings={isAdmin ? () => { void saveInventorySettings(); } : undefined}
            maintenanceLeadDays={isAdmin ? maintenanceLeadDays : undefined}
            setMaintenanceLeadDays={isAdmin ? setMaintenanceLeadDays : undefined}
            maintenanceSettingsSaving={maintenanceSettingsSaving}
            onSaveMaintenanceSettings={isAdmin ? () => { void saveMaintenanceSettings(); } : undefined}
            sidebarFavorites={sidebarFavorites}
            setSidebarFavorites={setSidebarFavorites}
            sidebarFavoritesSaving={sidebarFavoritesSaving}
            onSaveSidebarFavorites={() => { void saveSidebarFavorites(); }}
            localeOptions={localeOptions}
          />
          {isAdmin ? (
            <SettingsBrandingSection
              t={t}
              titleDraft={titleDraft}
              titleSizeDraft={titleSizeDraft}
              titlePositionDraft={titlePositionDraft}
              subtitleDraft={subtitleDraft}
              footerTextDraft={footerTextDraft}
              widthDraft={widthDraft}
              logoBackgroundDraft={logoBackgroundDraft}
              logoPaddingDraft={logoPaddingDraft}
              logoRadiusDraft={logoRadiusDraft}
              brandingStatus={brandingStatus}
              logoInputRef={logoInputRef}
              setTitleDraft={setTitleDraft}
              setTitleSizeDraft={setTitleSizeDraft}
              setTitlePositionDraft={setTitlePositionDraft}
              setSubtitleDraft={setSubtitleDraft}
              setFooterTextDraft={setFooterTextDraft}
              setWidthDraft={setWidthDraft}
              setLogoBackgroundDraft={setLogoBackgroundDraft}
              setLogoPaddingDraft={setLogoPaddingDraft}
              setLogoRadiusDraft={setLogoRadiusDraft}
              setLogoDraft={setLogoDraft}
              setBrandingStatus={setBrandingStatus}
              onLogoSelect={onLogoSelect}
              saveBranding={() => { void saveBranding(); }}
              resetBranding={resetBranding}
              primaryButtonClass={settingsPrimaryButtonClass}
              secondaryButtonClass={settingsSecondaryButtonClass}
            />
          ) : null}
        </>
      )}

      {(can("print") || isAdmin) && activeSection === "printer" && (
        <SettingsPrinterSection
          t={t}
          isAdmin={isAdmin}
          printMode={printMode}
          setPrintMode={setPrintMode}
          showPrintFeatures={showPrintFeatures}
          setShowPrintFeatures={setShowPrintFeatures}
          printer={printer}
          setPrinter={setPrinter}
          templateMeta={templateMeta}
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          setSelectedTemplateId={setSelectedTemplateId}
          templateDraft={templateDraft}
          setTemplateDraft={setTemplateDraft}
          canManageTemplates={canManageTemplates}
          createNewTemplate={createNewTemplate}
          savePrinterConfig={savePrinterConfig}
          calibratePrinter={calibratePrinter}
          saveTemplate={saveTemplate}
          deleteTemplate={deleteTemplate}
          makeDefaultTemplate={makeDefaultTemplate}
          printTemplateNow={printTemplateNow}
          loadDefaultTSPL={loadDefaultTSPL}
          primaryButtonClass={settingsPrimaryButtonClass}
          secondaryButtonClass={settingsSecondaryButtonClass}
          dangerButtonClass={settingsDangerButtonClass}
          inputClass={settingsInputClass}
          monoTextareaClass={settingsMonoTextareaClass}
        />
      )}

      {isAdmin && activeSection === "storage" && (
        <SettingsStorageSection
          t={t}
          externalSources={externalSources}
          selectedExternalSourceId={selectedExternalSourceId}
          setSelectedExternalSourceId={setSelectedExternalSourceId}
          externalSourceDraft={externalSourceDraft}
          setExternalSourceDraft={setExternalSourceDraft}
          selectedExternalSource={selectedExternalSource}
          externalSourceBusy={externalSourceBusy}
          createNewExternalSource={createNewExternalSource}
          fetchExternalSourceHostKey={fetchExternalSourceHostKey}
          testExternalSource={testExternalSource}
          saveExternalSource={saveExternalSource}
          deleteExternalSource={deleteExternalSource}
          inputClass={settingsInputClass}
          monoTextareaClass={settingsMonoTextareaClass}
          secondaryButtonClass={settingsSecondaryButtonClass}
          dangerButtonClass={settingsDangerButtonClass}
        />
      )}

      {isAdmin && activeSection === "ai" && (
        <SettingsAISection
          t={t}
          aiDraft={aiDraft}
          setAiDraft={setAiDraft}
          selectedProfileId={selectedAIProfileId}
          setSelectedProfileId={setSelectedAIProfileId}
          aiTesting={aiTesting}
          aiModelsLoading={aiModelsLoading}
          saveAISettings={() => { void saveAISettings(); }}
          testAISettings={() => { void testAISettings(); }}
          loadAIModels={loadAIModels}
          inputClass={settingsInputClass}
          primaryButtonClass={settingsPrimaryButtonClass}
          secondaryButtonClass={settingsSecondaryButtonClass}
        />
      )}

      {isAdmin && activeSection === "backup" && (
        <SettingsSystemSection
          t={t}
          backupBusy={backupBusy}
          recoverFile={recoverFile}
          recoverInputRef={recoverInputRef}
          recoverSelection={recoverSelection}
          setRecoverFile={setRecoverFile}
          setRecoverSelection={setRecoverSelection}
          exportBackupBundle={() => { void exportBackupBundle(); }}
          recoverBackupBundle={() => { void recoverBackupBundle(); }}
          checkLocations={() => { void checkLocations(); }}
          locIssues={locIssues}
          locFixing={locFixing}
          fixLocations={() => { void fixLocations(); }}
          primaryButtonClass={settingsPrimaryButtonClass}
          secondaryButtonClass={settingsSecondaryButtonClass}
          dangerButtonClass={settingsDangerButtonClass}
        />
      )}
    </>
  );
}
