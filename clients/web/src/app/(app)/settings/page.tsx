"use client";

import { useEffect, useRef, useState } from "react";
import {
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { useApp } from "@/lib/app-context";
import { api, type ExternalSource, type LabelTemplate, type LabelTemplateMeta, type PrinterStatus, type User } from "@/lib/api";
import { SettingsAppSection } from "@/components/settings-app-section";
import { SettingsAISection } from "@/components/settings-ai-section";
import { SettingsBrandingSection } from "@/components/settings-branding-section";
import { SettingsDevicesSection } from "@/components/settings-devices-section";
import { SettingsCard, StatusMessage } from "@/components/settings-ui";
import { SettingsPrinterSection } from "@/components/settings-printer-section";
import { SettingsStorageSection } from "@/components/settings-storage-section";
import { SettingsSystemSection } from "@/components/settings-system-section";
import { SettingsPageHeader, SettingsSectionsNav } from "@/components/settings-sections-nav";
import {
  createEmptyAIDraft,
  createEmptyExternalSourceDraft,
  createEmptyTemplateDraft,
  createProviderDraft,
  defaultAIBaseURL,
  defaultAIModel,
  draftFromExternalSource,
  draftFromAISettings,
  draftFromTemplate,
  isAIKeyOptional,
  type AISettingsDraft,
  type ExternalSourceDraft,
  type LabelTemplateDraft,
} from "@/components/settings-drafts";
import { LOCALES } from "@/lib/i18n";
import {
  buildSettingsSections,
  settingsDangerButtonClass,
  settingsInputClass,
  settingsMonoTextareaClass,
  settingsPrimaryButtonClass,
  settingsSecondaryButtonClass,
} from "./settings-page-meta";
import { flashStatus, messageFromError } from "./settings-page-status";
import {
  fetchExternalSourceList,
  fetchInitialSettingsData,
  fetchTemplateList,
  type DeviceSession,
} from "./settings-page-utils";
import {
  buildBrandingPayload,
  calibratePrinter,
  deleteExternalSourceDraft,
  deleteTemplateDraft,
  exportBackupBundleBlob,
  fetchDefaultTSPLPreview,
  fetchExternalSourceHostKeyDraft,
  fetchLocationHealth,
  fixLocationHealth,
  makeTemplateDefault,
  printTemplateNow,
  recoverBackupBundleFile,
  resetBrandingSettings,
  saveAISettingsDraft,
  saveExternalSourceDraft,
  savePrinterConfig,
  saveTemplateDraft,
  testAISettingsDraft,
  testExternalSourceDraft,
  type LocationHealthResult,
} from "./settings-page-actions";

export default function SettingsPage() {
  const { locale, setLocale, dateFormat, setDateFormat, iosDeleteConfirm, setIosDeleteConfirm, printMode, setPrintMode, showItemImages, setShowItemImages, showItemPlaceholders, setShowItemPlaceholders, showItemCategory, setShowItemCategory, showItemLocation, setShowItemLocation, showItemDescription, setShowItemDescription, showItemStock, setShowItemStock, showItemConsumable, setShowItemConsumable, showItemPrice, setShowItemPrice, showItemTotal, setShowItemTotal, showItemProperties, setShowItemProperties, showItemActivity, setShowItemActivity, showAttachmentUploadOnItemDetail, setShowAttachmentUploadOnItemDetail, itemStockWarningPercent, setItemStockWarningPercent, itemStockCriticalPercent, setItemStockCriticalPercent, itemsPerPage, setItemsPerPage, brandingLogo, brandingSubtitle, brandingFooterText, brandingWidth, refreshBranding, isAdmin, can, t } = useApp();
  const [me, setMe] = useState<User | null>(null);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [locIssues, setLocIssues] = useState<LocationHealthResult | null>(null);
  const [locFixing, setLocFixing] = useState(false);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [printer, setPrinter] = useState<PrinterStatus | null>(null);
  const [printerStatus, setPrinterStatus] = useState<string | null>(null);
  const [testPrintStatus, setTestPrintStatus] = useState<string | null>(null);
  const [templateMeta, setTemplateMeta] = useState<LabelTemplateMeta | null>(null);
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | "new" | null>(null);
  const [templateDraft, setTemplateDraft] = useState<LabelTemplateDraft>(createEmptyTemplateDraft());
  const [templateStatus, setTemplateStatus] = useState<string | null>(null);
  const [externalSources, setExternalSources] = useState<ExternalSource[]>([]);
  const [selectedExternalSourceId, setSelectedExternalSourceId] = useState<number | "new" | null>(null);
  const [externalSourceDraft, setExternalSourceDraft] = useState<ExternalSourceDraft>(createEmptyExternalSourceDraft());
  const [externalSourceStatus, setExternalSourceStatus] = useState<string | null>(null);
  const [externalSourceBusy, setExternalSourceBusy] = useState<"hostkey" | "test" | null>(null);
  const [brandingStatus, setBrandingStatus] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<AISettingsDraft>(createEmptyAIDraft());
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiTesting, setAiTesting] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState<"export" | "recover" | null>(null);
  const [recoverFile, setRecoverFile] = useState<File | null>(null);
  const [recoverSelection, setRecoverSelection] = useState({ database: true, attachments: true, config: true });
  const [activeSection, setActiveSection] = useState("account");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [subtitleDraft, setSubtitleDraft] = useState("");
  const [footerTextDraft, setFooterTextDraft] = useState("");
  const [logoDraft, setLogoDraft] = useState<string | null>(null);
  const [widthDraft, setWidthDraft] = useState<number>(180);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const recoverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void fetchInitialSettingsData()
      .then((data) => {
        setMe(data.me);
        setDisplayNameDraft(data.me.name || "");
        setEmailDraft(data.me.email || "");
        setSessions(data.sessions);
        if (data.printer) setPrinter(data.printer);
        if (data.templateMeta) setTemplateMeta(data.templateMeta);
        if (data.templates.length > 0) {
          setTemplates(data.templates);
          setSelectedTemplateId((prev) => prev ?? (data.templates[0]?.id ?? null));
        }
        if (data.externalSources.length > 0) {
          setExternalSources(data.externalSources);
          setSelectedExternalSourceId((prev) => prev ?? (data.externalSources[0]?.id ?? null));
        }
        if (data.aiDraft) {
          setAiDraft(data.aiDraft);
        }
      })
      .catch(() => {})
      .finally(() => {
        setSettingsLoaded(true);
      });
  }, []);

  useEffect(() => {
    setSubtitleDraft(brandingSubtitle);
  }, [brandingSubtitle]);

  useEffect(() => {
    setFooterTextDraft(brandingFooterText);
  }, [brandingFooterText]);

  useEffect(() => {
    setLogoDraft(brandingLogo);
  }, [brandingLogo]);

  useEffect(() => {
    setWidthDraft(brandingWidth);
  }, [brandingWidth]);

  useEffect(() => {
    if (selectedTemplateId === "new") {
      setTemplateDraft(createEmptyTemplateDraft());
      return;
    }
    const selected = templates.find((tpl) => tpl.id === selectedTemplateId);
    if (selected) {
      setTemplateDraft(draftFromTemplate(selected));
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (selectedExternalSourceId === "new") {
      setExternalSourceDraft(createEmptyExternalSourceDraft());
      return;
    }
    const selected = externalSources.find((source) => source.id === selectedExternalSourceId);
    if (selected) {
      setExternalSourceDraft(draftFromExternalSource(selected));
    }
  }, [selectedExternalSourceId, externalSources]);

  const checkLocations = async () => {
    try {
      const result = await fetchLocationHealth();
      setLocIssues(result);
    } catch {}
  };

  const fixLocations = async () => {
    setLocFixing(true);
    try {
      await fixLocationHealth();
      setLocIssues(null);
    } catch {}
    setLocFixing(false);
  };

  const saveBranding = async () => {
    try {
      await api.updateBranding(buildBrandingPayload(logoDraft, subtitleDraft, footerTextDraft, widthDraft));
      await refreshBranding();
      flashStatus(setBrandingStatus, t("settings.brandingSaved"));
    } catch {
      setBrandingStatus(t("settings.brandingFailed"));
    }
  };

  const saveAccount = async () => {
    setAccountStatus(null);
    try {
      const updated = await api.updateMe({
        display_name: displayNameDraft.trim() || undefined,
      });
      setMe(updated);
      setDisplayNameDraft(updated.name || "");
      setEmailDraft(updated.email || "");
      flashStatus(setAccountStatus, t("settings.accountSaved"));
    } catch (err) {
      setAccountStatus(messageFromError(err, t("common.error")));
    }
  };

  const onLogoSelect = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setBrandingStatus(t("settings.brandingInvalid"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setBrandingStatus(t("settings.brandingTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoDraft(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
  };

  const canManageTemplates = isAdmin;
  const selectedTemplate = selectedTemplateId === "new" ? null : templates.find((tpl) => tpl.id === selectedTemplateId) || null;
  const selectedExternalSource = selectedExternalSourceId === "new" ? null : externalSources.find((source) => source.id === selectedExternalSourceId) || null;
  const loadTemplates = async (includeInactive = isAdmin) => {
    const list = await fetchTemplateList(includeInactive);
    setTemplates(list);
    setSelectedTemplateId((prev) => {
      if (prev === "new") return prev;
      if (prev && list.some((tpl) => tpl.id === prev)) return prev;
      return list[0]?.id ?? null;
    });
    return list;
  };
  const loadExternalSources = async (includeInactive = true) => {
    const list = await fetchExternalSourceList(includeInactive);
    setExternalSources(list);
    setSelectedExternalSourceId((prev) => {
      if (prev === "new") return prev;
      if (prev && list.some((source) => source.id === prev)) return prev;
      return list[0]?.id ?? null;
    });
    return list;
  };

  const saveTemplate = async () => {
    setTemplateStatus(null);
    try {
      const saved = await saveTemplateDraft(
        templateDraft,
        selectedTemplateId === "new" ? null : selectedTemplate,
      );
      const list = await loadTemplates(true);
      const resolved = list.find((tpl) => tpl.id === saved.id);
      setSelectedTemplateId(resolved?.id || saved.id);
      flashStatus(setTemplateStatus, t("settings.templateSaved"));
    } catch (err) {
      setTemplateStatus(messageFromError(err, t("settings.templateSaveFailed")));
    }
  };

  const deleteTemplate = async () => {
    if (!selectedTemplate) return;
    setTemplateStatus(null);
    try {
      await deleteTemplateDraft(selectedTemplate);
      const list = await loadTemplates(true);
      setSelectedTemplateId(list[0]?.id ?? null);
      flashStatus(setTemplateStatus, t("settings.templateDeleted"));
    } catch (err) {
      setTemplateStatus(messageFromError(err, t("settings.templateDeleteFailed")));
    }
  };

  const makeDefaultTemplate = async () => {
    if (!selectedTemplate) return;
    setTemplateStatus(null);
    try {
      await makeTemplateDefault(selectedTemplate);
      await loadTemplates(true);
      flashStatus(setTemplateStatus, t("settings.templateDefaultSaved"));
    } catch (err) {
      setTemplateStatus(messageFromError(err, t("settings.templateSaveFailed")));
    }
  };

  const saveExternalSource = async () => {
    setExternalSourceStatus(null);
    try {
      const saved = await saveExternalSourceDraft(
        externalSourceDraft,
        selectedExternalSourceId === "new" ? null : selectedExternalSource,
      );
      const list = await loadExternalSources(true);
      const resolved = list.find((source) => source.id === saved.id);
      setSelectedExternalSourceId(resolved?.id || saved.id);
      flashStatus(setExternalSourceStatus, t("settings.externalSourceSaved"));
    } catch (err) {
      setExternalSourceStatus(messageFromError(err, t("settings.externalSourceSaveFailed")));
    }
  };

  const deleteExternalSource = async () => {
    if (!selectedExternalSource) return;
    setExternalSourceStatus(null);
    try {
      await deleteExternalSourceDraft(selectedExternalSource);
      const list = await loadExternalSources(true);
      setSelectedExternalSourceId(list[0]?.id ?? null);
      flashStatus(setExternalSourceStatus, t("settings.externalSourceDeleted"));
    } catch (err) {
      setExternalSourceStatus(messageFromError(err, t("settings.externalSourceDeleteFailed")));
    }
  };

  const fetchExternalSourceHostKey = async () => {
    setExternalSourceStatus(null);
    setExternalSourceBusy("hostkey");
    try {
      const info = await fetchExternalSourceHostKeyDraft(externalSourceDraft);
      setExternalSourceDraft((prev) => ({ ...prev, known_host_key: info.authorized_key }));
      setExternalSourceStatus(t("settings.externalSourceHostKeyFetched", { algorithm: info.algorithm, fingerprint: info.fingerprint_sha256 }));
    } catch (err) {
      setExternalSourceStatus(messageFromError(err, t("settings.externalSourceHostKeyFetchFailed")));
    } finally {
      setExternalSourceBusy(null);
    }
  };

  const testExternalSource = async () => {
    setExternalSourceStatus(null);
    setExternalSourceBusy("test");
    try {
      await testExternalSourceDraft(externalSourceDraft);
      setExternalSourceStatus(t("settings.externalSourceTestSucceeded"));
    } catch (err) {
      setExternalSourceStatus(messageFromError(err, t("settings.externalSourceTestFailed")));
    } finally {
      setExternalSourceBusy(null);
    }
  };

  const saveAISettings = async () => {
    setAiStatus(null);
    try {
      const saved = await saveAISettingsDraft(aiDraft);
      setAiDraft(draftFromAISettings(saved));
      flashStatus(setAiStatus, t("settings.aiSaved"));
    } catch (err) {
      setAiStatus(messageFromError(err, t("settings.aiSaveFailed")));
    }
  };

  const testAISettings = async () => {
    setAiStatus(null);
    setAiTesting(true);
    try {
      const result = await testAISettingsDraft(aiDraft);
      setAiStatus(result.output_text?.trim() ? `${t("settings.aiTestSucceeded")}: ${result.output_text.trim()}` : t("settings.aiTestSucceeded"));
    } catch (err) {
      setAiStatus(messageFromError(err, t("settings.aiTestFailed")));
    } finally {
      setAiTesting(false);
    }
  };

  const exportBackupBundle = async () => {
    setBackupStatus(null);
    setBackupBusy("export");
    try {
      const blob = await exportBackupBundleBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `itemplus-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      flashStatus(setBackupStatus, t("settings.exportSuccess"));
    } catch (err) {
      setBackupStatus(messageFromError(err, t("settings.exportFailed")));
    } finally {
      setBackupBusy(null);
    }
  };

  const recoverBackupBundle = async () => {
    if (!recoverFile) return;
    setBackupStatus(null);
    setBackupBusy("recover");
    try {
      const result = await recoverBackupBundleFile(recoverFile, recoverSelection);
      setBackupStatus(result.requires_restart ? `${t("settings.recoverSuccess")} ${t("settings.restartQueued")}` : t("settings.recoverSuccess"));
      setRecoverFile(null);
      if (recoverInputRef.current) recoverInputRef.current.value = "";
    } catch (err) {
      setBackupStatus(messageFromError(err, t("settings.recoverFailed")));
    } finally {
      setBackupBusy(null);
    }
  };

  const settingsSections = buildSettingsSections({
    t,
    hasAccount: !!me,
    hasSessions: sessions.length > 0,
    canPrint: can("print"),
    isAdmin,
  });

  useEffect(() => {
    if (!settingsLoaded) return;
    if (!settingsSections.some((section) => section.id === activeSection)) {
      setActiveSection(settingsSections[0]?.id || "account");
    }
  }, [activeSection, settingsLoaded, settingsSections]);

  return (
    <div className="w-full max-w-none">
      <SettingsPageHeader t={t} />

      <div className="pt-6 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-x-8">
        <SettingsSectionsNav
          sections={settingsSections}
          activeSection={activeSection}
          setActiveSection={setActiveSection}
        />

        <div className="space-y-12 [&>section:last-child]:border-b-0 [&>section:last-child]:pb-0">
        {me && activeSection === "account" ? (
          <SettingsCard
            sectionId="account"
            icon={Cog6ToothIcon}
            title={t("settings.sectionAccount")}
            description={t("settings.accountDescription")}
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label className="block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.displayName")}</label>
                <div className="mt-2">
                  <input value={displayNameDraft} onChange={(e) => setDisplayNameDraft(e.target.value)} className={settingsInputClass} />
                </div>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.email")}</label>
                <div className="mt-2">
                  <input type="email" value={emailDraft} readOnly disabled className={`${settingsInputClass} cursor-not-allowed opacity-70 disabled:cursor-not-allowed disabled:opacity-70`} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={saveAccount} className={settingsPrimaryButtonClass}>
                {t("common.save")}
              </button>
              {accountStatus ? <StatusMessage tone={accountStatus === t("settings.accountSaved") ? "success" : "error"}>{accountStatus}</StatusMessage> : null}
            </div>
          </SettingsCard>
        ) : null}

        {sessions.length > 0 && activeSection === "devices" ? (
          <SettingsDevicesSection
            sessions={sessions}
            t={t}
            onRemove={(sessionId) => setSessions((prev) => prev.filter((entry) => entry.id !== sessionId))}
          />
        ) : null}

          {activeSection === "app" && (
            <SettingsAppSection
              t={t}
              locale={locale}
              setLocale={(value) => setLocale(value as typeof locale)}
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
              localeOptions={LOCALES.map((l) => ({ value: l.code, label: l.name }))}
            />
          )}

          {(can("print") || isAdmin) && (activeSection === "branding" || activeSection === "printer") && (
            <>
              {isAdmin && activeSection === "branding" && (
                <SettingsBrandingSection
                  t={t}
                  logoDraft={logoDraft}
                  subtitleDraft={subtitleDraft}
                  footerTextDraft={footerTextDraft}
                  widthDraft={widthDraft}
                  brandingStatus={brandingStatus}
                  logoInputRef={logoInputRef}
                  setSubtitleDraft={setSubtitleDraft}
                  setFooterTextDraft={setFooterTextDraft}
                  setWidthDraft={setWidthDraft}
                  setLogoDraft={setLogoDraft}
                  setBrandingStatus={setBrandingStatus}
                  onLogoSelect={onLogoSelect}
                  saveBranding={saveBranding}
                  resetBranding={() => {
                    void (async () => {
                      await resetBrandingSettings();
                      await refreshBranding();
                      setLogoDraft(null);
                      setSubtitleDraft("");
                      setFooterTextDraft("");
                      setWidthDraft(180);
                      setBrandingStatus(t("settings.brandingReset"));
                      setTimeout(() => setBrandingStatus(null), 2500);
                    })();
                  }}
                  primaryButtonClass={settingsPrimaryButtonClass}
                  secondaryButtonClass={settingsSecondaryButtonClass}
                />
              )}
              {activeSection === "printer" ? (
                <SettingsPrinterSection
                  t={t}
                  isAdmin={isAdmin}
                  printMode={printMode}
                  setPrintMode={setPrintMode}
                  printer={printer}
                  setPrinter={setPrinter}
                  printerStatus={printerStatus}
                  templateMeta={templateMeta}
                  templates={templates}
                  selectedTemplateId={selectedTemplateId}
                  setSelectedTemplateId={setSelectedTemplateId}
                  templateDraft={templateDraft}
                  setTemplateDraft={setTemplateDraft}
                  templateStatus={templateStatus}
                  canManageTemplates={canManageTemplates}
                  testPrintStatus={testPrintStatus}
                  createNewTemplate={() => {
                    setSelectedTemplateId("new");
                    setTemplateDraft(createEmptyTemplateDraft());
                    setTemplateStatus(null);
                  }}
                  savePrinterConfig={() => {
                    void (async () => {
                      if (!printer) return;
                      const updated = await savePrinterConfig(printer);
                      setPrinter(updated);
                      setPrinterStatus(updated.reachable ? t("settings.printerConnected") : t("settings.printerNotReachable"));
                      setTimeout(() => setPrinterStatus(null), 3000);
                    })();
                  }}
                  calibratePrinter={() => {
                    void (async () => {
                      try {
                        const ok = await calibratePrinter();
                        setPrinterStatus(ok ? t("settings.calibrated") : t("settings.error"));
                      } catch {
                        setPrinterStatus(t("settings.connectionError"));
                      }
                      setTimeout(() => setPrinterStatus(null), 3000);
                    })();
                  }}
                  saveTemplate={() => { void saveTemplate(); }}
                  deleteTemplate={() => { void deleteTemplate(); }}
                  makeDefaultTemplate={() => { void makeDefaultTemplate(); }}
                  printTemplateNow={() => {
                    void (async () => {
                      setTestPrintStatus(null);
                      try {
                        const result = await printTemplateNow(templateDraft);
                        if (result.ok) {
                          setTestPrintStatus(t("settings.printSuccess"));
                        } else {
                          setTestPrintStatus(result.detail || t("settings.error"));
                        }
                      } catch {
                        setTestPrintStatus(t("settings.connectionError"));
                      }
                      setTimeout(() => setTestPrintStatus(null), 3000);
                    })();
                  }}
                  loadDefaultTSPL={() => {
                    void (async () => {
                      const data = await fetchDefaultTSPLPreview();
                      if (data) {
                        setTemplateDraft({ ...templateDraft, tspl_template: data.tspl });
                      }
                    })();
                  }}
                  primaryButtonClass={settingsPrimaryButtonClass}
                  secondaryButtonClass={settingsSecondaryButtonClass}
                  dangerButtonClass={settingsDangerButtonClass}
                  inputClass={settingsInputClass}
                  monoTextareaClass={settingsMonoTextareaClass}
                />
              ) : null}
            </>
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
              externalSourceStatus={externalSourceStatus}
              externalSourceBusy={externalSourceBusy}
              createNewExternalSource={() => {
                setSelectedExternalSourceId("new");
                setExternalSourceDraft(createEmptyExternalSourceDraft());
                setExternalSourceStatus(null);
              }}
              fetchExternalSourceHostKey={() => { void fetchExternalSourceHostKey(); }}
              testExternalSource={() => { void testExternalSource(); }}
              saveExternalSource={() => { void saveExternalSource(); }}
              deleteExternalSource={() => { void deleteExternalSource(); }}
              inputClass={settingsInputClass}
              monoTextareaClass={settingsMonoTextareaClass}
              primaryButtonClass={settingsPrimaryButtonClass}
              secondaryButtonClass={settingsSecondaryButtonClass}
              dangerButtonClass={settingsDangerButtonClass}
            />
          )}

          {isAdmin && activeSection === "ai" && (
            <SettingsAISection
              t={t}
              aiDraft={aiDraft}
              setAiDraft={setAiDraft}
              aiTesting={aiTesting}
              aiStatus={aiStatus}
              saveAISettings={saveAISettings}
              testAISettings={testAISettings}
              defaultAIModel={defaultAIModel}
              defaultAIBaseURL={defaultAIBaseURL}
              isAIKeyOptional={isAIKeyOptional}
              createProviderDraft={createProviderDraft}
              inputClass={settingsInputClass}
              primaryButtonClass={settingsPrimaryButtonClass}
              secondaryButtonClass={settingsSecondaryButtonClass}
            />
          )}

          {isAdmin && activeSection === "system" && (
              <SettingsSystemSection
                t={t}
                backupBusy={backupBusy}
                backupStatus={backupStatus}
                recoverFile={recoverFile}
                recoverInputRef={recoverInputRef}
                recoverSelection={recoverSelection}
                setRecoverFile={setRecoverFile}
                setRecoverSelection={setRecoverSelection}
                exportBackupBundle={exportBackupBundle}
                recoverBackupBundle={recoverBackupBundle}
                checkLocations={checkLocations}
                locIssues={locIssues}
                locFixing={locFixing}
                fixLocations={fixLocations}
                primaryButtonClass={settingsPrimaryButtonClass}
                secondaryButtonClass={settingsSecondaryButtonClass}
                dangerButtonClass={settingsDangerButtonClass}
              />
          )}

        </div>
      </div>
    </div>
  );
}
