"use client";

import { api, type LabelTemplate, type ExternalSource, type LabelTemplateMeta, type MaintenanceSettings, type PrinterStatus, type SidebarFavorite, type User } from "@/lib/api";
import { draftFromAISettings } from "@/components/settings/drafts";
import type { AISettingsDraft } from "@/components/settings/drafts";

export type DeviceSession = {
  id: number;
  device_type: string;
  device_name: string | null;
  ip_address: string | null;
  is_online: boolean;
  last_seen: string | null;
};

export async function fetchDeviceSessions() {
  const response = await fetch(`${api.baseURL}/api/devices/sessions`, { credentials: "include" });
  if (!response.ok) return [] as DeviceSession[];
  const data = await response.json();
  return (data.sessions || []) as DeviceSession[];
}

export async function fetchInitialSettingsData() {
  const me = await api.getMe();

  const result: {
    me: User;
    printer: PrinterStatus | null;
    templateMeta: LabelTemplateMeta | null;
    templates: LabelTemplate[];
    externalSources: ExternalSource[];
    maintenanceSettings: MaintenanceSettings | null;
    sidebarFavorites: SidebarFavorite[];
    aiDraft: AISettingsDraft | null;
    sessions: DeviceSession[];
  } = {
    me,
    printer: null,
    templateMeta: null,
    templates: [],
    externalSources: [],
    maintenanceSettings: null,
    sidebarFavorites: [],
    aiDraft: null,
    sessions: [],
  };

  const tasks: Promise<void>[] = [
    fetchDeviceSessions().then((sessions) => {
      result.sessions = sessions;
    }).catch(() => {}),
    api.getSidebarFavorites().then((favorites) => {
      result.sidebarFavorites = favorites.favorites || [];
    }).catch(() => {}),
  ];

  if (me.is_admin) {
    tasks.push(api.getPrinterStatus().then((printer) => {
      result.printer = printer;
    }).catch(() => {}));
  }

  if (me.is_admin || (me.permissions || []).includes("print")) {
    tasks.push(api.getLabelTemplateMeta().then((templateMeta) => {
      result.templateMeta = templateMeta;
    }).catch(() => {}));

    tasks.push(api.getLabelTemplates(undefined, me.is_admin).then((templates) => {
      result.templates = templates;
    }).catch(() => {}));

    if (me.is_admin) {
      tasks.push(api.getExternalSources(true).then((sources) => {
        result.externalSources = sources;
      }).catch(() => {}));

      tasks.push(api.getAISettings().then((settings) => {
        result.aiDraft = draftFromAISettings(settings);
      }).catch(() => {}));

      tasks.push(api.getMaintenanceSettings().then((settings) => {
        result.maintenanceSettings = settings;
      }).catch(() => {}));
    }
  }

  await Promise.all(tasks);
  return result;
}

export async function fetchTemplateList(includeInactive: boolean) {
  return api.getLabelTemplates(undefined, includeInactive);
}

export async function fetchExternalSourceList(includeInactive: boolean) {
  return api.getExternalSources(includeInactive);
}
