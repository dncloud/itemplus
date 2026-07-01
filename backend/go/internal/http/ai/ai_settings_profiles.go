package ai

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	aicore "github.com/itemplus/backend/internal/core/ai"
)

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

func normalizeAIProfile(profile aicore.AISettings, fallbackID, fallbackName string, preserveDisabled bool) aicore.AISettings {
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
		profile.ChatPrompt = aicore.DefaultChatPromptTemplateForProvider(profile.Provider)
	}
	if strings.TrimSpace(profile.ParseItemPrompt) == "" {
		profile.ParseItemPrompt = aicore.DefaultParseItemPromptTemplateForProvider(profile.Provider)
	}
	if strings.TrimSpace(profile.CategoryPropertyPrompt) == "" {
		profile.CategoryPropertyPrompt = aicore.DefaultCategoryPropertyPromptTemplateForProvider(profile.Provider)
	}
	if strings.TrimSpace(profile.PropertyEnhancementPrompt) == "" {
		profile.PropertyEnhancementPrompt = aicore.DefaultPropertyEnhancementPromptTemplateForProvider(profile.Provider)
	}
	if strings.TrimSpace(profile.VendorPrompt) == "" {
		profile.VendorPrompt = aicore.DefaultVendorPromptTemplateForProvider(profile.Provider)
	}
	if profile.Provider == "openai" {
		profile.SupportsVision = true
	}
	if !preserveDisabled && !profile.Enabled {
		profile.Enabled = true
	}
	return profile
}

func parseAIProfilePayload(c *gin.Context, persist bool) (aicore.AISettings, error) {
	var body aiProfilePayload
	if err := c.ShouldBindJSON(&body); err != nil {
		return aicore.AISettings{}, err
	}

	currentActive := loadAISettingsWithSecret()
	_, currentProfiles := loadAIProfilesWithSecret()
	currentByID := make(map[string]aicore.AISettings, len(currentProfiles))
	for _, candidate := range currentProfiles {
		currentByID[candidate.ProfileID] = candidate
	}

	profile := aicore.AISettings{
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
		VendorPrompt:              strings.TrimSpace(body.VendorPrompt),
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
	if strings.TrimSpace(profile.VendorPrompt) == "" {
		profile.VendorPrompt = currentProfile.VendorPrompt
	}
	if body.SupportsVision != nil {
		profile.SupportsVision = *body.SupportsVision
	} else {
		profile.SupportsVision = currentProfile.SupportsVision
	}

	profile = normalizeAIProfile(profile, "profile-1", "Primary AI profile", persist)

	if profile.Provider != "openai" && profile.Provider != "ollama" {
		return aicore.AISettings{}, errBadRequest("Unsupported AI provider")
	}
	if profile.Provider == "openai" && strings.TrimSpace(profile.APIKey) == "" {
		return aicore.AISettings{}, errBadRequest("API key is required for OpenAI")
	}

	return profile, nil
}

func parseAISettingsPayload(c *gin.Context) (string, []aicore.AISettings, error) {
	var body aiSettingsPayload
	if err := c.ShouldBindJSON(&body); err != nil {
		return "", nil, err
	}
	if len(body.Profiles) == 0 {
		return "", nil, errBadRequest("At least one AI profile is required")
	}

	currentActiveID, currentProfiles := loadAIProfilesWithSecret()
	currentByID := make(map[string]aicore.AISettings, len(currentProfiles))
	for _, profile := range currentProfiles {
		currentByID[profile.ProfileID] = profile
	}

	profiles := make([]aicore.AISettings, 0, len(body.Profiles))
	seenIDs := make(map[string]struct{}, len(body.Profiles))
	for index, rawProfile := range body.Profiles {
		profile := aicore.AISettings{
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
			VendorPrompt:              strings.TrimSpace(rawProfile.VendorPrompt),
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

func profileResponseFromSettings(profile aicore.AISettings) aiProfileResponse {
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
		VendorPrompt:                     profile.VendorPrompt,
		ChatPromptDefault:                aicore.DefaultChatPromptTemplateForProvider(profile.Provider),
		ParseItemPromptDefault:           aicore.DefaultParseItemPromptTemplateForProvider(profile.Provider),
		CategoryPropertyPromptDefault:    aicore.DefaultCategoryPropertyPromptTemplateForProvider(profile.Provider),
		PropertyEnhancementPromptDefault: aicore.DefaultPropertyEnhancementPromptTemplateForProvider(profile.Provider),
		VendorPromptDefault:              aicore.DefaultVendorPromptTemplateForProvider(profile.Provider),
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
