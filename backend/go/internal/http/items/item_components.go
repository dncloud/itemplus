package items

import (
	"database/sql"
	"errors"
	"fmt"
	"github.com/itemplus/backend/internal/http/middleware"
	"strings"

	"github.com/itemplus/backend/internal/database"
	"github.com/jmoiron/sqlx"
)

type bundleValidationError string

func (e bundleValidationError) Error() string {
	return string(e)
}

func parseComponentItemIDs(value interface{}) ([]int, error) {
	if value == nil {
		return nil, nil
	}
	values, ok := value.([]interface{})
	if !ok {
		return nil, bundleValidationError("component_item_ids must be an array")
	}
	parsed := make([]int, 0, len(values))
	for _, entry := range values {
		switch v := entry.(type) {
		case float64:
			parsed = append(parsed, int(v))
		case int:
			parsed = append(parsed, v)
		default:
			return nil, bundleValidationError("component_item_ids contains an invalid item id")
		}
	}
	return parsed, nil
}

func resolveNextIsBundle(tx *sqlx.Tx, itemsTable string, itemID int, rawIsBundle interface{}, hasComponentItemIDs bool, componentItemIDs []int) (bool, error) {
	if rawIsBundle != nil {
		switch value := rawIsBundle.(type) {
		case bool:
			if hasComponentItemIDs && len(componentItemIDs) > 0 {
				return true, nil
			}
			return value, nil
		case float64:
			if value == 0 || value == 1 {
				if hasComponentItemIDs && len(componentItemIDs) > 0 {
					return true, nil
				}
				return value == 1, nil
			}
		case int:
			if value == 0 || value == 1 {
				if hasComponentItemIDs && len(componentItemIDs) > 0 {
					return true, nil
				}
				return value == 1, nil
			}
		case string:
			normalized := strings.TrimSpace(strings.ToLower(value))
			switch normalized {
			case "true", "1":
				if hasComponentItemIDs && len(componentItemIDs) > 0 {
					return true, nil
				}
				return true, nil
			case "false", "0", "":
				if hasComponentItemIDs && len(componentItemIDs) > 0 {
					return true, nil
				}
				return false, nil
			}
		}
		return false, bundleValidationError("is_bundle must be a boolean")
	}
	if hasComponentItemIDs {
		return len(componentItemIDs) > 0, nil
	}
	var current bool
	if err := tx.Get(&current, fmt.Sprintf("SELECT COALESCE(is_bundle, 0) FROM %s WHERE id = ?", itemsTable), itemID); err != nil {
		return false, err
	}
	return current, nil
}

