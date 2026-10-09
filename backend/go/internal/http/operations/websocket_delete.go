package operations

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	itemscore "github.com/itemplus/backend/internal/core/items"
	"github.com/itemplus/backend/internal/database"
	authhandlers "github.com/itemplus/backend/internal/http/auth"
	"github.com/itemplus/backend/internal/http/middleware"
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

// pendingDeletes remembers which deletions a browser has asked the user's
// iPhone to confirm. A confirmation is only honoured when it answers one of
// these requests, so no client can delete by sending "delete.confirm" on its
// own.
type pendingDeleteKey struct {
	userID     int
	entityType string
	entityID   int
}

type pendingDelete struct {
	realm       string
	fromSession int
	expires     time.Time
}

const pendingDeleteLifetime = 2 * time.Minute

var (
	pendingDeletesMu sync.Mutex
	pendingDeletes   = map[pendingDeleteKey]pendingDelete{}
)

func rememberPendingDelete(key pendingDeleteKey, realm string, fromSession int) {
	pendingDeletesMu.Lock()
	defer pendingDeletesMu.Unlock()
	now := time.Now()
	for existing, request := range pendingDeletes {
		if now.After(request.expires) {
			delete(pendingDeletes, existing)
		}
	}
	pendingDeletes[key] = pendingDelete{realm: realm, fromSession: fromSession, expires: now.Add(pendingDeleteLifetime)}
}

// takePendingDelete returns the open request for the key and removes it.
func takePendingDelete(key pendingDeleteKey) (pendingDelete, bool) {
	pendingDeletesMu.Lock()
	defer pendingDeletesMu.Unlock()
	request, ok := pendingDeletes[key]
	delete(pendingDeletes, key)
	if !ok || time.Now().After(request.expires) {
		return pendingDelete{}, false
	}
	return request, true
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

	// No point in asking the iPhone to confirm what will be refused anyway.
	if usage := masterDataUsage(realm, entityType, entityID); usage != nil {
		sendDeleteInUse(userID, sessionID, entityID, entityType, usage)
		return
	}

	payload := buildDeletePayload(entityType, entityName, realm, entityID)
	if !ws.M.HasIOSDevices(userID) {
		ws.M.SendToSession(sessionID, "delete.no_device", payload)
		return
	}

	rememberPendingDelete(pendingDeleteKey{userID, entityType, entityID}, realm, sessionID)
	ws.M.SendToUserIOS(userID, "delete.confirm_request", mergeMaps(payload, map[string]interface{}{
		"from_session": sessionID,
	}))
	ws.M.SendToSession(sessionID, "delete.pending", payload)
}

// handleDeleteConfirm carries out a deletion the user approved on the iPhone.
// It only acts for an iPhone connection and for a request that is still
// open; realm and requesting session come from that request, not from the
// confirmation message.
func handleDeleteConfirm(data map[string]interface{}, userID int, deviceType string) {
	entityType := jsonString(data, "entity_type", "item")
	entityID := jsonIntAlt(data, "entity_id", "item_id")

	if deviceType != "ios" {
		return
	}
	request, ok := takePendingDelete(pendingDeleteKey{userID, entityType, entityID})
	if !ok {
		return
	}
	if !hasEntityDeletePermission(userID, entityType) {
		sendDeleteRejected(userID, request.fromSession, entityID, entityType)
		return
	}

	if entityType == "item" {
		doDeleteItem(userID, request.fromSession, request.realm, entityID)
		return
	}
	doDeleteEntity(userID, request.fromSession, request.realm, entityType, entityID)
}

var entityTableMap = map[string]string{
	"category":       "_categories",
	"location":       "_locations",
	"manufacturer":   "_manufacturers",
	"supplier":       "_suppliers",
	"vendor":         "_vendors",
	"developer":      "_developers",
	"publisher":      "_publishers",
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
	case "manufacturer", "supplier", "vendor", "developer", "publisher", "sales_platform":
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
	found, err := itemscore.DeleteItem(realm, itemID)
	if err != nil || !found {
		if err != nil {
			log.Printf("WS item delete error: %v", err)
		}
		sendDeleteRejected(userID, targetSession, itemID, "item")
		return
	}
	middleware.Audit(userID, "item.delete", fmt.Sprintf("realm=%s item=%d confirmed=ios", realm, itemID))

	payload := map[string]interface{}{"item_id": itemID, "entity_id": itemID, "entity_type": "item"}
	if targetSession > 0 {
		ws.M.SendToSession(targetSession, "delete.done", payload)
	}
	ws.M.SendToUserBrowsers(userID, "delete.done", payload)
	ws.M.Broadcast("stats."+realm+"_updated", nil)
}

func doDeleteEntity(userID, targetSession int, realm, entityType string, entityID int) {
	var err error
	found := true
	switch entityType {
	case "user":
		if !checkUserPermission(userID, "__admin_only__") {
			return
		}
		err = authhandlers.DeleteUserAccount(entityID, userID, false)
	case "attachment":
		// Removes the uploaded file as well, like the HTTP route does.
		found, err = itemscore.DeleteAttachment(realm, entityID)
	case "property":
		found, err = itemscore.DeleteProperty(realm, entityID)
	case "category":
		found, err = itemscore.DeleteCategory(realm, entityID)
	case "location":
		found, err = itemscore.DeleteLocation(realm, entityID)
	case "sales_platform":
		_, err = database.DB.Exec("DELETE FROM generic_sales_platforms WHERE id = ?", entityID)
	default:
		suffix, ok := entityTableMap[entityType]
		if !ok {
			log.Printf("Unknown entity type for delete: %s", entityType)
			return
		}
		if realm != "archive" && realm != "collection" {
			return
		}
		_, err = database.DB.Exec(fmt.Sprintf("DELETE FROM %s%s WHERE id = ?", realm, suffix), entityID)
	}
	var inUse *itemscore.InUseError
	if errors.As(err, &inUse) {
		sendDeleteInUse(userID, targetSession, entityID, entityType, inUse)
		return
	}
	if err != nil || !found {
		if err != nil {
			log.Printf("WS %s delete error: %v", entityType, err)
		}
		sendDeleteRejected(userID, targetSession, entityID, entityType)
		return
	}
	middleware.Audit(userID, entityType+".delete", fmt.Sprintf("realm=%s id=%d confirmed=ios", realm, entityID))

	payload := map[string]interface{}{"entity_id": entityID, "entity_type": entityType}
	if targetSession > 0 {
		ws.M.SendToSession(targetSession, "delete.done", payload)
	}
	ws.M.SendToUserBrowsers(userID, "delete.done", payload)
}

// masterDataUsage returns the usage of a category or location that is still
// in use, and nil for everything that may be deleted.
func masterDataUsage(realm, entityType string, entityID int) *itemscore.InUseError {
	var usage *itemscore.InUseError
	var err error
	switch entityType {
	case "category":
		usage, err = itemscore.CategoryUsage(realm, entityID)
	case "location":
		usage, err = itemscore.LocationUsage(realm, entityID)
	default:
		return nil
	}
	if err != nil || (usage.Items == 0 && usage.Children == 0) {
		return nil
	}
	return usage
}

// sendDeleteInUse tells the requesting browser that the deletion was refused
// because the category or location is still in use.
func sendDeleteInUse(userID, targetSession, entityID int, entityType string, usage *itemscore.InUseError) {
	sendToTargetOrBrowsers(userID, targetSession, "delete.rejected", map[string]interface{}{
		"entity_id":       entityID,
		"entity_type":     entityType,
		"reason":          entityType + "_in_use",
		"in_use_items":    usage.Items,
		"in_use_children": usage.Children,
	})
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
