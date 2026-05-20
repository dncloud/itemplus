package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
)

// RegisterCRUD creates standard List/Get/Create/Update/Delete routes for a realm table.
func RegisterCRUD(group *gin.RouterGroup, table string, readPerm, writePerm, deletePerm string) {
	// LIST
	group.GET("", middleware.Auth(), middleware.RequirePermission(readPerm, "items.read"), func(c *gin.Context) {
		search := c.Query("search")
		rows := []map[string]interface{}{}

		query := fmt.Sprintf("SELECT * FROM %s", table)
		var args []interface{}
		if search != "" {
			query += " WHERE name LIKE ?"
			args = append(args, "%"+search+"%")
		}
		query += " ORDER BY " + defaultListOrder(table)

		sqlRows, err := database.DB.Queryx(query, args...)
		if err != nil {
			log.Printf("DB query error in LIST %s: %v", table, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		defer sqlRows.Close()

		for sqlRows.Next() {
			row := map[string]interface{}{}
			if err := sqlRows.MapScan(row); err == nil {
				cleanRow(row)
				rows = append(rows, row)
			}
		}
		c.JSON(http.StatusOK, rows)
	})

	// GET ONE
	group.GET("/:id", middleware.Auth(), middleware.RequirePermission(readPerm, "items.read"), func(c *gin.Context) {
		id := c.Param("id")
		row := map[string]interface{}{}

		sqlRow := database.DB.QueryRowx(fmt.Sprintf("SELECT * FROM %s WHERE id = ?", table), id)
		if err := sqlRow.MapScan(row); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Not found"})
			return
		}
		cleanRow(row)
		c.JSON(http.StatusOK, row)
	})

	// CREATE
	group.POST("", middleware.Auth(), middleware.RequirePermission(writePerm), func(c *gin.Context) {
		body := map[string]interface{}{}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
			return
		}
		var err error
		body, err = sanitizeCRUDPayload(table, body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
			return
		}
		if endsWithAny(table, "_locations") {
			if err := validateLocationHierarchy(table, 0, body, false); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
				return
			}
		}
		body["created_at"] = database.TimestampNow()
		body["updated_at"] = body["created_at"]

		cols, vals, placeholders, err := buildInsert(body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid field name"})
			return
		}
		query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", table, cols, placeholders)
		result, err := database.DB.Exec(query, vals...)
		if err != nil {
			log.Printf("DB insert error in CREATE %s: %v", table, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}

		newID, _ := result.LastInsertId()
		row := map[string]interface{}{}
		sqlRow := database.DB.QueryRowx(fmt.Sprintf("SELECT * FROM %s WHERE id = ?", table), newID)
		if err := sqlRow.MapScan(row); err != nil {
			log.Printf("DB read error in CREATE %s: %v", table, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		cleanRow(row)
		c.JSON(http.StatusCreated, row)
	})

	// UPDATE
	group.PUT("/:id", middleware.Auth(), middleware.RequirePermission(writePerm), func(c *gin.Context) {
		id := c.Param("id")
		body := map[string]interface{}{}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
			return
		}
		var err error
		body, err = sanitizeCRUDPayload(table, body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
			return
		}
		if endsWithAny(table, "_locations") {
			locationID, err := strconv.ParseInt(id, 10, 64)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid id"})
				return
			}
			if err := validateLocationHierarchy(table, locationID, body, true); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
				return
			}
		}
		body["updated_at"] = database.TimestampNow()

		sets, vals, err := buildUpdate(body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid field name"})
			return
		}
		vals = append(vals, id)
		query := fmt.Sprintf("UPDATE %s SET %s WHERE id = ?", table, sets)
		result, err := database.DB.Exec(query, vals...)
		if err != nil {
			log.Printf("DB update error in UPDATE %s: %v", table, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		affected, _ := result.RowsAffected()
		if affected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Not found"})
			return
		}

		// Return updated row
		row := map[string]interface{}{}
		sqlRow := database.DB.QueryRowx(fmt.Sprintf("SELECT * FROM %s WHERE id = ?", table), id)
		if err := sqlRow.MapScan(row); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Not found"})
			return
		}
		cleanRow(row)
		c.JSON(http.StatusOK, row)
	})

	// DELETE
	group.DELETE("/:id", middleware.Auth(), middleware.RequirePermission(deletePerm), func(c *gin.Context) {
		id := c.Param("id")
		result, err := database.DB.Exec(fmt.Sprintf("DELETE FROM %s WHERE id = ?", table), id)
		if err != nil {
			log.Printf("DB delete error in DELETE %s: %v", table, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		affected, _ := result.RowsAffected()
		if affected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Not found"})
			return
		}
		c.Status(http.StatusNoContent)
	})
}

