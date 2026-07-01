package operations

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/itemplus/backend/internal/database"
	authhandlers "github.com/itemplus/backend/internal/http/auth"
	ws "github.com/itemplus/backend/internal/websocket"
)

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
		return []string{"__admin_only__"}
	default:
		return []string{"items." + action}
	}
}

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

func doDeleteEntity(userID, targetSession int, realm, entityType string, entityID int) {
	if entityType == "user" {
		if !checkUserPermission(userID, "__admin_only__") {
			return
		}
		if err := authhandlers.DeleteUserAccount(entityID, userID, false); err != nil {
			log.Printf("WS user delete error: %v", err)
			sendDeleteRejected(userID, targetSession, entityID, entityType)
			return
		}
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
	if perm == "__admin_only__" {
		return false
	}
	var perms []string
	_ = json.Unmarshal([]byte(permsJSON), &perms)
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

func jsonIntAlt(data map[string]interface{}, key, altKey string) int {
	if v := jsonInt(data, key); v != 0 {
		return v
	}
	return jsonInt(data, altKey)
}

func jsonString(data map[string]interface{}, key, defaultVal string) string {
	if v, ok := data[key].(string); ok && v != "" {
		return v
	}
	return defaultVal
}

func jsonStringAlt(data map[string]interface{}, key, altKey string) string {
	if v, ok := data[key].(string); ok && v != "" {
		return v
	}
	if v, ok := data[altKey].(string); ok {
		return v
	}
	return ""
}

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
