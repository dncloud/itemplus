package items

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/http/middleware"
	operationshandlers "github.com/itemplus/backend/internal/http/operations"
	settingshandlers "github.com/itemplus/backend/internal/http/settings"
)

func RegisterItemRoutes(g *gin.RouterGroup, realm string) {
	uploadRL := middleware.RateLimit(20, time.Minute)
	listRL := middleware.RateLimit(120, time.Minute)

	g.GET("", middleware.Auth(), middleware.RequirePermission("items.read"), listRL, listItems(realm))
	g.GET("/lookup", middleware.Auth(), middleware.RequirePermission("items.read"), listItemLookup(realm))
	g.GET("/:id", middleware.Auth(), middleware.RequirePermission("items.read"), getItem(realm))
	g.POST("", middleware.Auth(), middleware.RequirePermission("items.write"), createItem(realm))
	g.PUT("/:id", middleware.Auth(), middleware.RequirePermission("items.write"), updateItem(realm))
	g.DELETE("/:id", middleware.Auth(), middleware.RequirePermission("items.delete"), deleteItem(realm))
	g.GET("/:id/reminders", middleware.Auth(), middleware.RequirePermission("maintenance.read"), operationshandlers.ListMaintenanceReminders(realm))
	g.POST("/:id/reminders", middleware.Auth(), middleware.RequireAllPermissions("maintenance.read", "maintenance.write"), operationshandlers.CreateMaintenanceReminder(realm))
	g.PUT("/:id/reminders/:reminderId", middleware.Auth(), middleware.RequireAllPermissions("maintenance.read", "maintenance.write"), operationshandlers.UpdateMaintenanceReminder(realm))
	g.POST("/:id/reminders/:reminderId/complete", middleware.Auth(), middleware.RequireAllPermissions("maintenance.read", "maintenance.write"), operationshandlers.CompleteMaintenanceReminder(realm))
	g.POST("/:id/reminders/:reminderId/skip", middleware.Auth(), middleware.RequireAllPermissions("maintenance.read", "maintenance.write"), operationshandlers.SkipMaintenanceReminder(realm))
	g.DELETE("/:id/reminders/:reminderId", middleware.Auth(), middleware.RequireAllPermissions("maintenance.read", "maintenance.write"), operationshandlers.DeleteMaintenanceReminder(realm))

	g.POST("/:id/attachments", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), uploadRL, uploadAttachment(realm))
	g.POST("/:id/attachments/link", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), addLinkAttachment(realm))
	g.POST("/:id/attachments/external-sftp", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), addExternalSFTPAttachment(realm))
	g.POST("/:id/properties/:propId/upload", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), uploadRL, uploadPropertyFile(realm))
}

func RegisterAttachmentRoutes(g *gin.RouterGroup, realm string) {
	g.GET("/external-sources", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), settingshandlers.ListAttachmentExternalSources)
	g.GET("/external-sources/:id/browse", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), settingshandlers.BrowseAttachmentExternalSource)
	g.GET("/:attId/content", middleware.Auth(), middleware.RequirePermission("items.read"), getAttachmentContent(realm))
	g.PUT("/:attId", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), updateAttachment(realm))
	g.DELETE("/:attId", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), deleteAttachment(realm))
}

func getItem(realm string) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		user := middleware.GetUser(c)
		includeMaintenance := user != nil && user.HasPermission("maintenance.read")
		includeInventory := user != nil && user.HasPermission("inventory.read")
		row := loadEnrichedItem(realm, id, includeMaintenance, includeInventory)
		if row == nil {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
			return
		}
		c.JSON(http.StatusOK, row)
	}
}
