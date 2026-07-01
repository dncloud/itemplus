"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Trash2 } from "lucide-react";
import type { AIProfileDraft, AISettingsDraft } from "@/components/settings/drafts";
import type { AIModelOption } from "@/lib/api";
import {
  createEmptyAIProfileDraft,
  createProviderDraft,
  defaultAIBaseURL,
  defaultAIModel,
  isAIKeyOptional,
} from "@/components/settings/drafts";
import { ChoiceTile, SelectField, ToggleRow } from "@/components/settings/ui";

type PromptTab = "chat" | "parse" | "category" | "property" | "vendor";

function promptValueForTab(profile: AIProfileDraft, tab: PromptTab) {
  switch (tab) {
    case "chat":
      return profile.chat_prompt;
    case "parse":
      return profile.parse_item_prompt;
    case "category":
      return profile.category_property_prompt;
    case "property":
      return profile.property_enhancement_prompt;
    case "vendor":
      return profile.vendor_prompt;
  }
}

function promptDefaultForTab(profile: AIProfileDraft, tab: PromptTab) {
  switch (tab) {
    case "chat":
      return profile.chat_prompt_default;
    case "parse":
      return profile.parse_item_prompt_default;
    case "category":
      return profile.category_property_prompt_default;
    case "property":
      return profile.property_enhancement_prompt_default;
    case "vendor":
      return profile.vendor_prompt_default;
  }
}

