"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Building2, ChevronDown, Cloud, Cpu, type LucideIcon, MessageSquare, Plus, ScanText, SlidersHorizontal, Sparkles, Tag, Trash2 } from "lucide-react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { AI_PROVIDERS, type AIProvider, aiProviderLabel, isHostedAIProvider } from "@/lib/ai-providers";
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

const providerIcon: Record<AIProvider, LucideIcon> = { openai: Cloud, anthropic: Sparkles, ollama: Cpu };
const providerHint: Record<AIProvider, string> = {
  openai: "settings.aiProviderOpenAIHint",
  anthropic: "settings.aiProviderAnthropicHint",
  ollama: "settings.aiProviderOllamaHint",
};

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

  const promptTabs: Array<{ id: PromptTab; label: string; hint: string; icon: LucideIcon }> = [
    { id: "chat", label: t("settings.aiPromptChat"), hint: t("settings.aiPromptChatHint"), icon: MessageSquare },
    { id: "parse", label: t("settings.aiParsePrompt"), hint: t("settings.aiParsePromptHint"), icon: ScanText },
    { id: "category", label: t("settings.aiCategoryPrompt"), hint: t("settings.aiCategoryPromptHint"), icon: Tag },
    { id: "property", label: t("settings.aiPropertyPrompt"), hint: t("settings.aiPropertyPromptHint"), icon: SlidersHorizontal },
    { id: "vendor", label: t("settings.aiVendorPrompt"), hint: t("settings.aiVendorPromptHint"), icon: Building2 },
  ];

  const isLegacyProfile = selectedProfile?.id === "profile-1";
  const loadedModels = selectedProfile ? loadedModelsByProfile[selectedProfile.id] || [] : [];
  const selectedModelOption =
    selectedProfile && loadedModels.some((option) => option.id === selectedProfile.model) ? selectedProfile.model : "";
  const visibleModelStatus = selectedProfile && modelStatus?.profileId === selectedProfile.id ? modelStatus.message : null;
  const apiKeyPreview = selectedProfile?.api_key_preview?.trim() || "";

  const onLoadModels = async () => {
    if (!selectedProfile || !isHostedAIProvider(selectedProfile.provider)) return;
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
            {/* One button; the provider is chosen in its menu. */}
            <Menu as="div" className="relative shrink-0 lg:ml-auto">
              <MenuButton className={`inline-flex items-center gap-x-1.5 ${secondaryButtonClass}`}>
                <Plus aria-hidden="true" className="-ml-0.5 size-4" />
                {t("settings.aiAddProfile")}
                <ChevronDown aria-hidden="true" className="-mr-1 size-4 text-gray-400" />
              </MenuButton>
              <MenuItems
                anchor="bottom end"
                transition
                className="z-50 mt-2 w-72 origin-top-right rounded-md bg-white py-1 shadow-lg outline-1 outline-black/5 transition data-[closed]:scale-95 data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
              >
                {AI_PROVIDERS.map((provider) => {
                  const Icon = providerIcon[provider];
                  return (
                    <MenuItem key={provider}>
                      <button
                        type="button"
                        onClick={() => addProfile(provider)}
                        className="group flex w-full items-center gap-3 px-3 py-2 text-left data-[focus]:bg-gray-50 data-[focus]:outline-hidden dark:data-[focus]:bg-white/5"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 group-data-[focus]:bg-indigo-600 group-data-[focus]:text-white dark:bg-white/10 dark:text-gray-400 dark:group-data-[focus]:bg-indigo-500">
                          <Icon aria-hidden="true" className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-gray-900 dark:text-white">{aiProviderLabel(provider)}</span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400">{t(providerHint[provider])}</span>
                        </span>
                      </button>
                    </MenuItem>
                  );
                })}
              </MenuItems>
            </Menu>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {aiDraft.profiles.map((profile) => (
              <ChoiceTile
                key={profile.id}
                active={profile.id === selectedProfile?.id}
                onClick={() => setSelectedProfileId(profile.id)}
                icon={providerIcon[profile.provider] || Cloud}
                title={profile.name || t("settings.aiUnnamedProfile")}
                description={`${aiProviderLabel(profile.provider)} · ${profile.model || defaultAIModel(profile.provider)}`}
                badge={profile.id === aiDraft.active_profile_id ? t("settings.aiActiveProfile") : undefined}
              />
            ))}
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
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                    {AI_PROVIDERS.map((provider) => (
                      <ChoiceTile
                        key={provider}
                        active={selectedProfile.provider === provider}
                        icon={providerIcon[provider]}
                        onClick={() => updateSelectedProfile((profile) => createProviderDraft(provider, profile, aiDraft.profiles.length))}
                        title={aiProviderLabel(provider)}
                        description={t(providerHint[provider])}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <label className="block text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.aiModel")}</label>
                      {isHostedAIProvider(selectedProfile.provider) ? (
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
                    {isHostedAIProvider(selectedProfile.provider) && loadedModels.length > 0 ? (
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
                      {isHostedAIProvider(selectedProfile.provider) ? <p>{t("settings.aiModelHint")}</p> : null}
                      {visibleModelStatus ? <p className="text-indigo-600 dark:text-indigo-300">{visibleModelStatus}</p> : null}
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

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {promptTabs.map((tab) => (
                    <ChoiceTile
                      key={tab.id}
                      active={activePromptTab === tab.id}
                      onClick={() => setActivePromptTab(tab.id)}
                      icon={tab.icon}
                      title={tab.label}
                      description={tab.hint}
                    />
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
