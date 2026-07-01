package ai

import (
	"fmt"
	"sort"
	"strings"

	aicore "github.com/itemplus/backend/internal/core/ai"
	checkoutcore "github.com/itemplus/backend/internal/core/checkouts"
	"github.com/itemplus/backend/internal/database"
	itemhandlers "github.com/itemplus/backend/internal/http/items"
	"github.com/itemplus/backend/internal/http/middleware"
)

func runAIInventoryLookup(user *middleware.User, request *aicore.InventoryLookupRequest) (map[string]any, error) {
	if user == nil || request == nil {
		return nil, nil
	}

	realms := inventoryLookupRealms(request.Realm)
	if len(realms) == 0 {
		return nil, nil
	}

	result := map[string]any{
		"tool":    "inventory.lookup",
		"request": request,
	}

	switch request.Kind {
	case "items":
		if !user.HasPermission("items.read") {
			return nil, nil
		}
		rows := make([]map[string]any, 0)
		totalMatches := int64(0)
		totalQuantity := int64(0)
		totalActiveCheckouts := int64(0)
		for _, realm := range realms {
			realmRows, realmSummary, err := lookupInventoryItems(user, realm, request)
			if err != nil {
				return nil, err
			}
			rows = append(rows, realmRows...)
			totalMatches += realmSummary.TotalMatches
			totalQuantity += realmSummary.TotalQuantity
			totalActiveCheckouts += realmSummary.TotalActiveCheckouts
		}
		sort.Slice(rows, func(i, j int) bool {
			leftName, _ := rows[i]["name"].(string)
			rightName, _ := rows[j]["name"].(string)
			if leftName == rightName {
				leftRealm, _ := rows[i]["realm"].(string)
				rightRealm, _ := rows[j]["realm"].(string)
				return leftRealm < rightRealm
			}
			return strings.ToLower(leftName) < strings.ToLower(rightName)
		})
		if limit := normalizedInventoryLookupLimit(request.Limit); len(rows) > limit {
			rows = rows[:limit]
		}
		summary := map[string]any{
			"total_matches":      totalMatches,
			"total_quantity":     totalQuantity,
			"returned_row_count": len(rows),
		}
		if user.IsAdmin {
			summary["total_active_checkouts"] = totalActiveCheckouts
		}
		result["summary"] = summary
		result["rows"] = rows
	case "checkouts":
		rows := make([]map[string]any, 0)
		totalMatches := int64(0)
		overdueCount := int64(0)
		for _, realm := range realms {
			realmRows, realmSummary, err := lookupInventoryCheckouts(user, realm, request)
			if err != nil {
				return nil, err
			}
			rows = append(rows, realmRows...)
			totalMatches += realmSummary.TotalMatches
			overdueCount += realmSummary.OverdueCount
		}
		sort.Slice(rows, func(i, j int) bool {
			leftOverdue, _ := rows[i]["is_overdue"].(bool)
			rightOverdue, _ := rows[j]["is_overdue"].(bool)
			if leftOverdue != rightOverdue {
				return leftOverdue
			}
			leftName, _ := rows[i]["item_name"].(string)
			rightName, _ := rows[j]["item_name"].(string)
			if leftName == rightName {
				leftRealm, _ := rows[i]["realm"].(string)
				rightRealm, _ := rows[j]["realm"].(string)
				return leftRealm < rightRealm
			}
			return strings.ToLower(leftName) < strings.ToLower(rightName)
		})
		if limit := normalizedInventoryLookupLimit(request.Limit); len(rows) > limit {
			rows = rows[:limit]
		}
		result["summary"] = map[string]any{
			"total_matches":      totalMatches,
			"overdue_count":      overdueCount,
			"returned_row_count": len(rows),
		}
		result["rows"] = rows
	default:
		return nil, nil
	}

	return result, nil
}

type inventoryItemLookupSummary struct {
	TotalMatches         int64
	TotalQuantity        int64
	TotalActiveCheckouts int64
}

type inventoryCheckoutLookupSummary struct {
	TotalMatches int64
	OverdueCount int64
}

