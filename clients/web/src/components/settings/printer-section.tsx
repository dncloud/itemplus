"use client";

import type { ReactNode } from "react";
import type { LabelTemplate, LabelTemplateMeta, PrinterStatus } from "@/lib/api";
import { ChevronDown } from "lucide-react";
import type { LabelTemplateDraft } from "@/components/settings/drafts";
import { ChoiceTile, ToggleRow } from "@/components/settings/ui";

function PrinterInfoDropdown({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl bg-gray-50/80 outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-white/5 dark:outline-white/10"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm/6 font-medium text-gray-900 marker:hidden dark:text-white">
        <span>{title}</span>
        <ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-gray-200 px-4 py-4 dark:border-white/10">{children}</div>
    </details>
  );
}

export function SettingsPrinterSection({
  t,
  isAdmin,
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
  primaryButtonClass,
  secondaryButtonClass,
  dangerButtonClass,
  inputClass,
  monoTextareaClass,
}: {
  t: (key: string) => string;
  isAdmin: boolean;
  printMode: "server" | "ios";
  setPrintMode: (value: "server" | "ios") => void;
  showPrintFeatures: boolean;
  setShowPrintFeatures: (value: boolean) => void;
  printer: PrinterStatus | null;
  setPrinter: (value: PrinterStatus) => void;
  templateMeta: LabelTemplateMeta | null;
  templates: LabelTemplate[];
  selectedTemplateId: number | "new" | null;
  setSelectedTemplateId: (value: number | "new" | null) => void;
  templateDraft: LabelTemplateDraft;
  setTemplateDraft: (value: LabelTemplateDraft) => void;
  canManageTemplates: boolean;
  createNewTemplate: () => void;
  savePrinterConfig: () => void;
  calibratePrinter: () => void;
  saveTemplate: () => void;
  deleteTemplate: () => void;
  makeDefaultTemplate: () => void;
  printTemplateNow: () => void;
  loadDefaultTSPL: () => void;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  dangerButtonClass: string;
  inputClass: string;
  monoTextareaClass: string;
}) {
  const selectedTemplate =
    selectedTemplateId === "new" ? null : templates.find((tpl) => tpl.id === selectedTemplateId) || null;

  return (
    <section id="printer" className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[16rem_minmax(0,1fr)]">
      <div>
        <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">{t("settings.printerTitle")}</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("settings.printerDescription")}</p>
      </div>

      <div className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
        <div className="space-y-8 px-4 py-6 sm:p-8 md:max-w-5xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <label className="block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.printMode")}</label>
              {printMode === "server" && printer ? (
                <span className="inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className={`h-2.5 w-2.5 rounded-full ${printer.reachable ? "bg-emerald-500" : "bg-gray-300"}`} />
                  <span>{printer.reachable ? t("settings.printerConnected") : t("settings.printerNotReachable")}</span>
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              <ChoiceTile
                active={printMode === "server"}
                onClick={() => setPrintMode("server")}
                title={t("settings.printModeServer")}
                description={t("settings.printModeServerHint")}
              />
              <ChoiceTile
                active={printMode === "ios"}
                onClick={() => setPrintMode("ios")}
                title={t("settings.printModeIOS")}
                description={t("settings.printModeIOSHint")}
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-8 dark:border-white/10">
            <ToggleRow
              title={t("settings.showPrintFeatures")}
              description={t("settings.showPrintFeaturesHint")}
              checked={showPrintFeatures}
              onToggle={() => setShowPrintFeatures(!showPrintFeatures)}
            />
          </div>

          {printMode === "ios" ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">
              {t("settings.printModeIOSInfo")}
            </div>
          ) : null}

          {printMode === "server" && isAdmin && printer ? (
            <div className="space-y-4 border-t border-gray-200 pt-8 dark:border-white/10">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.ipAddress")}</label>
                  <input value={printer.host} onChange={(e) => setPrinter({ ...printer, host: e.target.value })} className={inputClass} placeholder="192.168.1.100" />
                </div>
                <div>
                  <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.port")}</label>
                  <input type="number" value={printer.port} onChange={(e) => setPrinter({ ...printer, port: Number(e.target.value) })} className={inputClass} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={savePrinterConfig} className={primaryButtonClass}>
                  {t("common.save")}
                </button>
                <button onClick={calibratePrinter} className={secondaryButtonClass}>
                  {t("settings.calibrate")}
                </button>
              </div>
            </div>
          ) : null}

          <div className="space-y-5 border-t border-gray-200 pt-8 dark:border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.labelTemplates")}</p>
            <p className="mt-1 text-sm/6 text-gray-500 dark:text-gray-400">{t("settings.labelTemplatesHint")}</p>
          </div>
          {canManageTemplates ? (
            <button onClick={createNewTemplate} className={secondaryButtonClass}>
              {t("settings.newTemplate")}
            </button>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {templates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700">
                {t("settings.noTemplates")}
              </div>
            ) : (
              templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => {
                    setSelectedTemplateId(tpl.id);
                  }}
                  className={`w-full rounded-lg border p-4 text-left transition ${selectedTemplateId === tpl.id ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200 dark:border-blue-600 dark:bg-blue-900/20 dark:ring-blue-900" : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{tpl.name}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {tpl.is_default ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{t("settings.defaultTemplate")}</span> : null}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="space-y-6 border-t border-gray-200 pt-6 dark:border-gray-700">
            {selectedTemplateId === null && templates.length === 0 ? (
              <div className="text-sm text-gray-500">{t("settings.noTemplates")}</div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.templateName")}</label>
                    <input
                      value={templateDraft.name}
                      onChange={(e) => setTemplateDraft({ ...templateDraft, name: e.target.value })}
                      disabled={!canManageTemplates}
                      className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.templateDescription")}</label>
                    <input
                      value={templateDraft.description || ""}
                      onChange={(e) => setTemplateDraft({ ...templateDraft, description: e.target.value })}
                      disabled={!canManageTemplates}
                      className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.tsplTemplate")}</label>
                    </div>
                    <textarea
                      value={templateDraft.tspl_template}
                      onChange={(e) => setTemplateDraft({ ...templateDraft, tspl_template: e.target.value })}
                      rows={18}
                      disabled={!canManageTemplates}
                      className={`${monoTextareaClass} disabled:cursor-not-allowed disabled:opacity-60`}
                    />
                    {isAdmin && printMode === "server" ? (
                      <div className="flex items-center gap-2">
                        <button onClick={printTemplateNow} className={secondaryButtonClass}>
                          {t("settings.printNow")}
                        </button>
                        <button onClick={loadDefaultTSPL} className={secondaryButtonClass}>
                          {t("settings.loadDefaultTSPL")}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-4 border-t border-gray-200 pt-6 dark:border-white/10">
                    <PrinterInfoDropdown title={t("settings.templateVariables")}>
                      <div className="max-h-48 space-y-2 overflow-auto pr-1">
                        {(templateMeta?.variables || []).map((variable) => {
                          const translationKey = `settings.templateVariableDescriptions.${variable.key}`;
                          const translated = t(translationKey);
                          return (
                            <div key={variable.key} className="text-xs">
                              <div className="font-mono text-blue-500">{"{{"}{variable.key}{"}}"}</div>
                              <div className="text-gray-500 dark:text-gray-400">{translated === translationKey ? variable.description : translated}</div>
                            </div>
                          );
                        })}
                      </div>
                    </PrinterInfoDropdown>

                    <PrinterInfoDropdown title={t("settings.supportedCommands")}>
                      <div className="flex flex-wrap gap-2">
                        {(templateMeta?.supported_commands || []).map((command) => (
                          <span key={command} className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-600 dark:bg-gray-800 dark:text-gray-300">{command}</span>
                        ))}
                      </div>
                      <p className="mt-3 text-sm/6 text-gray-500 dark:text-gray-400">{t("settings.supportedCommandsHint")}</p>
                      <p className="mt-2 text-sm/6 text-gray-500 dark:text-gray-400">
                        {t("settings.supportedCommandsManualPrefix")}{" "}
                        <a href="https://emea.tscprinters.com/en/downloads" title={t("settings.supportedCommandsManualTitle")} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400">
                          https://emea.tscprinters.com/en/downloads
                        </a>
                      </p>
                    </PrinterInfoDropdown>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canManageTemplates ? (
                    <>
                      <button onClick={saveTemplate} className={primaryButtonClass}>
                        {selectedTemplateId === "new" ? t("settings.createTemplate") : t("common.save")}
                      </button>
                      {selectedTemplate ? <button onClick={makeDefaultTemplate} className={secondaryButtonClass}>{t("settings.makeDefault")}</button> : null}
                      {selectedTemplate ? <button onClick={deleteTemplate} className={dangerButtonClass}>{t("common.delete")}</button> : null}
                    </>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
        </div>
      </div>
      </div>
    </section>
  );
}
