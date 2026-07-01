package operations

import (
	"log"
	"strings"

	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/printing"
	ws "github.com/itemplus/backend/internal/websocket"
)

func cleanupOldSessions(userID int) {
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
		if targetSession > 0 && ws.M.SessionBelongsToUser(targetSession, userID) {
			ws.M.SendToSession(targetSession, "qr.scanned", map[string]interface{}{
				"item_id":      itemID,
				"realm":        realm,
				"from_device":  deviceType,
				"from_session": sessionID,
			})
			return
		}
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
			ws.M.SendToSession(sessionID, "barcode.capture_unavailable", map[string]interface{}{"realm": realm})
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
