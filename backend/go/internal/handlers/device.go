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

func listDeviceSessions(c *gin.Context, query string, args ...interface{}) {
	rows, err := database.DB.Queryx(query, args...)
	if err != nil {
		log.Printf("DB query error in listDeviceSessions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		row := map[string]interface{}{}
		if rows.MapScan(row) == nil {
			cleanRow(row)
			reconcileSessionRow(row)
			result = append(result, row)
		}
	}
	if result == nil {
		result = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, result)
}

func reconcileSessionRow(row map[string]interface{}) {
	sessionID, ok := rowInt(row["id"])
	if !ok {
		return
	}
	isOnline, ok := rowBool(row["is_online"])
	if !ok || !isOnline {
		return
	}
	if ws.M.HasSession(sessionID) {
		return
	}
	row["is_online"] = false
	if _, err := database.DB.Exec("UPDATE device_sessions SET is_online = 0 WHERE id = ?", sessionID); err != nil {
		log.Printf("DB session reconcile error: %v", err)
	}
}

func rowInt(v interface{}) (int, bool) {
	switch value := v.(type) {
	case int:
		return value, true
	case int64:
		return int(value), true
	case float64:
		return int(value), true
	case string:
		n, err := strconv.Atoi(value)
		return n, err == nil
	default:
		return 0, false
	}
}

func rowBool(v interface{}) (bool, bool) {
	switch value := v.(type) {
	case bool:
		return value, true
	case int:
		return value != 0, true
	case int64:
		return value != 0, true
	case float64:
		return value != 0, true
	case string:
		switch value {
		case "1", "true", "TRUE", "True":
			return true, true
		case "0", "false", "FALSE", "False":
			return false, true
		}
	}
	return false, false
}

func listSessions(c *gin.Context) {
	user := middleware.GetUser(c)
	listDeviceSessions(c, "SELECT * FROM device_sessions WHERE user_id = ? ORDER BY last_seen DESC", user.ID)
}

func listOnlineSessions(c *gin.Context) {
	user := middleware.GetUser(c)
	listDeviceSessions(c, "SELECT * FROM device_sessions WHERE user_id = ? AND is_online = 1 ORDER BY last_seen DESC", user.ID)
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
