package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
	"github.com/itemplus/backend/internal/services"
)

const (
	aiProfilesSettingKey      = "ai.profiles"
	aiActiveProfileSettingKey = "ai.active_profile_id"
	legacyAIProfileID         = "profile-1"
)

type aiProfileResponse struct {
	ID                               string `json:"id"`
	Name                             string `json:"name"`
	Provider                         string `json:"provider"`
	Model                            string `json:"model"`
	BaseURL                          string `json:"base_url"`
	Enabled                          bool   `json:"enabled"`
	SupportsVision                   bool   `json:"supports_vision"`
	HasAPIKey                        bool   `json:"has_api_key"`
	APIKeyPreview                    string `json:"api_key_preview,omitempty"`
	ChatPrompt                       string `json:"chat_prompt"`
	ParseItemPrompt                  string `json:"parse_item_prompt"`
	CategoryPropertyPrompt           string `json:"category_property_prompt"`
	PropertyEnhancementPrompt        string `json:"property_enhancement_prompt"`
	ChatPromptDefault                string `json:"chat_prompt_default"`
	ParseItemPromptDefault           string `json:"parse_item_prompt_default"`
	CategoryPropertyPromptDefault    string `json:"category_property_prompt_default"`
	PropertyEnhancementPromptDefault string `json:"property_enhancement_prompt_default"`
}

type aiSettingsResponse struct {
	ActiveProfileID string              `json:"active_profile_id"`
	Profiles        []aiProfileResponse `json:"profiles"`
}

type aiModelListResponse struct {
	Models []services.AIModelOption `json:"models"`
}

type aiProfilePayload struct {
	ID                        string `json:"id"`
	Name                      string `json:"name"`
	Provider                  string `json:"provider"`
	Model                     string `json:"model"`
	BaseURL                   string `json:"base_url"`
	APIKey                    string `json:"api_key"`
	Enabled                   *bool  `json:"enabled"`
	SupportsVision            *bool  `json:"supports_vision"`
	ChatPrompt                string `json:"chat_prompt"`
	ParseItemPrompt           string `json:"parse_item_prompt"`
	CategoryPropertyPrompt    string `json:"category_property_prompt"`
	PropertyEnhancementPrompt string `json:"property_enhancement_prompt"`
}

type aiSettingsPayload struct {
	ActiveProfileID string             `json:"active_profile_id"`
	Profiles        []aiProfilePayload `json:"profiles"`
}

type storedAIProfile struct {
	ID                        string `json:"id"`
	Name                      string `json:"name"`
	Provider                  string `json:"provider"`
	Model                     string `json:"model"`
	BaseURL                   string `json:"base_url"`
	APIKey                    string `json:"api_key"`
	Enabled                   bool   `json:"enabled"`
	SupportsVision            bool   `json:"supports_vision"`
	ChatPrompt                string `json:"chat_prompt"`
	ParseItemPrompt           string `json:"parse_item_prompt"`
	CategoryPropertyPrompt    string `json:"category_property_prompt"`
	PropertyEnhancementPrompt string `json:"property_enhancement_prompt"`
}

func adminGetAISettings(c *gin.Context) {
	c.JSON(http.StatusOK, loadAISettings())
}

func adminUpdateAISettings(c *gin.Context) {
	activeProfileID, profiles, err := parseAISettingsPayload(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	if err := saveAISettingsBundle(activeProfileID, profiles); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not save AI settings"})
		return
	}

	user := middleware.GetUser(c)
	audit(user.ID, "ai.settings.update", "AI settings updated")
	c.JSON(http.StatusOK, loadAISettings())
}

func adminTestAISettings(c *gin.Context) {
	profile, err := parseAIProfilePayload(c, false)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	result, err := services.TestAIConnection(profile)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"detail": err.Error()})
		return
	}

	user := middleware.GetUser(c)
	audit(user.ID, "ai.settings.test", "AI connection test succeeded")
	c.JSON(http.StatusOK, result)
}

