package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/services"
	"github.com/itemplus/backend/internal/ws"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		for _, allowed := range config.C.CORSOrigins {
			if allowed == "*" || allowed == origin {
				return true
			}
		}
		log.Printf("WebSocket origin rejected: %s", origin)
		return false
	},
}

func RegisterWebSocketRoute(r *gin.Engine) {
	r.GET("/ws", handleWebSocket)
}

func handleWebSocket(c *gin.Context) {
	token := c.Query("token")
	ticket := c.Query("ticket")
	deviceType := c.DefaultQuery("device_type", "browser")
	deviceName := c.Query("device_name")

	var userID int
	var isActive, isAdmin bool

	if ticket != "" {
		// Authenticate via single-use WebSocket ticket (WebApp with HttpOnly cookies)
		uid, ok := ValidateWSTicket(ticket)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"detail": "Invalid or expired ticket"})
			return
		}
		userID = uid
		err := database.DB.QueryRow("SELECT is_active, is_admin FROM users WHERE id = ?", userID).Scan(&isActive, &isAdmin)
		if err != nil || !isActive {
			c.JSON(http.StatusForbidden, gin.H{"detail": "User not active"})
			return
		}
	} else if token != "" {
		// Authenticate via JWT token (iOS app)
		claims, err := services.DecodeToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"detail": "Invalid token"})
			return
		}
		userID = claims.UserID
		err = database.DB.QueryRow("SELECT is_active, is_admin FROM users WHERE id = ?", userID).Scan(&isActive, &isAdmin)
		if err != nil || !isActive {
			c.JSON(http.StatusForbidden, gin.H{"detail": "User not active"})
			return
		}
	} else {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Token or ticket required"})
		return
	}

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	clientIP := c.ClientIP()

	// Create or reuse device session
	var sessionID int64
	err = database.DB.QueryRow(
		"SELECT id FROM device_sessions WHERE user_id = ? AND device_type = ? AND ip_address = ? ORDER BY last_seen DESC LIMIT 1",
		userID, deviceType, clientIP,
	).Scan(&sessionID)

	now := time.Now().UTC().Format(time.RFC3339)
	if err != nil {
		// New session
		result, execErr := database.DB.Exec(
			"INSERT INTO device_sessions (user_id, device_type, device_name, ip_address, is_online, last_seen, user_agent, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)",
			userID, deviceType, deviceName, clientIP, now, c.GetHeader("User-Agent"), now, now,
		)
		if execErr != nil {
			log.Printf("WS session insert error: %v", execErr)
			conn.Close()
			return
		}
		sessionID, _ = result.LastInsertId()
	} else {
		database.DB.Exec("UPDATE device_sessions SET is_online = 1, last_seen = ?, device_name = ? WHERE id = ?", now, deviceName, sessionID)
	}

	// Clean up old offline sessions for this user (keep max 10)
	cleanupOldSessions(userID)

	wsConn := &ws.Connection{
		Conn:       conn,
		UserID:     userID,
		SessionID:  int(sessionID),
		DeviceType: deviceType,
		DeviceName: deviceName,
		IsAdmin:    isAdmin,
	}
	ws.M.Add(wsConn)

	// Notify other devices
	ws.M.SendToUserExcept(userID, int(sessionID), "device.connected", map[string]interface{}{
		"session_id":  sessionID,
		"device_type": deviceType,
		"device_name": deviceName,
	})

	defer func() {
		ws.M.Remove(int(sessionID))
		database.DB.Exec("UPDATE device_sessions SET is_online = 0, last_seen = ? WHERE id = ?", time.Now().UTC().Format(time.RFC3339), sessionID)
		ws.M.SendToUser(userID, "device.disconnected", map[string]interface{}{
			"session_id":  sessionID,
			"device_type": deviceType,
			"device_name": deviceName,
		})
	}()

	// Message loop
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var data map[string]interface{}
		if err := json.Unmarshal(message, &data); err != nil {
			continue
		}

		handleWSMessage(data, userID, int(sessionID), deviceType)
	}
}

// cleanupOldSessions removes old offline sessions for a user, keeping max 10.
func cleanupOldSessions(userID int) {
	// Get IDs of offline sessions beyond the 10 most recent
	var ids []int64
	err := database.DB.Select(&ids,
		"SELECT id FROM device_sessions WHERE user_id = ? AND is_online = 0 ORDER BY last_seen DESC LIMIT -1 OFFSET 10",
		userID,
	)
	if err != nil || len(ids) == 0 {
		return
	}
	for _, id := range ids {
		database.DB.Exec("DELETE FROM device_sessions WHERE id = ?", id)
	}
}

