package maintenance

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/itemplus/backend/internal/database"
)

type ReminderPayload struct {
	Title           string `json:"title"`
	ReminderType    string `json:"reminder_type"`
	CustomTypeLabel string `json:"custom_type_label"`
	DueDate         string `json:"due_date"`
	RepeatInterval  *int   `json:"repeat_interval"`
	RepeatUnit      string `json:"repeat_unit"`
	Status          string `json:"status"`
	Notes           string `json:"notes"`
}

func ReminderTable(realm string) string {
	return realm + "_maintenance_reminders"
}

func HistoryTable(realm string) string {
	return realm + "_maintenance_history"
}

func NormalizeReminderPayload(payload ReminderPayload, create bool) (ReminderPayload, error) {
	payload.Title = strings.TrimSpace(payload.Title)
	if payload.Title == "" {
		return payload, fmt.Errorf("Title is required")
	}
	payload.ReminderType = strings.TrimSpace(payload.ReminderType)
	if payload.ReminderType == "" {
		payload.ReminderType = "maintenance"
	}
	if !IsAllowedMaintenanceType(payload.ReminderType) {
		return payload, fmt.Errorf("Invalid reminder type")
	}
	payload.CustomTypeLabel = strings.TrimSpace(payload.CustomTypeLabel)
	if payload.ReminderType != "custom" {
		payload.CustomTypeLabel = ""
	}
	payload.DueDate = strings.TrimSpace(payload.DueDate)
	if payload.DueDate == "" {
		return payload, fmt.Errorf("Due date is required")
	}
	if _, err := ParseReminderDate(payload.DueDate); err != nil {
		return payload, fmt.Errorf("Invalid due date")
	}
	if payload.RepeatInterval != nil && *payload.RepeatInterval <= 0 {
		payload.RepeatInterval = nil
	}
	payload.RepeatUnit = strings.TrimSpace(payload.RepeatUnit)
	if payload.RepeatInterval == nil {
		payload.RepeatUnit = ""
	} else if !IsAllowedRepeatUnit(payload.RepeatUnit) {
		return payload, fmt.Errorf("Invalid repeat unit")
	}
	payload.Status = strings.TrimSpace(payload.Status)
	if payload.Status == "" || create {
		payload.Status = "open"
	}
	if !IsAllowedMaintenanceStatus(payload.Status) {
		return payload, fmt.Errorf("Invalid status")
	}
	payload.Notes = strings.TrimSpace(payload.Notes)
	return payload, nil
}

func LoadReminder(realm, itemID, reminderID string) (map[string]interface{}, error) {
	row := map[string]interface{}{}
	err := database.DB.QueryRowx(
		fmt.Sprintf(`SELECT r.*, COALESCE(u.display_name, u.email) AS created_by_name
			FROM %s r
			LEFT JOIN users u ON r.created_by = u.id
			WHERE r.id = ? AND r.item_id = ?`, ReminderTable(realm)),
		reminderID, itemID,
	).MapScan(row)
	if err != nil {
		return nil, err
	}
	cleanRow(row)
	AnnotateReminder(row, time.Now())
	return row, nil
}

func LoadItemReminders(realm, itemID string, includeDone bool) []map[string]interface{} {
	where := "WHERE r.item_id = ?"
	if !includeDone {
		where += " AND r.status = 'open'"
	}
	query := fmt.Sprintf(`SELECT r.*, COALESCE(u.display_name, u.email) AS created_by_name
		FROM %s r
		LEFT JOIN users u ON r.created_by = u.id
		%s
		ORDER BY CASE WHEN r.status = 'open' THEN 0 ELSE 1 END, r.due_date ASC, r.id ASC`, ReminderTable(realm), where)
	rows, err := database.DB.Queryx(query, itemID)
	if err != nil {
		return []map[string]interface{}{}
	}
	defer rows.Close()
	result := make([]map[string]interface{}, 0)
	now := time.Now()
	for rows.Next() {
		row := map[string]interface{}{}
		if rows.MapScan(row) == nil {
			cleanRow(row)
			AnnotateReminder(row, now)
			result = append(result, row)
		}
	}
	return result
}