func adminListAIModels(c *gin.Context) {
	profile, err := parseAIProfilePayload(c, false)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	if profile.Provider != "openai" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Model loading is only supported for OpenAI profiles"})
		return
	}

	models, err := services.ListOpenAIModels(profile)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, aiModelListResponse{Models: models})
}

func normalizeAIProvider(provider string) string {
	provider = strings.ToLower(strings.TrimSpace(provider))
	if provider == "" {
		return "openai"
	}
	return provider
}

func defaultAIModel(provider string) string {
	if normalizeAIProvider(provider) == "ollama" {
		return "gpt-oss:20b"
	}
	return "gpt-5-mini"
}

func defaultAIBaseURL(provider string) string {
	if normalizeAIProvider(provider) == "ollama" {
		return "http://localhost:11434/v1"
	}
	return "https://api.openai.com/v1"
}

func normalizeAIProfile(profile services.AISettings, fallbackID, fallbackName string, preserveDisabled bool) services.AISettings {
	profile.Provider = normalizeAIProvider(profile.Provider)
	if profile.Provider != "openai" && profile.Provider != "ollama" {
		profile.Provider = "openai"
	}
	if strings.TrimSpace(profile.ProfileID) == "" {
		profile.ProfileID = fallbackID
	}
	if strings.TrimSpace(profile.ProfileName) == "" {
		profile.ProfileName = fallbackName
	}
	if strings.TrimSpace(profile.Model) == "" {
		profile.Model = defaultAIModel(profile.Provider)
	}
	if strings.TrimSpace(profile.BaseURL) == "" {
		profile.BaseURL = defaultAIBaseURL(profile.Provider)
	}
	if strings.TrimSpace(profile.ChatPrompt) == "" {
		profile.ChatPrompt = services.DefaultChatPromptTemplateForProvider(profile.Provider)
	}
	if strings.TrimSpace(profile.ParseItemPrompt) == "" {
		profile.ParseItemPrompt = services.DefaultParseItemPromptTemplateForProvider(profile.Provider)
	}
	if strings.TrimSpace(profile.CategoryPropertyPrompt) == "" {
		profile.CategoryPropertyPrompt = services.DefaultCategoryPropertyPromptTemplateForProvider(profile.Provider)
	}
	if strings.TrimSpace(profile.PropertyEnhancementPrompt) == "" {
		profile.PropertyEnhancementPrompt = services.DefaultPropertyEnhancementPromptTemplateForProvider(profile.Provider)
	}
	if profile.Provider == "openai" {
		profile.SupportsVision = true
	}
	if !preserveDisabled && !profile.Enabled {
		profile.Enabled = true
	}
	return profile
}

