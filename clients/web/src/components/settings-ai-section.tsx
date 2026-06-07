"use client";

import type { Dispatch, SetStateAction } from "react";
import { SparklesIcon } from "@heroicons/react/24/outline";
import type { AISettingsDraft } from "@/components/settings-drafts";
import { ChoiceTile, SettingsCard, StatusMessage, ToggleRow } from "@/components/settings-ui";

type AIProvider = AISettingsDraft["provider"];

export function SettingsAISection({
  t,
  aiDraft,
  setAiDraft,
  aiTesting,
  aiStatus,
  saveAISettings,
  testAISettings,
  defaultAIModel,
  defaultAIBaseURL,
  isAIKeyOptional,
  createProviderDraft,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
  aiDraft: AISettingsDraft;
  setAiDraft: Dispatch<SetStateAction<AISettingsDraft>>;
  aiTesting: boolean;
  aiStatus: string | null;
  saveAISettings: () => void;
  testAISettings: () => void;
  defaultAIModel: (provider: AIProvider) => string;
  defaultAIBaseURL: (provider: AIProvider) => string;
  isAIKeyOptional: (provider: AIProvider) => boolean;
  createProviderDraft: (provider: AIProvider, previous?: AISettingsDraft) => AISettingsDraft;
  inputClass: string;
  primaryButtonClass: string;
  secondaryButtonClass: string;
}) {
  return (
    <SettingsCard
      sectionId="ai"
      icon={SparklesIcon}
      title={t("settings.sectionAI")}
      description={t("settings.aiHint")}
    >
      <div className="space-y-5">
        <ToggleRow
          title={t("settings.aiEnabled")}
          description={t("settings.aiEnabledHint")}
          checked={aiDraft.enabled}
          onToggle={() => setAiDraft((prev) => ({ ...prev, enabled: !prev.enabled }))}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.aiProvider")}</label>
            <div className="grid grid-cols-1 gap-2">
              <ChoiceTile
                active={aiDraft.provider === "ollama"}
                onClick={() => setAiDraft((prev) => createProviderDraft("ollama", prev))}
                title={t("settings.aiProviderOllama")}
                description={t("settings.aiProviderOllamaHint")}
              />
              <ChoiceTile
                active={aiDraft.provider === "openai"}
                onClick={() => setAiDraft((prev) => createProviderDraft("openai", prev))}
                title="OpenAI"
                description={t("settings.aiProviderOpenAIHint")}
              />
              <ChoiceTile
                active={aiDraft.provider === "openai_compatible"}
                onClick={() => setAiDraft((prev) => createProviderDraft("openai_compatible", prev))}
                title={t("settings.aiProviderCompatible")}
                description={t("settings.aiProviderCompatibleHint")}
              />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.aiModel")}</label>
              <input
                value={aiDraft.model}
                onChange={(e) => setAiDraft((prev) => ({ ...prev, model: e.target.value }))}
                className={inputClass}
                placeholder={defaultAIModel(aiDraft.provider) || t("settings.aiModelPlaceholder")}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.aiBaseUrl")}</label>
              <input
                value={aiDraft.base_url}
                onChange={(e) => setAiDraft((prev) => ({ ...prev, base_url: e.target.value }))}
                className={inputClass}
                placeholder={defaultAIBaseURL(aiDraft.provider)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">
                {isAIKeyOptional(aiDraft.provider) ? t("settings.aiApiKeyOptional") : t("settings.aiApiKey")}
              </label>
              <input
                type="password"
                value={aiDraft.api_key}
                onChange={(e) => setAiDraft((prev) => ({ ...prev, api_key: e.target.value }))}
                className={inputClass}
                placeholder={
                  aiDraft.has_api_key
                    ? t("settings.aiApiKeyStored")
                    : isAIKeyOptional(aiDraft.provider)
                      ? t("settings.aiApiKeyOptionalPlaceholder")
                      : "sk-..."
                }
              />
              <p className="mt-2 text-sm/6 text-gray-500 dark:text-gray-400">
                {aiDraft.has_api_key
                  ? t("settings.aiApiKeyStoredHint")
                  : isAIKeyOptional(aiDraft.provider)
                    ? t("settings.aiApiKeyOptionalHint")
                    : t("settings.aiApiKeyHint")}
              </p>
            </div>
          </div>
          <div className="lg:col-span-2">
            <p className="text-sm/6 text-gray-500 dark:text-gray-400">
              {t("settings.aiProviderCurrentHint", {
                provider:
                  aiDraft.provider === "ollama"
                    ? t("settings.aiProviderOllama")
                    : aiDraft.provider === "openai"
                      ? "OpenAI"
                      : t("settings.aiProviderCompatible"),
              })}
            </p>
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div>
              <p className="text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.aiPromptTemplates")}</p>
              <p className="mt-1 text-sm/6 text-gray-500 dark:text-gray-400">{t("settings.aiPromptTemplatesHint")}</p>
            </div>
            <div>
              <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.aiParsePrompt")}</label>
              <textarea
                value={aiDraft.parse_item_prompt}
                onChange={(e) => setAiDraft((prev) => ({ ...prev, parse_item_prompt: e.target.value }))}
                rows={10}
                className={`${inputClass} min-h-44 font-mono text-xs`}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.aiCategoryPrompt")}</label>
              <textarea
                value={aiDraft.category_property_prompt}
                onChange={(e) => setAiDraft((prev) => ({ ...prev, category_property_prompt: e.target.value }))}
                rows={12}
                className={`${inputClass} min-h-52 font-mono text-xs`}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.aiPropertyPrompt")}</label>
              <textarea
                value={aiDraft.property_enhancement_prompt}
                onChange={(e) => setAiDraft((prev) => ({ ...prev, property_enhancement_prompt: e.target.value }))}
                rows={12}
                className={`${inputClass} min-h-52 font-mono text-xs`}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={saveAISettings} className={primaryButtonClass}>
            {t("common.save")}
          </button>
          <button
            onClick={() =>
              setAiDraft((prev) => ({
                ...prev,
                parse_item_prompt: prev.parse_item_prompt_default,
                category_property_prompt: prev.category_property_prompt_default,
                property_enhancement_prompt: prev.property_enhancement_prompt_default,
              }))
            }
            className={secondaryButtonClass}
            type="button"
          >
            {t("settings.aiRestoreDefaults")}
          </button>
          <button onClick={testAISettings} disabled={aiTesting} className={`${secondaryButtonClass} disabled:opacity-50`}>
            {aiTesting ? t("settings.aiTesting") : t("settings.aiTestConnection")}
          </button>
          {aiStatus ? (
            <StatusMessage tone={aiStatus.startsWith(t("settings.aiTestSucceeded")) || aiStatus === t("settings.aiSaved") ? "success" : "error"}>
              {aiStatus}
            </StatusMessage>
          ) : null}
        </div>
      </div>
    </SettingsCard>
  );
}
