package operations

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	authcore "github.com/itemplus/backend/internal/core/auth"
	checkoutcore "github.com/itemplus/backend/internal/core/checkouts"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

func remindCheckout(c *gin.Context) {
	realm := c.Param("realm")
	if !ensureCheckoutRealm(c, realm) {
		return
	}

	id := c.Param("id")
	table := realm + "_checkouts"
	itemsTable := realm + "_items"
	query := fmt.Sprintf(
		`SELECT co.*, i.name AS item_name, COALESCE(u.display_name, u.email) AS user_name, u.email AS user_email, u.locale AS user_locale,
		        CASE WHEN COALESCE(u.email, '') <> '' THEN 1 ELSE 0 END AS user_has_email
		   FROM %s co
		   LEFT JOIN %s i ON co.item_id = i.id
		   LEFT JOIN users u ON co.user_id = u.id
		  WHERE co.id = ? AND co.bundle_parent_item_id IS NULL
		  LIMIT 1`,
		table,
		itemsTable,
	)

	row, err := loadCheckoutRow(query, realm, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Checkout not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	if checkoutStatusValue(row["status"]) != "active" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Only active checkouts can be reminded"})
		return
	}
	if isOverdue, _ := row["is_overdue"].(bool); !isOverdue {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Only overdue checkouts can be reminded"})
		return
	}

	userEmail := strings.TrimSpace(stringValue(row["user_email"]))
	if userEmail == "" {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"detail": "The checked out user does not have an e-mail address",
			"code":   "checkout_reminder_missing_email",
		})
		return
	}

	now := time.Now().In(time.Local)
	lastReminder := checkoutcore.ParseCheckoutTime(row["last_reminder_sent_at"])
	if checkoutcore.IsReminderCooldownActive(now, lastReminder) {
		nextReminderAt := checkoutcore.NextReminderTime(lastReminder)
		c.JSON(http.StatusConflict, gin.H{
			"detail":                "A reminder was sent recently. Please wait before sending another one.",
			"code":                  "checkout_reminder_cooldown",
			"last_reminder_sent_at": database.TimestampAt(lastReminder),
			"next_reminder_at":      nextReminderAt.Format(time.RFC3339),
			"cooldown_days":         checkoutcore.ReminderCooldownRemainingDays(now, lastReminder),
		})
		return
	}

	dueDate := checkoutcore.ParseCheckoutTime(row["due_date"])
	dueDateLabel := ""
	if !dueDate.IsZero() {
		dueDateLabel = dueDate.In(time.Local).Format("02.01.2006")
	}
	overdueDays := middleware.AsInt(row["overdue_days"])
	if overdueDays < 1 {
		overdueDays = 1
	}

	if err := authcore.SendCheckoutReminderEmail(
		userEmail,
		stringValue(row["user_name"]),
		stringValue(row["item_name"]),
		dueDateLabel,
		overdueDays,
		stringValue(row["user_locale"]),
	); err != nil {
		status := http.StatusBadGateway
		detail := "The reminder e-mail could not be sent"
		code := "checkout_reminder_send_failed"
		if errors.Is(err, authcore.ErrEmailNotConfigured) {
			detail = "SMTP is not configured for outgoing e-mail"
			code = "checkout_reminder_email_not_configured"
		}
		c.JSON(status, gin.H{
			"detail": detail,
			"code":   code,
		})
		return
	}

	lastReminderSentAt := database.TimestampAt(now)
	if _, err := database.DB.Exec(
		fmt.Sprintf("UPDATE %s SET last_reminder_sent_at = ?, updated_at = ? WHERE id = ?", table),
		lastReminderSentAt,
		database.TimestampAt(now),
		id,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Reminder was sent but the checkout could not be updated"})
		return
	}

	row["last_reminder_sent_at"] = lastReminderSentAt
	checkoutcore.EnrichCheckoutRow(row, realm)

	user := middleware.GetUser(c)
	middleware.Audit(user.ID, "checkout.reminder_sent", fmt.Sprintf("realm=%s checkout=%s item=%v user=%v", realm, id, row["item_id"], row["user_id"]))

	c.JSON(http.StatusOK, row)
}

func checkoutStatusValue(value interface{}) string {
	switch status := value.(type) {
	case string:
		return strings.TrimSpace(status)
	case []byte:
		return strings.TrimSpace(string(status))
	default:
		return ""
	}
}

func stringValue(value interface{}) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case []byte:
		return strings.TrimSpace(string(v))
	default:
		return ""
	}
}
