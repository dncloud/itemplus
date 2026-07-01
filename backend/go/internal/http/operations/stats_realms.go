package operations

import (
	"fmt"
	"github.com/itemplus/backend/internal/http/middleware"
	"math"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
)

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func realmStats(realm string) gin.H {
	var items, categories, locations, properties, totalQty int
	var totalValue, avgPrice float64

	database.DB.Get(&items, fmt.Sprintf("SELECT COUNT(*) FROM %s_items", realm))
	database.DB.Get(&categories, fmt.Sprintf("SELECT COUNT(*) FROM %s_categories", realm))
	database.DB.Get(&locations, fmt.Sprintf("SELECT COUNT(*) FROM %s_locations", realm))
	database.DB.Get(&properties, fmt.Sprintf("SELECT COUNT(*) FROM %s_properties", realm))
	database.DB.Get(&totalValue, fmt.Sprintf("SELECT COALESCE(SUM(purchase_price * quantity), 0) FROM %s_items WHERE purchase_price IS NOT NULL", realm))
	database.DB.Get(&totalQty, fmt.Sprintf("SELECT COALESCE(SUM(quantity), 0) FROM %s_items", realm))
	database.DB.Get(&avgPrice, fmt.Sprintf("SELECT COALESCE(AVG(purchase_price), 0) FROM %s_items WHERE purchase_price IS NOT NULL", realm))

	recentQuery := fmt.Sprintf(
		`SELECT i.id, i.name, i.created_at, i.updated_at,
			c.name AS category_name, c.color AS category_color,
			l.name AS location_name, l.color AS location_color
		FROM %s_items i
		LEFT JOIN %s_categories c ON i.category_id = c.id
		LEFT JOIN %s_locations l ON i.location_id = l.id
		ORDER BY i.updated_at DESC LIMIT 8`, realm, realm, realm)
	recentRows, _ := database.DB.Queryx(recentQuery)
	var recentlyAdded []gin.H
	if recentRows != nil {
		defer recentRows.Close()
		for recentRows.Next() {
			row := map[string]interface{}{}
			if recentRows.MapScan(row) == nil {
				middleware.CleanRow(row)
				recentlyAdded = append(recentlyAdded, gin.H(row))
			}
		}
	}
	if recentlyAdded == nil {
		recentlyAdded = []gin.H{}
	}

	topValQuery := fmt.Sprintf(
		`SELECT i.id, i.name, (i.purchase_price * i.quantity) AS value,
			c.name AS category_name, c.color AS category_color,
			l.name AS location_name, l.color AS location_color
		FROM %s_items i
		LEFT JOIN %s_categories c ON i.category_id = c.id
		LEFT JOIN %s_locations l ON i.location_id = l.id
		WHERE i.purchase_price IS NOT NULL
		ORDER BY (i.purchase_price * i.quantity) DESC LIMIT 5`, realm, realm, realm)
	topValRows, _ := database.DB.Queryx(topValQuery)
	var topByValue []gin.H
	if topValRows != nil {
		defer topValRows.Close()
		for topValRows.Next() {
			row := map[string]interface{}{}
			if topValRows.MapScan(row) == nil {
				middleware.CleanRow(row)
				if value, ok := row["value"].(float64); ok {
					row["value"] = round2(value)
				}
				topByValue = append(topByValue, gin.H(row))
			}
		}
	}
	if topByValue == nil {
		topByValue = []gin.H{}
	}

	topQtyQuery := fmt.Sprintf(
		`SELECT i.id, i.name, i.quantity,
			c.name AS category_name, c.color AS category_color,
			l.name AS location_name, l.color AS location_color
		FROM %s_items i
		LEFT JOIN %s_categories c ON i.category_id = c.id
		LEFT JOIN %s_locations l ON i.location_id = l.id
		ORDER BY i.quantity DESC LIMIT 5`, realm, realm, realm)
	topQtyRows, _ := database.DB.Queryx(topQtyQuery)
	var topByQuantity []gin.H
	if topQtyRows != nil {
		defer topQtyRows.Close()
		for topQtyRows.Next() {
			row := map[string]interface{}{}
			if topQtyRows.MapScan(row) == nil {
				middleware.CleanRow(row)
				topByQuantity = append(topByQuantity, gin.H(row))
			}
		}
	}
	if topByQuantity == nil {
		topByQuantity = []gin.H{}
	}

	catRows, _ := database.DB.Queryx(fmt.Sprintf(
		`SELECT c.id, c.name, COUNT(i.id) AS items, COALESCE(SUM(i.purchase_price * i.quantity), 0) AS value
		FROM %s_categories c LEFT JOIN %s_items i ON i.category_id = c.id
		GROUP BY c.id, c.name ORDER BY c.name`, realm, realm))
	var byCategory []gin.H
	if catRows != nil {
		defer catRows.Close()
		for catRows.Next() {
			var id, itemCount int
			var name string
			var value float64
			catRows.Scan(&id, &name, &itemCount, &value)
			byCategory = append(byCategory, gin.H{"id": id, "name": name, "items": itemCount, "value": round2(value)})
		}
	}
	if byCategory == nil {
		byCategory = []gin.H{}
	}
	totalValue = round2(totalValue)
	avgPrice = round2(avgPrice)

	return gin.H{
		"items":           items,
		"categories":      categories,
		"locations":       locations,
		"properties":      properties,
		"total_value":     totalValue,
		"total_quantity":  totalQty,
		"avg_price":       avgPrice,
		"recently_added":  recentlyAdded,
		"top_by_value":    topByValue,
		"top_by_quantity": topByQuantity,
		"by_category":     byCategory,
	}
}

