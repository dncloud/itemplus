package handlers

import (
	"fmt"
	"log"
	"math"
	"net/http"
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
	now := time.Now().UTC()

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
				isOverdue := now.After(due)
				row["is_overdue"] = isOverdue
				overdueDays := now.Sub(due).Seconds() / 86400
				if overdueDays < 0 {
					overdueDays = 0
				}
				row["overdue_days"] = math.Round(overdueDays*10) / 10
			} else if hasReturned {
				wasOverdue := returned.After(due)
				row["was_overdue"] = wasOverdue
				overdueDays := returned.Sub(due).Seconds() / 86400
				if overdueDays < 0 {
					overdueDays = 0
				}
				row["overdue_days"] = math.Round(overdueDays*10) / 10
			}
		}
	}
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

func checkoutItem(c *gin.Context) {
	realm := c.Param("realm")
	itemID := c.Param("item_id")
	table := realm + "_checkouts"
	itemsTable := realm + "_items"

	if realm != "archive" && realm != "collection" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid realm"})
		return
	}

	var body struct {
		UserID  *int    `json:"user_id"`
		DueDate *string `json:"due_date"`
		Notes   *string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	// Check if already checked out
	var count int
	database.DB.Get(&count, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE item_id = ? AND status = 'active'", table), itemID)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"detail": "Item is already checked out"})
		return
	}

	user := middleware.GetUser(c)
	checkoutUserID := user.ID
	if body.UserID != nil {
		checkoutUserID = *body.UserID
	}

	now := time.Now().UTC().Format(time.RFC3339)
	result, err := database.DB.Exec(
		fmt.Sprintf("INSERT INTO %s (item_id, user_id, status, due_date, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?)", table),
		itemID, checkoutUserID, "active", body.DueDate, body.Notes, now, now,
	)
	if err != nil {
		log.Printf("DB insert error in checkoutItem: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	newID, _ := result.LastInsertId()
	audit(user.ID, "checkout.create", fmt.Sprintf("realm=%s item=%s", realm, itemID))

	row := map[string]interface{}{}
	sqlRow := database.DB.QueryRowx(fmt.Sprintf(
		`SELECT co.*, i.name AS item_name, COALESCE(u.display_name, u.email) AS user_name
		FROM %s co
		LEFT JOIN %s i ON co.item_id = i.id
		LEFT JOIN users u ON co.user_id = u.id
		WHERE co.id = ?`, table, itemsTable), newID)
	if err := sqlRow.MapScan(row); err != nil {
		log.Printf("DB read error in checkoutItem: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	cleanRow(row)
	enrichCheckout(row, realm)
	c.JSON(http.StatusCreated, row)
}

func checkinItem(c *gin.Context) {
	realm := c.Param("realm")
	itemID := c.Param("item_id")
	table := realm + "_checkouts"

	if realm != "archive" && realm != "collection" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid realm"})
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	result, err := database.DB.Exec(
		fmt.Sprintf("UPDATE %s SET status = 'returned', returned_at = ?, updated_at = ? WHERE item_id = ? AND status = 'active'", table),
		now, now, itemID,
	)
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
	c.JSON(http.StatusOK, gin.H{"status": "returned", "item_id": itemID})
}

func updateCheckout(c *gin.Context) {
	realm := c.Param("realm")
	id := c.Param("id")
	table := realm + "_checkouts"

	if realm != "archive" && realm != "collection" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid realm"})
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
	body["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	sets, vals := buildUpdate(body)
	vals = append(vals, id)
	_, err := database.DB.Exec(fmt.Sprintf("UPDATE %s SET %s WHERE id = ?", table, sets), vals...)
	if err != nil {
		log.Printf("DB update error in updateCheckout: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	row := map[string]interface{}{}
	sqlRow := database.DB.QueryRowx(fmt.Sprintf("SELECT * FROM %s WHERE id = ?", table), id)
	_ = sqlRow.MapScan(row)
	cleanRow(row)
	enrichCheckout(row, realm)
	c.JSON(http.StatusOK, row)
}

func listActiveCheckouts(c *gin.Context) {
	realm := c.Param("realm")
	table := realm + "_checkouts"
	itemsTable := realm + "_items"

	if realm != "archive" && realm != "collection" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid realm"})
		return
	}

	query := fmt.Sprintf(
		`SELECT co.*, i.name AS item_name, COALESCE(u.display_name, u.email) AS user_name
		FROM %s co
		LEFT JOIN %s i ON co.item_id = i.id
		LEFT JOIN users u ON co.user_id = u.id
		WHERE co.status = 'active'
		ORDER BY co.created_at DESC`, table, itemsTable)

	rows, err := database.DB.Queryx(query)
	if err != nil {
		log.Printf("DB query error in listActiveCheckouts: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
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
	c.JSON(http.StatusOK, result)
}

func listCheckoutHistory(c *gin.Context) {
	realm := c.Param("realm")
	table := realm + "_checkouts"
	itemsTable := realm + "_items"

	if realm != "archive" && realm != "collection" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid realm"})
		return
	}

	query := fmt.Sprintf(
		`SELECT co.*, i.name AS item_name, COALESCE(u.display_name, u.email) AS user_name
		FROM %s co
		LEFT JOIN %s i ON co.item_id = i.id
		LEFT JOIN users u ON co.user_id = u.id
		WHERE co.status = 'returned'
		ORDER BY co.updated_at DESC
		LIMIT 50`, table, itemsTable)

	rows, err := database.DB.Queryx(query)
	if err != nil {
		log.Printf("DB query error in listCheckoutHistory: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
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
	c.JSON(http.StatusOK, result)
}

func listMyOverdueCheckouts(c *gin.Context) {
	user := middleware.GetUser(c)
	now := time.Now().UTC().Format(time.RFC3339)

	var allOverdue []map[string]interface{}
	for _, realm := range []string{"archive", "collection"} {
		table := realm + "_checkouts"
		itemsTable := realm + "_items"

		query := fmt.Sprintf(
			`SELECT co.*, i.name AS item_name, '%s' AS realm
			FROM %s co
			LEFT JOIN %s i ON co.item_id = i.id
			WHERE co.user_id = ? AND co.status = 'active' AND co.due_date IS NOT NULL AND co.due_date < ?
			ORDER BY co.due_date`, realm, table, itemsTable)

		rows, err := database.DB.Queryx(query, user.ID, now)
		if err != nil {
			continue
		}

		for rows.Next() {
			row := map[string]interface{}{}
			if rows.MapScan(row) == nil {
				cleanRow(row)
				enrichCheckout(row, realm)
				allOverdue = append(allOverdue, row)
			}
		}
		rows.Close()
	}

	if allOverdue == nil {
		allOverdue = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, allOverdue)
}

func createCheckoutRequest(c *gin.Context) {
	user := middleware.GetUser(c)
	var body struct {
		Realm                 string  `json:"realm" binding:"required"`
		ItemID                int     `json:"item_id" binding:"required"`
		RequestedDurationDays *int    `json:"requested_duration_days"`
		Notes                 *string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	if body.Realm != "archive" && body.Realm != "collection" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid realm"})
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

	now := time.Now().UTC().Format(time.RFC3339)
	result, err := database.DB.Exec(
		`INSERT INTO checkout_requests (realm, item_id, user_id, status, requested_duration_days, notes, created_at, updated_at)
		VALUES (?,?,?,?,?,?,?,?)`,
		body.Realm, body.ItemID, user.ID, "pending", body.RequestedDurationDays, body.Notes, now, now,
	)
	if err != nil {
		log.Printf("DB insert error in createCheckoutRequest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	newID, _ := result.LastInsertId()
	ws.M.SendToAdmins("admin.checkout_requested", map[string]interface{}{"request_id": newID})

	row := map[string]interface{}{}
	sqlRow := database.DB.QueryRowx("SELECT * FROM checkout_requests WHERE id = ?", newID)
	if err := sqlRow.MapScan(row); err != nil {
		log.Printf("DB read error in createCheckoutRequest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	cleanRow(row)
	enrichCheckoutRequest(row)
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
			var name *string
			if database.DB.Get(&name, fmt.Sprintf("SELECT name FROM %s WHERE id = ?", itemsTable), itemID) == nil && name != nil {
				row["item_name"] = *name
			} else {
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
}

func approveCheckoutRequest(c *gin.Context) {
	id := c.Param("id")
	user := middleware.GetUser(c)
	now := time.Now().UTC().Format(time.RFC3339)

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
	itemID := row["item_id"]
	requestUserID := row["user_id"]

	var activeCount int
	if err := database.DB.Get(&activeCount, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE item_id = ? AND status = 'active'", table), itemID); err == nil && activeCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"detail": "Item ist bereits ausgeliehen"})
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
				due := time.Now().UTC().AddDate(0, 0, int(d)).Format(time.RFC3339)
				dueDate = &due
			}
		case int64:
			if d > 0 {
				due := time.Now().UTC().AddDate(0, 0, int(d)).Format(time.RFC3339)
				dueDate = &due
			}
		}
	}

	database.DB.Exec(
		fmt.Sprintf("INSERT INTO %s (item_id, user_id, status, due_date, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?)", table),
		itemID, requestUserID, "active", dueDate, row["notes"], now, now,
	)

	audit(user.ID, "checkout.approve", "request="+id)
	ws.M.SendToUser(asInt(row["user_id"]), "checkout.approved", map[string]interface{}{"request_id": asInt(row["id"])})
	ws.M.Broadcast("stats."+realm+"_updated", nil)

	updatedRow := map[string]interface{}{}
	sqlRow = database.DB.QueryRowx("SELECT * FROM checkout_requests WHERE id = ?", id)
	if err := sqlRow.MapScan(updatedRow); err != nil {
		log.Printf("DB read error in approveCheckoutRequest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	cleanRow(updatedRow)
	enrichCheckoutRequest(updatedRow)
	c.JSON(http.StatusOK, updatedRow)
}

func rejectCheckoutRequest(c *gin.Context) {
	id := c.Param("id")
	user := middleware.GetUser(c)
	now := time.Now().UTC().Format(time.RFC3339)

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
	row := map[string]interface{}{}
	sqlRow := database.DB.QueryRowx("SELECT * FROM checkout_requests WHERE id = ?", id)
	if err := sqlRow.MapScan(row); err != nil {
		log.Printf("DB read error in rejectCheckoutRequest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	cleanRow(row)
	enrichCheckoutRequest(row)
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
