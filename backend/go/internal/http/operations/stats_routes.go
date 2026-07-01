package operations

import (
	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/http/middleware"
)

func RegisterStatsRoutes(api *gin.RouterGroup) {
	stats := api.Group("/stats", middleware.Auth())
	stats.GET("/overview", statsOverview)
	stats.GET("/inventory", statsInventory)
	stats.GET("/locations", statsLocations)
	stats.GET("/maintenance", middleware.RequirePermission("maintenance.read"), statsMaintenance)
	stats.GET("/ai-usage", middleware.RequireAdmin(), statsAIUsage)
}

type aiUsageStatsBucket struct {
	Bucket             string `db:"bucket" json:"bucket"`
	Provider           string `db:"provider" json:"provider"`
	Requests           int64  `db:"requests" json:"requests"`
	SuccessfulRequests int64  `db:"successful_requests" json:"successful_requests"`
	FailedRequests     int64  `db:"failed_requests" json:"failed_requests"`
	InputTokens        int64  `db:"input_tokens" json:"input_tokens"`
	OutputTokens       int64  `db:"output_tokens" json:"output_tokens"`
	TotalTokens        int64  `db:"total_tokens" json:"total_tokens"`
	ReasoningTokens    int64  `db:"reasoning_tokens" json:"reasoning_tokens"`
	WebSearchRequests  int64  `db:"web_search_requests" json:"web_search_requests"`
	WebFetchRequests   int64  `db:"web_fetch_requests" json:"web_fetch_requests"`
}

type aiUsageStatsPeriod struct {
	Label   string               `json:"label"`
	Since   string               `json:"since"`
	Buckets []aiUsageStatsBucket `json:"buckets"`
}

type aiUsageEventRow struct {
	Provider          string `db:"provider"`
	Success           int    `db:"success"`
	InputTokens       int64  `db:"input_tokens"`
	OutputTokens      int64  `db:"output_tokens"`
	TotalTokens       int64  `db:"total_tokens"`
	ReasoningTokens   int64  `db:"reasoning_tokens"`
	WebSearchRequests int64  `db:"web_search_requests"`
	WebFetchRequests  int64  `db:"web_fetch_requests"`
	CreatedAt         string `db:"created_at"`
}
