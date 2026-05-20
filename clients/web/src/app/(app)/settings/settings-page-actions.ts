import { api, type AIConnectionTestResult, type AISettings, type AISettingsPayload, type ExternalSource, type ExternalSourcePayload, type LabelTemplate, type LabelTemplatePayload, type PrinterStatus } from "@/lib/api";
import { parseTSPLPreview } from "@/components/tspl-template-preview";
import type { AISettingsDraft, ExternalSourceDraft, LabelTemplateDraft } from "@/components/settings-drafts";

export type LocationHealthResult = {
  issues: { realm: string; id: number; name: string; type: string }[];
  total_checked: number;
};

export async function fetchLocationHealth() {
  const res = await fetch(`${api.baseURL}/api/admin/health/locations`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  return (await res.json()) as LocationHealthResult;
}

export async function fixLocationHealth() {
  const res = await fetch(`${api.baseURL}/api/admin/health/locations/fix`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Failed to fix location health");
  }
}

export function buildBrandingPayload(logo: string | null, subtitle: string, footerText: string, width: number) {
  return { logo, subtitle: subtitle.trim(), footerText: footerText.trim(), width };
}

export async function resetBrandingSettings() {
  await api.resetBranding();
}

export function buildTemplatePayload(templateDraft: LabelTemplateDraft): LabelTemplatePayload {
  const parsed = parseTSPLPreview(templateDraft.tspl_template);
  return {
    ...templateDraft,
    target: "both",
    width_mm: parsed.widthMM,
    height_mm: parsed.heightMM,
    gap_mm: parsed.gapMM,
    speed: parsed.speed,
    density: parsed.density,
    direction: parsed.direction,
    reference_x: parsed.referenceX,
    reference_y: parsed.referenceY,
    shift_x: parsed.shiftX,
    shift_y: parsed.shiftY,
    name: templateDraft.name.trim(),
    description: templateDraft.description?.trim() || null,
    tspl_template: templateDraft.tspl_template,
  };
}

export async function saveTemplateDraft(
  templateDraft: LabelTemplateDraft,
  selectedTemplate: LabelTemplate | null,
) {
  const payload = buildTemplatePayload(templateDraft);
  if (!selectedTemplate) {
    return api.createLabelTemplate(payload);
  }
  return api.updateLabelTemplate(selectedTemplate.id, payload);
}

export async function deleteTemplateDraft(selectedTemplate: LabelTemplate) {
  await api.deleteLabelTemplate(selectedTemplate.id);
}

export async function makeTemplateDefault(selectedTemplate: LabelTemplate) {
  await api.setDefaultLabelTemplate(selectedTemplate.id);
}

export function buildExternalSourcePayload(externalSourceDraft: ExternalSourceDraft): ExternalSourcePayload {
  return {
    ...externalSourceDraft,
    name: externalSourceDraft.name.trim(),
    description: externalSourceDraft.description?.trim() || null,
    host: externalSourceDraft.host.trim(),
    username: externalSourceDraft.username.trim(),
    known_host_key: externalSourceDraft.known_host_key.trim(),
    base_path: externalSourceDraft.base_path.trim(),
    password: externalSourceDraft.auth_type === "password" ? (externalSourceDraft.password?.trim() || null) : null,
    private_key: externalSourceDraft.auth_type === "ssh_key" ? (externalSourceDraft.private_key?.trim() || null) : null,
  };
}

export async function saveExternalSourceDraft(
  externalSourceDraft: ExternalSourceDraft,
  selectedExternalSource: ExternalSource | null,
) {
  const payload = buildExternalSourcePayload(externalSourceDraft);
  if (!selectedExternalSource) {
    return api.createExternalSource(payload);
  }
  return api.updateExternalSource(selectedExternalSource.id, payload);
}

export async function deleteExternalSourceDraft(selectedExternalSource: ExternalSource) {
  await api.deleteExternalSource(selectedExternalSource.id);
}

export async function fetchExternalSourceHostKeyDraft(externalSourceDraft: ExternalSourceDraft) {
  return api.fetchExternalSourceHostKey({
    host: externalSourceDraft.host.trim(),
    port: externalSourceDraft.port || 22,
  });
}

export async function testExternalSourceDraft(externalSourceDraft: ExternalSourceDraft) {
  return api.testExternalSourceConnection(buildExternalSourcePayload(externalSourceDraft));
}

export function buildAISettingsPayload(aiDraft: AISettingsDraft): AISettingsPayload {
  return {
    provider: aiDraft.provider,
    model: aiDraft.model.trim(),
    base_url: aiDraft.base_url.trim(),
    api_key: (aiDraft.api_key || "").trim(),
    enabled: aiDraft.enabled,
  };
}

export async function saveAISettingsDraft(aiDraft: AISettingsDraft): Promise<AISettings> {
  return api.updateAISettings(buildAISettingsPayload(aiDraft));
}

export async function testAISettingsDraft(aiDraft: AISettingsDraft): Promise<AIConnectionTestResult> {
  return api.testAISettings(buildAISettingsPayload(aiDraft));
}

export async function exportBackupBundleBlob() {
  return api.exportBackupBundle();
}

export async function recoverBackupBundleFile(
  file: File,
  selection: { database: boolean; attachments: boolean; config: boolean },
) {
  return api.recoverBackupBundle(file, selection);
}

export async function savePrinterConfig(printer: PrinterStatus) {
  await api.updatePrinterConfig({ host: printer.host, port: printer.port });
  return api.getPrinterStatus();
}

export async function calibratePrinter() {
  const res = await fetch(`${api.baseURL}/api/print/calibrate`, { method: "POST", credentials: "include" });
  return res.ok;
}

export async function printTemplateNow(templateDraft: LabelTemplateDraft) {
  const res = await fetch(`${api.baseURL}/api/print/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ tspl: templateDraft.tspl_template || null }),
  });
  if (res.ok) return { ok: true, detail: null as string | null };
  const err = await res.json().catch(() => ({}));
  return { ok: false, detail: (err.detail as string | undefined) || null };
}

export async function fetchDefaultTSPLPreview() {
  const res = await fetch(`${api.baseURL}/api/print/test/preview`, { credentials: "include" });
  if (!res.ok) return null;
  return (await res.json()) as { tspl: string };
}
