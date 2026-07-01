package operations

import (
	"fmt"

	"github.com/itemplus/backend/internal/database"
)

func loadCheckoutUserName(userID interface{}) interface{} {
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
		return *displayName
	}
	if email != nil {
		return *email
	}
	return nil
}

func loadCheckoutRequestItemMeta(realm string, itemID interface{}) (interface{}, bool) {
	itemsTable := realm + "_items"
	var itemMeta struct {
		Name     *string `db:"name"`
		IsBundle bool    `db:"is_bundle"`
	}
	if database.DB.Get(&itemMeta, fmt.Sprintf("SELECT name, is_bundle FROM %s WHERE id = ?", itemsTable), itemID) == nil {
		if itemMeta.Name != nil {
			return *itemMeta.Name, itemMeta.IsBundle
		}
		return nil, itemMeta.IsBundle
	}
	return nil, false
}

func enrichCheckoutRequest(row map[string]interface{}) {
	if userID, ok := row["user_id"]; ok && userID != nil {
		row["user_name"] = loadCheckoutUserName(userID)
	}

	realmStr := ""
	switch v := row["realm"].(type) {
	case string:
		realmStr = v
	case []byte:
		realmStr = string(v)
	}
	if itemID, ok := row["item_id"]; ok && itemID != nil && (realmStr == "archive" || realmStr == "collection") {
		itemName, isBundle := loadCheckoutRequestItemMeta(realmStr, itemID)
		row["is_bundle"] = isBundle
		row["item_name"] = itemName
	}

	if approvedBy, ok := row["approved_by"]; ok && approvedBy != nil {
		row["approved_by_name"] = loadCheckoutUserName(approvedBy)
	}

	statusVal, _ := row["status"].(string)
	if statusVal == "" {
		if b, ok := row["status"].([]byte); ok {
			statusVal = string(b)
		}
	}
	if statusVal != "approved" && statusVal != "completed" {
		return
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
