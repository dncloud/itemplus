package ai

import aicore "github.com/itemplus/backend/internal/core/ai"

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
	VendorPrompt                     string `json:"vendor_prompt"`
	ChatPromptDefault                string `json:"chat_prompt_default"`
	ParseItemPromptDefault           string `json:"parse_item_prompt_default"`
	CategoryPropertyPromptDefault    string `json:"category_property_prompt_default"`
	PropertyEnhancementPromptDefault string `json:"property_enhancement_prompt_default"`
	VendorPromptDefault              string `json:"vendor_prompt_default"`
}

type aiSettingsResponse struct {
	ActiveProfileID string              `json:"active_profile_id"`
	Profiles        []aiProfileResponse `json:"profiles"`
}

type aiModelListResponse struct {
	Models []aicore.AIModelOption `json:"models"`
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
	VendorPrompt              string `json:"vendor_prompt"`
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
	VendorPrompt              string `json:"vendor_prompt"`
}
