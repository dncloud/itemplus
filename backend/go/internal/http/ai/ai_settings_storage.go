package ai

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	aicore "github.com/itemplus/backend/internal/core/ai"
	"github.com/itemplus/backend/internal/database"
)

func loadAISettings() aiSettingsResponse {
	activeProfileID, profiles := loadAIProfilesWithSecret()
	responseProfiles := make([]aiProfileResponse, 0, len(profiles))
	for _, profile := range profiles {
		responseProfiles = append(responseProfiles, profileResponseFromSettings(profile))
	}
	if len(responseProfiles) == 0 {
		fallback := normalizeAIProfile(aicore.AISettings{
			ProfileID:   "profile-1",
			ProfileName: "OpenAI",
			Provider:    "openai",
			Enabled:     false,
		}, "profile-1", "OpenAI", true)
		responseProfiles = append(responseProfiles, profileResponseFromSettings(fallback))
		activeProfileID = fallback.ProfileID
	}
	return aiSettingsResponse{
		ActiveProfileID: activeProfileID,
		Profiles:        responseProfiles,
	}
}

func loadLegacyAISettingsWithSecret() aicore.AISettings {
	var provider sql.NullString
	var model sql.NullString
	var baseURL sql.NullString
	var apiKey sql.NullString
	var enabled sql.NullString
	var chatPrompt sql.NullString
	var parseItemPrompt sql.NullString
	var categoryPropertyPrompt sql.NullString
	var propertyEnhancementPrompt sql.NullString
	var vendorPrompt sql.NullString

	_ = database.DB.Get(&provider, "SELECT value FROM app_settings WHERE `key` = ?", "ai.provider")
	_ = database.DB.Get(&model, "SELECT value FROM app_settings WHERE `key` = ?", "ai.model")
	_ = database.DB.Get(&baseURL, "SELECT value FROM app_settings WHERE `key` = ?", "ai.base_url")
	_ = database.DB.Get(&apiKey, "SELECT value FROM app_settings WHERE `key` = ?", "ai.api_key")
	_ = database.DB.Get(&enabled, "SELECT value FROM app_settings WHERE `key` = ?", "ai.enabled")
	_ = database.DB.Get(&chatPrompt, "SELECT value FROM app_settings WHERE `key` = ?", "ai.chat_prompt")
	_ = database.DB.Get(&parseItemPrompt, "SELECT value FROM app_settings WHERE `key` = ?", "ai.parse_item_prompt")
	_ = database.DB.Get(&categoryPropertyPrompt, "SELECT value FROM app_settings WHERE `key` = ?", "ai.category_property_prompt")
	_ = database.DB.Get(&propertyEnhancementPrompt, "SELECT value FROM app_settings WHERE `key` = ?", "ai.property_enhancement_prompt")
	_ = database.DB.Get(&vendorPrompt, "SELECT value FROM app_settings WHERE `key` = ?", "ai.vendor_prompt")

	settings := aicore.AISettings{
		ProfileID:   "profile-1",
		ProfileName: "Legacy AI profile",
		Provider:    "openai",
		Model:       defaultAIModel("openai"),
		BaseURL:     defaultAIBaseURL("openai"),
		Enabled:     false,
	}
	if provider.Valid && strings.TrimSpace(provider.String) != "" {
		settings.Provider = normalizeAIProvider(provider.String)
		if settings.Provider == "openai_compatible" {
			settings.Provider = "openai"
		}
	}
	if model.Valid && strings.TrimSpace(model.String) != "" {
		settings.Model = strings.TrimSpace(model.String)
	}
	if baseURL.Valid && strings.TrimSpace(baseURL.String) != "" {
		settings.BaseURL = strings.TrimSpace(baseURL.String)
	}
	if apiKey.Valid && strings.TrimSpace(apiKey.String) != "" {
		settings.APIKey = strings.TrimSpace(apiKey.String)
	}
	if enabled.Valid {
		settings.Enabled = parseFlexibleBool(enabled.String, settings.Enabled)
	}
	if chatPrompt.Valid && strings.TrimSpace(chatPrompt.String) != "" {
		settings.ChatPrompt = strings.TrimSpace(chatPrompt.String)
	}
	if parseItemPrompt.Valid && strings.TrimSpace(parseItemPrompt.String) != "" {
		settings.ParseItemPrompt = strings.TrimSpace(parseItemPrompt.String)
	}
	if categoryPropertyPrompt.Valid && strings.TrimSpace(categoryPropertyPrompt.String) != "" {
		settings.CategoryPropertyPrompt = strings.TrimSpace(categoryPropertyPrompt.String)
	}
	if propertyEnhancementPrompt.Valid && strings.TrimSpace(propertyEnhancementPrompt.String) != "" {
		settings.PropertyEnhancementPrompt = strings.TrimSpace(propertyEnhancementPrompt.String)
	}
	if vendorPrompt.Valid && strings.TrimSpace(vendorPrompt.String) != "" {
		settings.VendorPrompt = strings.TrimSpace(vendorPrompt.String)
	}
	return normalizeAIProfile(settings, "profile-1", "Legacy AI profile", true)
}