func handleWSMessage(data map[string]interface{}, userID, sessionID int, deviceType string) {
	msgType, _ := data["type"].(string)

	switch msgType {
	case "ping":
		ws.M.SendToSession(sessionID, "pong", nil)

	case "qr.scan":
		itemID := jsonInt(data, "item_id")
		targetSession := jsonInt(data, "target_session")
		payload := map[string]interface{}{
			"item_id":      itemID,
			"from_device":  deviceType,
			"from_session": sessionID,
		}
		if targetSession > 0 && ws.M.SessionBelongsToUser(targetSession, userID) {
			ws.M.SendToSession(targetSession, "browser.open_item", payload)
		} else {
			ws.M.SendToUserBrowsers(userID, "browser.open_item", payload)
		}

	case "qr.scan_location":
		locationID := jsonInt(data, "location_id")
		realm, _ := data["realm"].(string)
		ws.M.SendToUserBrowsers(userID, "browser.open_location", map[string]interface{}{
			"location_id":  locationID,
			"realm":        realm,
			"from_device":  deviceType,
			"from_session": sessionID,
		})

	case "delete.request":
		entityType := jsonString(data, "entity_type", "item")
		entityID := jsonIntAlt(data, "entity_id", "item_id")
		entityName := jsonStringAlt(data, "entity_name", "item_name")
		realm := jsonString(data, "realm", "archive")

		// Check permission based on entity type
		perms := permissionsForEntityType(entityType, "delete")
		if !checkUserPermissions(userID, perms...) {
			ws.M.SendToSession(sessionID, "delete.rejected", map[string]interface{}{
				"entity_id": entityID, "entity_type": entityType,
			})
			return
		}

		payload := map[string]interface{}{
			"entity_id":   entityID,
			"entity_type": entityType,
			"entity_name": entityName,
			"realm":       realm,
		}
		if !ws.M.HasIOSDevices(userID) {
			ws.M.SendToSession(sessionID, "delete.no_device", payload)
		} else {
			ws.M.SendToUserIOS(userID, "delete.confirm_request", mergeMaps(payload, map[string]interface{}{
				"from_session": sessionID,
			}))
			ws.M.SendToSession(sessionID, "delete.pending", payload)
		}

	case "delete.confirm":
		entityType := jsonString(data, "entity_type", "item")
		entityID := jsonIntAlt(data, "entity_id", "item_id")
		realm := jsonString(data, "realm", "archive")
		targetSession := jsonInt(data, "target_session")

		// Check permission based on entity type
		perms := permissionsForEntityType(entityType, "delete")
		if !checkUserPermissions(userID, perms...) {
			return
		}

		if targetSession > 0 && !ws.M.SessionBelongsToUser(targetSession, userID) {
			return
		}

		if entityType == "item" {
			doDeleteItem(userID, targetSession, realm, entityID)
		} else {
			doDeleteEntity(userID, targetSession, realm, entityType, entityID)
		}

	case "delete.reject":
		entityID := jsonIntAlt(data, "entity_id", "item_id")
		entityType := jsonString(data, "entity_type", "item")
		targetSession := jsonInt(data, "target_session")
		payload := map[string]interface{}{"entity_id": entityID, "entity_type": entityType}
		if targetSession > 0 && ws.M.SessionBelongsToUser(targetSession, userID) {
			ws.M.SendToSession(targetSession, "delete.rejected", payload)
		} else {
			ws.M.SendToUserBrowsers(userID, "delete.rejected", payload)
		}

	case "photo.request":
		ws.M.SendToUserIOS(userID, "photo.request", map[string]interface{}{
			"item_id":      jsonInt(data, "item_id"),
			"item_name":    data["item_name"],
			"realm":        jsonString(data, "realm", "archive"),
			"from_session": sessionID,
		})

	case "photo.uploaded":
		ws.M.SendToUserBrowsers(userID, "photo.uploaded", map[string]interface{}{
			"item_id":       jsonInt(data, "item_id"),
			"attachment_id": jsonInt(data, "attachment_id"),
		})

	case "devices.list":
		devices := ws.M.GetUserDevices(userID)
		ws.M.SendToSession(sessionID, "devices.list", map[string]interface{}{"devices": devices})

	default:
		log.Printf("Unknown WS message: %s", msgType)
	}
}