func inventoryLookupRealms(realm string) []string {
	switch strings.ToLower(strings.TrimSpace(realm)) {
	case "archive":
		return []string{"archive"}
	case "collection":
		return []string{"collection"}
	default:
		return []string{"archive", "collection"}
	}
}

func normalizedInventoryLookupLimit(limit int) int {
	if limit <= 0 {
		return 8
	}
	if limit > 20 {
		return 20
	}
	return limit
}

func lookupInventoryItems(user *middleware.User, realm string, request *aicore.InventoryLookupRequest) ([]map[string]any, inventoryItemLookupSummary, error) {
	rows := make([]map[string]any, 0)
	summary := inventoryItemLookupSummary{}
	if request == nil {
		return rows, summary, nil
	}

	propsTable := realm + "_item_properties"
	propDefsTable := realm + "_properties"
	checkoutTable := realm + "_checkouts"
	limit := normalizedInventoryLookupLimit(request.Limit)

	baseQuery := fmt.Sprintf(` FROM %s_items i
		LEFT JOIN %s_locations l ON i.location_id = l.id
		LEFT JOIN %s_categories c ON i.category_id = c.id
		LEFT JOIN %s_manufacturers m ON i.manufacturer_id = m.id
		LEFT JOIN %s_suppliers s ON i.supplier_id = s.id
		LEFT JOIN %s_vendors v ON i.vendor_id = v.id
		LEFT JOIN generic_sales_platforms sp ON i.sales_platform_id = sp.id`,
		realm, realm, realm, realm, realm, realm)

	conditions := make([]string, 0)
	args := make([]any, 0)

	if search := strings.TrimSpace(strings.ToLower(request.Search)); search != "" {
		like := "%" + search + "%"
		conditions = append(conditions, fmt.Sprintf(`(
			LOWER(i.name) LIKE ? OR
			LOWER(COALESCE(i.description, '')) LIKE ? OR
			LOWER(COALESCE(l.name, '')) LIKE ? OR
			LOWER(COALESCE(c.name, '')) LIKE ? OR
			EXISTS (
				SELECT 1 FROM %s ip
				WHERE ip.item_id = i.id AND LOWER(COALESCE(ip.value, '')) LIKE ?
			)
		)`, propsTable))
		args = append(args, like, like, like, like, like)
	}
	if locationName := strings.TrimSpace(strings.ToLower(request.LocationName)); locationName != "" {
		conditions = append(conditions, "LOWER(COALESCE(l.name, '')) LIKE ?")
		args = append(args, "%"+locationName+"%")
	}
	if categoryName := strings.TrimSpace(strings.ToLower(request.CategoryName)); categoryName != "" {
		conditions = append(conditions, "LOWER(COALESCE(c.name, '')) LIKE ?")
		args = append(args, "%"+categoryName+"%")
	}
	if status := strings.TrimSpace(strings.ToLower(request.Status)); status != "" && status != "all" {
		if status == "checked_out" {
			conditions = append(conditions, fmt.Sprintf("EXISTS (SELECT 1 FROM %s co WHERE co.item_id = i.id AND co.status = 'active')", checkoutTable))
		} else {
			conditions = append(conditions, "LOWER(COALESCE(i.item_status, '')) = ?")
			args = append(args, status)
		}
	}
	switch strings.TrimSpace(strings.ToLower(request.StockState)) {
	case "low_stock":
		conditions = append(conditions, "COALESCE(i.min_quantity, 0) > 0 AND COALESCE(i.quantity, 0) <= COALESCE(i.min_quantity, 0)")
	case "out_of_stock":
		conditions = append(conditions, "COALESCE(i.quantity, 0) <= 0")
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = " WHERE " + strings.Join(conditions, " AND ")
	}

	countQuery := "SELECT COUNT(*), COALESCE(SUM(i.quantity), 0), COALESCE(SUM((SELECT COUNT(*) FROM " + checkoutTable + " co WHERE co.item_id = i.id AND co.status = 'active')), 0)" + baseQuery + whereClause
	if err := database.DB.QueryRow(countQuery, args...).Scan(&summary.TotalMatches, &summary.TotalQuantity, &summary.TotalActiveCheckouts); err != nil {
		return nil, summary, err
	}

	query := fmt.Sprintf(`SELECT i.id, i.name, i.description, i.quantity, i.min_quantity,
		i.item_status, i.serial_number, i.barcode, i.purchase_date, i.purchase_price, i.estimated_value, i.is_bundle,
		COALESCE(l.name, '') AS location_name,
		COALESCE(c.name, '') AS category_name,
		COALESCE(m.name, '') AS manufacturer_name,
		COALESCE(s.name, '') AS supplier_name,
		COALESCE(v.name, '') AS vendor_name,
		COALESCE(sp.name, '') AS sales_platform_name,
		COALESCE((SELECT COUNT(*) FROM %s co WHERE co.item_id = i.id AND co.status = 'active'), 0) AS active_checkout_count
		%s%s
		ORDER BY i.name ASC, i.id ASC
		LIMIT ?`, checkoutTable, baseQuery, whereClause)
	queryArgs := append(append([]any{}, args...), limit)
	queryRows, err := database.DB.Queryx(query, queryArgs...)
	if err != nil {
		return nil, summary, err
	}
	defer queryRows.Close()

	itemIDs := make([]interface{}, 0, limit)
	for queryRows.Next() {
		row := map[string]any{}
		if queryRows.MapScan(row) != nil {
			continue
		}
		middleware.CleanRow(row)
		row["realm"] = realm
		if !user.IsAdmin {
			delete(row, "active_checkout_count")
		}
		itemIDs = append(itemIDs, row["id"])
		rows = append(rows, row)
	}

	propsByItem := itemhandlers.LoadListItemProperties(propsTable, propDefsTable, itemIDs)
	applyInventoryLookupItemEnrichment(rows, propsByItem)

	return rows, summary, queryRows.Err()
}