func loadAIProfilesWithSecret() (string, []aicore.AISettings) {
	var rawProfiles sql.NullString
	var activeProfileID sql.NullString

	_ = database.DB.Get(&rawProfiles, "SELECT value FROM app_settings WHERE `key` = ?", aiProfilesSettingKey)
	_ = database.DB.Get(&activeProfileID, "SELECT value FROM app_settings WHERE `key` = ?", aiActiveProfileSettingKey)

	if rawProfiles.Valid && strings.TrimSpace(rawProfiles.String) != "" {
		var storedProfiles []storedAIProfile
		if err := json.Unmarshal([]byte(rawProfiles.String), &storedProfiles); err == nil && len(storedProfiles) > 0 {
			profiles := make([]aicore.AISettings, 0, len(storedProfiles))
			for index, storedProfile := range storedProfiles {
				profiles = append(profiles, normalizeAIProfile(aicore.AISettings{
					ProfileID:                 strings.TrimSpace(storedProfile.ID),
					ProfileName:               strings.TrimSpace(storedProfile.Name),
					Provider:                  strings.TrimSpace(storedProfile.Provider),
					Model:                     strings.TrimSpace(storedProfile.Model),
					BaseURL:                   strings.TrimSpace(storedProfile.BaseURL),
					APIKey:                    strings.TrimSpace(storedProfile.APIKey),
					Enabled:                   storedProfile.Enabled,
					SupportsVision:            storedProfile.SupportsVision,
					ChatPrompt:                strings.TrimSpace(storedProfile.ChatPrompt),
					ParseItemPrompt:           strings.TrimSpace(storedProfile.ParseItemPrompt),
					CategoryPropertyPrompt:    strings.TrimSpace(storedProfile.CategoryPropertyPrompt),
					PropertyEnhancementPrompt: strings.TrimSpace(storedProfile.PropertyEnhancementPrompt),
					VendorPrompt:              strings.TrimSpace(storedProfile.VendorPrompt),
				}, fmt.Sprintf("profile-%d", index+1), fmt.Sprintf("AI profile %d", index+1), true))
			}

			activeID := strings.TrimSpace(activeProfileID.String)
			if activeID == "" {
				activeID = profiles[0].ProfileID
			}
			for _, profile := range profiles {
				if profile.ProfileID == activeID {
					return activeID, profiles
				}
			}
			return profiles[0].ProfileID, profiles
		}
	}

	legacy := loadLegacyAISettingsWithSecret()
	return legacy.ProfileID, []aicore.AISettings{legacy}
}

func loadAISettingsWithSecret() aicore.AISettings {
	activeProfileID, profiles := loadAIProfilesWithSecret()
	for _, profile := range profiles {
		if profile.ProfileID == activeProfileID {
			return profile
		}
	}
	if len(profiles) > 0 {
		return profiles[0]
	}
	return normalizeAIProfile(aicore.AISettings{
		ProfileID:   "profile-1",
		ProfileName: "OpenAI",
		Provider:    "openai",
		Enabled:     false,
	}, "profile-1", "OpenAI", true)
}

func saveAISettingsBundle(activeProfileID string, profiles []aicore.AISettings) error {
	now := database.TimestampNow()
	storedProfiles := make([]storedAIProfile, 0, len(profiles))
	for index, profile := range profiles {
		normalized := normalizeAIProfile(profile, fmt.Sprintf("profile-%d", index+1), fmt.Sprintf("AI profile %d", index+1), true)
		storedProfiles = append(storedProfiles, storedAIProfile{
			ID:                        normalized.ProfileID,
			Name:                      normalized.ProfileName,
			Provider:                  normalized.Provider,
			Model:                     normalized.Model,
			BaseURL:                   normalized.BaseURL,
			APIKey:                    strings.TrimSpace(normalized.APIKey),
			Enabled:                   normalized.Enabled,
			SupportsVision:            normalized.SupportsVision,
			ChatPrompt:                normalized.ChatPrompt,
			ParseItemPrompt:           normalized.ParseItemPrompt,
			CategoryPropertyPrompt:    normalized.CategoryPropertyPrompt,
			PropertyEnhancementPrompt: normalized.PropertyEnhancementPrompt,
			VendorPrompt:              normalized.VendorPrompt,
		})
	}
	rawProfiles, err := json.Marshal(storedProfiles)
	if err != nil {
		return err
	}
	if err := database.UpsertAppSetting(aiProfilesSettingKey, string(rawProfiles), now); err != nil {
		return err
	}
	return database.UpsertAppSetting(aiActiveProfileSettingKey, strings.TrimSpace(activeProfileID), now)
}