// entityTableMap maps entity types to their table name suffixes (prefixed by realm).
// "user" is handled separately since it has no realm prefix.
var entityTableMap = map[string]string{
	"category":     "_categories",
	"location":     "_locations",
	"manufacturer": "_manufacturers",
	"supplier":     "_suppliers",
	"vendor":       "_vendors",
	"attachment":   "_attachments",
	"property":     "_properties",
}

// permissionsForEntityType returns the required permissions for an entity action.
func permissionsForEntityType(entityType, action string) []string {
	switch entityType {
	case "item":
		return []string{"items." + action}
	case "category":
		return []string{"categories." + action}
	case "location":
		return []string{"locations." + action}
	case "manufacturer", "supplier", "vendor":
		return []string{"vendors." + action}
	case "attachment":
		return []string{"attachments.write", "items.read"}
	case "property":
		return []string{"items.write"}
	case "user":
		// User deletion is admin-only, handled by checkUserPermission (admin check)
		return []string{"__admin_only__"}
	default:
		return []string{"items." + action}
	}
}

// doDeleteItem deletes an item and notifies browsers.
func doDeleteItem(userID, targetSession int, realm string, itemID int) {
	if realm != "archive" && realm != "collection" {
		return
	}
	database.DB.Exec(fmt.Sprintf("DELETE FROM %s_items WHERE id = ?", realm), itemID)
	payload := map[string]interface{}{"item_id": itemID, "entity_id": itemID, "entity_type": "item"}
	if targetSession > 0 {
		ws.M.SendToSession(targetSession, "delete.done", payload)
	}
	ws.M.SendToUserBrowsers(userID, "delete.done", payload)
	ws.M.Broadcast("stats."+realm+"_updated", nil)
}

// doDeleteEntity deletes a non-item entity (category, location, vendor, etc.) and notifies browsers.
func doDeleteEntity(userID, targetSession int, realm, entityType string, entityID int) {
	if entityType == "user" {
		// User deletion is admin-only
		if !checkUserPermission(userID, "__admin_only__") {
			return
		}
		database.DB.Exec("DELETE FROM users WHERE id = ?", entityID)
	} else {
		suffix, ok := entityTableMap[entityType]
		if !ok {
			log.Printf("Unknown entity type for delete: %s", entityType)
			return
		}
		if realm != "archive" && realm != "collection" {
			return
		}
		database.DB.Exec(fmt.Sprintf("DELETE FROM %s%s WHERE id = ?", realm, suffix), entityID)
	}

	payload := map[string]interface{}{"entity_id": entityID, "entity_type": entityType}
	if targetSession > 0 {
		ws.M.SendToSession(targetSession, "delete.done", payload)
	}
	ws.M.SendToUserBrowsers(userID, "delete.done", payload)
}

func checkUserPermission(userID int, perm string) bool {
	var isAdmin bool
	var permsJSON string
	err := database.DB.QueryRow("SELECT is_admin, permissions FROM users WHERE id = ?", userID).Scan(&isAdmin, &permsJSON)
	if err != nil {
		return false
	}
	if isAdmin {
		return true
	}
	// Admin-only permissions cannot be granted via the permissions list
	if perm == "__admin_only__" {
		return false
	}
	var perms []string
	json.Unmarshal([]byte(permsJSON), &perms)
	for _, p := range perms {
		if p == perm {
			return true
		}
	}
	return false
}

func checkUserPermissions(userID int, perms ...string) bool {
	for _, perm := range perms {
		if !checkUserPermission(userID, perm) {
			return false
		}
	}
	return true
}

func jsonInt(data map[string]interface{}, key string) int {
	if v, ok := data[key].(float64); ok {
		return int(v)
	}
	return 0
}

// jsonIntAlt tries key first, then falls back to altKey.
func jsonIntAlt(data map[string]interface{}, key, altKey string) int {
	if v := jsonInt(data, key); v != 0 {
		return v
	}
	return jsonInt(data, altKey)
}

// jsonString returns a string from data with a default fallback.
func jsonString(data map[string]interface{}, key, defaultVal string) string {
	if v, ok := data[key].(string); ok && v != "" {
		return v
	}
	return defaultVal
}

// jsonStringAlt tries key first, then falls back to altKey.
func jsonStringAlt(data map[string]interface{}, key, altKey string) string {
	if v, ok := data[key].(string); ok && v != "" {
		return v
	}
	if v, ok := data[altKey].(string); ok {
		return v
	}
	return ""
}

// mergeMaps merges two maps, with values from b overriding a.
func mergeMaps(a, b map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{}, len(a)+len(b))
	for k, v := range a {
		result[k] = v
	}
	for k, v := range b {
		result[k] = v
	}
	return result
}
