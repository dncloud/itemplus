package items

import (
	"fmt"

	"github.com/itemplus/backend/internal/database"
	"github.com/jmoiron/sqlx"
)

func InventoryMovementTable(realm string) string {
	return realm + "_inventory_movements"
}

func RecordInventoryMovementTx(tx *sqlx.Tx, realm string, itemID interface{}, movementType string, beforeQty, afterQty int, checkoutID interface{}, source string, notes interface{}, userID interface{}, createdAt string) error {
	if movementType == "" {
		movementType = "adjusted"
	}
	if source == "" {
		source = "manual"
	}
	_, err := tx.Exec(
		fmt.Sprintf(`INSERT INTO %s
			(item_id, movement_type, quantity_delta, quantity_before, quantity_after, checkout_id, source, notes, created_by, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, InventoryMovementTable(realm)),
		itemID, movementType, afterQty-beforeQty, beforeQty, afterQty, checkoutID, source, notes, userID, createdAt,
	)
	return err
}

func RecordInventoryMovement(realm string, itemID interface{}, movementType string, beforeQty, afterQty int, checkoutID interface{}, source string, notes interface{}, userID interface{}, createdAt string) error {
	if movementType == "" {
		movementType = "adjusted"
	}
	if source == "" {
		source = "manual"
	}
	_, err := database.DB.Exec(
		fmt.Sprintf(`INSERT INTO %s
			(item_id, movement_type, quantity_delta, quantity_before, quantity_after, checkout_id, source, notes, created_by, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, InventoryMovementTable(realm)),
		itemID, movementType, afterQty-beforeQty, beforeQty, afterQty, checkoutID, source, notes, userID, createdAt,
	)
	return err
}

func LoadItemQuantityTx(tx *sqlx.Tx, realm string, itemID interface{}) (int, error) {
	var quantity int
	err := tx.Get(&quantity, fmt.Sprintf("SELECT COALESCE(quantity, 0) FROM %s_items WHERE id = ?", realm), itemID)
	return quantity, err
}

func LoadItemInventoryMovements(realm, itemID string, limit int) []map[string]interface{} {
	if limit <= 0 {
		limit = 10
	}
	rows, err := database.DB.Queryx(
		fmt.Sprintf(`SELECT m.*, COALESCE(u.display_name, u.email) AS created_by_name
			FROM %s m
			LEFT JOIN users u ON m.created_by = u.id
			WHERE m.item_id = ?
			ORDER BY m.created_at DESC, m.id DESC
			LIMIT ?`, InventoryMovementTable(realm)),
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
			cleanRow(row)
			row["realm"] = realm
			result = append(result, row)
		}
	}
	return result
}

func MovementTypeForQuantityChange(beforeQty, afterQty int) string {
	switch {
	case afterQty > beforeQty:
		return "bought"
	case afterQty < beforeQty:
		return "consumed"
	default:
		return "adjusted"
	}
}

func cleanRow(row map[string]interface{}) {
	for key, value := range row {
		switch typed := value.(type) {
		case []byte:
			row[key] = string(typed)
		}
	}
}