func loadItemComponentIDsTx(tx *sqlx.Tx, realm string, itemID int) ([]int, error) {
	componentsTable := realm + "_item_components"
	rows, err := tx.Queryx(fmt.Sprintf("SELECT child_item_id FROM %s WHERE parent_item_id = ? ORDER BY position ASC, id ASC", componentsTable), itemID)
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

func syncItemComponentsTx(tx *sqlx.Tx, realm string, parentItemID int, isBundle bool, componentItemIDs []int) error {
	itemsTable := realm + "_items"
	componentsTable := realm + "_item_components"

	componentIDs := make([]int, 0, len(componentItemIDs))
	seen := map[int]bool{}
	for _, childID := range componentItemIDs {
		if childID < 1 {
			return bundleValidationError("Bestandteile enthalten eine ungültige Item-ID")
		}
		if childID == parentItemID {
			return bundleValidationError("Ein Item kann nicht Teil von sich selbst sein")
		}
		if seen[childID] {
			continue
		}
		seen[childID] = true
		componentIDs = append(componentIDs, childID)
	}

	if isBundle {
		var parentOwnerCount int
		if err := tx.Get(&parentOwnerCount, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE child_item_id = ?", componentsTable), parentItemID); err != nil {
			return err
		}
		if parentOwnerCount > 0 {
			return bundleValidationError("Ein Bundle kann nicht gleichzeitig Teil eines anderen Items sein")
		}
	}

	for _, childID := range componentIDs {
		var child struct {
			ID       int  `db:"id"`
			IsBundle bool `db:"is_bundle"`
		}
		if err := tx.Get(&child, fmt.Sprintf("SELECT id, COALESCE(is_bundle, 0) AS is_bundle FROM %s WHERE id = ?", itemsTable), childID); err != nil {
			return bundleValidationError("Ein ausgewähltes Bestandteil-Item wurde nicht gefunden")
		}
		if child.IsBundle {
			return bundleValidationError("Bundles können nicht als Bestandteil eines anderen Items verwendet werden")
		}

		var assignedParentID int
		err := tx.Get(&assignedParentID, fmt.Sprintf("SELECT parent_item_id FROM %s WHERE child_item_id = ? LIMIT 1", componentsTable), childID)
		if err == nil && assignedParentID != parentItemID {
			return bundleValidationError("Mindestens ein Bestandteil gehört bereits zu einem anderen Item")
		}
		if err != nil && !errors.Is(err, sql.ErrNoRows) && !strings.Contains(strings.ToLower(err.Error()), "no rows") {
			return err
		}
	}

	if _, err := tx.Exec(fmt.Sprintf("DELETE FROM %s WHERE parent_item_id = ?", componentsTable), parentItemID); err != nil {
		return err
	}
	now := database.TimestampNow()
	for position, childID := range componentIDs {
		if _, err := tx.Exec(
			fmt.Sprintf("INSERT INTO %s (parent_item_id, child_item_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", componentsTable),
			parentItemID, childID, position, now, now,
		); err != nil {
			return err
		}
	}

	targetBundleState := isBundle || len(componentIDs) > 0
	if _, err := tx.Exec(fmt.Sprintf("UPDATE %s SET is_bundle = ?, updated_at = ? WHERE id = ?", itemsTable), targetBundleState, now, parentItemID); err != nil {
		return err
	}
	return nil
}

func componentIDsFromRows(rows []map[string]interface{}) []int {
	ids := make([]int, 0, len(rows))
	for _, row := range rows {
		switch id := row["id"].(type) {
		case int:
			ids = append(ids, id)
		case int64:
			ids = append(ids, int(id))
		case float64:
			ids = append(ids, int(id))
		}
	}
	return ids
}

func loadActiveCheckoutComponents(realm, checkoutTable, itemID string) ([]int, []string) {
	itemsTable := realm + "_items"
	query := fmt.Sprintf(`SELECT co.item_id, i.name
		FROM %s co
		JOIN %s i ON i.id = co.item_id
		WHERE co.bundle_parent_item_id = ? AND co.status = 'active'
		ORDER BY i.name ASC`, checkoutTable, itemsTable)
	rows, err := database.DB.Queryx(query, itemID)
	if err != nil {
		return []int{}, []string{}
	}
	defer rows.Close()

	componentIDs := []int{}
	componentNames := []string{}
	for rows.Next() {
		var componentID int
		var componentName string
		if err := rows.Scan(&componentID, &componentName); err == nil {
			componentIDs = append(componentIDs, componentID)
			componentNames = append(componentNames, componentName)
		}
	}
	return componentIDs, componentNames
}

func loadItemComponents(realm, itemID string) []map[string]interface{} {
	itemsTable := realm + "_items"
	componentsTable := realm + "_item_components"
	query := fmt.Sprintf(`SELECT i.id, i.name, i.item_status, i.is_bundle, ic.position
		FROM %s ic
		JOIN %s i ON i.id = ic.child_item_id
		WHERE ic.parent_item_id = ?
		ORDER BY ic.position ASC, i.name ASC`, componentsTable, itemsTable)
	rows, err := database.DB.Queryx(query, itemID)
	if err != nil {
		return []map[string]interface{}{}
	}
	defer rows.Close()

	components := []map[string]interface{}{}
	for rows.Next() {
		row := map[string]interface{}{}
		if rows.MapScan(row) == nil {
			middleware.CleanRow(row)
			components = append(components, row)
		}
	}
	return components
}

func loadParentBundle(realm, itemID string) map[string]interface{} {
	itemsTable := realm + "_items"
	componentsTable := realm + "_item_components"
	query := fmt.Sprintf(`SELECT p.id, p.name, p.item_status, p.is_bundle
		FROM %s ic
		JOIN %s p ON p.id = ic.parent_item_id
		WHERE ic.child_item_id = ?
		LIMIT 1`, componentsTable, itemsTable)
	row := map[string]interface{}{}
	if err := database.DB.QueryRowx(query, itemID).MapScan(row); err != nil {
		return nil
	}
	middleware.CleanRow(row)
	return row
}
