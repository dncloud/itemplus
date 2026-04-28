package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
)

func RegisterAdminRoutes(g *gin.RouterGroup) {
	g.Use(middleware.Auth(), middleware.RequireAdmin())

	g.GET("/export", adminExport)
	g.POST("/import", adminImport)
	g.POST("/wipe", adminWipe)
	g.GET("/health/locations", adminHealthLocations)
	g.POST("/health/locations/fix", adminFixLocations)
	g.PUT("/branding", adminUpdateBranding)
	g.DELETE("/branding", adminResetBranding)
}

func requireImportConfirm(wipeFirst bool, confirm string) bool {
	return !wipeFirst || confirm == "IMPORT"
}

func adminExport(c *gin.Context) {
	export := gin.H{}

	// Export users
	var users []map[string]interface{}
	userRows, err := database.DB.Queryx("SELECT * FROM users")
	if err == nil {
		defer userRows.Close()
		for userRows.Next() {
			row := map[string]interface{}{}
			if userRows.MapScan(row) == nil {
				cleanRow(row)
				users = append(users, row)
			}
		}
	}
	export["users"] = users

	// Export app settings
	var appSettings []map[string]interface{}
	settingsRows, err := database.DB.Queryx("SELECT * FROM app_settings")
	if err == nil {
		defer settingsRows.Close()
		for settingsRows.Next() {
			row := map[string]interface{}{}
			if settingsRows.MapScan(row) == nil {
				cleanRow(row)
				appSettings = append(appSettings, row)
			}
		}
	}
	if appSettings == nil {
		appSettings = []map[string]interface{}{}
	}
	export["app_settings"] = appSettings

	// Export realm data
	for _, realm := range []string{"archive", "collection"} {
		realmData := gin.H{}

		for _, entity := range []string{"categories", "locations", "items", "properties", "item_properties", "attachments", "checkouts", "manufacturers", "suppliers", "vendors"} {
			table := realm + "_" + entity
			var rows []map[string]interface{}
			sqlRows, err := database.DB.Queryx(fmt.Sprintf("SELECT * FROM %s", table))
			if err == nil {
				defer sqlRows.Close()
				for sqlRows.Next() {
					row := map[string]interface{}{}
					if sqlRows.MapScan(row) == nil {
						cleanRow(row)
						rows = append(rows, row)
					}
				}
			}
			if rows == nil {
				rows = []map[string]interface{}{}
			}
			realmData[entity] = rows
		}

		export[realm] = realmData
	}

	c.JSON(http.StatusOK, export)
}

func adminImport(c *gin.Context) {
	var body struct {
		Data      map[string]json.RawMessage `json:"data"`
		WipeFirst *bool                      `json:"wipe_first"`
		Confirm   string                     `json:"confirm"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid JSON body"})
		return
	}

	wipeFirst := true
	if body.WipeFirst != nil {
		wipeFirst = *body.WipeFirst
	}

	tx, err := database.DB.Beginx()
	if err != nil {
		log.Printf("DB transaction error in adminImport: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	defer tx.Rollback()

	// Wipe existing data (but keep users) in reverse dependency order
	if wipeFirst {
		if !requireImportConfirm(wipeFirst, body.Confirm) {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Must confirm destructive import with 'IMPORT'"})
			return
		}
		for _, realm := range []string{"archive", "collection"} {
			for _, entity := range []string{"item_properties", "attachments", "checkouts", "items", "properties", "locations", "categories", "manufacturers", "suppliers", "vendors"} {
				tx.Exec(fmt.Sprintf("DELETE FROM %s_%s", realm, entity))
			}
		}
	}

	counts := map[string]int{}

	// Import realm data in FK-safe order
	for _, realm := range []string{"archive", "collection"} {
		rawRealm, ok := body.Data[realm]
		if !ok {
			continue
		}

		var realmData map[string][]map[string]interface{}
		if err := json.Unmarshal(rawRealm, &realmData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": fmt.Sprintf("Invalid data for realm %s", realm)})
			return
		}

		importOrder := []string{
			"categories", "locations", "manufacturers", "suppliers", "vendors",
			"properties", "items", "item_properties", "attachments", "checkouts",
		}

		for _, entity := range importOrder {
			rows, ok := realmData[entity]
			if !ok {
				continue
			}

			table := realm + "_" + entity
			for _, row := range rows {
				// Build INSERT from row keys/values, skipping nil values
				columns := []string{}
				placeholders := []string{}
				values := []interface{}{}
				for k, v := range row {
					if v == nil {
						continue
					}
					columns = append(columns, k)
					placeholders = append(placeholders, "?")
					values = append(values, v)
				}
				if len(columns) == 0 {
					continue
				}
				query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)",
					table, strings.Join(columns, ", "), strings.Join(placeholders, ", "))
				if _, err := tx.Exec(query, values...); err != nil {
					log.Printf("DB import error in %s: %v", table, err)
					c.JSON(http.StatusInternalServerError, gin.H{
						"detail": fmt.Sprintf("Failed to import %s row", table),
					})
					return
				}
			}
			counts[realm+"."+entity] = len(rows)
		}
	}

	// Import users if present
	if rawSettings, ok := body.Data["app_settings"]; ok {
		var settings []map[string]interface{}
		if err := json.Unmarshal(rawSettings, &settings); err == nil {
			tx.Exec("DELETE FROM app_settings")
			for _, row := range settings {
				columns := []string{}
				placeholders := []string{}
				values := []interface{}{}
				for k, v := range row {
					if v == nil {
						continue
					}
					columns = append(columns, k)
					placeholders = append(placeholders, "?")
					values = append(values, v)
				}
				if len(columns) == 0 {
					continue
				}
				query := fmt.Sprintf("INSERT INTO app_settings (%s) VALUES (%s)",
					strings.Join(columns, ", "), strings.Join(placeholders, ", "))
				tx.Exec(query, values...)
			}
			counts["app_settings"] = len(settings)
		}
	}

	// Import users if present
	if rawUsers, ok := body.Data["users"]; ok {
		var users []map[string]interface{}
		if err := json.Unmarshal(rawUsers, &users); err == nil {
			for _, row := range users {
				columns := []string{}
				placeholders := []string{}
				values := []interface{}{}
				for k, v := range row {
					if v == nil {
						continue
					}
					columns = append(columns, k)
					placeholders = append(placeholders, "?")
					values = append(values, v)
				}
				if len(columns) == 0 {
					continue
				}
				query := fmt.Sprintf("INSERT OR IGNORE INTO users (%s) VALUES (%s)",
					strings.Join(columns, ", "), strings.Join(placeholders, ", "))
				tx.Exec(query, values...)
			}
			counts["users"] = len(users)
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("DB commit error in adminImport: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	user := middleware.GetUser(c)
	audit(user.ID, "database.import", fmt.Sprintf("wipe_first=%v counts=%v", wipeFirst, counts))
	c.JSON(http.StatusOK, gin.H{"status": "ok", "imported": counts})
}

func adminWipe(c *gin.Context) {
	var body struct {
		Realm   *string `json:"realm"`
		Confirm string  `json:"confirm"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	if body.Confirm != "WIPE" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Must confirm with 'WIPE'"})
		return
	}

	realms := []string{"archive", "collection"}
	if body.Realm != nil {
		if *body.Realm != "archive" && *body.Realm != "collection" {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid realm"})
			return
		}
		realms = []string{*body.Realm}
	}

	for _, realm := range realms {
		for _, entity := range []string{"item_properties", "attachments", "checkouts", "items", "properties", "locations", "categories", "manufacturers", "suppliers", "vendors"} {
			table := realm + "_" + entity
			database.DB.Exec(fmt.Sprintf("DELETE FROM %s", table))
		}
	}

	user := middleware.GetUser(c)
	audit(user.ID, "database.wipe", fmt.Sprintf("realms=%v", realms))
	c.JSON(http.StatusOK, gin.H{"status": "wiped", "realms": realms})
}

