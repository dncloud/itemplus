package operations

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	checkoutcore "github.com/itemplus/backend/internal/core/checkouts"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

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
		fmt.Sprintf("SELECT id, name FROM %s_items WHERE id IN (%s)", realm, middleware.InClausePlaceholders(args)),
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

	itemID := middleware.AsInt(row["item_id"])
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

	itemID := middleware.AsInt(row["item_id"])
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

	userID := middleware.AsInt64(row["user_id"])
	createdAt := checkoutcore.NormalizeNullableDBValue(row["created_at"])
	dueDate := checkoutcore.NormalizeNullableDBValue(row["due_date"])
	notes := checkoutcore.NormalizeNullableDBValue(row["notes"])

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
