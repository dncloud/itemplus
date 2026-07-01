package items

import (
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	checkoutcore "github.com/itemplus/backend/internal/core/checkouts"
	itemscore "github.com/itemplus/backend/internal/core/items"
	maintenancecore "github.com/itemplus/backend/internal/core/maintenance"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

func inClausePlaceholders(ids []interface{}) string {
	if len(ids) == 0 {
		return ""
	}
	return strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
}

func LoadListItemProperties(propsTable, propDefsTable string, itemIDs []interface{}) map[interface{}][]map[string]interface{} {
	propsByItem := map[interface{}][]map[string]interface{}{}
	if len(itemIDs) == 0 {
		return propsByItem
	}

	propQuery := fmt.Sprintf(
		`SELECT ip.item_id, ip.property_id, ip.value, pd.name AS property_name, pd.property_type, pd.display_width, pd.unit AS property_unit
		FROM %s ip
		JOIN %s pd ON ip.property_id = pd.id
		WHERE ip.item_id IN (%s)`,
		propsTable, propDefsTable, middleware.InClausePlaceholders(itemIDs))

	propRows, err := database.DB.Queryx(propQuery, itemIDs...)
	if err != nil {
		return propsByItem
	}
	defer propRows.Close()

	for propRows.Next() {
		pr := map[string]interface{}{}
		if propRows.MapScan(pr) == nil {
			middleware.CleanRow(pr)
			itemID := pr["item_id"]
			propsByItem[itemID] = append(propsByItem[itemID], pr)
		}
	}
	return propsByItem
}

func loadListItemAttachments(realm, attachTable string, itemIDs []interface{}) map[interface{}][]map[string]interface{} {
	attachByItem := map[interface{}][]map[string]interface{}{}
	if len(itemIDs) == 0 {
		return attachByItem
	}

	attachQuery := fmt.Sprintf(
		`SELECT * FROM %s WHERE item_id IN (%s) ORDER BY `+"`order`"+``,
		attachTable, middleware.InClausePlaceholders(itemIDs))

	attachRows, err := database.DB.Queryx(attachQuery, itemIDs...)
	if err != nil {
		return attachByItem
	}
	defer attachRows.Close()

	for attachRows.Next() {
		ar := map[string]interface{}{}
		if attachRows.MapScan(ar) == nil {
			middleware.CleanRow(ar)
			finalizeAttachmentRow(realm, ar)
			itemID := ar["item_id"]
			attachByItem[itemID] = append(attachByItem[itemID], ar)
		}
	}
	return attachByItem
}

func loadListItemCheckouts(checkoutTable string, itemIDs []interface{}) map[interface{}]map[string]interface{} {
	checkoutByItem := map[interface{}]map[string]interface{}{}
	if len(itemIDs) == 0 {
		return checkoutByItem
	}

	coQuery := fmt.Sprintf(
		`SELECT co.id, co.item_id, co.user_id, COALESCE(u.display_name, u.email) AS user_name, co.due_date, co.created_at
		FROM %s co
		LEFT JOIN users u ON co.user_id = u.id
		WHERE co.item_id IN (%s) AND co.status = 'active'`,
		checkoutTable, middleware.InClausePlaceholders(itemIDs))

	coRows, err := database.DB.Queryx(coQuery, itemIDs...)
	if err != nil {
		return checkoutByItem
	}
	defer coRows.Close()

	for coRows.Next() {
		cr := map[string]interface{}{}
		if coRows.MapScan(cr) == nil {
			middleware.CleanRow(cr)
			itemID := cr["item_id"]
			entry := map[string]interface{}{
				"user_id":     cr["user_id"],
				"user_name":   cr["user_name"],
				"due_date":    cr["due_date"],
				"checkout_id": cr["id"],
				"since":       cr["created_at"],
			}
			attachCheckoutDueState(entry, cr["due_date"])
			if existing, ok := checkoutByItem[itemID]; ok {
				users, _ := existing["users"].([]map[string]interface{})
				existing["users"] = append(users, entry)
				existing["checkout_count"] = len(existing["users"].([]map[string]interface{}))
				continue
			}
			checkoutByItem[itemID] = map[string]interface{}{
				"user_id":        cr["user_id"],
				"user_name":      cr["user_name"],
				"due_date":       cr["due_date"],
				"checkout_id":    cr["id"],
				"since":          cr["created_at"],
				"is_overdue":     entry["is_overdue"],
				"overdue_days":   entry["overdue_days"],
				"users":          []map[string]interface{}{entry},
				"checkout_count": 1,
			}
		}
	}
	return checkoutByItem
}

func loadListItemMaintenance(realm string, itemIDs []interface{}) map[interface{}]map[string]interface{} {
	maintenanceByItem := make(map[interface{}]map[string]interface{})
	if len(itemIDs) == 0 {
		return maintenanceByItem
	}
	placeholders := middleware.InClausePlaceholders(itemIDs)
	now := time.Now()
	today := middleware.StartOfLocalDay(now).Format("2006-01-02")
	alertDate := middleware.MaintenanceAlertDate(now).Format("2006-01-02")
	query := fmt.Sprintf(`SELECT item_id,
		COUNT(*) AS open_count,
		SUM(CASE WHEN due_date <= ? THEN 1 ELSE 0 END) AS due_count,
		SUM(CASE WHEN due_date < ? THEN 1 ELSE 0 END) AS overdue_count,
		MIN(due_date) AS next_due_date
		FROM %s
		WHERE status = 'open' AND item_id IN (%s)
		GROUP BY item_id`, middleware.MaintenanceReminderTable(realm), placeholders)
	args := append([]interface{}{alertDate, today}, itemIDs...)
	rows, err := database.DB.Queryx(query, args...)
	if err != nil {
		return maintenanceByItem
	}
	defer rows.Close()
	for rows.Next() {
		row := map[string]interface{}{}
		if rows.MapScan(row) != nil {
			continue
		}
		middleware.CleanRow(row)
		itemID := row["item_id"]
		maintenanceByItem[itemID] = map[string]interface{}{
			"open_count":    middleware.AsInt(row["open_count"]),
			"due_count":     middleware.AsInt(row["due_count"]),
			"overdue_count": middleware.AsInt(row["overdue_count"]),
			"next_due_date": row["next_due_date"],
		}
	}
	return maintenanceByItem
}

func applyListItemEnrichment(realm string, items []map[string]interface{}, propsByItem map[interface{}][]map[string]interface{}, attachByItem map[interface{}][]map[string]interface{}, checkoutByItem map[interface{}]map[string]interface{}, maintenanceByItem map[interface{}]map[string]interface{}, includeMaintenance bool) {
	for _, item := range items {
		itemID := item["id"]
		item["properties"] = propsByItem[itemID]
		item["attachments"] = attachByItem[itemID]
		item["checked_out_to"] = checkoutByItem[itemID]
		if includeMaintenance {
			if maintenance, ok := maintenanceByItem[itemID]; ok {
				item["maintenance"] = maintenance
			} else {
				item["maintenance"] = map[string]interface{}{
					"open_count":    0,
					"due_count":     0,
					"overdue_count": 0,
					"next_due_date": nil,
				}
			}
		}
	}
}

func loadItemProperties(propsTable, propDefsTable, itemID string) (map[string]interface{}, map[string]interface{}) {
	byID := map[string]interface{}{}
	byName := map[string]interface{}{}

	query := fmt.Sprintf(`SELECT ip.property_id, ip.value, pd.name AS property_name, pd.property_type, pd.unit
		FROM %s ip
		JOIN %s pd ON ip.property_id = pd.id
		WHERE ip.item_id = ?`, propsTable, propDefsTable)
	rows, err := database.DB.Queryx(query, itemID)
	if err != nil {
		return byID, byName
	}
	defer rows.Close()

	for rows.Next() {
		var propertyID int
		var rawValue string
		var propertyName string
		var propertyType string
		var unit *string
		if err := rows.Scan(&propertyID, &rawValue, &propertyName, &propertyType, &unit); err != nil {
			continue
		}
		value := decodePropertyValue(propertyType, rawValue)
		byID[fmt.Sprintf("%d", propertyID)] = value
		byName[propertyName] = FormatWithUnit(value, unit)
	}

	return byID, byName
}

func decodePropertyValue(propertyType string, rawValue string) interface{} {
	switch strings.ToLower(strings.TrimSpace(propertyType)) {
	case "boolean":
		if rawValue == "true" {
			return true
		}
		if rawValue == "false" {
			return false
		}
	}
	return ParseJSONValue(rawValue)
}

func loadItemAttachments(realm, attachTable, itemID string) []map[string]interface{} {
	rows, err := database.DB.Queryx(fmt.Sprintf("SELECT * FROM %s WHERE item_id = ? ORDER BY `order`", attachTable), itemID)
	if err != nil {
		return []map[string]interface{}{}
	}
	defer rows.Close()

	attachments := []map[string]interface{}{}
	for rows.Next() {
		row := map[string]interface{}{}
		if rows.MapScan(row) == nil {
			middleware.CleanRow(row)
			finalizeAttachmentRow(realm, row)
			attachments = append(attachments, row)
		}
	}
	return attachments
}

func loadItemCheckoutInfo(realm, checkoutTable, itemID string) interface{} {
	query := fmt.Sprintf(`SELECT co.id, co.user_id, COALESCE(u.display_name, u.email) AS user_name, co.due_date, co.created_at
		FROM %s co
		LEFT JOIN users u ON co.user_id = u.id
		WHERE co.item_id = ? AND co.status = 'active'
		ORDER BY co.created_at ASC, co.id ASC`, checkoutTable)
	rows, err := database.DB.Queryx(query, itemID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	users := make([]map[string]interface{}, 0)
	var first map[string]interface{}
	for rows.Next() {
		entry := map[string]interface{}{}
		if rows.MapScan(entry) == nil {
			middleware.CleanRow(entry)
			userEntry := map[string]interface{}{
				"user_id":     entry["user_id"],
				"user_name":   entry["user_name"],
				"due_date":    entry["due_date"],
				"checkout_id": entry["id"],
				"since":       entry["created_at"],
			}
			attachCheckoutDueState(userEntry, entry["due_date"])
			if first == nil {
				first = userEntry
			}
			users = append(users, userEntry)
		}
	}
	if len(users) == 0 {
		return nil
	}

	componentIDs, componentNames := loadActiveCheckoutComponents(realm, checkoutTable, itemID)
	return gin.H{
		"user_id":         first["user_id"],
		"user_name":       first["user_name"],
		"due_date":        first["due_date"],
		"checkout_id":     first["checkout_id"],
		"since":           first["since"],
		"is_overdue":      first["is_overdue"],
		"overdue_days":    first["overdue_days"],
		"users":           users,
		"checkout_count":  len(users),
		"component_ids":   componentIDs,
		"component_names": componentNames,
	}
}

func attachCheckoutDueState(target map[string]interface{}, dueValue interface{}) {
	due := checkoutcore.ParseCheckoutTime(dueValue)
	if due.IsZero() {
		return
	}
	now := time.Now().In(time.Local)
	target["is_overdue"] = checkoutcore.IsCheckoutOverdue(now, due)
	target["overdue_days"] = checkoutcore.CalculateOverdueDays(now, due)
}

func loadEnrichedItem(realm string, itemID string, includeMaintenance bool, includeInventory bool) map[string]interface{} {
	itemsTable := realm + "_items"
	propsTable := realm + "_item_properties"
	propDefsTable := realm + "_properties"
	attachTable := realm + "_attachments"
	checkoutTable := realm + "_checkouts"

	query := fmt.Sprintf(`SELECT i.*,
		c.name AS category_name,
		l.name AS location_name,
		m.name AS manufacturer_name,
		s.name AS supplier_name,
		v.name AS vendor_name,
		sp.name AS sales_platform_name
		FROM %s i
		LEFT JOIN %s_categories c ON i.category_id = c.id
		LEFT JOIN %s_locations l ON i.location_id = l.id
		LEFT JOIN %s_manufacturers m ON i.manufacturer_id = m.id
		LEFT JOIN %s_suppliers s ON i.supplier_id = s.id
		LEFT JOIN %s_vendors v ON i.vendor_id = v.id
		LEFT JOIN generic_sales_platforms sp ON i.sales_platform_id = sp.id
		WHERE i.id = ?`, itemsTable, realm, realm, realm, realm, realm)

	row := map[string]interface{}{}
	sqlRow := database.DB.QueryRowx(query, itemID)
	if err := sqlRow.MapScan(row); err != nil {
		return nil
	}
	middleware.CleanRow(row)

	byID, byName := loadItemProperties(propsTable, propDefsTable, itemID)
	row["properties"] = byID
	row["properties_display"] = byName

	row["attachments"] = loadItemAttachments(realm, attachTable, itemID)
	row["checked_out_to"] = loadItemCheckoutInfo(realm, checkoutTable, itemID)
	row["components"] = loadItemComponents(realm, itemID)
	row["component_item_ids"] = componentIDsFromRows(row["components"].([]map[string]interface{}))
	row["parent_bundle"] = loadParentBundle(realm, itemID)
	if includeMaintenance {
		row["maintenance_reminders"] = maintenancecore.LoadItemReminders(realm, itemID, false)
		row["maintenance_history"] = maintenancecore.LoadItemHistory(realm, itemID, 20)
	} else {
		row["maintenance_reminders"] = []map[string]interface{}{}
		row["maintenance_history"] = []map[string]interface{}{}
	}
	if includeInventory {
		row["inventory_movements"] = itemscore.LoadItemInventoryMovements(realm, itemID, 5)
	} else {
		row["inventory_movements"] = []map[string]interface{}{}
	}

	enrichVendorInfo(realm, row)

	return row
}

func FormatWithUnit(val interface{}, unitRaw interface{}) interface{} {
	entry := map[string]interface{}{"value": val}
	if unitRaw == nil {
		return entry
	}
	unit := ""
	switch u := unitRaw.(type) {
	case string:
		unit = u
	case []byte:
		unit = string(u)
	}
	if unit != "" {
		entry["unit"] = unit
	}
	return entry
}

func getLocationTree(realm string, locationID int) []int {
	table := realm + "_locations"
	result := []int{locationID}

	type locRow struct {
		ID       int  `db:"id"`
		ParentID *int `db:"parent_id"`
	}
	var allLocs []locRow
	err := database.DB.Select(&allLocs, fmt.Sprintf("SELECT id, parent_id FROM %s", table))
	if err != nil {
		return result
	}

	childrenMap := map[int][]int{}
	for _, loc := range allLocs {
		if loc.ParentID != nil {
			childrenMap[*loc.ParentID] = append(childrenMap[*loc.ParentID], loc.ID)
		}
	}

	queue := []int{locationID}
	for len(queue) > 0 {
		parent := queue[0]
		queue = queue[1:]
		for _, childID := range childrenMap[parent] {
			result = append(result, childID)
			queue = append(queue, childID)
		}
	}
	return result
}

func enrichVendorInfo(realm string, item map[string]interface{}) {
	loadVendor := func(table string, vendorID interface{}) map[string]interface{} {
		row := map[string]interface{}{}
		sqlRow := database.DB.QueryRowx(fmt.Sprintf("SELECT * FROM %s WHERE id = ?", table), vendorID)
		if err := sqlRow.MapScan(row); err != nil {
			return nil
		}
		middleware.CleanRow(row)
		return row
	}

	if mfrID := item["manufacturer_id"]; mfrID != nil && mfrID != int64(0) && mfrID != float64(0) {
		if mfr := loadVendor(realm+"_manufacturers", mfrID); mfr != nil {
			item["manufacturer_info"] = map[string]interface{}{
				"website":       mfr["website"],
				"email":         mfr["email"],
				"phone":         mfr["phone"],
				"support_email": mfr["support_email"],
				"support_phone": mfr["support_phone"],
				"support_url":   mfr["support_url"],
			}
		}
	}
	if supID := item["supplier_id"]; supID != nil && supID != int64(0) && supID != float64(0) {
		if sup := loadVendor(realm+"_suppliers", supID); sup != nil {
			item["supplier_info"] = map[string]interface{}{
				"website":         sup["website"],
				"email":           sup["email"],
				"phone":           sup["phone"],
				"contact_person":  sup["contact_person"],
				"account_manager": sup["account_manager"],
			}
		}
	}
	if venID := item["vendor_id"]; venID != nil && venID != int64(0) && venID != float64(0) {
		if ven := loadVendor(realm+"_vendors", venID); ven != nil {
			item["vendor_info"] = map[string]interface{}{
				"website":         ven["website"],
				"email":           ven["email"],
				"phone":           ven["phone"],
				"contact_person":  ven["contact_person"],
				"customer_number": ven["customer_number"],
			}
		}
	}
}