func parseAIProfilePayload(c *gin.Context, persist bool) (services.AISettings, error) {
	var body aiProfilePayload
	if err := c.ShouldBindJSON(&body); err != nil {
		return services.AISettings{}, err
	}

	currentActive := loadAISettingsWithSecret()
	_, currentProfiles := loadAIProfilesWithSecret()
	currentByID := make(map[string]services.AISettings, len(currentProfiles))
	for _, candidate := range currentProfiles {
		currentByID[candidate.ProfileID] = candidate
	}

	profile := services.AISettings{
		ProfileID:                 strings.TrimSpace(body.ID),
		ProfileName:               strings.TrimSpace(body.Name),
		Provider:                  strings.TrimSpace(body.Provider),
		Model:                     strings.TrimSpace(body.Model),
		BaseURL:                   strings.TrimSpace(body.BaseURL),
		APIKey:                    strings.TrimSpace(body.APIKey),
		ChatPrompt:                strings.TrimSpace(body.ChatPrompt),
		ParseItemPrompt:           strings.TrimSpace(body.ParseItemPrompt),
		CategoryPropertyPrompt:    strings.TrimSpace(body.CategoryPropertyPrompt),
		PropertyEnhancementPrompt: strings.TrimSpace(body.PropertyEnhancementPrompt),
	}
	if body.Enabled != nil {
		profile.Enabled = *body.Enabled
	} else if persist {
		profile.Enabled = currentActive.Enabled
	}

	currentProfile, hasCurrentProfile := currentByID[profile.ProfileID]
	if !hasCurrentProfile {
		currentProfile = currentActive
	}

	if strings.TrimSpace(profile.ProfileID) == "" {
		profile.ProfileID = currentProfile.ProfileID
	}
	if strings.TrimSpace(profile.ProfileName) == "" {
		profile.ProfileName = currentProfile.ProfileName
	}
	if strings.TrimSpace(profile.Provider) == "" {
		profile.Provider = currentProfile.Provider
	}
	if strings.TrimSpace(profile.Model) == "" {
		profile.Model = currentProfile.Model
	}
	if strings.TrimSpace(profile.BaseURL) == "" {
		profile.BaseURL = currentProfile.BaseURL
	}
	if strings.TrimSpace(profile.APIKey) == "" {
		profile.APIKey = currentProfile.APIKey
	}
	if strings.TrimSpace(profile.ChatPrompt) == "" {
		profile.ChatPrompt = currentProfile.ChatPrompt
	}
	if strings.TrimSpace(profile.ParseItemPrompt) == "" {
		profile.ParseItemPrompt = currentProfile.ParseItemPrompt
	}
	if strings.TrimSpace(profile.CategoryPropertyPrompt) == "" {
		profile.CategoryPropertyPrompt = currentProfile.CategoryPropertyPrompt
	}
	if strings.TrimSpace(profile.PropertyEnhancementPrompt) == "" {
		profile.PropertyEnhancementPrompt = currentProfile.PropertyEnhancementPrompt
	}
	if body.SupportsVision != nil {
		profile.SupportsVision = *body.SupportsVision
	} else {
		profile.SupportsVision = currentProfile.SupportsVision
	}

	profile = normalizeAIProfile(profile, "profile-1", "Primary AI profile", persist)

	if profile.Provider != "openai" && profile.Provider != "ollama" {
		return services.AISettings{}, errBadRequest("Unsupported AI provider")
	}
	if profile.Provider == "openai" && strings.TrimSpace(profile.APIKey) == "" {
		return services.AISettings{}, errBadRequest("API key is required for OpenAI")
	}

	return profile, nil
}

