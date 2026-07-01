package items

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

func listItems(realm string) gin.HandlerFunc {
	itemsTable := realm + "_items"
	propsTable := realm + "_item_properties"
	propDefsTable := realm + "_properties"
	attachTable := realm + "_attachments"
	checkoutTable := realm + "_checkouts"

	return func(c *gin.Context) {
		search := c.Query("search")
		categoryID := c.Query("category_id")
		locationID := c.Query("location_id")
		status := c.Query("status")
		sortField := c.DefaultQuery("sort", "id")
		sortOrder := c.DefaultQuery("order", "desc")
		pageStr := c.DefaultQuery("page", "1")
		perPageStr := c.DefaultQuery("per_page", "50")

		page, _ := strconv.Atoi(pageStr)
		perPage, _ := strconv.Atoi(perPageStr)
		if page < 1 {
			page = 1
		}
		if perPage <= 0 || perPage > 200 {
			perPage = 50
		}
		offset := (page - 1) * perPage

		sortMap := map[string]string{
			"id": "i.id", "name": "i.name", "price": "i.purchase_price", "quantity": "i.quantity",
			"created": "i.created_at", "updated": "i.updated_at",
		}
		sortCol := "i.id"
		if col, ok := sortMap[sortField]; ok {
			sortCol = col
		}
		if sortOrder != "asc" {
			sortOrder = "desc"
		}

		orderClause := fmt.Sprintf("%s %s", sortCol, sortOrder)
		switch sortField {
		case "price", "quantity":
			orderClause = fmt.Sprintf("%s %s, i.name ASC, i.id DESC", sortCol, sortOrder)
		case "name":
			orderClause = fmt.Sprintf("i.name %s, i.id DESC", sortOrder)
		case "created", "updated":
			orderClause = fmt.Sprintf("%s %s, i.id DESC", sortCol, sortOrder)
		case "id":
			orderClause = fmt.Sprintf("i.id %s", sortOrder)
		default:
			orderClause = fmt.Sprintf("i.id %s", sortOrder)
		}

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
			LEFT JOIN generic_sales_platforms sp ON i.sales_platform_id = sp.id`,
			itemsTable, realm, realm, realm, realm, realm)

		var conditions []string
		var args []interface{}

		if search != "" {
			searchPattern := "%" + search + "%"
			conditions = append(conditions, fmt.Sprintf(
				`(i.name LIKE ? OR i.description LIKE ? OR EXISTS (
					SELECT 1 FROM %s ip
					WHERE ip.item_id = i.id AND ip.value LIKE ?
				))`,
				propsTable,
			))
			args = append(args, searchPattern, searchPattern, searchPattern)
		}
		if categoryID != "" {
			conditions = append(conditions, "i.category_id = ?")
			args = append(args, categoryID)
		}
		if locationID != "" {
			locID, err := strconv.Atoi(locationID)
			if err == nil {
				locIDs := getLocationTree(realm, locID)
				locPlaceholders := make([]string, len(locIDs))
				for i, lid := range locIDs {
					locPlaceholders[i] = strconv.Itoa(lid)
				}
				conditions = append(conditions, fmt.Sprintf("i.location_id IN (%s)", strings.Join(locPlaceholders, ",")))
			} else {
				conditions = append(conditions, "i.location_id = ?")
				args = append(args, locationID)
			}
		}
		if status != "" {
			switch status {
			case "active", "reserved", "for_sale", "sold":
				conditions = append(conditions, "i.item_status = ?")
				args = append(args, status)
			case "checked_out":
				conditions = append(conditions, fmt.Sprintf("EXISTS (SELECT 1 FROM %s co WHERE co.item_id = i.id AND co.status = 'active')", checkoutTable))
			}
		}

		if len(conditions) > 0 {
			query += " WHERE " + strings.Join(conditions, " AND ")
		}
		query += fmt.Sprintf(" ORDER BY %s LIMIT ? OFFSET ?", orderClause)
		args = append(args, perPage, offset)

		rows, err := database.DB.Queryx(query, args...)
		if err != nil {
			log.Printf("DB query error in listItems %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		defer rows.Close()

		items := make([]map[string]interface{}, 0)
		var itemIDs []interface{}

		for rows.Next() {
			row := map[string]interface{}{}
			if err := rows.MapScan(row); err == nil {
				middleware.CleanRow(row)
				items = append(items, row)
				itemIDs = append(itemIDs, row["id"])
			}
		}

		if len(items) == 0 {
			c.JSON(http.StatusOK, gin.H{
				"items":          []interface{}{},
				"total":          0,
				"total_quantity": 0,
				"total_value":    0,
				"page":           page,
				"per_page":       perPage,
			})
			return
		}

		propsByItem := LoadListItemProperties(propsTable, propDefsTable, itemIDs)
		attachByItem := loadListItemAttachments(realm, attachTable, itemIDs)
		checkoutByItem := loadListItemCheckouts(checkoutTable, itemIDs)
		user := middleware.GetUser(c)
		includeMaintenance := user != nil && user.HasPermission("maintenance.read")
		maintenanceByItem := make(map[interface{}]map[string]interface{})
		if includeMaintenance {
			maintenanceByItem = loadListItemMaintenance(realm, itemIDs)
		}
		applyListItemEnrichment(realm, items, propsByItem, attachByItem, checkoutByItem, maintenanceByItem, includeMaintenance)

		countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s i", itemsTable)
		if len(conditions) > 0 {
			countQuery += " WHERE " + strings.Join(conditions, " AND ")
		}
		var total int
		countArgs := args[:len(args)-2]
		database.DB.Get(&total, countQuery, countArgs...)

		var totalQty int
		var totalValue float64
		aggQuery := fmt.Sprintf("SELECT COALESCE(SUM(quantity),0), COALESCE(SUM(purchase_price*quantity),0) FROM %s", itemsTable)
		if len(conditions) > 0 {
			aggQuery += " WHERE " + strings.Join(conditions, " AND ")
		}
		aggArgs := args[:len(args)-2]
		database.DB.QueryRow(aggQuery, aggArgs...).Scan(&totalQty, &totalValue)

		c.JSON(http.StatusOK, gin.H{
			"items":          items,
			"total":          total,
			"total_quantity": totalQty,
			"total_value":    totalValue,
			"page":           page,
			"per_page":       perPage,
		})
	}
}

func listItemLookup(realm string) gin.HandlerFunc {
	itemsTable := realm + "_items"
	componentsTable := realm + "_item_components"

	return func(c *gin.Context) {
		excludeID := strings.TrimSpace(c.Query("exclude_id"))
		query := fmt.Sprintf(`SELECT i.id, i.name, i.item_status, i.is_bundle,
			pc.parent_item_id,
			pi.name AS parent_item_name
			FROM %s i
			LEFT JOIN %s pc ON pc.child_item_id = i.id
			LEFT JOIN %s pi ON pi.id = pc.parent_item_id`,
			itemsTable, componentsTable, itemsTable,
		)
		args := []interface{}{}
		if excludeID != "" {
			query += " WHERE i.id <> ?"
			args = append(args, excludeID)
		}
		query += " ORDER BY i.name ASC, i.id ASC"

		rows, err := database.DB.Queryx(query, args...)
		if err != nil {
			log.Printf("DB query error in listItemLookup %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		defer rows.Close()

		items := make([]map[string]interface{}, 0)
		for rows.Next() {
			row := map[string]interface{}{}
			if err := rows.MapScan(row); err == nil {
				middleware.CleanRow(row)
				items = append(items, row)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}
