package operations

import (
	"github.com/itemplus/backend/internal/http/middleware"
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

type maintenanceSettingsPayload struct {
	ReminderLeadDays int `json:"reminder_lead_days"`
}

func adminGetMaintenanceSettings(c *gin.Context) {
	c.JSON(http.StatusOK, currentMaintenanceSettings())
}

func adminUpdateMaintenanceSettings(c *gin.Context) {
	var payload maintenanceSettingsPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}
	payload.ReminderLeadDays = clampMaintenanceReminderLeadDays(payload.ReminderLeadDays)
	if err := database.UpsertAppSetting(maintenanceReminderLeadDaysSettingKey, strconv.Itoa(payload.ReminderLeadDays), database.TimestampNow()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not save maintenance settings"})
		return
	}
	c.JSON(http.StatusOK, payload)
}

func currentMaintenanceSettings() maintenanceSettingsPayload {
	return maintenanceSettingsPayload{ReminderLeadDays: maintenanceReminderLeadDays()}
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
	return clampMaintenanceReminderLeadDays(value)
}

func clampMaintenanceReminderLeadDays(value int) int {
	if value < 0 {
		return 0
	}
	if value > maxMaintenanceReminderLeadDays {
		return maxMaintenanceReminderLeadDays
	}
	return value
}

func maintenanceAlertDate(now time.Time) time.Time {
	return middleware.StartOfLocalDay(now).AddDate(0, 0, maintenanceReminderLeadDays())
}
