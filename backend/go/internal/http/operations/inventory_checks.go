package operations

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	inventorycore "github.com/itemplus/backend/internal/core/inventory"
	"github.com/itemplus/backend/internal/http/middleware"
)

func RegisterInventoryCheckRoutes(api *gin.RouterGroup) {
	api.GET("/inventory-checks", middleware.Auth(), middleware.RequirePermission("inventory.read"), listInventoryChecks)
	api.GET("/inventory-checks/:id", middleware.Auth(), middleware.RequirePermission("inventory.read"), getInventoryCheck)
	api.POST("/inventory-checks/start", middleware.Auth(), middleware.RequireAllPermissions("inventory.read", "inventory.write"), startInventoryCheck)
	api.POST("/inventory-checks/:id/scan", middleware.Auth(), middleware.RequireAllPermissions("inventory.read", "inventory.write"), scanInventoryCheck)
	api.POST("/inventory-checks/:id/entries/:entry_id/approve", middleware.Auth(), middleware.RequireAllPermissions("inventory.read", "inventory.write"), approveInventoryCheckEntry)
	api.POST("/inventory-checks/:id/entries/:entry_id/correct-location", middleware.Auth(), middleware.RequireAllPermissions("inventory.read", "inventory.write"), correctInventoryCheckEntryLocation)
	api.POST("/inventory-checks/:id/finish", middleware.Auth(), middleware.RequireAllPermissions("inventory.read", "inventory.write"), finishInventoryCheck)
}

func listInventoryChecks(c *gin.Context) {
	realm := strings.TrimSpace(c.DefaultQuery("realm", "archive"))
	active, err := inventorycore.GetActiveSession(realm)
	if err != nil && err != sql.ErrNoRows {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	recent, err := inventorycore.ListRecentSessions(realm, 10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"active_session":  active,
		"recent_sessions": recent,
	})
}

func getInventoryCheck(c *gin.Context) {
	sessionID, ok := parseInventoryCheckID(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid session id"})
		return
	}
	detail, err := inventorycore.GetSession(sessionID)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Session not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, detail)
}

func startInventoryCheck(c *gin.Context) {
	user := middleware.GetUser(c)
	var body struct {
		Realm      string `json:"realm"`
		LocationID *int   `json:"location_id"`
		Title      string `json:"title"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}
	detail, err := inventorycore.StartSession(inventorycore.StartSessionInput{
		Realm:      strings.TrimSpace(body.Realm),
		LocationID: body.LocationID,
		Title:      strings.TrimSpace(body.Title),
		StartedBy:  user.ID,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, detail)
}

func scanInventoryCheck(c *gin.Context) {
	sessionID, ok := parseInventoryCheckID(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid session id"})
		return
	}
	var body struct {
		ItemID    *int   `json:"item_id"`
		Code      string `json:"code"`
		Symbology string `json:"symbology"`
		FoundVia  string `json:"found_via"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}
	result, err := inventorycore.ScanSession(sessionID, inventorycore.ScanInput{
		ItemID:    body.ItemID,
		Code:      strings.TrimSpace(body.Code),
		Symbology: strings.TrimSpace(body.Symbology),
		FoundVia:  strings.TrimSpace(body.FoundVia),
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func approveInventoryCheckEntry(c *gin.Context) {
	sessionID, ok := parseInventoryCheckID(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid session id"})
		return
	}
	entryID, ok := parseInventoryCheckID(c.Param("entry_id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid entry id"})
		return
	}
	user := middleware.GetUser(c)
	entry, err := inventorycore.ApproveEntry(sessionID, entryID, user.ID, "manual")
	if err != nil {
		status := http.StatusBadRequest
		if err == sql.ErrNoRows {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"entry": entry})
}

func correctInventoryCheckEntryLocation(c *gin.Context) {
	sessionID, ok := parseInventoryCheckID(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid session id"})
		return
	}
	entryID, ok := parseInventoryCheckID(c.Param("entry_id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid entry id"})
		return
	}
	entry, err := inventorycore.CorrectEntryLocation(sessionID, entryID)
	if err != nil {
		status := http.StatusBadRequest
		if err == sql.ErrNoRows {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"entry": entry})
}

func finishInventoryCheck(c *gin.Context) {
	sessionID, ok := parseInventoryCheckID(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid session id"})
		return
	}
	detail, err := inventorycore.FinishSession(sessionID)
	if err != nil {
		status := http.StatusBadRequest
		if err == sql.ErrNoRows {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, detail)
}

func parseInventoryCheckID(value string) (int, bool) {
	id, err := strconv.Atoi(strings.TrimSpace(value))
	return id, err == nil && id > 0
}
