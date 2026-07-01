package ai

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	aicore "github.com/itemplus/backend/internal/core/ai"
	"github.com/itemplus/backend/internal/http/middleware"
)

func chatWithAIStream(c *gin.Context) {
	var body struct {
		Messages       []aicore.ChatMessage `json:"messages"`
		Locale         string               `json:"locale"`
		AllowWebSearch bool                 `json:"allow_web_search"`
		TempImageID    string               `json:"temp_image_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}
	if len(body.Messages) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "At least one message is required"})
		return
	}

	settings := loadAISettingsWithSecret()
	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Streaming not supported"})
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	c.Status(http.StatusOK)
	flusher.Flush()

	emit := func(event aicore.AIStreamEvent) error {
		payload, err := json.Marshal(event)
		if err != nil {
			return err
		}
		if _, err := c.Writer.Write([]byte("data: " + string(payload) + "\n\n")); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}

	appContext := buildAIChatAppContext(c)
	chatRequest := aicore.ChatRequest{
		Messages:       body.Messages,
		Locale:         body.Locale,
		AllowWebSearch: body.AllowWebSearch,
		TempImageID:    body.TempImageID,
		AppContext:     appContext,
	}

	if lookupPlan, lookupErr := aicore.PlanInventoryLookup(settings, chatRequest); lookupErr == nil && lookupPlan != nil && lookupPlan.Request != nil {
		if lookupResult, err := runAIInventoryLookup(middleware.GetUser(c), lookupPlan.Request); err == nil && len(lookupResult) > 0 {
			appContext["inventory_lookup"] = lookupResult
			chatRequest.AppContext = appContext
		}
	}

	user := middleware.GetUser(c)
	result, err := aicore.ChatWithAIStream(settings, chatRequest, emit)
	if err != nil {
		recordAIUsageEvent(user, settings, "chat", "", false, aiUsageFromError(err), err)
		_ = emit(aicore.AIStreamEvent{Type: "error", Message: err.Error()})
		return
	}

	recordAIUsageEvent(user, settings, "chat", result.Transport, true, result.Usage, nil)
	middleware.Audit(user.ID, "ai.chat", fmt.Sprintf("profile=%s provider=%s model=%s", settings.ProfileID, settings.Provider, settings.Model))
	_ = emit(aicore.AIStreamEvent{
		Type: "done",
		Result: &aicore.ParseItemIntentResult{
			AssistantMessage: result.AssistantMessage,
			Transport:        result.Transport,
			Model:            result.Model,
			Provider:         result.Provider,
			Usage:            result.Usage,
			Context:          result.Context,
		},
	})
}

func buildAIChatAppContext(c *gin.Context) map[string]any {
	user := middleware.GetUser(c)
	if user == nil {
		return nil
	}

	displayName := ""
	if user.DisplayName != nil {
		displayName = strings.TrimSpace(*user.DisplayName)
	}
	email := ""
	if user.Email != nil {
		email = strings.TrimSpace(*user.Email)
	}

	return map[string]any{
		"current_user": map[string]any{
			"id":           user.ID,
			"display_name": displayName,
			"email":        email,
			"is_admin":     user.IsAdmin,
			"permissions":  user.PermissionList(),
		},
	}
}
