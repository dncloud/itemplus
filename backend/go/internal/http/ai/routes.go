package ai

import (
	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/http/middleware"
)

func RegisterAIRoutes(g *gin.RouterGroup) {
	g.Use(middleware.Auth())
	g.POST("/chat/stream", chatWithAIStream)
	g.POST("/parse-item-intent", middleware.RequirePermission("items.write"), parseItemIntent)
	g.POST("/parse-item-intent/stream", middleware.RequirePermission("items.write"), parseItemIntentStream)
	g.POST("/suggest-category-properties", middleware.RequirePermission("categories.write"), suggestCategoryProperties)
	g.POST("/suggest-property-enhancement", middleware.RequirePermission("categories.write"), suggestPropertyEnhancement)
	g.POST("/suggest-vendor", middleware.RequirePermission("vendors.write"), suggestVendor)
	g.POST("/resolve-vendor-logo", middleware.RequirePermission("vendors.write"), resolveVendorLogo)
	g.POST("/temp-image", middleware.RequirePermission("items.write"), uploadAITempImage)
	g.GET("/temp-image/:id", middleware.RequirePermission("items.write"), getAITempImage)
}
