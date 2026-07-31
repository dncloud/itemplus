package operations

import (
	"database/sql"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	checkoutcore "github.com/itemplus/backend/internal/core/checkouts"
	itemscore "github.com/itemplus/backend/internal/core/items"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
	ws "github.com/itemplus/backend/internal/websocket"
)

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
	rootQuantity, err := itemscore.LoadItemQuantityTx(tx, realm, itemIDInt)
	if err != nil {
		log.Printf("DB load root quantity error in checkoutItem: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

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
	rootBeforeQty, rootAfterQty := checkoutMovementQuantities(rootQuantity, "checked_out")
	if err := itemscore.RecordInventoryMovementTx(tx, realm, itemIDInt, "checked_out", rootBeforeQty, rootAfterQty, newID, "checkout", body.Notes, user.ID, now); err != nil {
		log.Printf("DB inventory movement insert error in checkoutItem: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	for _, componentID := range selectedComponentIDs {
		componentQuantity, err := itemscore.LoadItemQuantityTx(tx, realm, componentID)
		if err != nil {
			log.Printf("DB load component quantity error in checkoutItem: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		componentResult, err := tx.Exec(
			fmt.Sprintf("INSERT INTO %s (item_id, bundle_parent_item_id, user_id, status, due_date, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)", table),
			componentID, itemIDInt, checkoutUserID, "active", body.DueDate, body.Notes, now, now,
		)
		if err != nil {
			log.Printf("DB insert child checkout error in checkoutItem: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		componentCheckoutID, _ := componentResult.LastInsertId()
		componentBeforeQty, componentAfterQty := checkoutMovementQuantities(componentQuantity, "checked_out")
		if err := itemscore.RecordInventoryMovementTx(tx, realm, componentID, "checked_out", componentBeforeQty, componentAfterQty, componentCheckoutID, "checkout", body.Notes, user.ID, now); err != nil {
			log.Printf("DB inventory child movement insert error in checkoutItem: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
	}
	if err := tx.Commit(); err != nil {
		log.Printf("DB commit error in checkoutItem: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	middleware.Audit(user.ID, "checkout.create", fmt.Sprintf("realm=%s item=%s", realm, itemID))

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
	itemsTable := realm + "_items"

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
	returnedRows := make([]map[string]interface{}, 0)
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
		middleware.CleanRow(rootRow)
		rootItemID := middleware.AsInt64(rootRow["item_id"])
		rootUserID := middleware.AsInt64(rootRow["user_id"])
		rootCreatedAt := checkoutcore.NormalizeNullableDBValue(rootRow["created_at"])
		rootDueDate := checkoutcore.NormalizeNullableDBValue(rootRow["due_date"])
		rootNotes := checkoutcore.NormalizeNullableDBValue(rootRow["notes"])
		rows, err := database.DB.Queryx(
			fmt.Sprintf(`SELECT co.id, co.item_id, co.notes, COALESCE(i.quantity, 0) AS quantity
				FROM %s co
				LEFT JOIN %s i ON co.item_id = i.id
				WHERE co.status = 'active'
				  AND (
				    co.id = ?
				    OR (
				      co.bundle_parent_item_id = ?
				      AND co.user_id = ?
				      AND co.created_at = ?
				      AND (
				        (co.due_date IS NULL AND ? IS NULL)
				        OR co.due_date = ?
				      )
				      AND (
				        (co.notes IS NULL AND ? IS NULL)
				        OR co.notes = ?
				      )
				    )
				  )`, table, itemsTable),
			*body.CheckoutID,
			rootItemID,
			rootUserID,
			rootCreatedAt,
			rootDueDate,
			rootDueDate,
			rootNotes,
			rootNotes,
		)
		if err == nil {
			for rows.Next() {
				row := map[string]interface{}{}
				if rows.MapScan(row) == nil {
					middleware.CleanRow(row)
					returnedRows = append(returnedRows, row)
				}
			}
			_ = rows.Close()
		}

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
		rows, err := database.DB.Queryx(
			fmt.Sprintf(`SELECT co.id, co.item_id, co.notes, COALESCE(i.quantity, 0) AS quantity
				FROM %s co
				LEFT JOIN %s i ON co.item_id = i.id
				WHERE (co.item_id = ? OR co.bundle_parent_item_id = ?) AND co.status = 'active'`, table, itemsTable),
			itemID, itemID,
		)
		if err == nil {
			for rows.Next() {
				row := map[string]interface{}{}
				if rows.MapScan(row) == nil {
					middleware.CleanRow(row)
					returnedRows = append(returnedRows, row)
				}
			}
			_ = rows.Close()
		}
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

	database.DB.Exec(
		`UPDATE checkout_requests SET status = 'completed', updated_at = ?
		WHERE realm = ? AND item_id = ? AND status = 'approved'`,
		now, realm, itemID,
	)

	user := middleware.GetUser(c)
	for _, row := range returnedRows {
		quantity := middleware.AsInt(row["quantity"])
		beforeQty, afterQty := checkoutMovementQuantities(quantity, "returned")
		if err := itemscore.RecordInventoryMovement(realm, row["item_id"], "returned", beforeQty, afterQty, row["id"], "checkout", checkoutcore.NormalizeNullableDBValue(row["notes"]), user.ID, now); err != nil {
			log.Printf("DB inventory movement insert error in checkinItem: %v", err)
		}
	}
	middleware.Audit(user.ID, "checkout.return", fmt.Sprintf("realm=%s item=%s", realm, itemID))
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

	sets, vals, err := database.BuildUpdate(body)
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