func sanitizeCRUDPayload(table string, body map[string]interface{}) (map[string]interface{}, error) {
	allowed := writableCRUDFields(table)
	if len(allowed) == 0 {
		return nil, fmt.Errorf("Unsupported table")
	}

	clean := make(map[string]interface{}, len(body))
	for key, value := range body {
		if isReadOnlyPayloadField(key) {
			continue
		}
		if !allowed[key] {
			return nil, fmt.Errorf("Invalid field: %s", key)
		}
		clean[key] = normalizeCRUDValue(key, value)
	}
	return clean, nil
}

func writableCRUDFields(table string) map[string]bool {
	switch {
	case endsWithAny(table, "_categories"):
		return fieldSet("name", "description", "color", "position")
	case endsWithAny(table, "_locations"):
		return fieldSet("name", "description", "color", "parent_id", "manager_id", "image", "capacity", "position")
	case endsWithAny(table, "_manufacturers"):
		return fieldSet("name", "logo", "website", "email", "phone", "address", "support_email", "support_phone", "support_url")
	case endsWithAny(table, "_suppliers"):
		return fieldSet("name", "logo", "website", "email", "phone", "address", "contact_person", "account_manager")
	case endsWithAny(table, "_vendors"):
		return fieldSet("name", "logo", "website", "email", "phone", "address", "contact_person", "customer_number")
	case table == "generic_sales_platforms":
		return fieldSet("name", "logo", "website", "email", "phone", "address", "contact_person", "customer_number")
	default:
		return nil
	}
}

func fieldSet(fields ...string) map[string]bool {
	result := make(map[string]bool, len(fields))
	for _, field := range fields {
		result[field] = true
	}
	return result
}

func isReadOnlyPayloadField(key string) bool {
	return key == "id" || key == "created_at" || key == "updated_at"
}

func normalizeCRUDValue(key string, value interface{}) interface{} {
	if key != "address" || value == nil {
		return value
	}
	switch typed := value.(type) {
	case string:
		return typed
	case map[string]interface{}, []interface{}:
		if encoded, err := json.Marshal(typed); err == nil {
			return string(encoded)
		}
	}
	return value
}

func defaultListOrder(table string) string {
	switch {
	case endsWithAny(table, "_categories", "_locations"):
		return "position, id"
	case endsWithAny(table, "_manufacturers", "_suppliers", "_vendors"):
		return "name, id"
	case table == "generic_sales_platforms":
		return "name, id"
	default:
		return "id"
	}
}

func endsWithAny(s string, suffixes ...string) bool {
	for _, suffix := range suffixes {
		if len(s) >= len(suffix) && s[len(s)-len(suffix):] == suffix {
			return true
		}
	}
	return false
}

func validateLocationHierarchy(table string, currentID int64, body map[string]interface{}, isUpdate bool) error {
	rawParent, exists := body["parent_id"]
	if !exists {
		return nil
	}

	parentID, hasParent, err := parseNullableInt64(rawParent)
	if err != nil {
		return fmt.Errorf("invalid parent_id")
	}
	if !hasParent {
		return nil
	}
	if isUpdate && parentID == currentID {
		return fmt.Errorf("location cannot be its own parent")
	}

	var checkID int64
	if err := database.DB.Get(&checkID, fmt.Sprintf("SELECT id FROM %s WHERE id = ?", table), parentID); err != nil {
		return fmt.Errorf("selected parent location does not exist")
	}

	visited := map[int64]bool{}
	current := parentID
	for current != 0 {
		if isUpdate && current == currentID {
			return fmt.Errorf("circular location hierarchy detected")
		}
		if visited[current] {
			return fmt.Errorf("circular location hierarchy detected")
		}
		visited[current] = true

		var row struct {
			ParentID *int64 `db:"parent_id"`
		}
		err := database.DB.Get(&row, fmt.Sprintf("SELECT parent_id FROM %s WHERE id = ?", table), current)
		if err != nil || row.ParentID == nil {
			break
		}
		current = *row.ParentID
	}

	return nil
}