func statsOverview(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"archive":    realmStats("archive"),
		"collection": realmStats("collection"),
	})
}

func statsInventory(c *gin.Context) {
	var warnings []gin.H

	for _, realm := range []string{"archive", "collection"} {
		rows, err := database.DB.Queryx(fmt.Sprintf(
			`SELECT id, name, quantity, minimum_quantity FROM %s_items
			WHERE is_consumable = 1 AND minimum_quantity IS NOT NULL AND quantity <= minimum_quantity`, realm))
		if err != nil {
			continue
		}
		defer rows.Close()
		for rows.Next() {
			var id, qty int
			var minQty *int
			var name string
			rows.Scan(&id, &name, &qty, &minQty)
			level := "low_stock"
			if qty == 0 {
				level = "out_of_stock"
			}
			w := gin.H{"realm": realm, "item_id": id, "name": name, "level": level, "quantity": qty}
			if level == "low_stock" && minQty != nil {
				w["minimum"] = *minQty
			}
			warnings = append(warnings, w)
		}
	}
	if warnings == nil {
		warnings = []gin.H{}
	}

	c.JSON(http.StatusOK, gin.H{"warnings": warnings})
}

func statsLocations(c *gin.Context) {
	var warnings []gin.H

	for _, realm := range []string{"archive", "collection"} {
		rows, err := database.DB.Queryx(fmt.Sprintf(
			`SELECT l.id, l.name, l.capacity, COALESCE(SUM(i.quantity), 0) AS used
			FROM %s_locations l
			LEFT JOIN %s_items i ON i.location_id = l.id
			WHERE l.capacity IS NOT NULL AND l.capacity > 0
			GROUP BY l.id, l.name, l.capacity`, realm, realm))
		if err != nil {
			continue
		}
		defer rows.Close()
		for rows.Next() {
			var id, capacity, used int
			var name string
			rows.Scan(&id, &name, &capacity, &used)
			if capacity == 0 {
				continue
			}
			pct := float64(used) / float64(capacity)
			if pct < 0.75 {
				continue
			}
			level := "warning"
			if pct >= 1.0 {
				level = "full"
			} else if pct >= 0.9 {
				level = "almost_full"
			}
			warnings = append(warnings, gin.H{
				"realm":       realm,
				"location_id": id,
				"name":        name,
				"level":       level,
				"used":        used,
				"capacity":    capacity,
			})
		}
	}
	if warnings == nil {
		warnings = []gin.H{}
	}

	c.JSON(http.StatusOK, gin.H{"warnings": warnings})
}