func applyInventoryLookupItemEnrichment(items []map[string]any, propsByItem map[interface{}][]map[string]interface{}) {
	for _, item := range items {
		id := item["id"]
		if props, ok := propsByItem[id]; ok {
			byID := map[string]interface{}{}
			byName := map[string]interface{}{}
			for _, p := range props {
				propID := fmt.Sprintf("%v", p["property_id"])
				propName, _ := p["property_name"].(string)
				val := itemhandlers.ParseJSONValue(p["value"])
				byID[propID] = val
				if propName != "" {
					byName[propName] = itemhandlers.FormatWithUnit(val, p["property_unit"])
				}
			}
			item["properties"] = byID
			item["properties_display"] = byName
		} else {
			item["properties"] = map[string]interface{}{}
			item["properties_display"] = map[string]interface{}{}
		}

		quantity, quantityOK := inventoryLookupInt64(item["quantity"])
		minQuantity, minQuantityOK := inventoryLookupInt64(item["min_quantity"])
		item["stock"] = map[string]any{
			"quantity":      quantity,
			"min_quantity":  minQuantity,
			"has_min_stock": minQuantityOK,
			"is_low_stock":  quantityOK && minQuantityOK && quantity <= minQuantity,
		}

		item["master_data"] = map[string]any{
			"category_name":       item["category_name"],
			"location_name":       item["location_name"],
			"manufacturer_name":   item["manufacturer_name"],
			"supplier_name":       item["supplier_name"],
			"vendor_name":         item["vendor_name"],
			"sales_platform_name": item["sales_platform_name"],
			"serial_number":       item["serial_number"],
			"barcode":             item["barcode"],
			"purchase_date":       item["purchase_date"],
			"purchase_price":      item["purchase_price"],
			"estimated_value":     item["estimated_value"],
			"item_status":         item["item_status"],
			"is_bundle":           item["is_bundle"],
		}
	}
}

func inventoryLookupInt64(value any) (int64, bool) {
	switch v := value.(type) {
	case int:
		return int64(v), true
	case int8:
		return int64(v), true
	case int16:
		return int64(v), true
	case int32:
		return int64(v), true
	case int64:
		return v, true
	case float32:
		return int64(v), true
	case float64:
		return int64(v), true
	default:
		return 0, false
	}
}

