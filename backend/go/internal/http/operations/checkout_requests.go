package operations

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	itemscore "github.com/itemplus/backend/internal/core/items"
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

	// Read everything first: the enrichment below runs further queries, and
	// SQLite's single connection is busy until this result set is closed.
	var result []map[string]interface{}
	for rows.Next() {
		row := map[string]interface{}{}
		if rows.MapScan(row) == nil {
			middleware.CleanRow(row)
			result = append(result, row)
		}
	}
	if err := rows.Close(); err != nil {
		log.Printf("DB rows close error in listCheckoutRequests: %v", err)
	}
	for _, row := range result {
		enrichCheckoutRequestComponents(row)
		enrichCheckoutRequest(row)
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

	var dueDate *string
	if days, ok := row["requested_duration_days"]; ok && days != nil {
		if d := middleware.AsInt(days); d > 0 {
			due := database.TimestampAt(time.Now().UTC().AddDate(0, 0, d))
			dueDate = &due
		}
	}

	// Read before the transaction starts; see checkoutMovementQuantities.
	checkoutAffectsQuantity := inventoryCheckoutAffectsMovementQuantity()

	// Approval, checkouts and stock movements succeed or fail together.
	tx, err := database.DB.Beginx()
	if err != nil {
		log.Printf("DB begin error in approveCheckoutRequest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	defer tx.Rollback()

	// The status condition lets only one of two simultaneous approvals through.
	result, err := tx.Exec(
		"UPDATE checkout_requests SET status = 'approved', approved_by = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
		user.ID, now, id,
	)
	if err != nil {
		log.Printf("DB update error in approveCheckoutRequest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Request not found or already processed"})
		return
	}

	// Like a direct checkout: one checkout row and one "checked_out" stock
	// movement for the item itself and for every bundle component.
	rootItemID := middleware.AsInt(itemID)
	targets := append([]int{rootItemID}, selectedComponentIDs...)
	for index, targetID := range targets {
		var bundleParent interface{}
		if index > 0 {
			bundleParent = rootItemID
		}
		quantity, err := itemscore.LoadItemQuantityTx(tx, realm, targetID)
		if err != nil {
			log.Printf("DB load quantity error in approveCheckoutRequest: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		inserted, err := tx.Exec(
			fmt.Sprintf("INSERT INTO %s (item_id, bundle_parent_item_id, user_id, status, due_date, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)", table),
			targetID, bundleParent, requestUserID, "active", dueDate, row["notes"], now, now,
		)
		if err != nil {
			log.Printf("DB insert error in approveCheckoutRequest: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		checkoutID, _ := inserted.LastInsertId()
		beforeQty, afterQty := movementQuantities(checkoutAffectsQuantity, quantity, "checked_out")
		if err := itemscore.RecordInventoryMovementTx(tx, realm, targetID, "checked_out", beforeQty, afterQty, checkoutID, "checkout", row["notes"], user.ID, now); err != nil {
			log.Printf("DB inventory movement insert error in approveCheckoutRequest: %v", err)
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
