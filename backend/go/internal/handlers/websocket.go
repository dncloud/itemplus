package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/printing"
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

const (
	wsWriteWait  = 10 * time.Second
	wsPongWait   = 75 * time.Second
	wsPingPeriod = 30 * time.Second
)

func RegisterWebSocketRoute(r *gin.Engine) {
	r.GET("/ws", handleWebSocket)
}

func loadActiveUserFlags(userID int) (isActive, isAdmin bool, err error) {
	err = database.DB.QueryRow("SELECT is_active, is_admin FROM users WHERE id = ?", userID).Scan(&isActive, &isAdmin)
	return
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
		var err error
		isActive, isAdmin, err = loadActiveUserFlags(userID)
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
		isActive, isAdmin, err = loadActiveUserFlags(userID)
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

	_ = conn.SetReadDeadline(time.Now().Add(wsPongWait))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(wsPongWait))
	})

	clientIP := config.ResolveClientIP(c.Request.RemoteAddr, c.Request.Header)

	// Create or reuse device session
	var sessionID int64
	err = database.DB.QueryRow(
		"SELECT id FROM device_sessions WHERE user_id = ? AND device_type = ? AND ip_address = ? ORDER BY last_seen DESC LIMIT 1",
		userID, deviceType, clientIP,
	).Scan(&sessionID)

	now := database.TimestampNow()
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
	ws.M.SendToSession(int(sessionID), "session.ready", map[string]interface{}{
		"session_id": sessionID,
	})

	// Notify other devices
	ws.M.SendToUserExcept(userID, int(sessionID), "device.connected", map[string]interface{}{
		"session_id":  sessionID,
		"device_type": deviceType,
		"device_name": deviceName,
	})

	done := make(chan struct{})

	defer func() {
		close(done)
		ws.M.Remove(int(sessionID))
		database.DB.Exec("UPDATE device_sessions SET is_online = 0, last_seen = ? WHERE id = ?", database.TimestampNow(), sessionID)
		ws.M.SendToUser(userID, "device.disconnected", map[string]interface{}{
			"session_id":  sessionID,
			"device_type": deviceType,
			"device_name": deviceName,
		})
	}()

	go func() {
		ticker := time.NewTicker(wsPingPeriod)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				if err := conn.WriteControl(websocket.PingMessage, []byte("ping"), time.Now().Add(wsWriteWait)); err != nil {
					_ = conn.Close()
					return
				}
			}
		}
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
	// Keep the query portable across SQLite/MySQL by trimming in Go.
	var ids []int64
	err := database.DB.Select(&ids,
		"SELECT id FROM device_sessions WHERE user_id = ? AND is_online = 0 ORDER BY last_seen DESC",
		userID,
	)
	if err != nil || len(ids) <= 10 {
		return
	}
	for _, id := range ids[10:] {
		database.DB.Exec("DELETE FROM device_sessions WHERE id = ?", id)
	}
}

func touchDeviceSession(userID, sessionID int) {
	now := database.TimestampNow()
	if _, err := database.DB.Exec(
		"UPDATE device_sessions SET is_online = 1, last_seen = ?, updated_at = ? WHERE id = ? AND user_id = ?",
		now, now, sessionID, userID,
	); err != nil {
		log.Printf("DB device session touch error: %v", err)
	}
}

func sendToTargetOrBrowsers(userID, targetSession int, event string, payload map[string]interface{}) {
	if targetSession > 0 && ws.M.SessionBelongsToUser(targetSession, userID) {
		ws.M.SendToSession(targetSession, event, payload)
		return
	}
	ws.M.SendToUserBrowsers(userID, event, payload)
}

func sendDeleteRejected(userID, targetSession, entityID int, entityType string) {
	sendToTargetOrBrowsers(userID, targetSession, "delete.rejected", map[string]interface{}{
		"entity_id":   entityID,
		"entity_type": entityType,
	})
}

func sendPrintResult(userID, targetSession int, success bool, payload map[string]interface{}) {
	event := "print.failed"
	if success {
		event = "print.done"
	}
	sendToTargetOrBrowsers(userID, targetSession, event, payload)
}

func cleanPresenceText(value string, maxLen int) string {
	value = strings.TrimSpace(value)
	if len(value) > maxLen {
		value = value[:maxLen]
	}
	return strings.Map(func(r rune) rune {
		if r < 32 || r == 127 {
			return -1
		}
		return r
	}, value)
}

