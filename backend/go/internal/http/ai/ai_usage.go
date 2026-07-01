package ai

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	aicore "github.com/itemplus/backend/internal/core/ai"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

func renderAIGatewayError(c *gin.Context, err error) {
	var debugErr *aicore.AIDebugError
	if errors.As(err, &debugErr) {
		c.JSON(http.StatusBadGateway, gin.H{
			"detail":    debugErr.Error(),
			"raw_debug": debugErr.RawDebug,
			"usage":     debugErr.Usage,
		})
		return
	}
	c.JSON(http.StatusBadGateway, gin.H{"detail": err.Error()})
}

func aiUsageFromError(err error) *aicore.AIUsage {
	var debugErr *aicore.AIDebugError
	if errors.As(err, &debugErr) {
		return debugErr.Usage
	}
	return nil
}

func recordAIUsageEvent(user *middleware.User, settings aicore.AISettings, feature string, transport string, success bool, usage *aicore.AIUsage, recordErr error) {
	var userID any
	if user != nil {
		userID = user.ID
	}

	inputTokens := 0
	outputTokens := 0
	totalTokens := 0
	reasoningTokens := 0
	webSearchRequests := 0
	webFetchRequests := 0
	if usage != nil {
		inputTokens = usage.InputTokens
		outputTokens = usage.OutputTokens
		totalTokens = usage.TotalTokens
		reasoningTokens = usage.ReasoningTokens
		webSearchRequests = usage.WebSearchRequests
		webFetchRequests = usage.WebFetchRequests
	}

	errorText := ""
	if recordErr != nil {
		errorText = trimAIUsageError(recordErr.Error())
	}

	if _, err := database.DB.Exec(
		`INSERT INTO ai_usage_events (
			user_id, profile_id, profile_name, provider, model, feature, transport, success, error,
			input_tokens, output_tokens, total_tokens, reasoning_tokens, web_search_requests, web_fetch_requests, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		userID,
		settings.ProfileID,
		settings.ProfileName,
		settings.Provider,
		settings.Model,
		feature,
		transport,
		success,
		errorText,
		inputTokens,
		outputTokens,
		totalTokens,
		reasoningTokens,
		webSearchRequests,
		webFetchRequests,
		database.TimestampNow(),
	); err != nil {
		fmt.Printf("AI usage event could not be recorded: %v\n", err)
	}
}

func trimAIUsageError(value string) string {
	value = strings.TrimSpace(value)
	if len(value) <= 1000 {
		return value
	}
	return value[:1000]
}
