package operations

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
	ws "github.com/itemplus/backend/internal/websocket"
)

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

	var quantity int
	err := database.DB.Get(&quantity, fmt.Sprintf("SELECT COALESCE(quantity, 1) FROM %s WHERE id = ?", itemsTable), body.ItemID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
		return
	}

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

	var pendingCount int
	database.DB.Get(&pendingCount,
		"SELECT COUNT(*) FROM checkout_requests WHERE realm = ? AND item_id = ? AND status = 'pending'",
		body.Realm, body.ItemID)

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
			middleware.CleanRow(row)
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

func approveCheckoutRequest(c *gin.Context) {
	id := c.Param("id")
	user := middleware.GetUser(c)
	now := database.TimestampNow()

	row := map[string]interface{}{}
	sqlRow := database.DB.QueryRowx("SELECT * FROM checkout_requests WHERE id = ? AND status = 'pending'", id)
	if err := sqlRow.MapScan(row); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Request not found or already processed"})
		return
	}
	middleware.CleanRow(row)

	realm, _ := row["realm"].(string)
	table := realm + "_checkouts"
	itemsTable := realm + "_items"
	itemID := row["item_id"]
	requestUserID := row["user_id"]

	selectedComponentIDs := parseComponentIDsJSON(row["component_item_ids"])
	if err := ensureCheckoutTargetsAvailable(table, itemsTable, middleware.AsInt(itemID), selectedComponentIDs); err != nil {
		c.JSON(http.StatusConflict, gin.H{"detail": err.Error()})
		return
	}

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
			componentID, middleware.AsInt(itemID), requestUserID, "active", dueDate, row["notes"], now, now,
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

	middleware.Audit(user.ID, "checkout.approve", "request="+id)
	ws.M.SendToUser(middleware.AsInt(row["user_id"]), "checkout.approved", map[string]interface{}{"request_id": middleware.AsInt(row["id"])})
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
	middleware.Audit(user.ID, "checkout.reject", "request="+id)
	row, err := loadCheckoutRequestRow("SELECT * FROM checkout_requests WHERE id = ?", id)
	if err != nil {
		log.Printf("DB read error in rejectCheckoutRequest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	ws.M.SendToUser(middleware.AsInt(row["user_id"]), "checkout.rejected", map[string]interface{}{"request_id": middleware.AsInt(row["id"])})
	c.JSON(http.StatusOK, row)
}
