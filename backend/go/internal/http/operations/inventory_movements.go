package operations

import (
	"fmt"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	checkoutcore "github.com/itemplus/backend/internal/core/checkouts"
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
		fmt.Sprintf(`SELECT m.*, COALESCE(u.display_name, u.email) AS created_by_name,
				COALESCE(cu.display_name, cu.email) AS checkout_user_name
			FROM %s m
			LEFT JOIN users u ON m.created_by = u.id
			LEFT JOIN %s co ON m.checkout_id = co.id
			LEFT JOIN users cu ON co.user_id = cu.id
			WHERE m.item_id = ?
			ORDER BY m.created_at DESC, m.id DESC
			LIMIT ?`, inventoryMovementTable(realm), realm+"_checkouts"),
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

// listInventoryMovements lists stock movements, newest first. Besides the
// page of movements it says how many match in total and how many of each
// type there are, so the page can offer its filters with honest counts
// without fetching every row.
//
// Filters: realm, item_id, type, q (part of the item name), days (only the
// last n days), and limit/offset for paging. The counts per type ignore the
// type filter: they describe what the other filters leave to choose from.
func listInventoryMovements(c *gin.Context) {
	realmFilter := strings.TrimSpace(c.Query("realm"))
	itemID := strings.TrimSpace(c.Query("item_id"))
	movementType := strings.TrimSpace(c.Query("type"))
	search := strings.ToLower(strings.TrimSpace(c.Query("q")))
	days, _ := strconv.Atoi(c.Query("days"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", strconv.Itoa(defaultInventoryMovementLimit)))
	if limit <= 0 {
		limit = defaultInventoryMovementLimit
	}
	if limit > 500 {
		limit = 500
	}
	offset, _ := strconv.Atoi(c.Query("offset"))
	if offset < 0 {
		offset = 0
	}

	realms := []string{"archive", "collection"}
	if realmFilter == "archive" || realmFilter == "collection" {
		realms = []string{realmFilter}
	}

	result := make([]map[string]interface{}, 0)
	counts := map[string]int{}
	for _, realm := range realms {
		conditions := []string{"1=1"}
		args := []interface{}{}
		if itemID != "" {
			conditions = append(conditions, "m.item_id = ?")
			args = append(args, itemID)
		}
		if search != "" {
			conditions = append(conditions, "LOWER(i.name) LIKE ?")
			args = append(args, "%"+search+"%")
		}
		if days > 0 {
			conditions = append(conditions, "m.created_at >= ?")
			args = append(args, database.TimestampAt(time.Now().AddDate(0, 0, -days)))
		}
		from := fmt.Sprintf("%s m JOIN %s_items i ON m.item_id = i.id", inventoryMovementTable(realm), realm)

		typeCounts := []struct {
			Type  string `db:"movement_type"`
			Count int    `db:"n"`
		}{}
		if err := database.DB.Select(&typeCounts,
			fmt.Sprintf("SELECT m.movement_type, COUNT(*) AS n FROM %s WHERE %s GROUP BY m.movement_type", from, strings.Join(conditions, " AND ")),
			args...,
		); err != nil {
			log.Printf("DB inventory movement count error %s: %v", realm, err)
			continue
		}
		for _, entry := range typeCounts {
			counts[entry.Type] += entry.Count
		}

		if movementType != "" {
			conditions = append(conditions, "m.movement_type = ?")
			args = append(args, movementType)
		}
		// Each realm gives its newest rows up to the end of the wanted page;
		// the page is cut out after both are merged.
		args = append(args, offset+limit)
		query := fmt.Sprintf(`SELECT m.*, i.name AS item_name,
				c.name AS category_name, c.color AS category_color,
				l.name AS location_name, l.color AS location_color,
				COALESCE(u.display_name, u.email) AS created_by_name,
				COALESCE(cu.display_name, cu.email) AS checkout_user_name
			FROM %s
			LEFT JOIN %s_categories c ON i.category_id = c.id
			LEFT JOIN %s_locations l ON i.location_id = l.id
			LEFT JOIN users u ON m.created_by = u.id
			LEFT JOIN %s_checkouts co ON m.checkout_id = co.id
			LEFT JOIN users cu ON co.user_id = cu.id
			WHERE %s
			ORDER BY m.created_at DESC, m.id DESC
			LIMIT ?`, from, realm, realm, realm, strings.Join(conditions, " AND "))
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
	if offset > len(result) {
		offset = len(result)
	}
	result = result[offset:]
	if len(result) > limit {
		result = result[:limit]
	}

	total := 0
	for movement, count := range counts {
		if movementType == "" || movement == movementType {
			total += count
		}
	}
	c.JSON(http.StatusOK, gin.H{"movements": result, "total": total, "counts": counts})
}

// sortRowsByCreatedDesc puts the newest row first. The time arrives as a
// time value from SQLite and as text from MySQL, so it is parsed either way;
// comparing it as text alone left SQLite rows sorted by id only.
func sortRowsByCreatedDesc(rows []map[string]interface{}) {
	sort.SliceStable(rows, func(i, j int) bool {
		left := checkoutcore.ParseCheckoutTime(rows[i]["created_at"])
		right := checkoutcore.ParseCheckoutTime(rows[j]["created_at"])
		if left.Equal(right) {
			return middleware.AsInt(rows[i]["id"]) > middleware.AsInt(rows[j]["id"])
		}
		return left.After(right)
	})
}
