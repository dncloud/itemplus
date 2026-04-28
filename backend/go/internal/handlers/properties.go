package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
)

func RegisterPropertyRoutes(g *gin.RouterGroup, realm string) {
	table := realm + "_properties"

	g.GET("", middleware.Auth(), middleware.RequireAllPermissions("categories.read", "items.read"), listProperties(table))
	g.POST("", middleware.Auth(), middleware.RequirePermission("categories.write"), createProperty(table))
	g.PUT("/:id", middleware.Auth(), middleware.RequirePermission("categories.write"), updateProperty(table))
	g.DELETE("/:id", middleware.Auth(), middleware.RequirePermission("categories.delete"), deleteProperty(table))
}

func listProperties(table string) gin.HandlerFunc {
	return func(c *gin.Context) {
		categoryID := c.Query("category_id")
		query := fmt.Sprintf("SELECT * FROM %s", table)
		var args []interface{}

		if categoryID != "" {
			query += " WHERE category_id = ?"
			args = append(args, categoryID)
		}
		query += " ORDER BY position, id"

		rows, err := database.DB.Queryx(query, args...)
		if err != nil {
			log.Printf("DB query error in listProperties: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		defer rows.Close()

		var result []map[string]interface{}
		for rows.Next() {
			row := map[string]interface{}{}
			if rows.MapScan(row) == nil {
				cleanRow(row)
				result = append(result, row)
			}
		}
		if result == nil {
			result = []map[string]interface{}{}
		}
		c.JSON(http.StatusOK, result)
	}
}

func createProperty(table string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			CategoryID   int              `json:"category_id" binding:"required"`
			Name         string           `json:"name" binding:"required"`
			PropertyType string           `json:"property_type"`
			Type         string           `json:"type"` // alias — iOS sends "type"
			Unit         *string          `json:"unit"`
			Options      *json.RawMessage `json:"options"`
			Required     *bool            `json:"required"`
			ShowInList   *bool            `json:"show_in_list"`
			DisplayWidth *string          `json:"display_width"`
			Position     *int             `json:"position"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
			return
		}

		// Resolve property_type: property_type > type > "text"
		propType := body.PropertyType
		if propType == "" {
			propType = body.Type
		}
		if propType == "" {
			propType = "text"
		}

		now := time.Now().UTC().Format(time.RFC3339)
		options := "{}"
		if body.Options != nil {
			options = string(*body.Options)
		}

		displayWidth := "third"
		if body.DisplayWidth != nil {
			displayWidth = *body.DisplayWidth
		}
		required := false
		if body.Required != nil {
			required = *body.Required
		}
		showInList := false
		if body.ShowInList != nil {
			showInList = *body.ShowInList
		}
		position := 0
		if body.Position != nil {
			position = *body.Position
		}

		result, err := database.DB.Exec(
			fmt.Sprintf(`INSERT INTO %s (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
				VALUES (?,?,?,?,?,?,?,?,?,?,?)`, table),
			body.CategoryID, body.Name, propType, body.Unit, options,
			required, showInList, displayWidth, position, now, now,
		)
		if err != nil {
			log.Printf("DB insert error in createProperty: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}

		newID, _ := result.LastInsertId()
		row := map[string]interface{}{}
		sqlRow := database.DB.QueryRowx(fmt.Sprintf("SELECT * FROM %s WHERE id = ?", table), newID)
		if sqlRow.MapScan(row) == nil {
			cleanRow(row)
		}
		c.JSON(http.StatusCreated, row)
	}
}

func updateProperty(table string) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		body := map[string]interface{}{}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
			return
		}

		delete(body, "id")

		// Resolve property_type: property_type > type
		if _, has := body["type"]; has {
			if _, hasPT := body["property_type"]; !hasPT {
				body["property_type"] = body["type"]
			}
			delete(body, "type")
		}

		// Serialize options to JSON string for storage
		if opts, has := body["options"]; has && opts != nil {
			switch v := opts.(type) {
			case string:
				// Already a JSON string — store as-is
				body["options"] = v
			case map[string]interface{}, []interface{}:
				if b, err := json.Marshal(v); err == nil {
					body["options"] = string(b)
				}
			default:
				if b, err := json.Marshal(v); err == nil {
					body["options"] = string(b)
				}
			}
		}

		body["updated_at"] = time.Now().UTC().Format(time.RFC3339)

		sets, vals := buildUpdate(body)
		vals = append(vals, id)
		_, err := database.DB.Exec(fmt.Sprintf("UPDATE %s SET %s WHERE id = ?", table, sets), vals...)
		if err != nil {
			log.Printf("DB update error in updateProperty: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}

		row := map[string]interface{}{}
		sqlRow := database.DB.QueryRowx(fmt.Sprintf("SELECT * FROM %s WHERE id = ?", table), id)
		_ = sqlRow.MapScan(row)
		cleanRow(row)
		c.JSON(http.StatusOK, row)
	}
}

func deleteProperty(table string) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		result, err := database.DB.Exec(fmt.Sprintf("DELETE FROM %s WHERE id = ?", table), id)
		if err != nil {
			log.Printf("DB delete error in deleteProperty: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		affected, _ := result.RowsAffected()
		if affected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Not found"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}
