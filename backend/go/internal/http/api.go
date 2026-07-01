package httpapi

import (
	"github.com/gin-gonic/gin"
	aihandlers "github.com/itemplus/backend/internal/http/ai"
	authhandlers "github.com/itemplus/backend/internal/http/auth"
	itemhandlers "github.com/itemplus/backend/internal/http/items"
	operationshandlers "github.com/itemplus/backend/internal/http/operations"
	settingshandlers "github.com/itemplus/backend/internal/http/settings"
)

var (
	Root        = operationshandlers.Root
	Health      = operationshandlers.Health
	GetBranding = settingshandlers.GetBranding
)

func RegisterCRUD(group *gin.RouterGroup, table string, readPerm, writePerm, deletePerm string) {
	itemhandlers.RegisterCRUD(group, table, readPerm, writePerm, deletePerm)
}

func RegisterItemRoutes(g *gin.RouterGroup, realm string) {
	itemhandlers.RegisterItemRoutes(g, realm)
}

func RegisterAttachmentRoutes(g *gin.RouterGroup, realm string) {
	itemhandlers.RegisterAttachmentRoutes(g, realm)
}

func RegisterPropertyRoutes(g *gin.RouterGroup, realm string) {
	itemhandlers.RegisterPropertyRoutes(g, realm)
}

func RegisterAuthRoutes(g *gin.RouterGroup) {
	authhandlers.RegisterAuthRoutes(g)
}

func RegisterUserRoutes(api *gin.RouterGroup) {
	authhandlers.RegisterUserRoutes(api)
}

func RegisterDeviceRoutes(g *gin.RouterGroup) {
	authhandlers.RegisterDeviceRoutes(g)
}

func RegisterQRLoginRoutes(g *gin.RouterGroup) {
	authhandlers.RegisterQRLoginRoutes(g)
}

func RegisterAIRoutes(g *gin.RouterGroup) {
	aihandlers.RegisterAIRoutes(g)
}

func RegisterPrinterRoutes(g *gin.RouterGroup) {
	settingshandlers.RegisterPrinterRoutes(g)
}

func RegisterStatsRoutes(api *gin.RouterGroup) {
	operationshandlers.RegisterStatsRoutes(api)
}

func RegisterUpdateStatusRoutes(api *gin.RouterGroup) {
	settingshandlers.RegisterUpdateStatusRoutes(api)
}

func RegisterAdminRoutes(g *gin.RouterGroup) {
	operationshandlers.RegisterAdminRoutes(g)
	g.GET("/ai-settings", aihandlers.AdminGetAISettings)
	g.PUT("/ai-settings", aihandlers.AdminUpdateAISettings)
	g.POST("/ai-settings/test", aihandlers.AdminTestAISettings)
	g.POST("/ai-settings/models", aihandlers.AdminListAIModels)
}

func RegisterCheckoutRoutes(api *gin.RouterGroup) {
	operationshandlers.RegisterCheckoutRoutes(api)
}

func RegisterInventoryMovementRoutes(api *gin.RouterGroup) {
	operationshandlers.RegisterInventoryMovementRoutes(api)
}

func RegisterInventoryCheckRoutes(api *gin.RouterGroup) {
	operationshandlers.RegisterInventoryCheckRoutes(api)
}

func RegisterWebSocketRoute(r *gin.Engine) {
	operationshandlers.RegisterWebSocketRoute(r)
}

func ValidateWSTicket(ticket string) (int, bool) {
	return authhandlers.ValidateWSTicket(ticket)
}
