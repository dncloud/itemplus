package operations

import (
	"fmt"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
	"github.com/jmoiron/sqlx"
)

const defaultInventoryMovementLimit = 100

func RegisterInventoryMovementRoutes(api *gin.RouterGroup) {
	api.GET("/inventory-movements", middleware.Auth(), middleware.RequirePermission("inventory.read"), listInventoryMovements)
}

func inventoryMovementTable(realm string) string {
	return realm + "_inventory_movements"
}

func recordInventoryMovementTx(tx *sqlx.Tx, realm string, itemID interface{}, movementType string, beforeQty, afterQty int, checkoutID interface{}, source string, notes interface{}, userID interface{}, createdAt string) error {
	if movementType == "" {
		movementType = "adjusted"
	}
	if source == "" {
		source = "manual"
	}
	_, err := tx.Exec(
		fmt.Sprintf(`INSERT INTO %s
			(item_id, movement_type, quantity_delta, quantity_before, quantity_after, checkout_id, source, notes, created_by, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, inventoryMovementTable(realm)),
		itemID, movementType, afterQty-beforeQty, beforeQty, afterQty, checkoutID, source, notes, userID, createdAt,
	)
	return err
}

func recordInventoryMovement(realm string, itemID interface{}, movementType string, beforeQty, afterQty int, checkoutID interface{}, source string, notes interface{}, userID interface{}, createdAt string) error {
	if movementType == "" {
		movementType = "adjusted"
	}
	if source == "" {
		source = "manual"
	}
	_, err := database.DB.Exec(
		fmt.Sprintf(`INSERT INTO %s
			(item_id, movement_type, quantity_delta, quantity_before, quantity_after, checkout_id, source, notes, created_by, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, inventoryMovementTable(realm)),
		itemID, movementType, afterQty-beforeQty, beforeQty, afterQty, checkoutID, source, notes, userID, createdAt,
	)
	return err
}

func loadItemQuantityTx(tx *sqlx.Tx, realm string, itemID interface{}) (int, error) {
	var quantity int
	err := tx.Get(&quantity, fmt.Sprintf("SELECT COALESCE(quantity, 0) FROM %s_items WHERE id = ?", realm), itemID)
	return quantity, err
}

func loadItemInventoryMovements(realm, itemID string, limit int) []map[string]interface{} {
	if limit <= 0 {
		limit = 10
	}
	rows, err := database.DB.Queryx(
		fmt.Sprintf(`SELECT m.*, COALESCE(u.display_name, u.email) AS created_by_name
			FROM %s m
			LEFT JOIN users u ON m.created_by = u.id
			WHERE m.item_id = ?
			ORDER BY m.created_at DESC, m.id DESC
			LIMIT ?`, inventoryMovementTable(realm)),
		itemID, limit,
	)
	if err != nil {
		return []map[string]interface{}{}
	}
	defer rows.Close()
	result := make([]map[string]interface{}, 0)
	for rows.Next() {
		row := map[string]interface{}{}
		if rows.MapScan(row) == nil {
			middleware.CleanRow(row)
			row["realm"] = realm
			result = append(result, row)
		}
	}
	return result
}

func movementTypeForQuantityChange(beforeQty, afterQty int) string {
	switch {
	case afterQty > beforeQty:
		return "bought"
	case afterQty < beforeQty:
		return "consumed"
	default:
		return "adjusted"
	}
}

func listInventoryMovements(c *gin.Context) {
	realmFilter := strings.TrimSpace(c.Query("realm"))
	itemID := strings.TrimSpace(c.Query("item_id"))
	movementType := strings.TrimSpace(c.Query("type"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", strconv.Itoa(defaultInventoryMovementLimit)))
	if limit <= 0 || limit > 500 {
		limit = defaultInventoryMovementLimit
	}

	realms := []string{"archive", "collection"}
	if realmFilter == "archive" || realmFilter == "collection" {
		realms = []string{realmFilter}
	}

	result := make([]map[string]interface{}, 0)
	for _, realm := range realms {
		conditions := []string{"1=1"}
		args := []interface{}{}
		if itemID != "" {
			conditions = append(conditions, "m.item_id = ?")
			args = append(args, itemID)
		}
		if movementType != "" {
			conditions = append(conditions, "m.movement_type = ?")
			args = append(args, movementType)
		}
		args = append(args, limit)
		query := fmt.Sprintf(`SELECT m.*, i.name AS item_name,
				c.name AS category_name, c.color AS category_color,
				l.name AS location_name, l.color AS location_color,
				COALESCE(u.display_name, u.email) AS created_by_name
			FROM %s m
			JOIN %s_items i ON m.item_id = i.id
			LEFT JOIN %s_categories c ON i.category_id = c.id
			LEFT JOIN %s_locations l ON i.location_id = l.id
			LEFT JOIN users u ON m.created_by = u.id
			WHERE %s
			ORDER BY m.created_at DESC, m.id DESC
			LIMIT ?`, inventoryMovementTable(realm), realm, realm, realm, strings.Join(conditions, " AND "))
		rows, err := database.DB.Queryx(query, args...)
		if err != nil {
			log.Printf("DB inventory movements query error %s: %v", realm, err)
			continue
		}
		for rows.Next() {
			row := map[string]interface{}{}
			if rows.MapScan(row) == nil {
				middleware.CleanRow(row)
				row["realm"] = realm
				result = append(result, row)
			}
		}
		_ = rows.Close()
	}

	sortRowsByCreatedDesc(result)
	if len(result) > limit {
		result = result[:limit]
	}
	c.JSON(http.StatusOK, gin.H{"movements": result})
}

func sortRowsByCreatedDesc(rows []map[string]interface{}) {
	sort.Slice(rows, func(i, j int) bool {
		left := valueString(rows[i]["created_at"])
		right := valueString(rows[j]["created_at"])
		if left == right {
			return middleware.AsInt(rows[i]["id"]) > middleware.AsInt(rows[j]["id"])
		}
		return left > right
	})
}