func parseNullableInt64(v interface{}) (int64, bool, error) {
	switch val := v.(type) {
	case nil:
		return 0, false, nil
	case int:
		return int64(val), true, nil
	case int64:
		return val, true, nil
	case float64:
		return int64(val), true, nil
	case string:
		trimmed := strings.TrimSpace(val)
		if trimmed == "" {
			return 0, false, nil
		}
		parsed, err := strconv.ParseInt(trimmed, 10, 64)
		if err != nil {
			return 0, false, err
		}
		return parsed, true, nil
	default:
		return 0, false, fmt.Errorf("unsupported type")
	}
}

var sqlIdentifierPattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

func quoteSQLIdentifier(name string) (string, error) {
	if !sqlIdentifierPattern.MatchString(name) {
		return "", fmt.Errorf("invalid SQL identifier")
	}
	return "`" + name + "`", nil
}

func sortedKeys(data map[string]interface{}) []string {
	keys := make([]string, 0, len(data))
	for key := range data {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// Build INSERT parts from request data. Field names are checked and quoted here;
// values still go through SQL placeholders, so user input never becomes SQL text.
func buildInsert(data map[string]interface{}) (string, []interface{}, string, error) {
	cols := make([]string, 0, len(data))
	placeholders := make([]string, 0, len(data))
	vals := make([]interface{}, 0, len(data))
	for _, key := range sortedKeys(data) {
		quoted, err := quoteSQLIdentifier(key)
		if err != nil {
			return "", nil, "", err
		}
		cols = append(cols, quoted)
		placeholders = append(placeholders, "?")
		vals = append(vals, data[key])
	}
	return strings.Join(cols, ", "), vals, strings.Join(placeholders, ", "), nil
}

// Build an UPDATE clause in a stable order. Stable SQL is easier to read in logs
// and avoids needless query churn while keeping the same placeholder protection.
func buildUpdate(data map[string]interface{}) (string, []interface{}, error) {
	sets := make([]string, 0, len(data))
	vals := make([]interface{}, 0, len(data))
	for _, key := range sortedKeys(data) {
		quoted, err := quoteSQLIdentifier(key)
		if err != nil {
			return "", nil, err
		}
		sets = append(sets, quoted+" = ?")
		vals = append(vals, data[key])
	}
	return strings.Join(sets, ", "), vals, nil
}

// Helper: normalize SQLite row values for JSON serialization.
// SQLite drivers may return []byte or string for TEXT columns.
func cleanRow(row map[string]interface{}) {
	for k, v := range row {
		var s string
		switch val := v.(type) {
		case []byte:
			s = string(val)
		case string:
			s = val
		default:
			continue
		}
		// Try JSON object/array first
		if len(s) > 0 && (s[0] == '{' || s[0] == '[') {
			var parsed interface{}
			if json.Unmarshal([]byte(s), &parsed) == nil {
				row[k] = parsed
				continue
			}
		}
		// Try number
		if n, err := strconv.ParseFloat(s, 64); err == nil {
			if n == float64(int64(n)) {
				row[k] = int64(n)
			} else {
				row[k] = n
			}
		} else {
			row[k] = s
		}
	}
}

// parseJSONValue tries to parse a string as JSON, returns the parsed value or the original string.
// Handles double-encoded JSON (e.g. "\"[\\\"A\\\"]\"" → ["A"]).
func parseJSONValue(v interface{}) interface{} {
	s, ok := v.(string)
	if !ok {
		return v
	}
	// Try JSON object/array/string
	if len(s) > 0 && (s[0] == '{' || s[0] == '[' || s[0] == '"') {
		var parsed interface{}
		if json.Unmarshal([]byte(s), &parsed) == nil {
			// If result is still a string, try parsing again (double-encoded)
			if inner, isStr := parsed.(string); isStr && len(inner) > 0 && (inner[0] == '{' || inner[0] == '[') {
				var inner2 interface{}
				if json.Unmarshal([]byte(inner), &inner2) == nil {
					return inner2
				}
			}
			return parsed
		}
	}
	// Try number
	if n, err := strconv.ParseFloat(s, 64); err == nil {
		if n == float64(int64(n)) {
			return int64(n)
		}
		return n
	}
	// Try bool
	if s == "true" {
		return true
	}
	if s == "false" {
		return false
	}
	return s
}
