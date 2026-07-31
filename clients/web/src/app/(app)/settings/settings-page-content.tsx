"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { api, type AIModelOption, type ExternalSource, type LabelTemplate, type LabelTemplateMeta, type PrinterStatus, type SidebarFavorite, type User } from "@/lib/api";
import { FloatingNotification, type FloatingNotificationState } from "@/components/ui/floating-notification";
import { SettingsPageHeader } from "@/components/settings/sections-nav";
import type { SettingsPageSectionsProps } from "./settings-page-types";
import {
  createEmptyAIDraft,
  createEmptyExternalSourceDraft,
  createEmptyTemplateDraft,
  draftFromExternalSource,
  draftFromAISettings,
  draftFromTemplate,
  type AISettingsDraft,
  type AIProfileDraft,
  type ExternalSourceDraft,
  type LabelTemplateDraft,
} from "@/components/settings/drafts";
import { LOCALES } from "@/lib/i18n";
import {
  buildSettingsSections,
  settingsDangerButtonClass,
  settingsInputClass,
  settingsMonoTextareaClass,
  settingsPrimaryButtonClass,
  settingsSecondaryButtonClass,
} from "./settings-page-meta";
import { messageFromError, messageFromErrorCode } from "./settings-page-status";
import { SettingsPageSections } from "./settings-page-sections";
import {
  fetchExternalSourceList,
  fetchInitialSettingsData,
  fetchTemplateList,
} from "./settings-page-utils";
import {
  buildBrandingPayload,
  calibratePrinter,
  deleteExternalSourceDraft,
  deleteTemplateDraft,
  exportBackupBundleBlob,
  fetchAIModelsDraft,
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

export default function SettingsPageContent() {
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get("section") || "";
  const { locale, setLocale, dateFormat, setDateFormat, iosDeleteConfirm, setIosDeleteConfirm, printMode, setPrintMode, showPrintFeatures, setShowPrintFeatures, showItemImages, setShowItemImages, showItemPlaceholders, setShowItemPlaceholders, showItemCategory, setShowItemCategory, showItemLocation, setShowItemLocation, showItemDescription, setShowItemDescription, showItemStock, setShowItemStock, showItemConsumable, setShowItemConsumable, showItemPrice, setShowItemPrice, showItemTotal, setShowItemTotal, showItemProperties, setShowItemProperties, showItemActivity, setShowItemActivity, showAttachmentUploadOnItemDetail, setShowAttachmentUploadOnItemDetail, itemStockWarningPercent, setItemStockWarningPercent, itemStockCriticalPercent, setItemStockCriticalPercent, itemsPerPage, setItemsPerPage, brandingLogo, brandingTitle, brandingTitleSize, brandingTitlePosition, brandingSubtitle, brandingFooterText, brandingWidth, brandingLogoBackground, brandingLogoPadding, brandingLogoRadius, refreshBranding, isAdmin, can, t } = useApp();
  const [me, setMe] = useState<User | null>(null);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  const [locIssues, setLocIssues] = useState<LocationHealthResult | null>(null);
  const [locFixing, setLocFixing] = useState(false);
  const [printer, setPrinter] = useState<PrinterStatus | null>(null);
  const [templateMeta, setTemplateMeta] = useState<LabelTemplateMeta | null>(null);
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | "new" | null>(null);
  const [templateDraft, setTemplateDraft] = useState<LabelTemplateDraft>(createEmptyTemplateDraft());
  const [externalSources, setExternalSources] = useState<ExternalSource[]>([]);
  const [selectedExternalSourceId, setSelectedExternalSourceId] = useState<number | "new" | null>(null);
  const [externalSourceDraft, setExternalSourceDraft] = useState<ExternalSourceDraft>(createEmptyExternalSourceDraft());
  const [externalSourceBusy, setExternalSourceBusy] = useState<"hostkey" | "test" | null>(null);
  const [brandingStatus, setBrandingStatus] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<AISettingsDraft>(createEmptyAIDraft());
  const [selectedAIProfileId, setSelectedAIProfileId] = useState("");
  const [aiTesting, setAiTesting] = useState(false);
  const [aiModelsLoading, setAiModelsLoading] = useState(false);
  const [maintenanceLeadDays, setMaintenanceLeadDays] = useState(0);
  const [inventoryCheckoutAffectsMovementQuantity, setInventoryCheckoutAffectsMovementQuantity] = useState(false);
  const [inventorySettingsSaving, setInventorySettingsSaving] = useState(false);
  const [maintenanceSettingsSaving, setMaintenanceSettingsSaving] = useState(false);
  const [sidebarFavorites, setSidebarFavorites] = useState<SidebarFavorite[]>([]);
  const [sidebarFavoritesSaving, setSidebarFavoritesSaving] = useState(false);
  const [backupBusy, setBackupBusy] = useState<"export" | "recover" | null>(null);
  const [recoverFile, setRecoverFile] = useState<File | null>(null);
  const [recoverSelection, setRecoverSelection] = useState({ database: true, attachments: true, config: true });
  const [notification, setNotification] = useState<FloatingNotificationState>(null);
  const [activeSection, setActiveSection] = useState("account");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [titleDraft, setTitleDraft] = useState("item+");
  const [titleSizeDraft, setTitleSizeDraft] = useState<number>(17);
  const [titlePositionDraft, setTitlePositionDraft] = useState<"right" | "below">("right");
  const [subtitleDraft, setSubtitleDraft] = useState("");
  const [footerTextDraft, setFooterTextDraft] = useState("");
  const [logoDraft, setLogoDraft] = useState<string | null>(null);
  const [widthDraft, setWidthDraft] = useState<number>(64);
  const [logoBackgroundDraft, setLogoBackgroundDraft] = useState("");
  const [logoPaddingDraft, setLogoPaddingDraft] = useState<number>(0);
  const [logoRadiusDraft, setLogoRadiusDraft] = useState<number>(6);
  const aiDraftTouchedRef = useRef(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const recoverInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const updateAiDraft: typeof setAiDraft = (value) => {
    aiDraftTouchedRef.current = true;
    setAiDraft(value);
  };

  const showNotification = (title: string, message?: string, tone: "success" | "error" | "info" = "success") => {
    setNotification({ title, message, tone });
  };

  useEffect(() => {
    if (!notification) return;
    const timeout = window.setTimeout(() => setNotification(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  useEffect(() => {
    void fetchInitialSettingsData()
      .then((data) => {
        setMe(data.me);
        setDisplayNameDraft(data.me.name || "");
        setEmailDraft(data.me.email || "");
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
        if (data.aiDraft && !aiDraftTouchedRef.current) {
          setAiDraft(data.aiDraft);
          setSelectedAIProfileId(data.aiDraft.active_profile_id || data.aiDraft.profiles[0]?.id || "");
        }
        if (data.maintenanceSettings) {
          setMaintenanceLeadDays(data.maintenanceSettings.reminder_lead_days || 0);
        }
        if (data.inventorySettings) {
          setInventoryCheckoutAffectsMovementQuantity(!!data.inventorySettings.checkout_affects_movement_quantity);
        }
        setSidebarFavorites(data.sidebarFavorites);
      })
      .catch(() => {})
      .finally(() => {
        setSettingsLoaded(true);
      });
  }, []);

  async function deleteAccount() {
    try {
      setDeleteAccountBusy(true);
      await api.deleteMe();
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      window.location.assign("/auth");
    } catch (err) {
      const message = messageFromErrorCode(err, t("settings.deleteAccountFailed"), {
          account_deletion_active_checkouts: t("settings.deleteAccountBlocked"),
          account_deletion_admin_forbidden: t("settings.deleteAccountAdminBlocked"),
        });
      showNotification(message, undefined, "error");
    } finally {
      setDeleteAccountBusy(false);
    }
  }

  async function saveSidebarFavorites() {
    try {
      setSidebarFavoritesSaving(true);
      const result = await api.updateSidebarFavorites(sidebarFavorites);
      setSidebarFavorites(result.favorites || []);
      window.dispatchEvent(new Event("sidebar-favorites-updated"));
      showNotification(t("settings.sidebarFavoritesSaved"));
    } catch (err) {
      const message = messageFromError(err, t("settings.sidebarFavoritesSaveFailed"));
      showNotification(message, undefined, "error");
    } finally {
      setSidebarFavoritesSaving(false);
    }
  }

  useEffect(() => {
    setTitleDraft(brandingTitle);
  }, [brandingTitle]);

  useEffect(() => {
    setSubtitleDraft(brandingSubtitle);
  }, [brandingSubtitle]);

  useEffect(() => {
    setTitleSizeDraft(brandingTitleSize);
  }, [brandingTitleSize]);

  useEffect(() => {
    setTitlePositionDraft(brandingTitlePosition);
  }, [brandingTitlePosition]);

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
    setLogoBackgroundDraft(brandingLogoBackground);
  }, [brandingLogoBackground]);

  useEffect(() => {
    setLogoPaddingDraft(brandingLogoPadding);
  }, [brandingLogoPadding]);

  useEffect(() => {
    setLogoRadiusDraft(brandingLogoRadius);
  }, [brandingLogoRadius]);

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

  useEffect(() => {
    if (!selectedAIProfileId && aiDraft.profiles.length > 0) {
      setSelectedAIProfileId(aiDraft.active_profile_id || aiDraft.profiles[0]?.id || "");
    }
  }, [aiDraft.active_profile_id, aiDraft.profiles, selectedAIProfileId]);

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
    if (logoBackgroundDraft.trim() && !/^#[0-9a-f]{6}$/i.test(logoBackgroundDraft.trim())) {
      const message = t("settings.brandingInvalidBackground");
      setBrandingStatus(message);
      showNotification(message, undefined, "error");
      return;
    }
    try {
      await api.updateBranding(buildBrandingPayload({
        logo: logoDraft,
        title: titleDraft,
        titleSize: titleSizeDraft,
        titlePosition: titlePositionDraft,
        subtitle: subtitleDraft,
        footerText: footerTextDraft,
        width: widthDraft,
        logoBackground: logoBackgroundDraft,
        logoPadding: logoPaddingDraft,
        logoRadius: logoRadiusDraft,
      }));
      await refreshBranding();
      setBrandingStatus(null);
      showNotification(t("settings.brandingSaved"));
    } catch (err) {
      const message = messageFromError(err, t("settings.brandingFailed"));
      setBrandingStatus(message);
      showNotification(message, undefined, "error");
    }
  };

  const saveAccount = async () => {
    try {
      const updated = await api.updateMe({
        display_name: displayNameDraft.trim() || undefined,
      });
      setMe(updated);
      setDisplayNameDraft(updated.name || "");
      setEmailDraft(updated.email || "");
      showNotification(t("settings.accountSaved"));
    } catch (err) {
      const message = messageFromError(err, t("common.error"));
      showNotification(message, undefined, "error");
    }
  };

  const updateLocalePreference = async (value: typeof locale) => {
    const previous = locale;
    setLocale(value);
    try {
      const updated = await api.updateMe({ locale: value });
      setMe(updated);
    } catch (err) {
      setLocale(previous);
      const message = messageFromError(err, t("common.error"));
      showNotification(message, undefined, "error");
    }
  };

  const uploadAccountAvatar = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showNotification(t("settings.avatarInvalid"), undefined, "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showNotification(t("settings.avatarTooLarge"), undefined, "error");
      return;
    }
    try {
      const updated = await api.uploadMyAvatar(file);
      setMe(updated);
      showNotification(t("settings.avatarSaved"));
    } catch (err) {
      const message = messageFromError(err, t("settings.avatarSaveFailed"));
      showNotification(message, undefined, "error");
    }
  };

  const removeAccountAvatar = async () => {
    try {
      const updated = await api.deleteMyAvatar();
      setMe(updated);
      showNotification(t("settings.avatarRemoved"));
    } catch (err) {
      const message = messageFromError(err, t("settings.avatarRemoveFailed"));
      showNotification(message, undefined, "error");
    }
  };

  const onLogoSelect = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      const message = t("settings.brandingInvalid");
      setBrandingStatus(message);
      showNotification(message, undefined, "error");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      const message = t("settings.brandingTooLarge");
      setBrandingStatus(message);
      showNotification(message, undefined, "error");
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
    try {
      const saved = await saveTemplateDraft(
        templateDraft,
        selectedTemplateId === "new" ? null : selectedTemplate,
      );
      const list = await loadTemplates(true);
      const resolved = list.find((tpl) => tpl.id === saved.id);
      setSelectedTemplateId(resolved?.id || saved.id);
      showNotification(t("settings.templateSaved"));
    } catch (err) {
      const message = messageFromError(err, t("settings.templateSaveFailed"));
      showNotification(message, undefined, "error");
    }
  };

  const deleteTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      await deleteTemplateDraft(selectedTemplate);
      const list = await loadTemplates(true);
      setSelectedTemplateId(list[0]?.id ?? null);
      showNotification(t("settings.templateDeleted"));
    } catch (err) {
      const message = messageFromError(err, t("settings.templateDeleteFailed"));
      showNotification(message, undefined, "error");
    }
  };

  const makeDefaultTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      await makeTemplateDefault(selectedTemplate);
      await loadTemplates(true);
      showNotification(t("settings.templateDefaultSaved"));
    } catch (err) {
      const message = messageFromError(err, t("settings.templateSaveFailed"));
      showNotification(message, undefined, "error");
    }
  };

  const saveExternalSource = async () => {
    try {
      const saved = await saveExternalSourceDraft(
        externalSourceDraft,
        selectedExternalSourceId === "new" ? null : selectedExternalSource,
      );
      const list = await loadExternalSources(true);
      const resolved = list.find((source) => source.id === saved.id);
      setSelectedExternalSourceId(resolved?.id || saved.id);
      showNotification(t("settings.externalSourceSaved"));
    } catch (err) {
      const message = messageFromError(err, t("settings.externalSourceSaveFailed"));
      showNotification(message, undefined, "error");
    }
  };

  const deleteExternalSource = async () => {
    if (!selectedExternalSource) return;
    try {
      await deleteExternalSourceDraft(selectedExternalSource);
      const list = await loadExternalSources(true);
      setSelectedExternalSourceId(list[0]?.id ?? null);
      showNotification(t("settings.externalSourceDeleted"));
    } catch (err) {
      const message = messageFromError(err, t("settings.externalSourceDeleteFailed"));
      showNotification(message, undefined, "error");
    }
  };

  const fetchExternalSourceHostKey = async () => {
    setExternalSourceBusy("hostkey");
    try {
      const info = await fetchExternalSourceHostKeyDraft(externalSourceDraft);
      setExternalSourceDraft((prev) => ({ ...prev, known_host_key: info.authorized_key }));
      const message = t("settings.externalSourceHostKeyFetched", { algorithm: info.algorithm, fingerprint: info.fingerprint_sha256 });
      showNotification(message, undefined, "success");
    } catch (err) {
      const message = messageFromError(err, t("settings.externalSourceHostKeyFetchFailed"));
      showNotification(message, undefined, "error");
    } finally {
      setExternalSourceBusy(null);
    }
  };

  const testExternalSource = async () => {
    setExternalSourceBusy("test");
    try {
      await testExternalSourceDraft(externalSourceDraft);
      showNotification(t("settings.externalSourceTestSucceeded"));
    } catch (err) {
      const message = messageFromError(err, t("settings.externalSourceTestFailed"));
      showNotification(message, undefined, "error");
    } finally {
      setExternalSourceBusy(null);
    }
  };

  const saveAISettings = async () => {
    try {
      const saved = await saveAISettingsDraft(aiDraft);
      aiDraftTouchedRef.current = false;
      const nextDraft = draftFromAISettings(saved);
      setAiDraft(nextDraft);
      setSelectedAIProfileId(nextDraft.active_profile_id || nextDraft.profiles[0]?.id || "");
      showNotification(t("settings.aiSaved"));
    } catch (err) {
      const message = messageFromError(err, t("settings.aiSaveFailed"));
      showNotification(message, undefined, "error");
    }
  };

  const saveMaintenanceSettings = async () => {
    setMaintenanceSettingsSaving(true);
    try {
      const saved = await api.updateMaintenanceSettings({ reminder_lead_days: maintenanceLeadDays });
      setMaintenanceLeadDays(saved.reminder_lead_days || 0);
      showNotification(t("settings.maintenanceSettingsSaved"));
    } catch (err) {
      const message = messageFromError(err, t("settings.maintenanceSettingsSaveFailed"));
      showNotification(message, undefined, "error");
    } finally {
      setMaintenanceSettingsSaving(false);
    }
  };

  const saveInventorySettings = async () => {
    setInventorySettingsSaving(true);
    try {
      const saved = await api.updateInventorySettings({
        checkout_affects_movement_quantity: inventoryCheckoutAffectsMovementQuantity,
      });
      setInventoryCheckoutAffectsMovementQuantity(!!saved.checkout_affects_movement_quantity);
      showNotification(t("settings.inventorySettingsSaved"));
    } catch (err) {
      const message = messageFromError(err, t("settings.inventorySettingsSaveFailed"));
      showNotification(message, undefined, "error");
    } finally {
      setInventorySettingsSaving(false);
    }
  };

  const testAISettings = async () => {
    setAiTesting(true);
    try {
      const selectedProfile =
        aiDraft.profiles.find((profile) => profile.id === selectedAIProfileId) ||
        aiDraft.profiles[0];
      if (!selectedProfile) throw new Error(t("settings.aiSaveFailed"));
      const result = await testAISettingsDraft(selectedProfile as AIProfileDraft);
      const message = result.output_text?.trim() ? `${t("settings.aiTestSucceeded")}: ${result.output_text.trim()}` : t("settings.aiTestSucceeded");
      showNotification(message);
    } catch (err) {
      const message = messageFromError(err, t("settings.aiTestFailed"));
      showNotification(message, undefined, "error");
    } finally {
      setAiTesting(false);
    }
  };

  const loadAIModels = async (profile: AIProfileDraft): Promise<AIModelOption[]> => {
    setAiModelsLoading(true);
    try {
      return await fetchAIModelsDraft(profile);
    } catch (err) {
      const message = messageFromError(err, t("settings.aiModelsLoadFailed"));
      showNotification(message, undefined, "error");
      throw err;
    } finally {
      setAiModelsLoading(false);
    }
  };

  const exportBackupBundle = async () => {
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
      showNotification(t("settings.exportSuccess"));
    } catch (err) {
      const message = messageFromError(err, t("settings.exportFailed"));
      showNotification(message, undefined, "error");
    } finally {
      setBackupBusy(null);
    }
  };

  const recoverBackupBundle = async () => {
    if (!recoverFile) return;
    setBackupBusy("recover");
    try {
      const result = await recoverBackupBundleFile(recoverFile, recoverSelection);
      const message = result.requires_restart ? `${t("settings.recoverSuccess")} ${t("settings.restartQueued")}` : t("settings.recoverSuccess");
      showNotification(message);
      setRecoverFile(null);
      if (recoverInputRef.current) recoverInputRef.current.value = "";
    } catch (err) {
      const message = messageFromError(err, t("settings.recoverFailed"));
      showNotification(message, undefined, "error");
    } finally {
      setBackupBusy(null);
    }
  };

  const settingsSections = buildSettingsSections({
    t,
    hasAccount: !!me,
    canPrint: can("print"),
    isAdmin,
  });
  const accountActiveCheckouts = me?.active_checkouts || 0;
  const accountDeleteDisabled = !!me?.is_admin || accountActiveCheckouts > 0 || deleteAccountBusy;
  const accountPermissions = me?.is_admin ? [t("settings.administrator")] : (me?.permissions || []);
  const accountInfoRows = me ? [
    { label: t("settings.email"), value: emailDraft || t("common.none") },
    { label: t("settings.appleSub"), value: me.sub || t("common.none") },
    { label: t("settings.currentIp"), value: me.current_ip || me.last_ip || t("common.none") },
    { label: t("settings.lastDevice"), value: me.last_device || t("common.none") },
  ] : [];

  useEffect(() => {
    if (!settingsLoaded) return;
    if (requestedSection && settingsSections.some((section) => section.id === requestedSection)) {
      setActiveSection(requestedSection);
      return;
    }
    if (!settingsSections.some((section) => section.id === activeSection)) {
      setActiveSection(settingsSections[0]?.id || "account");
    }
  }, [activeSection, requestedSection, settingsLoaded, settingsSections]);

  const activeSectionLabel = settingsSections.find((section) => section.id === activeSection)?.label;
  const sectionProps: SettingsPageSectionsProps = {
    activeSection,
    me,
    t,
    can,
    isAdmin,
    locale,
    setLocale: (value) => {
      void updateLocalePreference(value as typeof locale);
    },
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
    localeOptions: LOCALES.map((l) => ({ value: l.code, label: l.name })),
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
    resetBranding: () => {
      void (async () => {
        try {
          await resetBrandingSettings();
          await refreshBranding();
          setLogoDraft(null);
          setTitleDraft("item+");
          setTitleSizeDraft(17);
          setTitlePositionDraft("right");
          setSubtitleDraft("");
          setFooterTextDraft("");
          setWidthDraft(64);
          setLogoBackgroundDraft("");
          setLogoPaddingDraft(0);
          setLogoRadiusDraft(6);
          setBrandingStatus(null);
          showNotification(t("settings.brandingReset"));
        } catch (err) {
          const message = messageFromError(err, t("settings.brandingFailed"));
          setBrandingStatus(message);
          showNotification(message, undefined, "error");
        }
      })();
    },
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
    createNewTemplate: () => {
      setSelectedTemplateId("new");
      setTemplateDraft(createEmptyTemplateDraft());
    },
    savePrinterConfig: () => {
      void (async () => {
        if (!printer) return;
        try {
          const updated = await savePrinterConfig(printer);
          setPrinter(updated);
          const message = updated.reachable ? t("settings.printerConnected") : t("settings.printerNotReachable");
          showNotification(message, undefined, updated.reachable ? "success" : "error");
        } catch {
          const message = t("settings.connectionError");
          showNotification(message, undefined, "error");
        }
      })();
    },
    calibratePrinter: () => {
      void (async () => {
        try {
          const ok = await calibratePrinter();
          const message = ok ? t("settings.calibrated") : t("settings.error");
          showNotification(message, undefined, ok ? "success" : "error");
        } catch {
          const message = t("settings.connectionError");
          showNotification(message, undefined, "error");
        }
      })();
    },
    saveTemplate: () => { void saveTemplate(); },
    deleteTemplate: () => { void deleteTemplate(); },
    makeDefaultTemplate: () => { void makeDefaultTemplate(); },
    printTemplateNow: () => {
      void (async () => {
        try {
          const result = await printTemplateNow(templateDraft);
          if (result.ok) {
            showNotification(t("settings.printSuccess"));
          } else {
            const message = result.detail || t("settings.error");
            showNotification(message, undefined, "error");
          }
        } catch {
          const message = t("settings.connectionError");
          showNotification(message, undefined, "error");
        }
      })();
    },
    loadDefaultTSPL: () => {
      void (async () => {
        const data = await fetchDefaultTSPLPreview();
        if (data) {
          setTemplateDraft({ ...templateDraft, tspl_template: data.tspl });
        }
      })();
    },
    externalSources,
    selectedExternalSourceId,
    setSelectedExternalSourceId,
    externalSourceDraft,
    setExternalSourceDraft,
    selectedExternalSource,
    externalSourceBusy,
    createNewExternalSource: () => {
      setSelectedExternalSourceId("new");
      setExternalSourceDraft(createEmptyExternalSourceDraft());
    },
    fetchExternalSourceHostKey: () => { void fetchExternalSourceHostKey(); },
    testExternalSource: () => { void testExternalSource(); },
    saveExternalSource: () => { void saveExternalSource(); },
    deleteExternalSource: () => { void deleteExternalSource(); },
    aiDraft,
    setAiDraft: updateAiDraft,
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
  };

  return (
    <div className="w-full max-w-none">
      <FloatingNotification notification={notification} onClose={() => setNotification(null)} t={t} />
      <SettingsPageHeader t={t} activeSectionLabel={activeSectionLabel} />

      <div className="pt-6">
        <div className="space-y-12 [&>section:last-child]:border-b-0 [&>section:last-child]:pb-0">
          <SettingsPageSections {...sectionProps} />
        </div>
      </div>
    </div>
  );
}
