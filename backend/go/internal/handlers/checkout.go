package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
	"github.com/itemplus/backend/internal/ws"
)

func RegisterCheckoutRoutes(api *gin.RouterGroup) {
	// Direct checkout/checkin
	api.POST("/checkout/:realm/:item_id", middleware.Auth(), middleware.RequirePermission("checkout.manage"), checkoutItem)
	api.POST("/checkin/:realm/:item_id", middleware.Auth(), middleware.RequirePermission("checkout.manage"), checkinItem)
	api.PUT("/checkout/:realm/:id", middleware.Auth(), middleware.RequireAdmin(), updateCheckout)

	// Checkout lists
	api.GET("/checkouts/:realm/active", middleware.Auth(), listActiveCheckouts)
	api.GET("/checkouts/:realm/history", middleware.Auth(), listCheckoutHistory)
	api.GET("/checkouts/my/overdue", middleware.Auth(), listMyOverdueCheckouts)
	api.GET("/checkouts/overdue", middleware.Auth(), middleware.RequirePermission("checkout.manage"), listOverdueCheckouts)

	// Checkout requests
	api.POST("/checkout/request", middleware.Auth(), createCheckoutRequest)
	api.GET("/checkout/requests", middleware.Auth(), listCheckoutRequests)
	api.PUT("/checkout/requests/:id/approve", middleware.Auth(), middleware.RequirePermission("checkout.manage"), approveCheckoutRequest)
	api.PUT("/checkout/requests/:id/reject", middleware.Auth(), middleware.RequirePermission("checkout.manage"), rejectCheckoutRequest)
}

// enrichCheckout adds overdue/duration info to a checkout row.
// The row must already contain: status, created_at, due_date, returned_at (from DB).
func enrichCheckout(row map[string]interface{}, realm string) {
	row["realm"] = realm
	now := time.Now().In(time.Local)

	// Parse created_at for duration calculation
	var start time.Time
	if v, ok := row["created_at"]; ok && v != nil {
		start = parseTime(v)
	}

	// Parse returned_at
	var returned time.Time
	var hasReturned bool
	if v, ok := row["returned_at"]; ok && v != nil {
		returned = parseTime(v)
		hasReturned = !returned.IsZero()
	}

	// Duration calculation
	if !start.IsZero() {
		end := now
		if hasReturned {
			end = returned
		}
		durationDays := end.Sub(start).Seconds() / 86400
		row["duration_days"] = math.Round(durationDays*10) / 10
	}

	// Overdue calculation
	if v, ok := row["due_date"]; ok && v != nil {
		due := parseTime(v)
		if !due.IsZero() {
			statusVal, _ := row["status"].(string)
			if statusVal == "" {
				// status might be []byte from MapScan
				if b, ok := row["status"].([]byte); ok {
					statusVal = string(b)
				}
			}
			if statusVal == "active" {
				isOverdue := isCheckoutOverdue(now, due)
				row["is_overdue"] = isOverdue
				row["overdue_days"] = calculateOverdueDays(now, due)
			} else if hasReturned {
				wasOverdue := isCheckoutOverdue(returned, due)
				row["was_overdue"] = wasOverdue
				row["overdue_days"] = calculateOverdueDays(returned, due)
			}
		}
	}
}

func normalizeCheckoutDate(value time.Time, loc *time.Location) time.Time {
	local := value.In(loc)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, loc)
}

func isCheckoutOverdue(reference, due time.Time) bool {
	loc := time.Local
	return normalizeCheckoutDate(reference, loc).After(normalizeCheckoutDate(due, loc))
}

func calculateOverdueDays(reference, due time.Time) float64 {
	loc := time.Local
	referenceDate := normalizeCheckoutDate(reference, loc)
	dueDate := normalizeCheckoutDate(due, loc)
	overdueDays := referenceDate.Sub(dueDate).Seconds() / 86400
	if overdueDays < 0 {
		overdueDays = 0
	}
	return math.Round(overdueDays*10) / 10
}

// parseTime attempts to parse a time value from various formats returned by DB/MapScan.
func parseTime(v interface{}) time.Time {
	switch val := v.(type) {
	case time.Time:
		return val.UTC()
	case string:
		return parseTimeStr(val)
	case []byte:
		return parseTimeStr(string(val))
	}
	return time.Time{}
}

func parseTimeStr(s string) time.Time {
	if len(s) == len("2006-01-02") {
		if t, err := time.ParseInLocation("2006-01-02", s, time.Local); err == nil {
			return t
		}
	}
	for _, layout := range []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05Z",
		"2006-01-02 15:04:05Z",
	} {
		if t, err := time.Parse(layout, s); err == nil {
			return t.UTC()
		}
	}
	return time.Time{}
}

func ensureCheckoutRealm(c *gin.Context, realm string) bool {
	if realm == "archive" || realm == "collection" {
		return true
	}
	c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid realm"})
	return false
}

