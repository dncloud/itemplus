package operations

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	maintenancecore "github.com/itemplus/backend/internal/core/maintenance"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

type maintenanceResolutionPayload struct {
	Note string `json:"note"`
}

func ListMaintenanceReminders(realm string) gin.HandlerFunc {
	return func(c *gin.Context) {
		itemID := c.Param("id")
		if !database.TableRowExistsByID(realm+"_items", itemID) {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
			return
		}
		c.JSON(http.StatusOK, loadItemMaintenanceReminders(realm, itemID, true))
	}
}

func CreateMaintenanceReminder(realm string) gin.HandlerFunc {
	return func(c *gin.Context) {
		itemID := c.Param("id")
		if !database.TableRowExistsByID(realm+"_items", itemID) {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
			return
		}
		var payload maintenancecore.ReminderPayload
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
			return
		}
		payload, err := normalizeMaintenanceReminderPayload(payload, true)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
			return
		}
		user := middleware.GetUser(c)
		var createdBy interface{}
		if user != nil {
			createdBy = user.ID
		}
		now := database.TimestampNow()
		result, err := database.DB.Exec(
			fmt.Sprintf(`INSERT INTO %s
				(item_id, title, reminder_type, custom_type_label, due_date, repeat_interval, repeat_unit, status, notes, created_by, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`, middleware.MaintenanceReminderTable(realm)),
			itemID, payload.Title, payload.ReminderType, nullableString(payload.CustomTypeLabel), payload.DueDate, payload.RepeatInterval, nullableString(payload.RepeatUnit), nullableString(payload.Notes), createdBy, now, now,
		)
		if err != nil {
			log.Printf("DB insert error in createMaintenanceReminder %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not create reminder"})
			return
		}
		newID, _ := result.LastInsertId()
		row, err := loadMaintenanceReminder(realm, itemID, strconv.FormatInt(newID, 10))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not load reminder"})
			return
		}
		c.JSON(http.StatusCreated, row)
	}
}

func UpdateMaintenanceReminder(realm string) gin.HandlerFunc {
	return func(c *gin.Context) {
		itemID := c.Param("id")
		reminderID := c.Param("reminderId")
		var payload maintenancecore.ReminderPayload
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
			return
		}
		payload, err := normalizeMaintenanceReminderPayload(payload, false)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
			return
		}
		if payload.Status != "open" {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Use complete or skip actions to resolve reminders"})
			return
		}
		result, err := database.DB.Exec(
			fmt.Sprintf(`UPDATE %s
				SET title = ?, reminder_type = ?, custom_type_label = ?, due_date = ?, repeat_interval = ?, repeat_unit = ?, status = ?, notes = ?, updated_at = ?
				WHERE id = ? AND item_id = ?`, middleware.MaintenanceReminderTable(realm)),
			payload.Title, payload.ReminderType, nullableString(payload.CustomTypeLabel), payload.DueDate, payload.RepeatInterval, nullableString(payload.RepeatUnit), payload.Status, nullableString(payload.Notes), database.TimestampNow(), reminderID, itemID,
		)
		if err != nil {
			log.Printf("DB update error in updateMaintenanceReminder %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not update reminder"})
			return
		}
		if affected, _ := result.RowsAffected(); affected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Reminder not found"})
			return
		}
		row, err := loadMaintenanceReminder(realm, itemID, reminderID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not load reminder"})
			return
		}
		c.JSON(http.StatusOK, row)
	}
}

func CompleteMaintenanceReminder(realm string) gin.HandlerFunc {
	return func(c *gin.Context) {
		resolveMaintenanceReminder(c, realm, "completed")
	}
}

func SkipMaintenanceReminder(realm string) gin.HandlerFunc {
	return func(c *gin.Context) {
		resolveMaintenanceReminder(c, realm, "skipped")
	}
}

