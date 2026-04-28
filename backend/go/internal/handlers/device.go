package handlers

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
	"github.com/itemplus/backend/internal/ws"
)

func RegisterDeviceRoutes(g *gin.RouterGroup) {
	g.GET("/sessions", middleware.Auth(), listSessions)
	g.GET("/sessions/online", middleware.Auth(), listOnlineSessions)
	g.DELETE("/sessions/:id", middleware.Auth(), deleteSession)
}

func listSessions(c *gin.Context) {
	user := middleware.GetUser(c)

	rows, err := database.DB.Queryx(
		"SELECT * FROM device_sessions WHERE user_id = ? ORDER BY last_seen DESC", user.ID)
	if err != nil {
		log.Printf("DB query error in listSessions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		row := map[string]interface{}{}
		if rows.MapScan(row) == nil {
			cleanRow(row)
			result = append(result, row)
		}
	}
	if result == nil {
		result = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, result)
}

func listOnlineSessions(c *gin.Context) {
	user := middleware.GetUser(c)

	rows, err := database.DB.Queryx(
		"SELECT * FROM device_sessions WHERE user_id = ? AND is_online = 1 ORDER BY last_seen DESC", user.ID)
	if err != nil {
		log.Printf("DB query error in listOnlineSessions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		row := map[string]interface{}{}
		if rows.MapScan(row) == nil {
			cleanRow(row)
			result = append(result, row)
		}
	}
	if result == nil {
		result = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, result)
}

func deleteSession(c *gin.Context) {
	user := middleware.GetUser(c)
	id := c.Param("id")

	result, err := database.DB.Exec(
		"DELETE FROM device_sessions WHERE id = ? AND user_id = ?", id, user.ID)
	if err != nil {
		log.Printf("DB delete error in deleteSession: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Session not found"})
		return
	}

	// Kick the WebSocket connection for this session
	if sessionID, err := strconv.Atoi(id); err == nil {
		ws.M.Kick(sessionID)
	}

	audit(user.ID, "session.kick", "session_id="+id)
	c.Status(http.StatusNoContent)
}