func adminHealthLocations(c *gin.Context) {
	issues := []gin.H{}
	totalChecked := 0

	for _, realm := range []string{"archive", "collection"} {
		// Load all locations into a map for parent-chain walking
		type loc struct {
			ID       int64  `db:"id"`
			Name     string `db:"name"`
			ParentID *int64 `db:"parent_id"`
		}

		var locations []loc
		err := database.DB.Select(&locations, fmt.Sprintf(
			"SELECT id, name, parent_id FROM %s_locations", realm))
		if err != nil {
			continue
		}
		totalChecked += len(locations)

		locMap := map[int64]*loc{}
		for i := range locations {
			locMap[locations[i].ID] = &locations[i]
		}

		for _, l := range locations {
			if l.ParentID == nil {
				continue
			}

			// Self-parenting
			if *l.ParentID == l.ID {
				issues = append(issues, gin.H{
					"realm": realm,
					"id":    l.ID,
					"name":  l.Name,
					"type":  "self_parent",
				})
				continue
			}

			// Deep cycle detection — walk the parent chain
			visited := map[int64]bool{}
			current := l.ParentID
			for current != nil {
				if *current == l.ID {
					issues = append(issues, gin.H{
						"realm": realm,
						"id":    l.ID,
						"name":  l.Name,
						"type":  "cycle",
					})
					break
				}
				if visited[*current] {
					break
				}
				visited[*current] = true
				parent, ok := locMap[*current]
				if !ok {
					break
				}
				current = parent.ParentID
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"issues":        issues,
		"total_checked": totalChecked,
	})
}

func adminFixLocations(c *gin.Context) {
	fixed := 0

	for _, realm := range []string{"archive", "collection"} {
		// Load all locations for cycle detection
		type loc struct {
			ID       int64  `db:"id"`
			ParentID *int64 `db:"parent_id"`
		}

		var locations []loc
		err := database.DB.Select(&locations, fmt.Sprintf(
			"SELECT id, parent_id FROM %s_locations", realm))
		if err != nil {
			continue
		}

		locMap := map[int64]*loc{}
		for i := range locations {
			locMap[locations[i].ID] = &locations[i]
		}

		// Detect and fix all cycles (self-parent and deep cycles)
		var toFix []int64
		for _, l := range locations {
			if l.ParentID == nil {
				continue
			}

			shouldFix := false

			// Self-parenting
			if *l.ParentID == l.ID {
				shouldFix = true
			} else {
				// Deep cycle detection
				visited := map[int64]bool{}
				current := l.ParentID
				for current != nil {
					if *current == l.ID {
						shouldFix = true
						break
					}
					if visited[*current] {
						break
					}
					visited[*current] = true
					parent, ok := locMap[*current]
					if !ok {
						break
					}
					current = parent.ParentID
				}
			}

			if shouldFix {
				toFix = append(toFix, l.ID)
			}
		}

		// Apply fixes
		for _, id := range toFix {
			result, err := database.DB.Exec(fmt.Sprintf(
				"UPDATE %s_locations SET parent_id = NULL WHERE id = ?", realm), id)
			if err == nil {
				affected, _ := result.RowsAffected()
				fixed += int(affected)
			}
			// Update in-memory map so subsequent checks use fixed state
			if entry, ok := locMap[id]; ok {
				entry.ParentID = nil
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"fixed": fixed})
}

func mapKeys(m map[string]json.RawMessage) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
