package middleware

import (
	"encoding/json"
	"log"
	"strconv"
	"strings"
	"time"

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
		if len(s) > 0 && (s[0] == '{' || s[0] == '[') {
			var parsed interface{}
			if json.Unmarshal([]byte(s), &parsed) == nil {
				row[k] = parsed
				continue
			}
		}
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
