package ai

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/http/middleware"
)

func RegisterAIRoutes(g *gin.RouterGroup) {
	g.Use(middleware.Auth())
	// Every one of these calls costs the operator tokens at the AI provider,
	// or makes the server fetch something. One shared budget per client keeps
	// a runaway script or a careless loop from running up the bill.
	providerRL := middleware.RateLimit(40, time.Minute)
	g.POST("/chat/stream", providerRL, chatWithAIStream)
	g.POST("/parse-item-intent", providerRL, middleware.RequirePermission("items.write"), parseItemIntent)
	g.POST("/parse-item-intent/stream", providerRL, middleware.RequirePermission("items.write"), parseItemIntentStream)
	g.POST("/suggest-category-properties", providerRL, middleware.RequirePermission("categories.write"), suggestCategoryProperties)
	g.POST("/suggest-property-enhancement", providerRL, middleware.RequirePermission("categories.write"), suggestPropertyEnhancement)
	g.POST("/suggest-vendor", providerRL, middleware.RequirePermission("vendors.write"), suggestVendor)
	g.POST("/resolve-vendor-logo", providerRL, middleware.RequirePermission("vendors.write"), resolveVendorLogo)
	g.POST("/temp-image", providerRL, middleware.RequirePermission("items.write"), uploadAITempImage)
	g.GET("/temp-image/:id", middleware.RequirePermission("items.write"), getAITempImage)
}