func parseAISettingsPayload(c *gin.Context) (string, []services.AISettings, error) {
	var body aiSettingsPayload
	if err := c.ShouldBindJSON(&body); err != nil {
		return "", nil, err
	}
	if len(body.Profiles) == 0 {
		return "", nil, errBadRequest("At least one AI profile is required")
	}

	currentActiveID, currentProfiles := loadAIProfilesWithSecret()
	currentByID := make(map[string]services.AISettings, len(currentProfiles))
	for _, profile := range currentProfiles {
		currentByID[profile.ProfileID] = profile
	}

	profiles := make([]services.AISettings, 0, len(body.Profiles))
	seenIDs := make(map[string]struct{}, len(body.Profiles))
	for index, rawProfile := range body.Profiles {
		profile := services.AISettings{
			ProfileID:                 strings.TrimSpace(rawProfile.ID),
			ProfileName:               strings.TrimSpace(rawProfile.Name),
			Provider:                  strings.TrimSpace(rawProfile.Provider),
			Model:                     strings.TrimSpace(rawProfile.Model),
			BaseURL:                   strings.TrimSpace(rawProfile.BaseURL),
			APIKey:                    strings.TrimSpace(rawProfile.APIKey),
			ChatPrompt:                strings.TrimSpace(rawProfile.ChatPrompt),
			ParseItemPrompt:           strings.TrimSpace(rawProfile.ParseItemPrompt),
			CategoryPropertyPrompt:    strings.TrimSpace(rawProfile.CategoryPropertyPrompt),
			PropertyEnhancementPrompt: strings.TrimSpace(rawProfile.PropertyEnhancementPrompt),
		}
		if rawProfile.Enabled != nil {
			profile.Enabled = *rawProfile.Enabled
		}
		if rawProfile.SupportsVision != nil {
			profile.SupportsVision = *rawProfile.SupportsVision
		}

		fallbackID := fmt.Sprintf("profile-%d", index+1)
		fallbackName := fmt.Sprintf("AI profile %d", index+1)
		if existing, ok := currentByID[profile.ProfileID]; ok {
			if strings.TrimSpace(profile.APIKey) == "" {
				profile.APIKey = existing.APIKey
			}
			if rawProfile.SupportsVision == nil {
				profile.SupportsVision = existing.SupportsVision
			}
		}

		profile = normalizeAIProfile(profile, fallbackID, fallbackName, true)
		if profile.Provider != "openai" && profile.Provider != "ollama" {
			return "", nil, errBadRequest("Unsupported AI provider")
		}
		if profile.Provider == "openai" && strings.TrimSpace(profile.APIKey) == "" {
			return "", nil, errBadRequest("API key is required for OpenAI profiles")
		}
		if _, exists := seenIDs[profile.ProfileID]; exists {
			return "", nil, errBadRequest("Profile IDs must be unique")
		}
		seenIDs[profile.ProfileID] = struct{}{}
		profiles = append(profiles, profile)
	}

	if _, exists := currentByID[legacyAIProfileID]; exists {
		if _, kept := seenIDs[legacyAIProfileID]; !kept {
			return "", nil, errBadRequest("Legacy AI profile cannot be removed")
		}
	}

	activeProfileID := strings.TrimSpace(body.ActiveProfileID)
	if activeProfileID == "" {
		activeProfileID = currentActiveID
	}
	if activeProfileID == "" {
		activeProfileID = profiles[0].ProfileID
	}
	if _, exists := seenIDs[activeProfileID]; !exists {
		activeProfileID = profiles[0].ProfileID
	}

	return activeProfileID, profiles, nil
}

func profileResponseFromSettings(profile services.AISettings) aiProfileResponse {
	profile = normalizeAIProfile(profile, "profile-1", "Primary AI profile", true)
	return aiProfileResponse{
		ID:                               profile.ProfileID,
		Name:                             profile.ProfileName,
		Provider:                         profile.Provider,
		Model:                            profile.Model,
		BaseURL:                          profile.BaseURL,
		Enabled:                          profile.Enabled,
		SupportsVision:                   profile.SupportsVision,
		HasAPIKey:                        strings.TrimSpace(profile.APIKey) != "",
		APIKeyPreview:                    previewAIAPIKey(profile.APIKey),
		ChatPrompt:                       profile.ChatPrompt,
		ParseItemPrompt:                  profile.ParseItemPrompt,
		CategoryPropertyPrompt:           profile.CategoryPropertyPrompt,
		PropertyEnhancementPrompt:        profile.PropertyEnhancementPrompt,
		ChatPromptDefault:                services.DefaultChatPromptTemplateForProvider(profile.Provider),
		ParseItemPromptDefault:           services.DefaultParseItemPromptTemplateForProvider(profile.Provider),
		CategoryPropertyPromptDefault:    services.DefaultCategoryPropertyPromptTemplateForProvider(profile.Provider),
		PropertyEnhancementPromptDefault: services.DefaultPropertyEnhancementPromptTemplateForProvider(profile.Provider),
	}
}

func previewAIAPIKey(apiKey string) string {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return ""
	}
	runes := []rune(apiKey)
	if len(runes) > 16 {
		return string(runes[:16]) + "..."
	}
	if len(runes) > 6 {
		return string(runes[:6]) + "..."
	}
	if len(runes) > 2 {
		return string(runes[:2]) + "..."
	}
	return "..."
}

