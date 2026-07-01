package operations

import (
	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/http/middleware"
	settingshandlers "github.com/itemplus/backend/internal/http/settings"
)

func RegisterAdminRoutes(g *gin.RouterGroup) {
	g.Use(middleware.Auth(), middleware.RequireAdmin())

	g.GET("/export-bundle", adminExportBundle)
	g.POST("/recover-bundle", adminRecoverBundle)
	g.GET("/health/locations", adminHealthLocations)
	g.POST("/health/locations/fix", adminFixLocations)
	g.PUT("/branding", settingshandlers.AdminUpdateBranding)
	g.DELETE("/branding", settingshandlers.AdminResetBranding)
	g.GET("/maintenance-settings", adminGetMaintenanceSettings)
	g.PUT("/maintenance-settings", adminUpdateMaintenanceSettings)
	settingshandlers.RegisterExternalSourceRoutes(g)
}