export function SettingsAISection({
  t,
  aiDraft,
  setAiDraft,
  selectedProfileId,
  setSelectedProfileId,
  aiTesting,
  aiModelsLoading,
  saveAISettings,
  testAISettings,
  loadAIModels,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
  aiDraft: AISettingsDraft;
  setAiDraft: Dispatch<SetStateAction<AISettingsDraft>>;
  selectedProfileId: string;
  setSelectedProfileId: (id: string) => void;
  aiTesting: boolean;
  aiModelsLoading: boolean;
  saveAISettings: () => void;
  testAISettings: () => void;
  loadAIModels: (profile: AIProfileDraft) => Promise<AIModelOption[]>;
  inputClass: string;
  primaryButtonClass: string;
  secondaryButtonClass: string;
}) {
  const [activePromptTab, setActivePromptTab] = useState<PromptTab>("chat");
  const [loadedModelsByProfile, setLoadedModelsByProfile] = useState<Record<string, AIModelOption[]>>({});
  const [modelStatus, setModelStatus] = useState<{ profileId: string; message: string } | null>(null);

  const selectedProfile = useMemo(
    () => aiDraft.profiles.find((profile) => profile.id === selectedProfileId) || aiDraft.profiles[0] || null,
    [aiDraft.profiles, selectedProfileId],
  );

  const updateSelectedProfile = (updater: (profile: AIProfileDraft) => AIProfileDraft) => {
    if (!selectedProfile) return;
    setAiDraft((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) => (profile.id === selectedProfile.id ? updater(profile) : profile)),
    }));
  };

  const addProfile = (provider: AIProfileDraft["provider"]) => {
    setAiDraft((prev) => {
      const next = createEmptyAIProfileDraft(provider, prev.profiles.length + 1);
      next.id = `profile-${Date.now()}`;
      return {
        ...prev,
        active_profile_id: next.id,
        profiles: [...prev.profiles, next],
      };
    });
  };

  const removeProfile = () => {
    if (!selectedProfile || aiDraft.profiles.length <= 1) return;
    setAiDraft((prev) => {
      const remaining = prev.profiles.filter((profile) => profile.id !== selectedProfile.id);
      const nextActive = prev.active_profile_id === selectedProfile.id ? remaining[0]?.id || "" : prev.active_profile_id;
      setSelectedProfileId(nextActive);
      return {
        ...prev,
        active_profile_id: nextActive,
        profiles: remaining,
      };
    });
  };

  const promptTabs: Array<{ id: PromptTab; label: string; hint: string }> = [
    { id: "chat", label: t("settings.aiPromptChat"), hint: t("settings.aiPromptChatHint") },
    { id: "parse", label: t("settings.aiParsePrompt"), hint: t("settings.aiParsePromptHint") },
    { id: "category", label: t("settings.aiCategoryPrompt"), hint: t("settings.aiCategoryPromptHint") },
    { id: "property", label: t("settings.aiPropertyPrompt"), hint: t("settings.aiPropertyPromptHint") },
    { id: "vendor", label: t("settings.aiVendorPrompt"), hint: t("settings.aiVendorPromptHint") },
  ];

  const isLegacyProfile = selectedProfile?.id === "profile-1";
  const loadedModels = selectedProfile ? loadedModelsByProfile[selectedProfile.id] || [] : [];
  const selectedModelOption =
    selectedProfile && loadedModels.some((option) => option.id === selectedProfile.model) ? selectedProfile.model : "";
  const visibleModelStatus = selectedProfile && modelStatus?.profileId === selectedProfile.id ? modelStatus.message : null;
  const apiKeyPreview = selectedProfile?.api_key_preview?.trim() || "";

  const onLoadModels = async () => {
    if (!selectedProfile || selectedProfile.provider !== "openai") return;
    try {
      const models = await loadAIModels(selectedProfile);
      setLoadedModelsByProfile((prev) => ({ ...prev, [selectedProfile.id]: models }));
      setModelStatus({
        profileId: selectedProfile.id,
        message:
          models.length > 0
            ? t("settings.aiModelsLoaded", { count: models.length })
            : t("settings.aiNoModelsFound"),
      });
    } catch {
      // parent handles notifications
    }
  };

  return (
    <section id="ai" className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[16rem_minmax(0,1fr)]">
      <div>
        <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">{t("settings.sectionAI")}</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("settings.aiHint")}</p>
      </div>

      <div className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
        <div className="space-y-8 px-4 py-6 sm:p-8 md:max-w-5xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.aiProfiles")}</p>
              <p className="mt-1 text-sm/6 text-gray-500 dark:text-gray-400">{t("settings.aiPromptTemplatesHint")}</p>
            </div>
            <div className="flex flex-wrap gap-2 lg:ml-auto lg:justify-end">
              <button type="button" onClick={() => addProfile("openai")} className={secondaryButtonClass}>
                {t("settings.aiAddOpenAIProfile")}
              </button>
              <button type="button" onClick={() => addProfile("ollama")} className={secondaryButtonClass}>
                {t("settings.aiAddOllamaProfile")}
              </button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {aiDraft.profiles.map((profile) => {
              const active = profile.id === selectedProfile?.id;
              const isActiveProfile = profile.id === aiDraft.active_profile_id;
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => setSelectedProfileId(profile.id)}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    active
                      ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200 dark:border-blue-600 dark:bg-blue-900/20 dark:ring-blue-900"
                      : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {profile.name || t("settings.aiUnnamedProfile")}
                      </div>
                      <div className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                        {profile.provider === "ollama" ? "Ollama" : "OpenAI"} · {profile.model || defaultAIModel(profile.provider)}
                      </div>
                    </div>
                    {isActiveProfile ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        {t("settings.aiActiveProfile")}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedProfile ? (
            <>
              <div className="space-y-6 border-t border-gray-200 pt-8 dark:border-white/10">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div>
                    <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.aiProfileName")}</label>
                    <input
                      value={selectedProfile.name}
                      onChange={(e) => updateSelectedProfile((profile) => ({ ...profile, name: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAiDraft((prev) => ({ ...prev, active_profile_id: selectedProfile.id }))}
                      className={secondaryButtonClass}
                    >
                      {t("settings.aiUseThisProfile")}
                    </button>
                    <button
                      type="button"
                      onClick={removeProfile}
                      disabled={aiDraft.profiles.length <= 1 || isLegacyProfile}
                      title={isLegacyProfile ? t("settings.aiLegacyProfileLocked") : undefined}
                      className={`${secondaryButtonClass} disabled:opacity-50`}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("common.delete")}
                    </button>
                  </div>
                </div>

                <ToggleRow
                  title={t("settings.aiEnabled")}
                  description={t("settings.aiEnabledHint")}
                  checked={selectedProfile.enabled}
                  onToggle={() => updateSelectedProfile((profile) => ({ ...profile, enabled: !profile.enabled }))}
                />

                <div className="space-y-3">
                  <label className="block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.aiProvider")}</label>
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                    <ChoiceTile
                      active={selectedProfile.provider === "ollama"}
                      onClick={() =>
                        updateSelectedProfile((profile) => createProviderDraft("ollama", profile, aiDraft.profiles.length))
                      }
                      title={t("settings.aiProviderOllama")}
                      description={t("settings.aiProviderOllamaHint")}
                    />
                    <ChoiceTile
                      active={selectedProfile.provider === "openai"}
                      onClick={() =>
                        updateSelectedProfile((profile) => createProviderDraft("openai", profile, aiDraft.profiles.length))
                      }
                      title="OpenAI"
                      description={t("settings.aiProviderOpenAIHint")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <label className="block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.aiModel")}</label>
                      {selectedProfile.provider === "openai" ? (
                        <button
                          type="button"
                          onClick={onLoadModels}
                          disabled={aiModelsLoading}
                          className={`${secondaryButtonClass} !px-3 !py-1.5 text-xs disabled:opacity-50`}
                        >
                          {aiModelsLoading ? t("settings.aiLoadingModels") : t("settings.aiLoadModels")}
                        </button>
                      ) : null}
                    </div>
                    {selectedProfile.provider === "openai" && loadedModels.length > 0 ? (
                      <div className="mb-3">
                        <SelectField
                          label={t("settings.aiAvailableModels")}
                          value={selectedModelOption || loadedModels[0]?.id || ""}
                          onChange={(value) => updateSelectedProfile((profile) => ({ ...profile, model: String(value) }))}
                          options={loadedModels.map((option) => ({
                            value: option.id,
                            label: option.id,
                          }))}
                        />
                      </div>
                    ) : null}
                    <input
                      value={selectedProfile.model}
                      onChange={(e) => updateSelectedProfile((profile) => ({ ...profile, model: e.target.value }))}
                      className={inputClass}
                      placeholder={defaultAIModel(selectedProfile.provider)}
                    />
                    <div className="mt-2 space-y-1 text-sm/6 text-gray-500 dark:text-gray-400">
                      {selectedProfile.provider === "openai" ? <p>{t("settings.aiModelHint")}</p> : null}
                      {visibleModelStatus ? <p className="text-blue-600 dark:text-blue-300">{visibleModelStatus}</p> : null}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.aiBaseUrl")}</label>
                    <input
                      value={selectedProfile.base_url}
                      onChange={(e) => updateSelectedProfile((profile) => ({ ...profile, base_url: e.target.value }))}
                      className={inputClass}
                      placeholder={defaultAIBaseURL(selectedProfile.provider)}
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="mb-2 block text-sm/6 font-medium text-gray-900 dark:text-white">
                      {isAIKeyOptional(selectedProfile.provider) ? t("settings.aiApiKeyOptional") : t("settings.aiApiKey")}
                    </label>
                    <input
                      type="password"
                      value={selectedProfile.api_key}
                      onChange={(e) => updateSelectedProfile((profile) => ({ ...profile, api_key: e.target.value }))}
                      className={inputClass}
                      placeholder={
                        apiKeyPreview
                          ? apiKeyPreview
                          : selectedProfile.has_api_key
                            ? t("settings.aiApiKeyStored")
                            : isAIKeyOptional(selectedProfile.provider)
                              ? t("settings.aiApiKeyOptionalPlaceholder")
                              : "sk-..."
                      }
                    />
                    <p className="mt-2 text-sm/6 text-gray-500 dark:text-gray-400">
                      {isAIKeyOptional(selectedProfile.provider) ? t("settings.aiApiKeyOptionalHint") : t("settings.aiApiKeyHint")}
                      {apiKeyPreview ? (
                        <span className="ml-2 inline-flex rounded-md border border-gray-200 px-1.5 py-0.5 font-mono text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
                          {t("settings.aiApiKeyCurrent", { preview: apiKeyPreview })}
                        </span>
                      ) : null}
                    </p>
                  </div>

                  {selectedProfile.provider === "ollama" ? (
                    <div className="lg:col-span-2 border-t border-gray-200 pt-6 dark:border-white/10">
                      <ToggleRow
                        title={t("settings.aiSupportsVision")}
                        description={t("settings.aiSupportsVisionHint")}
                        checked={selectedProfile.supports_vision}
                        onToggle={() => updateSelectedProfile((profile) => ({ ...profile, supports_vision: !profile.supports_vision }))}
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-5 border-t border-gray-200 pt-8 dark:border-white/10">
                <div>
                  <p className="text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.aiPromptTemplates")}</p>
                  <p className="mt-1 text-sm/6 text-gray-500 dark:text-gray-400">{t("settings.aiPromptTemplatesHint")}</p>
                </div>

                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                  {promptTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActivePromptTab(tab.id)}
                      className={`w-full rounded-lg border p-4 text-left transition ${
                        activePromptTab === tab.id
                          ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200 dark:border-blue-600 dark:bg-blue-900/20 dark:ring-blue-900"
                          : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{tab.label}</div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tab.hint}</div>
                    </button>
                  ))}
                </div>

                <div className="space-y-4 border-t border-gray-200 pt-6 dark:border-white/10">
                  <textarea
                    value={promptValueForTab(selectedProfile, activePromptTab)}
                    onChange={(e) =>
                      updateSelectedProfile((profile) => {
                        if (activePromptTab === "chat") return { ...profile, chat_prompt: e.target.value };
                        if (activePromptTab === "parse") return { ...profile, parse_item_prompt: e.target.value };
                        if (activePromptTab === "category") return { ...profile, category_property_prompt: e.target.value };
                        if (activePromptTab === "property") return { ...profile, property_enhancement_prompt: e.target.value };
                        return { ...profile, vendor_prompt: e.target.value };
                      })
                    }
                    rows={14}
                    className={`${inputClass} min-h-72 font-mono text-xs`}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedProfile((profile) => {
                          const nextValue = promptDefaultForTab(profile, activePromptTab);
                          if (activePromptTab === "chat") return { ...profile, chat_prompt: nextValue };
                          if (activePromptTab === "parse") return { ...profile, parse_item_prompt: nextValue };
                          if (activePromptTab === "category") return { ...profile, category_property_prompt: nextValue };
                          if (activePromptTab === "property") return { ...profile, property_enhancement_prompt: nextValue };
                          return { ...profile, vendor_prompt: nextValue };
                        })
                      }
                      className={secondaryButtonClass}
                    >
                      {t("settings.aiRestoreDefaults")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-8 dark:border-white/10">
                <button onClick={saveAISettings} className={primaryButtonClass}>
                  {t("common.save")}
                </button>
                <button onClick={testAISettings} disabled={aiTesting} className={`${secondaryButtonClass} disabled:opacity-50`}>
                  {aiTesting ? t("settings.aiTesting") : t("settings.aiTestConnection")}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