func handlePresenceUpdate(data map[string]interface{}, userID, sessionID int, deviceType string) {
	if deviceType != "browser" {
		return
	}

	path := cleanPresenceText(jsonString(data, "path", ""), 256)
	if !strings.HasPrefix(path, "/") || strings.HasPrefix(path, "//") {
		path = ""
	}
	label := cleanPresenceText(jsonString(data, "label", ""), 120)
	realm := cleanPresenceText(jsonString(data, "realm", ""), 32)
	if realm != "archive" && realm != "collection" {
		realm = ""
	}

	now := database.TimestampNow()
	if _, err := database.DB.Exec(
		"UPDATE device_sessions SET current_path = ?, current_label = ?, current_realm = ?, last_seen = ?, updated_at = ? WHERE id = ? AND user_id = ?",
		path, label, realm, now, now, sessionID, userID,
	); err != nil {
		log.Printf("DB presence update error: %v", err)
		return
	}

	ws.M.UpdatePresence(sessionID, path, label, realm)
	ws.M.SendToUserIOS(userID, "devices.list", map[string]interface{}{"devices": ws.M.GetUserDevices(userID)})
}

func handlePrinterBridgeStatus(data map[string]interface{}, userID, sessionID int, deviceType string) {
	if deviceType != "ios" {
		return
	}

	configured := jsonBool(data, "configured")
	reachable := jsonBool(data, "reachable")
	now := database.TimestampNow()
	if _, err := database.DB.Exec(
		"UPDATE device_sessions SET printer_bridge_configured = ?, printer_bridge_reachable = ?, last_seen = ?, updated_at = ? WHERE id = ? AND user_id = ?",
		configured, reachable, now, now, sessionID, userID,
	); err != nil {
		log.Printf("DB printer bridge status update error: %v", err)
		return
	}

	ws.M.SendToUser(userID, "devices.list", map[string]interface{}{"devices": ws.M.GetUserDevices(userID)})
}

func hasEntityDeletePermission(userID int, entityType string) bool {
	perms := permissionsForEntityType(entityType, "delete")
	return checkUserPermissions(userID, perms...)
}

func buildDeletePayload(entityType, entityName, realm string, entityID int) map[string]interface{} {
	return map[string]interface{}{
		"entity_id":   entityID,
		"entity_type": entityType,
		"entity_name": entityName,
		"realm":       realm,
	}
}

func handleDeleteRequest(data map[string]interface{}, userID, sessionID int) {
	entityType := jsonString(data, "entity_type", "item")
	entityID := jsonIntAlt(data, "entity_id", "item_id")
	entityName := jsonStringAlt(data, "entity_name", "item_name")
	realm := jsonString(data, "realm", "archive")

	if !hasEntityDeletePermission(userID, entityType) {
		sendDeleteRejected(userID, sessionID, entityID, entityType)
		return
	}

	payload := buildDeletePayload(entityType, entityName, realm, entityID)
	if !ws.M.HasIOSDevices(userID) {
		ws.M.SendToSession(sessionID, "delete.no_device", payload)
		return
	}

	ws.M.SendToUserIOS(userID, "delete.confirm_request", mergeMaps(payload, map[string]interface{}{
		"from_session": sessionID,
	}))
	ws.M.SendToSession(sessionID, "delete.pending", payload)
}

func handleDeleteConfirm(data map[string]interface{}, userID int) {
	entityType := jsonString(data, "entity_type", "item")
	entityID := jsonIntAlt(data, "entity_id", "item_id")
	realm := jsonString(data, "realm", "archive")
	targetSession := jsonInt(data, "target_session")

	if !hasEntityDeletePermission(userID, entityType) {
		return
	}
	if targetSession > 0 && !ws.M.SessionBelongsToUser(targetSession, userID) {
		return
	}

	if entityType == "item" {
		doDeleteItem(userID, targetSession, realm, entityID)
		return
	}
	doDeleteEntity(userID, targetSession, realm, entityType, entityID)
}

func handlePrintRequest(data map[string]interface{}, userID, sessionID int) {
	entityType := jsonString(data, "entity_type", "item")
	entityID := jsonIntAlt(data, "entity_id", "item_id")
	realm := jsonString(data, "realm", "archive")
	requestID := jsonString(data, "request_id", "")
	copies := jsonInt(data, "copies")
	if copies < 1 {
		copies = 1
	}

	if !checkUserPermission(userID, "print") {
		ws.M.SendToSession(sessionID, "print.failed", map[string]interface{}{"request_id": requestID, "detail": "Print permission required"})
		return
	}
	if entityID <= 0 || (entityType != "item" && entityType != "location") {
		ws.M.SendToSession(sessionID, "print.failed", map[string]interface{}{"request_id": requestID, "detail": "Invalid print target"})
		return
	}
	if !ws.M.HasIOSDevices(userID) {
		ws.M.SendToSession(sessionID, "print.failed", map[string]interface{}{"request_id": requestID, "detail": "No iOS bridge connected"})
		return
	}

	tspl, _, err := printing.RenderEntityTSPL(realm, entityType, entityID, copies)
	if err != nil {
		ws.M.SendToSession(sessionID, "print.failed", map[string]interface{}{"request_id": requestID, "detail": err.Error()})
		return
	}

	title := "Item QR"
	if entityType == "location" {
		title = "Location QR"
	}
	ws.M.SendToUserIOS(userID, "print.request", map[string]interface{}{
		"request_id":   requestID,
		"entity_id":    entityID,
		"entity_type":  entityType,
		"realm":        realm,
		"copies":       copies,
		"tspl":         tspl,
		"title":        title,
		"from_session": sessionID,
	})
}

