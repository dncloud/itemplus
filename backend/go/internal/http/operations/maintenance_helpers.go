package operations

import (
	"time"

	maintenancecore "github.com/itemplus/backend/internal/core/maintenance"
)

func normalizeMaintenanceReminderPayload(payload maintenancecore.ReminderPayload, create bool) (maintenancecore.ReminderPayload, error) {
	return maintenancecore.NormalizeReminderPayload(payload, create)
}

func loadMaintenanceReminder(realm, itemID, reminderID string) (map[string]interface{}, error) {
	return maintenancecore.LoadReminder(realm, itemID, reminderID)
}

func loadItemMaintenanceReminders(realm, itemID string, includeDone bool) []map[string]interface{} {
	return maintenancecore.LoadItemReminders(realm, itemID, includeDone)
}

func loadItemMaintenanceHistory(realm, itemID string, limit int) []map[string]interface{} {
	return maintenancecore.LoadItemHistory(realm, itemID, limit)
}

func annotateMaintenanceReminder(row map[string]interface{}, now time.Time) {
	maintenancecore.AnnotateReminder(row, now)
}

func parseMaintenanceDate(value string) (time.Time, error) {
	return maintenancecore.ParseReminderDate(value)
}

func nextMaintenanceDueDate(current string, interval int, unit string) (string, error) {
	return maintenancecore.NextReminderDueDate(current, interval, unit)
}

func nullableString(value string) interface{} {
	return maintenancecore.NullableString(value)
}

func valueString(value interface{}) string {
	return maintenancecore.ValueString(value)
}
