package operations

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
	ws "github.com/itemplus/backend/internal/websocket"
)

// Notifications are short messages for one user about something that
// happened to them or waits for them: a loan request, a decision, a reported
// return. They are stored, so they also reach someone who was not online,
// and they work in the web client without the iOS app.
//
// A notification holds a kind and the facts (who, which item), never a
// finished sentence: the client writes the text in the reader's language.

const (
	notifyLoanRequested       = "loan.requested"
	notifyLoanApproved        = "loan.approved"
	notifyLoanRejected        = "loan.rejected"
	notifyLoanReturnReported  = "loan.return_reported"
	notifyLoanReturnConfirmed = "loan.return_confirmed"
	notifyLoanReturnDismissed = "loan.return_dismissed"
)

// notificationsKept is how many notifications a user keeps; older ones go.
const notificationsKept = 100

func RegisterNotificationRoutes(api *gin.RouterGroup) {
	api.GET("/notifications", middleware.Auth(), listNotifications)
	api.POST("/notifications/read", middleware.Auth(), markNotificationsRead)
	api.DELETE("/notifications", middleware.Auth(), deleteReadNotifications)
	api.DELETE("/notifications/:id", middleware.Auth(), deleteNotification)
}

// notify stores one notification for each recipient and tells their open
// browsers. It never fails the action that caused it: a loan that was
// approved stays approved even if the message about it could not be saved.
func notify(recipients []int, kind string, data map[string]interface{}, link string) {
	payload, err := json.Marshal(data)
	if err != nil {
		log.Printf("notification %s: %v", kind, err)
		return
	}
	now := database.TimestampNow()
	for _, userID := range recipients {
		if _, err := database.DB.Exec(
			"INSERT INTO notifications (user_id, kind, data, link, created_at) VALUES (?, ?, ?, ?, ?)",
			userID, kind, string(payload), link, now,
		); err != nil {
			log.Printf("notification %s for user %d: %v", kind, userID, err)
			continue
		}
		trimNotifications(userID)
		ws.M.SendToUser(userID, "notifications.updated", nil)
	}
}

func trimNotifications(userID int) {
	var ids []int
	if err := database.DB.Select(&ids, "SELECT id FROM notifications WHERE user_id = ? ORDER BY id DESC", userID); err != nil || len(ids) <= notificationsKept {
		return
	}
	// ids are newest first; everything from the oldest kept one downwards goes.
	if _, err := database.DB.Exec("DELETE FROM notifications WHERE user_id = ? AND id < ?", userID, ids[notificationsKept-1]); err != nil {
		log.Printf("trim notifications of user %d: %v", userID, err)
	}
}

// loanManagers lists the active users who manage loans, without the one who
// just acted: nobody needs a message about what they did themselves.
func loanManagers(except int) []int {
	rows := []struct {
		ID          int     `db:"id"`
		IsAdmin     bool    `db:"is_admin"`
		Permissions *string `db:"permissions"`
	}{}
	if err := database.DB.Select(&rows, "SELECT id, is_admin, permissions FROM users WHERE is_active = 1"); err != nil {
		log.Printf("load loan managers: %v", err)
		return nil
	}
	var managers []int
	for _, row := range rows {
		if row.ID == except {
			continue
		}
		if row.IsAdmin || (row.Permissions != nil && strings.Contains(*row.Permissions, `"checkout.manage"`)) {
			managers = append(managers, row.ID)
		}
	}
	return managers
}

// loanFacts collects what a loan notification says: the item and, when
// someone else has to be named, that person.
func loanFacts(realm string, itemID interface{}, personID int) map[string]interface{} {
	facts := map[string]interface{}{"realm": realm, "item_id": middleware.AsInt(itemID)}
	var itemName string
	if err := database.DB.Get(&itemName, fmt.Sprintf("SELECT name FROM %s_items WHERE id = ?", realm), itemID); err == nil {
		facts["item"] = itemName
	}
	if personID > 0 {
		var personName string
		if err := database.DB.Get(&personName, "SELECT COALESCE(display_name, email, '') FROM users WHERE id = ?", personID); err == nil && personName != "" {
			facts["user"] = personName
		}
	}
	return facts
}

func loansLink(realm string) string {
	return "/checkouts?realm=" + realm
}

func listNotifications(c *gin.Context) {
	user := middleware.GetUser(c)
	rows, err := database.DB.Queryx(
		"SELECT id, kind, data, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ?", user.ID, notificationsKept)
	if err != nil {
		log.Printf("DB query error in listNotifications: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	items := []map[string]interface{}{}
	for rows.Next() {
		row := map[string]interface{}{}
		if rows.MapScan(row) != nil {
			continue
		}
		middleware.CleanRow(row)
		facts := map[string]interface{}{}
		if raw, ok := row["data"].(string); ok {
			_ = json.Unmarshal([]byte(raw), &facts)
		}
		row["data"] = facts
		items = append(items, row)
	}
	if err := rows.Close(); err != nil {
		log.Printf("DB rows close error in listNotifications: %v", err)
	}

	var unread int
	if err := database.DB.Get(&unread, "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL", user.ID); err != nil {
		log.Printf("DB count error in listNotifications: %v", err)
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "unread": unread})
}

// markNotificationsRead marks one notification of the caller as read, or all
// of them when no id is given.
func markNotificationsRead(c *gin.Context) {
	user := middleware.GetUser(c)
	var body struct {
		ID *int `json:"id"`
	}
	_ = c.ShouldBindJSON(&body)

	query := "UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL"
	args := []interface{}{database.TimestampNow(), user.ID}
	if body.ID != nil {
		query += " AND id = ?"
		args = append(args, *body.ID)
	}
	if _, err := database.DB.Exec(query, args...); err != nil {
		log.Printf("DB update error in markNotificationsRead: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	ws.M.SendToUser(user.ID, "notifications.updated", nil)
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// deleteNotification removes one notification of the caller.
func deleteNotification(c *gin.Context) {
	user := middleware.GetUser(c)
	result, err := database.DB.Exec("DELETE FROM notifications WHERE id = ? AND user_id = ?", c.Param("id"), user.ID)
	if err != nil {
		log.Printf("DB delete error in deleteNotification: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Notification not found"})
		return
	}
	ws.M.SendToUser(user.ID, "notifications.updated", nil)
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// deleteReadNotifications clears the caller's inbox of everything already
// read; unread notifications stay.
func deleteReadNotifications(c *gin.Context) {
	user := middleware.GetUser(c)
	if _, err := database.DB.Exec("DELETE FROM notifications WHERE user_id = ? AND read_at IS NOT NULL", user.ID); err != nil {
		log.Printf("DB delete error in deleteReadNotifications: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	ws.M.SendToUser(user.ID, "notifications.updated", nil)
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