func loadAISettings() aiSettingsResponse {
	activeProfileID, profiles := loadAIProfilesWithSecret()
	responseProfiles := make([]aiProfileResponse, 0, len(profiles))
	for _, profile := range profiles {
		responseProfiles = append(responseProfiles, profileResponseFromSettings(profile))
	}
	if len(responseProfiles) == 0 {
		fallback := normalizeAIProfile(services.AISettings{
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

func loadLegacyAISettingsWithSecret() services.AISettings {
	var provider sql.NullString
	var model sql.NullString
	var baseURL sql.NullString
	var apiKey sql.NullString
	var enabled sql.NullString
	var chatPrompt sql.NullString
	var parseItemPrompt sql.NullString
	var categoryPropertyPrompt sql.NullString
	var propertyEnhancementPrompt sql.NullString

	_ = database.DB.Get(&provider, "SELECT value FROM app_settings WHERE `key` = ?", "ai.provider")
	_ = database.DB.Get(&model, "SELECT value FROM app_settings WHERE `key` = ?", "ai.model")
	_ = database.DB.Get(&baseURL, "SELECT value FROM app_settings WHERE `key` = ?", "ai.base_url")
	_ = database.DB.Get(&apiKey, "SELECT value FROM app_settings WHERE `key` = ?", "ai.api_key")
	_ = database.DB.Get(&enabled, "SELECT value FROM app_settings WHERE `key` = ?", "ai.enabled")
	_ = database.DB.Get(&chatPrompt, "SELECT value FROM app_settings WHERE `key` = ?", "ai.chat_prompt")
	_ = database.DB.Get(&parseItemPrompt, "SELECT value FROM app_settings WHERE `key` = ?", "ai.parse_item_prompt")
	_ = database.DB.Get(&categoryPropertyPrompt, "SELECT value FROM app_settings WHERE `key` = ?", "ai.category_property_prompt")
	_ = database.DB.Get(&propertyEnhancementPrompt, "SELECT value FROM app_settings WHERE `key` = ?", "ai.property_enhancement_prompt")

	settings := services.AISettings{
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
	return normalizeAIProfile(settings, "profile-1", "Legacy AI profile", true)
}

func loadAIProfilesWithSecret() (string, []services.AISettings) {
	var rawProfiles sql.NullString
	var activeProfileID sql.NullString

	_ = database.DB.Get(&rawProfiles, "SELECT value FROM app_settings WHERE `key` = ?", aiProfilesSettingKey)
	_ = database.DB.Get(&activeProfileID, "SELECT value FROM app_settings WHERE `key` = ?", aiActiveProfileSettingKey)

	if rawProfiles.Valid && strings.TrimSpace(rawProfiles.String) != "" {
		var storedProfiles []storedAIProfile
		if err := json.Unmarshal([]byte(rawProfiles.String), &storedProfiles); err == nil && len(storedProfiles) > 0 {
			profiles := make([]services.AISettings, 0, len(storedProfiles))
			for index, storedProfile := range storedProfiles {
				profiles = append(profiles, normalizeAIProfile(services.AISettings{
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
	return legacy.ProfileID, []services.AISettings{legacy}
}

func loadAISettingsWithSecret() services.AISettings {
	activeProfileID, profiles := loadAIProfilesWithSecret()
	for _, profile := range profiles {
		if profile.ProfileID == activeProfileID {
			return profile
		}
	}
	if len(profiles) > 0 {
		return profiles[0]
	}
	return normalizeAIProfile(services.AISettings{
		ProfileID:   "profile-1",
		ProfileName: "OpenAI",
		Provider:    "openai",
		Enabled:     false,
	}, "profile-1", "OpenAI", true)
}

func saveAISettingsBundle(activeProfileID string, profiles []services.AISettings) error {
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

func errBadRequest(message string) error {
	return &badRequestError{message: message}
}

func parseFlexibleBool(raw string, fallback bool) bool {
	value := strings.TrimSpace(strings.ToLower(raw))
	if value == "" {
		return fallback
	}

	if parsed, err := strconv.ParseBool(value); err == nil {
		return parsed
	}

	switch value {
	case "on", "yes", "y", "enabled", "active":
		return true
	case "off", "no", "n", "disabled", "inactive":
		return false
	default:
		return fallback
	}
}

type badRequestError struct {
	message string
}

func (e *badRequestError) Error() string {
	return e.message
}