func lookupInventoryCheckouts(user *middleware.User, realm string, request *aicore.InventoryLookupRequest) ([]map[string]any, inventoryCheckoutLookupSummary, error) {
	rows := make([]map[string]any, 0)
	summary := inventoryCheckoutLookupSummary{}
	if user == nil || request == nil {
		return rows, summary, nil
	}

	limit := normalizedInventoryLookupLimit(request.Limit)
	baseQuery := fmt.Sprintf(` FROM %s_checkouts co
		JOIN %s_items i ON co.item_id = i.id
		LEFT JOIN %s_locations l ON i.location_id = l.id
		LEFT JOIN %s_categories c ON i.category_id = c.id
		LEFT JOIN users u ON co.user_id = u.id`,
		realm, realm, realm, realm)

	conditions := make([]string, 0)
	args := make([]any, 0)

	status := strings.TrimSpace(strings.ToLower(request.Status))
	switch status {
	case "", "active":
		conditions = append(conditions, "co.status = 'active'")
	case "returned":
		conditions = append(conditions, "co.status = 'returned'")
	case "all":
	default:
		conditions = append(conditions, "LOWER(COALESCE(co.status, '')) = ?")
		args = append(args, status)
	}

	if search := strings.TrimSpace(strings.ToLower(request.Search)); search != "" {
		like := "%" + search + "%"
		conditions = append(conditions, `(LOWER(i.name) LIKE ? OR LOWER(COALESCE(co.notes, '')) LIKE ? OR LOWER(COALESCE(l.name, '')) LIKE ? OR LOWER(COALESCE(c.name, '')) LIKE ? OR LOWER(COALESCE(u.display_name, u.email, '')) LIKE ?)`)
		args = append(args, like, like, like, like, like)
	}
	if locationName := strings.TrimSpace(strings.ToLower(request.LocationName)); locationName != "" {
		conditions = append(conditions, "LOWER(COALESCE(l.name, '')) LIKE ?")
		args = append(args, "%"+locationName+"%")
	}
	if categoryName := strings.TrimSpace(strings.ToLower(request.CategoryName)); categoryName != "" {
		conditions = append(conditions, "LOWER(COALESCE(c.name, '')) LIKE ?")
		args = append(args, "%"+categoryName+"%")
	}
	if userName := strings.TrimSpace(strings.ToLower(request.UserName)); userName != "" {
		conditions = append(conditions, "LOWER(COALESCE(u.display_name, u.email, '')) LIKE ?")
		args = append(args, "%"+userName+"%")
	}
	if !user.IsAdmin {
		conditions = append(conditions, "co.user_id = ?")
		args = append(args, user.ID)
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = " WHERE " + strings.Join(conditions, " AND ")
	}

	countQuery := "SELECT COUNT(*)" + baseQuery + whereClause
	if err := database.DB.QueryRow(countQuery, args...).Scan(&summary.TotalMatches); err != nil {
		return nil, summary, err
	}

	query := "SELECT co.id, co.item_id, co.user_id, co.status, co.due_date, co.returned_at, co.notes, co.created_at, i.name AS item_name, COALESCE(l.name, '') AS location_name, COALESCE(c.name, '') AS category_name, COALESCE(u.display_name, u.email, '') AS user_name" + baseQuery + whereClause + " ORDER BY co.created_at DESC, co.id DESC LIMIT ?"
	queryArgs := append(append([]any{}, args...), limit)
	queryRows, err := database.DB.Queryx(query, queryArgs...)
	if err != nil {
		return nil, summary, err
	}
	defer queryRows.Close()

	for queryRows.Next() {
		row := map[string]any{}
		if queryRows.MapScan(row) != nil {
			continue
		}
		middleware.CleanRow(row)
		checkoutcore.EnrichCheckoutRow(row, realm)
		row["realm"] = realm
		if !user.IsAdmin {
			delete(row, "user_name")
		} else {
			name, _ := row["user_name"].(string)
			if strings.TrimSpace(name) == "" {
				if userID, ok := aiMapInt64(row["user_id"]); ok && userID > 0 {
					row["user_name"] = fmt.Sprintf("User #%d", userID)
				}
			}
		}
		if overdue, ok := row["is_overdue"].(bool); ok && overdue {
			summary.OverdueCount++
		}
		rows = append(rows, row)
	}

	return rows, summary, queryRows.Err()
}