func statsMaintenance(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "12"))
	if limit <= 0 || limit > 50 {
		limit = 12
	}
	now := time.Now()
	today := middleware.StartOfLocalDay(now).Format("2006-01-02")
	alertDate := middleware.MaintenanceAlertDate(now).Format("2006-01-02")
	items := make([]map[string]interface{}, 0)
	history := make([]map[string]interface{}, 0)
	var dueCount, overdueCount int
	for _, realm := range []string{"archive", "collection"} {
		table := middleware.MaintenanceReminderTable(realm)
		query := fmt.Sprintf(`SELECT r.id, r.item_id, r.title, r.reminder_type, r.custom_type_label, r.due_date, r.repeat_interval, r.repeat_unit,
				r.status, r.notes, r.last_completed_at, r.completed_at, r.created_at, r.updated_at,
				i.name AS item_name,
				c.name AS category_name, c.color AS category_color,
				l.name AS location_name, l.color AS location_color
			FROM %s r
			JOIN %s_items i ON r.item_id = i.id
			LEFT JOIN %s_categories c ON i.category_id = c.id
			LEFT JOIN %s_locations l ON i.location_id = l.id
			WHERE r.status = 'open' AND r.due_date <= ?
			ORDER BY r.due_date ASC, r.id ASC
			LIMIT ?`, table, realm, realm, realm)
		rows, err := database.DB.Queryx(query, alertDate, limit)
		if err == nil {
			for rows.Next() {
				row := map[string]interface{}{}
				if rows.MapScan(row) == nil {
					middleware.CleanRow(row)
					row["realm"] = realm
					annotateMaintenanceReminder(row, now)
					items = append(items, row)
				}
			}
			_ = rows.Close()
		}
		historyQuery := fmt.Sprintf(`SELECT h.id, h.reminder_id, h.item_id, h.action, h.title, h.reminder_type, h.custom_type_label, h.due_date,
				h.notes, h.performed_by, h.performed_at, h.created_at,
				i.name AS item_name,
				c.name AS category_name, c.color AS category_color,
				l.name AS location_name, l.color AS location_color
			FROM %s h
			JOIN %s_items i ON h.item_id = i.id
			LEFT JOIN %s_categories c ON i.category_id = c.id
			LEFT JOIN %s_locations l ON i.location_id = l.id
			ORDER BY h.performed_at DESC, h.id DESC
			LIMIT ?`, middleware.MaintenanceHistoryTable(realm), realm, realm, realm)
		historyRows, err := database.DB.Queryx(historyQuery, limit)
		if err == nil {
			for historyRows.Next() {
				row := map[string]interface{}{}
				if historyRows.MapScan(row) == nil {
					middleware.CleanRow(row)
					row["realm"] = realm
					row["status"] = valueString(row["action"])
					history = append(history, row)
				}
			}
			_ = historyRows.Close()
		}
		var realmDue, realmOverdue int
		_ = database.DB.Get(&realmDue, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE status = 'open' AND due_date <= ?", table), alertDate)
		_ = database.DB.Get(&realmOverdue, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE status = 'open' AND due_date < ?", table), today)
		dueCount += realmDue
		overdueCount += realmOverdue
	}
	sort.Slice(items, func(i, j int) bool {
		left := valueString(items[i]["due_date"])
		right := valueString(items[j]["due_date"])
		if left == right {
			return middleware.AsInt(items[i]["id"]) < middleware.AsInt(items[j]["id"])
		}
		return left < right
	})
	if len(items) > limit {
		items = items[:limit]
	}
	sort.Slice(history, func(i, j int) bool {
		left := valueString(history[i]["performed_at"])
		right := valueString(history[j]["performed_at"])
		if left == right {
			return middleware.AsInt(history[i]["id"]) > middleware.AsInt(history[j]["id"])
		}
		return left > right
	})
	if len(history) > limit {
		history = history[:limit]
	}
	c.JSON(http.StatusOK, gin.H{
		"items":              items,
		"history":            history,
		"due":                dueCount,
		"overdue":            overdueCount,
		"reminder_lead_days": maintenanceReminderLeadDays(),
	})
}
