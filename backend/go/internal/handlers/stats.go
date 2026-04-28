package handlers

import (
	"fmt"
	"math"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
)

func RegisterStatsRoutes(api *gin.RouterGroup) {
	stats := api.Group("/stats", middleware.Auth())
	stats.GET("/overview", statsOverview)
	stats.GET("/inventory", statsInventory)
	stats.GET("/locations", statsLocations)
}

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

	// Recently active (added or updated)
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
				cleanRow(row)
				recentlyAdded = append(recentlyAdded, gin.H(row))
			}
		}
	}
	if recentlyAdded == nil {
		recentlyAdded = []gin.H{}
	}

	// Top by value
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
				cleanRow(row)
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

	// Top by quantity
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
				cleanRow(row)
				topByQuantity = append(topByQuantity, gin.H(row))
			}
		}
	}
	if topByQuantity == nil {
		topByQuantity = []gin.H{}
	}

	// By category
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