func LoadItemHistory(realm, itemID string, limit int) []map[string]interface{} {
	if limit <= 0 {
		limit = 20
	}
	query := fmt.Sprintf(`SELECT h.*, COALESCE(u.display_name, u.email) AS performed_by_name
		FROM %s h
		LEFT JOIN users u ON h.performed_by = u.id
		WHERE h.item_id = ?
		ORDER BY h.performed_at DESC, h.id DESC
		LIMIT ?`, HistoryTable(realm))
	rows, err := database.DB.Queryx(query, itemID, limit)
	if err != nil {
		return []map[string]interface{}{}
	}
	defer rows.Close()
	result := make([]map[string]interface{}, 0)
	for rows.Next() {
		row := map[string]interface{}{}
		if rows.MapScan(row) == nil {
			cleanRow(row)
			result = append(result, row)
		}
	}
	return result
}

func AnnotateReminder(row map[string]interface{}, now time.Time) {
	if ValueString(row["status"]) != "open" {
		row["is_due"] = false
		row["is_overdue"] = false
		return
	}
	due, err := ParseReminderDate(ValueString(row["due_date"]))
	if err != nil {
		row["is_due"] = false
		row["is_overdue"] = false
		return
	}
	today := StartOfLocalDay(now)
	row["is_due"] = !due.After(MaintenanceAlertDate(now))
	row["is_overdue"] = due.Before(today)
}

func ParseReminderDate(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, sql.ErrNoRows
	}
	if t, err := time.ParseInLocation("2006-01-02", value, time.Local); err == nil {
		return t, nil
	}
	if t, err := database.ParseTimestamp(value); err == nil {
		return StartOfLocalDay(t), nil
	}
	return time.Time{}, fmt.Errorf("invalid date")
}

func NextReminderDueDate(current string, interval int, unit string) (string, error) {
	due, err := ParseReminderDate(current)
	if err != nil {
		return "", err
	}
	switch unit {
	case "days":
		due = due.AddDate(0, 0, interval)
	case "weeks":
		due = due.AddDate(0, 0, interval*7)
	case "months":
		due = due.AddDate(0, interval, 0)
	case "years":
		due = due.AddDate(interval, 0, 0)
	default:
		return "", fmt.Errorf("invalid repeat unit")
	}
	return due.Format("2006-01-02"), nil
}

func StartOfLocalDay(t time.Time) time.Time {
	local := t.Local()
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, local.Location())
}

func MaintenanceAlertDate(now time.Time) time.Time {
	leadDays := maintenanceReminderLeadDays()
	return StartOfLocalDay(now).AddDate(0, 0, leadDays)
}

func IsAllowedMaintenanceType(value string) bool {
	switch value {
	case "maintenance", "warranty", "inspection", "custom":
		return true
	default:
		return false
	}
}

func IsAllowedRepeatUnit(value string) bool {
	switch value {
	case "days", "weeks", "months", "years":
		return true
	default:
		return false
	}
}

func IsAllowedMaintenanceStatus(value string) bool {
	switch value {
	case "open", "completed", "skipped":
		return true
	default:
		return false
	}
}

func NullableString(value string) interface{} {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}

func ValueString(value interface{}) string {
	switch v := value.(type) {
	case string:
		return v
	case []byte:
		return string(v)
	default:
		return ""
	}
}

func cleanRow(row map[string]interface{}) {
	for key, value := range row {
		switch typed := value.(type) {
		case []byte:
			row[key] = string(typed)
		}
	}
}

func maintenanceReminderLeadDays() int {
	var raw string
	if err := database.DB.Get(&raw, "SELECT value FROM app_settings WHERE `key` = ?", "maintenance.reminder_lead_days"); err != nil {
		return 0
	}
	if days, err := strconv.Atoi(strings.TrimSpace(raw)); err == nil && days >= 0 && days <= 365 {
		return days
	}
	return 0
}