func handleWSMessage(data map[string]interface{}, userID, sessionID int, deviceType string) {
	msgType, _ := data["type"].(string)
	touchDeviceSession(userID, sessionID)

	switch msgType {
	case "ping":
		ws.M.SendToSession(sessionID, "pong", nil)

	case "presence.update":
		handlePresenceUpdate(data, userID, sessionID, deviceType)

	case "printer.bridge_status":
		handlePrinterBridgeStatus(data, userID, sessionID, deviceType)

	case "qr.scan":
		itemID := jsonInt(data, "item_id")
		realm, _ := data["realm"].(string)
		targetSession := jsonInt(data, "target_session")
		sendToTargetOrBrowsers(userID, targetSession, "browser.open_item", map[string]interface{}{
			"item_id":      itemID,
			"realm":        realm,
			"from_device":  deviceType,
			"from_session": sessionID,
		})

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
		handleDeleteRequest(data, userID, sessionID)

	case "delete.confirm":
		handleDeleteConfirm(data, userID)

	case "delete.reject":
		entityID := jsonIntAlt(data, "entity_id", "item_id")
		entityType := jsonString(data, "entity_type", "item")
		targetSession := jsonInt(data, "target_session")
		sendDeleteRejected(userID, targetSession, entityID, entityType)

	case "photo.request":
		ws.M.SendToUserIOS(userID, "photo.request", map[string]interface{}{
			"item_id":      jsonInt(data, "item_id"),
			"item_name":    data["item_name"],
			"realm":        jsonString(data, "realm", "archive"),
			"purpose":      jsonString(data, "purpose", "attachment"),
			"from_session": sessionID,
		})

	case "photo.uploaded":
		sendToTargetOrBrowsers(userID, jsonInt(data, "target_session"), "photo.uploaded", map[string]interface{}{
			"item_id":       jsonInt(data, "item_id"),
			"attachment_id": jsonInt(data, "attachment_id"),
			"temp_image_id": jsonString(data, "temp_image_id", ""),
			"purpose":       jsonString(data, "purpose", "attachment"),
		})

	case "barcode.capture_request":
		realm := jsonString(data, "realm", "archive")
		if !ws.M.HasIOSDevices(userID) {
			ws.M.SendToSession(sessionID, "barcode.capture_unavailable", map[string]interface{}{
				"realm": realm,
			})
			return
		}
		ws.M.SendToUserIOS(userID, "barcode.capture_request", map[string]interface{}{
			"realm":        realm,
			"from_session": sessionID,
		})

	case "barcode.scanned":
		code := jsonString(data, "code", "")
		symbology := jsonString(data, "symbology", "")
		targetSession := jsonInt(data, "target_session")
		realm := jsonString(data, "realm", "archive")
		sendToTargetOrBrowsers(userID, targetSession, "barcode.scanned", map[string]interface{}{
			"code":         code,
			"symbology":    symbology,
			"realm":        realm,
			"from_device":  deviceType,
			"from_session": sessionID,
		})

	case "print.request":
		handlePrintRequest(data, userID, sessionID)

	case "print.result":
		requestID := jsonString(data, "request_id", "")
		success, _ := data["success"].(bool)
		detail := jsonString(data, "detail", "")
		targetSession := jsonInt(data, "target_session")
		sendPrintResult(userID, targetSession, success, map[string]interface{}{"request_id": requestID, "detail": detail})

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
	"category":       "_categories",
	"location":       "_locations",
	"manufacturer":   "_manufacturers",
	"supplier":       "_suppliers",
	"vendor":         "_vendors",
	"sales_platform": "generic_sales_platforms",
	"attachment":     "_attachments",
	"property":       "_properties",
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
	case "manufacturer", "supplier", "vendor", "sales_platform":
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
		if entityType == "sales_platform" {
			database.DB.Exec("DELETE FROM generic_sales_platforms WHERE id = ?", entityID)
		} else {
			if realm != "archive" && realm != "collection" {
				return
			}
			database.DB.Exec(fmt.Sprintf("DELETE FROM %s%s WHERE id = ?", realm, suffix), entityID)
		}
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

func jsonBool(data map[string]interface{}, key string) bool {
	if v, ok := data[key].(bool); ok {
		return v
	}
	if v, ok := data[key].(float64); ok {
		return v != 0
	}
	if v, ok := data[key].(string); ok {
		switch strings.TrimSpace(strings.ToLower(v)) {
		case "1", "true", "yes", "on":
			return true
		}
	}
	return false
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