func DeleteMaintenanceReminder(realm string) gin.HandlerFunc {
	return func(c *gin.Context) {
		result, err := database.DB.Exec(
			fmt.Sprintf("DELETE FROM %s WHERE id = ? AND item_id = ?", middleware.MaintenanceReminderTable(realm)),
			c.Param("reminderId"), c.Param("id"),
		)
		if err != nil {
			log.Printf("DB delete error in deleteMaintenanceReminder %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not delete reminder"})
			return
		}
		if affected, _ := result.RowsAffected(); affected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Reminder not found"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

func resolveMaintenanceReminder(c *gin.Context, realm string, action string) {
	itemID := c.Param("id")
	reminderID := c.Param("reminderId")
	var payload maintenanceResolutionPayload
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
			return
		}
	}
	payload.Note = strings.TrimSpace(payload.Note)
	row, err := loadMaintenanceReminder(realm, itemID, reminderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Reminder not found"})
		return
	}
	if valueString(row["status"]) != "open" {
		c.JSON(http.StatusConflict, gin.H{"detail": "Reminder is already resolved"})
		return
	}
	if due, err := parseMaintenanceDate(valueString(row["due_date"])); err != nil || due.After(middleware.StartOfLocalDay(time.Now())) {
		c.JSON(http.StatusConflict, gin.H{"detail": "Reminder is not due yet"})
		return
	}
	now := database.TimestampNow()
	repeatInterval := middleware.AsInt(row["repeat_interval"])
	repeatUnit := valueString(row["repeat_unit"])
	user := middleware.GetUser(c)
	var performedBy interface{}
	if user != nil {
		performedBy = user.ID
	}
	if err := insertMaintenanceHistory(realm, itemID, reminderID, action, row, performedBy, now, payload.Note); err != nil {
		log.Printf("DB maintenance history insert error %s: %v", realm, err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not write reminder history"})
		return
	}
	if repeatInterval > 0 && repeatUnit != "" {
		nextDue, err := nextMaintenanceDueDate(valueString(row["due_date"]), repeatInterval, repeatUnit)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Could not calculate next due date"})
			return
		}
		_, err = database.DB.Exec(
			fmt.Sprintf(`UPDATE %s
				SET due_date = ?, status = 'open', last_completed_at = ?, completed_at = NULL, updated_at = ?
				WHERE id = ? AND item_id = ?`, middleware.MaintenanceReminderTable(realm)),
			nextDue, now, now, reminderID, itemID,
		)
		if err != nil {
			log.Printf("DB resolve recurring reminder error %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not update reminder"})
			return
		}
	} else {
		status := "completed"
		if action == "skipped" {
			status = "skipped"
		}
		_, err = database.DB.Exec(
			fmt.Sprintf(`UPDATE %s
				SET status = ?, completed_at = ?, last_completed_at = ?, updated_at = ?
				WHERE id = ? AND item_id = ?`, middleware.MaintenanceReminderTable(realm)),
			status, now, now, now, reminderID, itemID,
		)
		if err != nil {
			log.Printf("DB resolve reminder error %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not update reminder"})
			return
		}
	}
	updated, err := loadMaintenanceReminder(realm, itemID, reminderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not load reminder"})
		return
	}
	c.JSON(http.StatusOK, updated)
}

func insertMaintenanceHistory(realm, itemID, reminderID, action string, reminder map[string]interface{}, performedBy interface{}, performedAt string, historyNote string) error {
	historyNote = mergeMaintenanceHistoryNotes(valueString(reminder["notes"]), historyNote)
	_, err := database.DB.Exec(
		fmt.Sprintf(`INSERT INTO %s
			(reminder_id, item_id, action, title, reminder_type, custom_type_label, due_date, notes, performed_by, performed_at, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, middleware.MaintenanceHistoryTable(realm)),
		reminderID,
		itemID,
		action,
		valueString(reminder["title"]),
		valueString(reminder["reminder_type"]),
		nullableString(valueString(reminder["custom_type_label"])),
		valueString(reminder["due_date"]),
		nullableString(historyNote),
		performedBy,
		performedAt,
		performedAt,
	)
	return err
}

func mergeMaintenanceHistoryNotes(reminderNotes, resolutionNote string) string {
	reminderNotes = strings.TrimSpace(reminderNotes)
	resolutionNote = strings.TrimSpace(resolutionNote)

	switch {
	case reminderNotes == "" && resolutionNote == "":
		return ""
	case reminderNotes == "":
		return resolutionNote
	case resolutionNote == "":
		return reminderNotes
	case strings.EqualFold(reminderNotes, resolutionNote):
		return resolutionNote
	default:
		return reminderNotes + "\n\n---\n" + resolutionNote
	}
}
