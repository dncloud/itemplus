package middleware

import (
	"encoding/json"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
)

const (
	maintenanceReminderLeadDaysSettingKey = "maintenance.reminder_lead_days"
	maxMaintenanceReminderLeadDays        = 365
)

func Audit(userID int, action string, details string) {
	if details != "" {
		log.Printf("[AUDIT] user=%d action=%s %s", userID, action, details)
	} else {
		log.Printf("[AUDIT] user=%d action=%s", userID, action)
	}
}

// jsonTextColumns are text columns that store serialized JSON and are handed
// to clients in parsed form.
var jsonTextColumns = map[string]bool{
	"options":            true,
	"permissions":        true,
	"component_item_ids": true,
	"value":              true,
}

// CleanRow turns the raw values of a scanned row into JSON-friendly ones:
// byte slices become strings, serialized JSON is parsed, and numbers that a
// driver delivered as text (MySQL does, for every column) become numbers.
//
// Text stays text. A column the schema declares as text is never converted,
// whatever it looks like: an item called "1942" or "007", a phone number, a
// description of "[1,2]". Only columns the schema does not know (aliases and
// computed values) and the mixed "value" column are still judged by content.
func CleanRow(row map[string]interface{}) {
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

		isText := database.IsTextColumn(k) || strings.HasSuffix(k, "_name")
		if isText && !jsonTextColumns[k] {
			row[k] = s
			continue
		}
		if len(s) > 0 && (s[0] == '{' || s[0] == '[') {
			var parsed interface{}
			if json.Unmarshal([]byte(s), &parsed) == nil {
				row[k] = parsed
				continue
			}
		}
		if isText && k != "value" {
			row[k] = s
			continue
		}
		if n, ok := ParseFiniteNumber(s); ok {
			if n == math.Trunc(n) && math.Abs(n) < 1e15 {
				row[k] = int64(n)
			} else {
				row[k] = n
			}
		} else {
			row[k] = s
		}
	}
}

// ParseFiniteNumber accepts what a database prints for a numeric value.
// strconv.ParseFloat alone also accepts "NaN", "Infinity" and hex floats,
// none of which can be encoded as JSON.
func ParseFiniteNumber(s string) (float64, bool) {
	if s == "" {
		return 0, false
	}
	for _, r := range s {
		if (r < '0' || r > '9') && r != '.' && r != '-' && r != '+' && r != 'e' && r != 'E' {
			return 0, false
		}
	}
	n, err := strconv.ParseFloat(s, 64)
	if err != nil || math.IsNaN(n) || math.IsInf(n, 0) {
		return 0, false
	}
	return n, true
}

func StringValue(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func InClausePlaceholders(ids []interface{}) string {
	if len(ids) == 0 {
		return ""
	}
	return strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
}

func MaintenanceReminderTable(realm string) string {
	return realm + "_maintenance_reminders"
}

func MaintenanceHistoryTable(realm string) string {
	return realm + "_maintenance_history"
}

func MaintenanceAlertDate(now time.Time) time.Time {
	return StartOfLocalDay(now).AddDate(0, 0, maintenanceReminderLeadDays())
}

func StartOfLocalDay(t time.Time) time.Time {
	local := t.Local()
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, local.Location())
}

func AsInt(v interface{}) int {
	switch n := v.(type) {
	case int:
		return n
	case int64:
		return int(n)
	case float64:
		return int(n)
	default:
		return 0
	}
}

func AsInt64(v interface{}) int64 {
	switch n := v.(type) {
	case int:
		return int64(n)
	case int64:
		return n
	case float64:
		return int64(n)
	default:
		return 0
	}
}

func maintenanceReminderLeadDays() int {
	var raw string
	if err := database.DB.Get(&raw, "SELECT value FROM app_settings WHERE `key` = ?", maintenanceReminderLeadDaysSettingKey); err != nil {
		return 0
	}
	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return 0
	}
	if value < 0 {
		return 0
	}
	if value > maxMaintenanceReminderLeadDays {
		return maxMaintenanceReminderLeadDays
	}
	return value
}

// NumericParams rejects requests whose named path parameters are present but
// not plain numbers. Record ids end up in SQL comparisons and in folder
// names; MySQL would silently read "5abc" as 5, and a folder would be created
// under the literal text.
func NumericParams(names ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		for _, name := range names {
			value := c.Param(name)
			if value == "" {
				continue
			}
			if len(value) > 18 {
				c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"detail": "Not found"})
				return
			}
			for _, r := range value {
				if r < '0' || r > '9' {
					c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"detail": "Not found"})
					return
				}
			}
		}
		c.Next()
	}
}
