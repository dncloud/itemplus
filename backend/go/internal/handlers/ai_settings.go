package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
	"github.com/itemplus/backend/internal/services"
)

type aiSettingsResponse struct {
	Provider  string `json:"provider"`
	Model     string `json:"model"`
	BaseURL   string `json:"base_url"`
	Enabled   bool   `json:"enabled"`
	HasAPIKey bool   `json:"has_api_key"`
}

type aiSettingsPayload struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
	BaseURL  string `json:"base_url"`
	APIKey   string `json:"api_key"`
	Enabled  *bool  `json:"enabled"`
}

func adminGetAISettings(c *gin.Context) {
	c.JSON(http.StatusOK, loadAISettings())
}

func adminUpdateAISettings(c *gin.Context) {
	settings, err := parseAISettingsPayload(c, true)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	if err := saveAISettings(settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not save AI settings"})
		return
	}

	user := middleware.GetUser(c)
	audit(user.ID, "ai.settings.update", "AI settings updated")
	c.JSON(http.StatusOK, loadAISettings())
}

func adminTestAISettings(c *gin.Context) {
	settings, err := parseAISettingsPayload(c, false)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	result, err := services.TestAIConnection(settings)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"detail": err.Error()})
		return
	}

	user := middleware.GetUser(c)
	audit(user.ID, "ai.settings.test", "AI connection test succeeded")
	c.JSON(http.StatusOK, result)
}

func parseAISettingsPayload(c *gin.Context, persist bool) (services.AISettings, error) {
	var body aiSettingsPayload
	if err := c.ShouldBindJSON(&body); err != nil {
		return services.AISettings{}, err
	}

	current := loadAISettingsWithSecret()

	provider := strings.ToLower(strings.TrimSpace(body.Provider))
	if provider == "" {
		provider = current.Provider
	}
	if provider == "" {
		provider = "openai"
	}
	if provider != "openai" && provider != "ollama" && provider != "openai_compatible" {
		return services.AISettings{}, errBadRequest("Unsupported AI provider")
	}

	model := strings.TrimSpace(body.Model)
	if model == "" {
		model = current.Model
	}
	if model == "" {
		if provider == "ollama" {
			model = "llama3.2"
		} else {
			model = "gpt-5-mini"
		}
	}

	baseURL := strings.TrimSpace(body.BaseURL)
	if baseURL == "" {
		baseURL = current.BaseURL
	}
	if baseURL == "" {
		if provider == "ollama" {
			baseURL = "http://localhost:11434/v1"
		} else {
			baseURL = "https://api.openai.com/v1"
		}
	}

	apiKey := strings.TrimSpace(body.APIKey)
	if apiKey == "" {
		apiKey = current.APIKey
	}

	enabled := current.Enabled
	if body.Enabled != nil {
		enabled = *body.Enabled
	}
	if !persist && body.Enabled == nil && !enabled {
		enabled = true
	}

	return services.AISettings{
		Provider: provider,
		Model:    model,
		BaseURL:  baseURL,
		APIKey:   apiKey,
		Enabled:  enabled,
	}, nil
}

func loadAISettings() aiSettingsResponse {
	full := loadAISettingsWithSecret()
	return aiSettingsResponse{
		Provider:  full.Provider,
		Model:     full.Model,
		BaseURL:   full.BaseURL,
		Enabled:   full.Enabled,
		HasAPIKey: strings.TrimSpace(full.APIKey) != "",
	}
}

func loadAISettingsWithSecret() services.AISettings {
	var provider sql.NullString
	var model sql.NullString
	var baseURL sql.NullString
	var apiKey sql.NullString
	var enabled sql.NullString

	_ = database.DB.Get(&provider, "SELECT value FROM app_settings WHERE `key` = ?", "ai.provider")
	_ = database.DB.Get(&model, "SELECT value FROM app_settings WHERE `key` = ?", "ai.model")
	_ = database.DB.Get(&baseURL, "SELECT value FROM app_settings WHERE `key` = ?", "ai.base_url")
	_ = database.DB.Get(&apiKey, "SELECT value FROM app_settings WHERE `key` = ?", "ai.api_key")
	_ = database.DB.Get(&enabled, "SELECT value FROM app_settings WHERE `key` = ?", "ai.enabled")

	settings := services.AISettings{
		Provider: "openai",
		Model:    "gpt-5-mini",
		BaseURL:  "https://api.openai.com/v1",
		Enabled:  false,
	}
	if provider.Valid && strings.TrimSpace(provider.String) != "" {
		settings.Provider = strings.ToLower(strings.TrimSpace(provider.String))
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
	return settings
}

func saveAISettings(settings services.AISettings) error {
	now := database.TimestampNow()
	entries := map[string]string{
		"ai.provider": settings.Provider,
		"ai.model":    settings.Model,
		"ai.base_url": settings.BaseURL,
		"ai.enabled":  strconv.FormatBool(settings.Enabled),
	}

	for key, value := range entries {
		if err := database.UpsertAppSetting(key, value, now); err != nil {
			return err
		}
	}

	if strings.TrimSpace(settings.APIKey) == "" {
		_, err := database.DB.Exec("DELETE FROM app_settings WHERE `key` = ?", "ai.api_key")
		return err
	}

	return database.UpsertAppSetting("ai.api_key", strings.TrimSpace(settings.APIKey), now)
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