func loadCheckoutRow(query string, realm string, args ...interface{}) (map[string]interface{}, error) {
	row := map[string]interface{}{}
	if err := database.DB.QueryRowx(query, args...).MapScan(row); err != nil {
		return nil, err
	}
	cleanRow(row)
	enrichCheckout(row, realm)
	return row, nil
}

func loadCheckoutRows(query string, realm string, args ...interface{}) ([]map[string]interface{}, error) {
	rows, err := database.DB.Queryx(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		row := map[string]interface{}{}
		if rows.MapScan(row) == nil {
			cleanRow(row)
			enrichCheckout(row, realm)
			result = append(result, row)
		}
	}
	if result == nil {
		result = []map[string]interface{}{}
	}
	return result, nil
}

func loadCheckoutRequestRow(query string, args ...interface{}) (map[string]interface{}, error) {
	row := map[string]interface{}{}
	if err := database.DB.QueryRowx(query, args...).MapScan(row); err != nil {
		return nil, err
	}
	cleanRow(row)
	enrichCheckoutRequestComponents(row)
	enrichCheckoutRequest(row)
	return row, nil
}

func loadBundleComponentIDs(realm string, parentItemID int) ([]int, error) {
	table := realm + "_item_components"
	rows, err := database.DB.Queryx(
		fmt.Sprintf("SELECT child_item_id FROM %s WHERE parent_item_id = ? ORDER BY position ASC, id ASC", table),
		parentItemID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	componentIDs := []int{}
	for rows.Next() {
		var childID int
		if err := rows.Scan(&childID); err != nil {
			return nil, err
		}
		componentIDs = append(componentIDs, childID)
	}
	return componentIDs, rows.Err()
}

func resolveCheckoutComponentIDs(realm string, parentItemID int, selectedComponentIDs []int) ([]int, error) {
	availableComponentIDs, err := loadBundleComponentIDs(realm, parentItemID)
	if err != nil {
		return nil, err
	}
	if len(availableComponentIDs) == 0 {
		if len(selectedComponentIDs) > 0 {
			return nil, errors.New("Dieses Item ist kein Bundle")
		}
		return nil, nil
	}
	if len(selectedComponentIDs) == 0 {
		return availableComponentIDs, nil
	}

	allowed := map[int]bool{}
	for _, componentID := range availableComponentIDs {
		allowed[componentID] = true
	}
	seen := map[int]bool{}
	resolved := make([]int, 0, len(selectedComponentIDs))
	for _, componentID := range selectedComponentIDs {
		if !allowed[componentID] {
			return nil, errors.New("Mindestens ein ausgewählter Bestandteil gehört nicht zu diesem Bundle")
		}
		if seen[componentID] {
			continue
		}
		seen[componentID] = true
		resolved = append(resolved, componentID)
	}
	return resolved, nil
}

func parseComponentIDsJSON(raw interface{}) []int {
	if raw == nil {
		return []int{}
	}
	switch value := raw.(type) {
	case string:
		if strings.TrimSpace(value) == "" {
			return []int{}
		}
		var ids []int
		if json.Unmarshal([]byte(value), &ids) == nil {
			return ids
		}
	case []byte:
		var ids []int
		if json.Unmarshal(value, &ids) == nil {
			return ids
		}
	case []int:
		return value
	case []int64:
		ids := make([]int, 0, len(value))
		for _, id := range value {
			ids = append(ids, int(id))
		}
		return ids
	case []interface{}:
		ids := make([]int, 0, len(value))
		for _, entry := range value {
			switch n := entry.(type) {
			case int:
				ids = append(ids, n)
			case int64:
				ids = append(ids, int(n))
			case float64:
				ids = append(ids, int(n))
			case string:
				if parsed, err := strconv.Atoi(strings.TrimSpace(n)); err == nil {
					ids = append(ids, parsed)
				}
			}
		}
		return ids
	}
	return []int{}
}

func loadItemNamesByID(realm string, ids []int) map[int]string {
	names := map[int]string{}
	if len(ids) == 0 || (realm != "archive" && realm != "collection") {
		return names
	}

	args := make([]interface{}, 0, len(ids))
	for _, id := range ids {
		args = append(args, id)
	}

	rows, err := database.DB.Queryx(
		fmt.Sprintf("SELECT id, name FROM %s_items WHERE id IN (%s)", realm, inClausePlaceholders(args)),
		args...,
	)
	if err != nil {
		return names
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		var name string
		if err := rows.Scan(&id, &name); err == nil && strings.TrimSpace(name) != "" {
			names[id] = name
		}
	}
	return names
}

// Keep bundle labels in the original component order while loading the names in
// one small query. That keeps checkout lists readable without extra DB chatter.
func orderedItemNames(ids []int, namesByID map[int]string, includeFallback bool) []string {
	names := make([]string, 0, len(ids))
	for _, id := range ids {
		name, ok := namesByID[id]
		if ok {
			names = append(names, name)
			continue
		}
		if includeFallback {
			names = append(names, fmt.Sprintf("Item #%d", id))
		}
	}
	return names
}

func enrichCheckoutRequestComponents(row map[string]interface{}) {
	realmStr, _ := row["realm"].(string)
	if realmStr == "" {
		if b, ok := row["realm"].([]byte); ok {
			realmStr = string(b)
		}
	}
	if realmStr != "archive" && realmStr != "collection" {
		return
	}

	itemID := asInt(row["item_id"])
	componentIDs := parseComponentIDsJSON(row["component_item_ids"])
	row["component_item_ids"] = componentIDs

	row["component_names"] = orderedItemNames(componentIDs, loadItemNamesByID(realmStr, componentIDs), false)

	allComponentIDs, err := loadBundleComponentIDs(realmStr, itemID)
	if err != nil || len(allComponentIDs) == 0 {
		row["bundle_component_item_ids"] = []int{}
		row["bundle_component_names"] = []string{}
		return
	}

	row["bundle_component_item_ids"] = allComponentIDs
	row["bundle_component_names"] = orderedItemNames(allComponentIDs, loadItemNamesByID(realmStr, allComponentIDs), false)
}

func enrichActiveCheckoutComponents(row map[string]interface{}) {
	realmStr, _ := row["realm"].(string)
	if realmStr == "" {
		if b, ok := row["realm"].([]byte); ok {
			realmStr = string(b)
		}
	}
	if realmStr != "archive" && realmStr != "collection" {
		return
	}

	itemID := asInt(row["item_id"])
	if itemID == 0 {
		return
	}

	allComponentIDs, err := loadBundleComponentIDs(realmStr, itemID)
	if err != nil || len(allComponentIDs) == 0 {
		row["is_bundle"] = false
		row["component_item_ids"] = []int{}
		row["component_names"] = []string{}
		row["bundle_component_item_ids"] = []int{}
		row["bundle_component_names"] = []string{}
		return
	}

	row["is_bundle"] = true
	checkoutsTable := realmStr + "_checkouts"

	allNames := orderedItemNames(allComponentIDs, loadItemNamesByID(realmStr, allComponentIDs), true)
	row["bundle_component_item_ids"] = allComponentIDs
	row["bundle_component_names"] = allNames

	userID := asInt64(row["user_id"])
	createdAt := normalizeNullableDBValue(row["created_at"])
	dueDate := normalizeNullableDBValue(row["due_date"])
	notes := normalizeNullableDBValue(row["notes"])

	childRows, err := database.DB.Queryx(
		fmt.Sprintf(`SELECT item_id
			FROM %s
			WHERE status = 'active'
			  AND bundle_parent_item_id = ?
			  AND user_id = ?
			  AND created_at = ?
			  AND (
			    (due_date IS NULL AND ? IS NULL)
			    OR due_date = ?
			  )
			  AND (
			    (notes IS NULL AND ? IS NULL)
			    OR notes = ?
			  )
			ORDER BY id ASC`, checkoutsTable),
		itemID,
		userID,
		createdAt,
		dueDate,
		dueDate,
		notes,
		notes,
	)
	if err != nil {
		row["component_item_ids"] = []int{}
		row["component_names"] = []string{}
		return
	}
	defer childRows.Close()

	activeComponentIDs := []int{}
	activeComponentNames := []string{}
	nameByID := map[int]string{}
	for index, componentID := range allComponentIDs {
		if index < len(allNames) {
			nameByID[componentID] = allNames[index]
		}
	}

	for childRows.Next() {
		var childID int
		if err := childRows.Scan(&childID); err == nil {
			activeComponentIDs = append(activeComponentIDs, childID)
			if name, ok := nameByID[childID]; ok {
				activeComponentNames = append(activeComponentNames, name)
			}
		}
	}

	row["component_item_ids"] = activeComponentIDs
	row["component_names"] = activeComponentNames
}

func ensureCheckoutTargetsAvailable(checkoutsTable, itemsTable string, parentItemID int, componentItemIDs []int) error {
	var quantity int
	if err := database.DB.Get(&quantity, fmt.Sprintf("SELECT COALESCE(quantity, 1) FROM %s WHERE id = ?", itemsTable), parentItemID); err != nil {
		return err
	}
	if quantity < 1 {
		quantity = 1
	}

	var activeParentCount int
	if err := database.DB.Get(&activeParentCount, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE item_id = ? AND status = 'active'", checkoutsTable), parentItemID); err != nil {
		return err
	}
	if activeParentCount >= quantity {
		if quantity == 1 {
			return errors.New("Item ist bereits ausgeliehen")
		}
		return fmt.Errorf("Alle %d Exemplare sind bereits ausgeliehen", quantity)
	}

	for _, targetID := range componentItemIDs {
		var count int
		if err := database.DB.Get(&count, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE item_id = ? AND status = 'active'", checkoutsTable), targetID); err != nil {
			return err
		}
		if count > 0 {
			return errors.New("Mindestens ein ausgewählter Bestandteil ist bereits ausgeliehen")
		}
	}
	return nil
}

func checkoutItem(c *gin.Context) {
	realm := c.Param("realm")
	itemID := c.Param("item_id")
	table := realm + "_checkouts"
	itemsTable := realm + "_items"

	if !ensureCheckoutRealm(c, realm) {
		return
	}

	var body struct {
		UserID           *int    `json:"user_id"`
		DueDate          *string `json:"due_date"`
		Notes            *string `json:"notes"`
		ComponentItemIDs []int   `json:"component_item_ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	itemIDInt, err := strconv.Atoi(itemID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid item id"})
		return
	}

	selectedComponentIDs, err := resolveCheckoutComponentIDs(realm, itemIDInt, body.ComponentItemIDs)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	if err := ensureCheckoutTargetsAvailable(table, itemsTable, itemIDInt, selectedComponentIDs); err != nil {
		c.JSON(http.StatusConflict, gin.H{"detail": err.Error()})
		return
	}

	user := middleware.GetUser(c)
	checkoutUserID := user.ID
	if body.UserID != nil {
		checkoutUserID = *body.UserID
	}

	now := database.TimestampNow()
	tx, err := database.DB.Beginx()
	if err != nil {
		log.Printf("DB begin error in checkoutItem: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	defer tx.Rollback()

	result, err := tx.Exec(
		fmt.Sprintf("INSERT INTO %s (item_id, bundle_parent_item_id, user_id, status, due_date, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)", table),
		itemID, nil, checkoutUserID, "active", body.DueDate, body.Notes, now, now,
	)
	if err != nil {
		log.Printf("DB insert error in checkoutItem: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	newID, _ := result.LastInsertId()
	for _, componentID := range selectedComponentIDs {
		if _, err := tx.Exec(
			fmt.Sprintf("INSERT INTO %s (item_id, bundle_parent_item_id, user_id, status, due_date, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)", table),
			componentID, itemIDInt, checkoutUserID, "active", body.DueDate, body.Notes, now, now,
		); err != nil {
			log.Printf("DB insert child checkout error in checkoutItem: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
	}
	if err := tx.Commit(); err != nil {
		log.Printf("DB commit error in checkoutItem: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	audit(user.ID, "checkout.create", fmt.Sprintf("realm=%s item=%s", realm, itemID))

	row, err := loadCheckoutRow(fmt.Sprintf(
		`SELECT co.*, i.name AS item_name, COALESCE(u.display_name, u.email) AS user_name
		FROM %s co
		LEFT JOIN %s i ON co.item_id = i.id
		LEFT JOIN users u ON co.user_id = u.id
		WHERE co.id = ?`, table, itemsTable), realm, newID)
	if err != nil {
		log.Printf("DB read error in checkoutItem: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	c.JSON(http.StatusCreated, row)
}

func checkinItem(c *gin.Context) {
	realm := c.Param("realm")
	itemID := c.Param("item_id")
	table := realm + "_checkouts"

	if !ensureCheckoutRealm(c, realm) {
		return
	}

	var body struct {
		CheckoutID *int64 `json:"checkout_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil && !errors.Is(err, io.EOF) {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	now := database.TimestampNow()
	var result sql.Result
	var err error
	if body.CheckoutID != nil {
		rootRow := map[string]interface{}{}
		if err := database.DB.QueryRowx(
			fmt.Sprintf("SELECT id, item_id, user_id, due_date, notes, created_at FROM %s WHERE id = ? AND item_id = ? AND status = 'active'", table),
			*body.CheckoutID,
			itemID,
		).MapScan(rootRow); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				c.JSON(http.StatusNotFound, gin.H{"detail": "No active checkout found"})
				return
			}
			log.Printf("DB checkout lookup error in checkinItem: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		cleanRow(rootRow)
		rootItemID := asInt64(rootRow["item_id"])
		rootUserID := asInt64(rootRow["user_id"])
		rootCreatedAt := normalizeNullableDBValue(rootRow["created_at"])
		rootDueDate := normalizeNullableDBValue(rootRow["due_date"])
		rootNotes := normalizeNullableDBValue(rootRow["notes"])

		result, err = database.DB.Exec(
			fmt.Sprintf(`UPDATE %s
				SET status = 'returned', returned_at = ?, updated_at = ?
				WHERE status = 'active'
				  AND (
				    id = ?
				    OR (
				      bundle_parent_item_id = ?
				      AND user_id = ?
				      AND created_at = ?
				      AND (
				        (due_date IS NULL AND ? IS NULL)
				        OR due_date = ?
				      )
				      AND (
				        (notes IS NULL AND ? IS NULL)
				        OR notes = ?
				      )
				    )
				  )`, table),
			now,
			now,
			*body.CheckoutID,
			rootItemID,
			rootUserID,
			rootCreatedAt,
			rootDueDate,
			rootDueDate,
			rootNotes,
			rootNotes,
		)
	} else {
		result, err = database.DB.Exec(
			fmt.Sprintf("UPDATE %s SET status = 'returned', returned_at = ?, updated_at = ? WHERE (item_id = ? OR bundle_parent_item_id = ?) AND status = 'active'", table),
			now, now, itemID, itemID,
		)
	}
	if err != nil {
		log.Printf("DB update error in checkinItem: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "No active checkout found"})
		return
	}

	// Mark the corresponding checkout request as completed
	database.DB.Exec(
		`UPDATE checkout_requests SET status = 'completed', updated_at = ?
		WHERE realm = ? AND item_id = ? AND status = 'approved'`,
		now, realm, itemID,
	)

	user := middleware.GetUser(c)
	audit(user.ID, "checkout.return", fmt.Sprintf("realm=%s item=%s", realm, itemID))
	ws.M.Broadcast("stats."+realm+"_updated", nil)
	response := gin.H{"status": "returned", "item_id": itemID}
	if body.CheckoutID != nil {
		response["checkout_id"] = *body.CheckoutID
	}
	c.JSON(http.StatusOK, response)
}

func updateCheckout(c *gin.Context) {
	realm := c.Param("realm")
	id := c.Param("id")
	table := realm + "_checkouts"

	if !ensureCheckoutRealm(c, realm) {
		return
	}

	body := map[string]interface{}{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	delete(body, "id")
	delete(body, "item_id")
	delete(body, "user_id")
	body["updated_at"] = database.TimestampNow()

	sets, vals, err := buildUpdate(body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid field name"})
		return
	}
	vals = append(vals, id)
	_, err = database.DB.Exec(fmt.Sprintf("UPDATE %s SET %s WHERE id = ?", table, sets), vals...)
	if err != nil {
		log.Printf("DB update error in updateCheckout: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	row, _ := loadCheckoutRow(fmt.Sprintf("SELECT * FROM %s WHERE id = ?", table), realm, id)
	c.JSON(http.StatusOK, row)
}

func listActiveCheckouts(c *gin.Context) {
	realm := c.Param("realm")
	table := realm + "_checkouts"
	itemsTable := realm + "_items"

	if !ensureCheckoutRealm(c, realm) {
		return
	}

	query := fmt.Sprintf(
		`SELECT co.*, i.name AS item_name, COALESCE(u.display_name, u.email) AS user_name
		FROM %s co
		LEFT JOIN %s i ON co.item_id = i.id
		LEFT JOIN users u ON co.user_id = u.id
		WHERE co.status = 'active' AND co.bundle_parent_item_id IS NULL
		ORDER BY co.created_at DESC`, table, itemsTable)

	result, err := loadCheckoutRows(query, realm)
	if err != nil {
		log.Printf("DB query error in listActiveCheckouts: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	for _, row := range result {
		enrichActiveCheckoutComponents(row)
	}
	c.JSON(http.StatusOK, result)
}

func listCheckoutHistory(c *gin.Context) {
	realm := c.Param("realm")
	table := realm + "_checkouts"
	itemsTable := realm + "_items"

	if !ensureCheckoutRealm(c, realm) {
		return
	}

	query := fmt.Sprintf(
		`SELECT co.*, i.name AS item_name, COALESCE(u.display_name, u.email) AS user_name
		FROM %s co
		LEFT JOIN %s i ON co.item_id = i.id
		LEFT JOIN users u ON co.user_id = u.id
		WHERE co.status = 'returned' AND co.bundle_parent_item_id IS NULL
		ORDER BY co.updated_at DESC
		LIMIT 50`, table, itemsTable)

	result, err := loadCheckoutRows(query, realm)
	if err != nil {
		log.Printf("DB query error in listCheckoutHistory: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	c.JSON(http.StatusOK, result)
}

func listMyOverdueCheckouts(c *gin.Context) {
	user := middleware.GetUser(c)
	allOverdue := collectOverdueCheckouts(&user.ID)
	c.JSON(http.StatusOK, allOverdue)
}

func listOverdueCheckouts(c *gin.Context) {
	allOverdue := collectOverdueCheckouts(nil)
	c.JSON(http.StatusOK, allOverdue)
}

func collectOverdueCheckouts(userID *int) []map[string]interface{} {
	var allOverdue []map[string]interface{}
	for _, realm := range []string{"archive", "collection"} {
		table := realm + "_checkouts"
		itemsTable := realm + "_items"

		userFilter := ""
		args := []interface{}{}
		if userID != nil {
			userFilter = "AND co.user_id = ?"
			args = append(args, *userID)
		}

		query := fmt.Sprintf(
			`SELECT co.*, i.name AS item_name, COALESCE(u.display_name, u.email) AS user_name, '%s' AS realm
			FROM %s co
			LEFT JOIN %s i ON co.item_id = i.id
			LEFT JOIN users u ON co.user_id = u.id
			WHERE co.status = 'active' AND co.due_date IS NOT NULL AND co.bundle_parent_item_id IS NULL %s
			ORDER BY co.due_date`, realm, table, itemsTable, userFilter)

		rows, err := loadCheckoutRows(query, realm, args...)
		if err != nil {
			continue
		}
		for _, row := range rows {
			if isOverdue, ok := row["is_overdue"].(bool); ok && isOverdue {
				allOverdue = append(allOverdue, row)
			}
		}
	}

	if allOverdue == nil {
		allOverdue = []map[string]interface{}{}
	}
	sort.SliceStable(allOverdue, func(i, j int) bool {
		return parseTime(allOverdue[i]["due_date"]).Before(parseTime(allOverdue[j]["due_date"]))
	})
	return allOverdue
}

func createCheckoutRequest(c *gin.Context) {
	user := middleware.GetUser(c)
	var body struct {
		Realm                 string  `json:"realm" binding:"required"`
		ItemID                int     `json:"item_id" binding:"required"`
		RequestedDurationDays *int    `json:"requested_duration_days"`
		ComponentItemIDs      []int   `json:"component_item_ids"`
		Notes                 *string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	if !ensureCheckoutRealm(c, body.Realm) {
		return
	}

	itemsTable := body.Realm + "_items"
	checkoutsTable := body.Realm + "_checkouts"

	// Get item to check quantity
	var quantity int
	err := database.DB.Get(&quantity, fmt.Sprintf("SELECT COALESCE(quantity, 1) FROM %s WHERE id = ?", itemsTable), body.ItemID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
		return
	}

	// Count active checkouts
	var activeCount int
	database.DB.Get(&activeCount, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE item_id = ? AND status = 'active'", checkoutsTable), body.ItemID)

	selectedComponentIDs, err := resolveCheckoutComponentIDs(body.Realm, body.ItemID, body.ComponentItemIDs)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	if err := ensureCheckoutTargetsAvailable(checkoutsTable, itemsTable, body.ItemID, selectedComponentIDs); err != nil {
		c.JSON(http.StatusConflict, gin.H{"detail": err.Error()})
		return
	}

	// Count pending requests
	var pendingCount int
	database.DB.Get(&pendingCount,
		"SELECT COUNT(*) FROM checkout_requests WHERE realm = ? AND item_id = ? AND status = 'pending'",
		body.Realm, body.ItemID)

	// Block if all copies are checked out or requested
	if (activeCount + pendingCount) >= quantity {
		c.JSON(http.StatusConflict, gin.H{
			"detail": fmt.Sprintf("Alle %d Exemplare sind bereits ausgeliehen oder angefragt", quantity),
		})
		return
	}

	componentIDsJSON, _ := json.Marshal(selectedComponentIDs)

	now := database.TimestampNow()
	result, err := database.DB.Exec(
		`INSERT INTO checkout_requests (realm, item_id, user_id, status, requested_duration_days, component_item_ids, notes, created_at, updated_at)
		VALUES (?,?,?,?,?,?,?,?,?)`,
		body.Realm, body.ItemID, user.ID, "pending", body.RequestedDurationDays, string(componentIDsJSON), body.Notes, now, now,
	)
	if err != nil {
		log.Printf("DB insert error in createCheckoutRequest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	newID, _ := result.LastInsertId()
	ws.M.SendToAdmins("admin.checkout_requested", map[string]interface{}{"request_id": newID})

	row, err := loadCheckoutRequestRow("SELECT * FROM checkout_requests WHERE id = ?", newID)
	if err != nil {
		log.Printf("DB read error in createCheckoutRequest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	c.JSON(http.StatusCreated, row)
}

func listCheckoutRequests(c *gin.Context) {
	user := middleware.GetUser(c)
	statusFilter := c.Query("status")

	var query string
	var args []interface{}

	if user.IsAdmin {
		query = `SELECT cr.* FROM checkout_requests cr`
		if statusFilter != "" {
			query += ` WHERE cr.status = ?`
			args = append(args, statusFilter)
		}
		query += ` ORDER BY cr.created_at DESC`
	} else {
		query = `SELECT cr.* FROM checkout_requests cr WHERE cr.user_id = ?`
		args = append(args, user.ID)
		if statusFilter != "" {
			query += ` AND cr.status = ?`
			args = append(args, statusFilter)
		}
		query += ` ORDER BY cr.created_at DESC`
	}

	rows, err := database.DB.Queryx(query, args...)
	if err != nil {
		log.Printf("DB query error in listCheckoutRequests: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		row := map[string]interface{}{}
		if rows.MapScan(row) == nil {
			cleanRow(row)
			enrichCheckoutRequestComponents(row)
			enrichCheckoutRequest(row)
			result = append(result, row)
		}
	}
	if result == nil {
		result = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, result)
}

// enrichCheckoutRequest resolves user_name, item_name and approved_by_name for a checkout request row.
func enrichCheckoutRequest(row map[string]interface{}) {
	// Resolve user name
	if userID, ok := row["user_id"]; ok && userID != nil {
		var displayName, email *string
		sqlRow := database.DB.QueryRowx("SELECT display_name, email FROM users WHERE id = ?", userID)
		if sqlRow.Err() == nil {
			var dn, em *string
			if sqlRow.Scan(&dn, &em) == nil {
				displayName = dn
				email = em
			}
		}
		if displayName != nil && *displayName != "" {
			row["user_name"] = *displayName
		} else if email != nil {
			row["user_name"] = *email
		} else {
			row["user_name"] = nil
		}
	}

	// Resolve item name
	if realm, ok := row["realm"]; ok && realm != nil {
		realmStr := ""
		switch v := realm.(type) {
		case string:
			realmStr = v
		case []byte:
			realmStr = string(v)
		}
		if itemID, ok := row["item_id"]; ok && itemID != nil && (realmStr == "archive" || realmStr == "collection") {
			itemsTable := realmStr + "_items"
			var itemMeta struct {
				Name     *string `db:"name"`
				IsBundle bool    `db:"is_bundle"`
			}
			if database.DB.Get(&itemMeta, fmt.Sprintf("SELECT name, is_bundle FROM %s WHERE id = ?", itemsTable), itemID) == nil {
				row["is_bundle"] = itemMeta.IsBundle
				if itemMeta.Name != nil {
					row["item_name"] = *itemMeta.Name
				} else {
					row["item_name"] = nil
				}
			} else {
				row["is_bundle"] = false
				row["item_name"] = nil
			}
		}
	}

	// Resolve approver name
	if approvedBy, ok := row["approved_by"]; ok && approvedBy != nil {
		var displayName, email *string
		sqlRow := database.DB.QueryRowx("SELECT display_name, email FROM users WHERE id = ?", approvedBy)
		if sqlRow.Err() == nil {
			var dn, em *string
			if sqlRow.Scan(&dn, &em) == nil {
				displayName = dn
				email = em
			}
		}
		if displayName != nil && *displayName != "" {
			row["approved_by_name"] = *displayName
		} else if email != nil {
			row["approved_by_name"] = *email
		} else {
			row["approved_by_name"] = nil
		}
	}

	// Attach the concrete checkout row for approved/completed requests so the UI
	// can show the real loan window, overdue state, and return timestamp.
	statusVal, _ := row["status"].(string)
	if statusVal == "" {
		if b, ok := row["status"].([]byte); ok {
			statusVal = string(b)
		}
	}
	if statusVal != "approved" && statusVal != "completed" {
		return
	}

	realmStr := ""
	switch v := row["realm"].(type) {
	case string:
		realmStr = v
	case []byte:
		realmStr = string(v)
	}
	if realmStr != "archive" && realmStr != "collection" {
		return
	}

	itemID, hasItemID := row["item_id"]
	userID, hasUserID := row["user_id"]
	if !hasItemID || itemID == nil || !hasUserID || userID == nil {
		return
	}

	checkoutsTable := realmStr + "_checkouts"
	checkoutStatus := "active"
	orderBy := "created_at DESC"
	if statusVal == "completed" {
		checkoutStatus = "returned"
		orderBy = "returned_at DESC, updated_at DESC"
	}

	checkoutRow, err := loadCheckoutRow(
		fmt.Sprintf(
			`SELECT *
			FROM %s
			WHERE item_id = ? AND user_id = ? AND status = ?
			ORDER BY %s
			LIMIT 1`, checkoutsTable,
			orderBy,
		),
		realmStr,
		itemID,
		userID,
		checkoutStatus,
	)
	if err != nil || checkoutRow == nil {
		return
	}

	if dueDate, ok := checkoutRow["due_date"]; ok && dueDate != nil {
		row["due_date"] = dueDate
	}
	if checkoutCreatedAt, ok := checkoutRow["created_at"]; ok && checkoutCreatedAt != nil {
		row["checkout_created_at"] = checkoutCreatedAt
	}
	if returnedAt, ok := checkoutRow["returned_at"]; ok && returnedAt != nil {
		row["returned_at"] = returnedAt
	}
	if durationDays, ok := checkoutRow["duration_days"]; ok && durationDays != nil {
		row["duration_days"] = durationDays
	}
	if isOverdue, ok := checkoutRow["is_overdue"]; ok && isOverdue != nil {
		row["is_overdue"] = isOverdue
	}
	if wasOverdue, ok := checkoutRow["was_overdue"]; ok && wasOverdue != nil {
		row["was_overdue"] = wasOverdue
	}
	if overdueDays, ok := checkoutRow["overdue_days"]; ok && overdueDays != nil {
		row["overdue_days"] = overdueDays
	}
}

func approveCheckoutRequest(c *gin.Context) {
	id := c.Param("id")
	user := middleware.GetUser(c)
	now := database.TimestampNow()

	// Get request
	row := map[string]interface{}{}
	sqlRow := database.DB.QueryRowx("SELECT * FROM checkout_requests WHERE id = ? AND status = 'pending'", id)
	if err := sqlRow.MapScan(row); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Request not found or already processed"})
		return
	}
	cleanRow(row)

	// Create checkout
	realm, _ := row["realm"].(string)
	table := realm + "_checkouts"
	itemsTable := realm + "_items"
	itemID := row["item_id"]
	requestUserID := row["user_id"]

	selectedComponentIDs := parseComponentIDsJSON(row["component_item_ids"])
	if err := ensureCheckoutTargetsAvailable(table, itemsTable, asInt(itemID), selectedComponentIDs); err != nil {
		c.JSON(http.StatusConflict, gin.H{"detail": err.Error()})
		return
	}

	// Update request
	result, err := database.DB.Exec(
		"UPDATE checkout_requests SET status = 'approved', approved_by = ?, updated_at = ? WHERE id = ?",
		user.ID, now, id,
	)
	if err != nil {
		log.Printf("DB update error in approveCheckoutRequest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Request not found or already processed"})
		return
	}

	var dueDate *string
	if days, ok := row["requested_duration_days"]; ok && days != nil {
		switch d := days.(type) {
		case float64:
			if d > 0 {
				due := database.TimestampAt(time.Now().UTC().AddDate(0, 0, int(d)))
				dueDate = &due
			}
		case int64:
			if d > 0 {
				due := database.TimestampAt(time.Now().UTC().AddDate(0, 0, int(d)))
				dueDate = &due
			}
		}
	}

	tx, err := database.DB.Beginx()
	if err != nil {
		log.Printf("DB begin error in approveCheckoutRequest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec(
		fmt.Sprintf("INSERT INTO %s (item_id, bundle_parent_item_id, user_id, status, due_date, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)", table),
		itemID, nil, requestUserID, "active", dueDate, row["notes"], now, now,
	); err != nil {
		log.Printf("DB insert error in approveCheckoutRequest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	for _, componentID := range selectedComponentIDs {
		if _, err := tx.Exec(
			fmt.Sprintf("INSERT INTO %s (item_id, bundle_parent_item_id, user_id, status, due_date, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)", table),
			componentID, asInt(itemID), requestUserID, "active", dueDate, row["notes"], now, now,
		); err != nil {
			log.Printf("DB insert child checkout error in approveCheckoutRequest: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
	}
	if err := tx.Commit(); err != nil {
		log.Printf("DB commit error in approveCheckoutRequest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	audit(user.ID, "checkout.approve", "request="+id)
	ws.M.SendToUser(asInt(row["user_id"]), "checkout.approved", map[string]interface{}{"request_id": asInt(row["id"])})
	ws.M.Broadcast("stats."+realm+"_updated", nil)

	updatedRow, err := loadCheckoutRequestRow("SELECT * FROM checkout_requests WHERE id = ?", id)
	if err != nil {
		log.Printf("DB read error in approveCheckoutRequest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	c.JSON(http.StatusOK, updatedRow)
}

func rejectCheckoutRequest(c *gin.Context) {
	id := c.Param("id")
	user := middleware.GetUser(c)
	now := database.TimestampNow()

	result, err := database.DB.Exec(
		"UPDATE checkout_requests SET status = 'rejected', approved_by = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
		user.ID, now, id,
	)
	if err != nil {
		log.Printf("DB update error in rejectCheckoutRequest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Request not found or already processed"})
		return
	}
	audit(user.ID, "checkout.reject", "request="+id)
	row, err := loadCheckoutRequestRow("SELECT * FROM checkout_requests WHERE id = ?", id)
	if err != nil {
		log.Printf("DB read error in rejectCheckoutRequest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	ws.M.SendToUser(asInt(row["user_id"]), "checkout.rejected", map[string]interface{}{"request_id": asInt(row["id"])})
	c.JSON(http.StatusOK, row)
}

func asInt(v interface{}) int {
	switch n := v.(type) {
	case int:
		return n
	case int64:
		return int(n)
	case float64:
		return int(n)
	default:
		return 0
	}
}

func asInt64(v interface{}) int64 {
	switch n := v.(type) {
	case int:
		return int64(n)
	case int64:
		return n
	case float64:
		return int64(n)
	default:
		return 0
	}
}

func normalizeNullableDBValue(v interface{}) interface{} {
	if v == nil {
		return nil
	}
	switch value := v.(type) {
	case string:
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return nil
		}
		return trimmed
	case []byte:
		trimmed := strings.TrimSpace(string(value))
		if trimmed == "" {
			return nil
		}
		return trimmed
	default:
		return v
	}
}
