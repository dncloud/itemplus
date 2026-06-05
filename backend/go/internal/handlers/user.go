package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
	"github.com/itemplus/backend/internal/ws"
)

const deletedUserPrefix = "deleted_user_"

type userDeletionBlockedError struct {
	activeCheckouts int
}

type userDeletionAdminError struct{}

func (e userDeletionBlockedError) Error() string {
	if e.activeCheckouts > 0 {
		return fmt.Sprintf("Account cannot be deleted while it still has %d active checkout(s). Please return them first.", e.activeCheckouts)
	}
	return "Account deletion is currently blocked"
}

func (e userDeletionAdminError) Error() string {
	return "Administrator accounts cannot be deleted from the app."
}

func visibleUsersWhereClause(alias string) string {
	column := "apple_sub"
	if alias != "" {
		column = alias + ".apple_sub"
	}
	return fmt.Sprintf("%s NOT LIKE '%s%%'", column, deletedUserPrefix)
}

func countVisibleUsers() int {
	var count int
	if err := database.DB.Get(&count, "SELECT COUNT(*) FROM users WHERE "+visibleUsersWhereClause("")); err != nil {
		return 0
	}
	return count
}

func loadVisibleUserByID(id interface{}) (*middleware.User, error) {
	var user middleware.User
	if err := database.DB.Get(&user, "SELECT * FROM users WHERE id = ? AND "+visibleUsersWhereClause(""), id); err != nil {
		return nil, err
	}
	return &user, nil
}

func countUserDeleteBlocks(userID int) (int, error) {
	var activeArchive int
	if err := database.DB.Get(&activeArchive, "SELECT COUNT(*) FROM archive_checkouts WHERE user_id = ? AND status = 'active'", userID); err != nil {
		return 0, err
	}
	var activeCollection int
	if err := database.DB.Get(&activeCollection, "SELECT COUNT(*) FROM collection_checkouts WHERE user_id = ? AND status = 'active'", userID); err != nil {
		return 0, err
	}
	return activeArchive + activeCollection, nil
}

func deleteUserAccount(userID int, actorID int, selfService bool) error {
	user, err := loadVisibleUserByID(userID)
	if err != nil {
		return err
	}
	if user.IsAdmin {
		return userDeletionAdminError{}
	}

	activeCheckouts, err := countUserDeleteBlocks(userID)
	if err != nil {
		return err
	}
	if activeCheckouts > 0 {
		return userDeletionBlockedError{activeCheckouts: activeCheckouts}
	}

	tx, err := database.DB.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM device_sessions WHERE user_id = ?", userID); err != nil {
		return err
	}
	if _, err := tx.Exec("DELETE FROM checkout_requests WHERE user_id = ?", userID); err != nil {
		return err
	}
	if _, err := tx.Exec("UPDATE archive_locations SET manager_id = NULL WHERE manager_id = ?", userID); err != nil {
		return err
	}
	if _, err := tx.Exec("UPDATE collection_locations SET manager_id = NULL WHERE manager_id = ?", userID); err != nil {
		return err
	}
	if user.Email != nil && *user.Email != "" {
		if _, err := tx.Exec("DELETE FROM magic_link_tokens WHERE email = ?", *user.Email); err != nil {
			return err
		}
	}

	if _, err := tx.Exec("DELETE FROM users WHERE id = ?", userID); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	if actorID > 0 {
		action := "user.delete"
		detail := fmt.Sprintf("target_user=%d deleted", userID)
		if selfService {
			action = "user.delete_self"
			detail = "self-service account deletion"
		}
		audit(actorID, action, detail)
	}

	return nil
}

func RegisterUserRoutes(api *gin.RouterGroup) {
	// Current user
	api.GET("/user", middleware.AuthAllowInactive(), getMe)
	api.PUT("/user", middleware.Auth(), updateMe)
	api.DELETE("/user", middleware.Auth(), deleteMe)

	// Admin: manage users
	api.GET("/users", middleware.Auth(), middleware.RequireAdmin(), listUsers)
	api.GET("/users/lookup", middleware.Auth(), lookupUser)
	api.GET("/users/inactive", middleware.Auth(), middleware.RequireAdmin(), listInactiveUsers)
	api.GET("/users/:id", middleware.Auth(), middleware.RequireAdmin(), getUser)
	api.PUT("/users/:id", middleware.Auth(), middleware.RequireAdmin(), updateUser)
	api.PUT("/users/:id/activate", middleware.Auth(), middleware.RequireAdmin(), activateUser)
	api.DELETE("/users/:id", middleware.Auth(), middleware.RequireAdmin(), deleteUser)
}

func getMe(c *gin.Context) {
	user := middleware.GetUser(c)
	c.JSON(http.StatusOK, userResponse(user))
}

func userResponse(user *middleware.User) gin.H {
	resp := gin.H{
		"id":          user.ID,
		"sub":         user.AppleSub,
		"email":       user.Email,
		"name":        user.DisplayName,
		"is_admin":    user.IsAdmin,
		"is_active":   user.IsActive,
		"permissions": user.PermissionList(),
		"last_login":  user.LastLogin,
		"created_at":  user.CreatedAt,
	}

	// Include last session info separately from the auth login timestamp.
	var lastSession struct {
		IPAddress  *string `db:"ip_address"`
		DeviceName *string `db:"device_name"`
		DeviceType *string `db:"device_type"`
		LastSeen   *string `db:"last_seen"`
		IsOnline   bool    `db:"is_online"`
	}
	if err := database.DB.Get(&lastSession,
		"SELECT ip_address, device_name, device_type, last_seen, is_online FROM device_sessions WHERE user_id = ? ORDER BY last_seen DESC LIMIT 1",
		user.ID,
	); err == nil {
		resp["last_ip"] = lastSession.IPAddress
		if lastSession.DeviceName != nil && *lastSession.DeviceName != "" {
			resp["last_device"] = lastSession.DeviceName
		} else {
			resp["last_device"] = lastSession.DeviceType
		}
		resp["last_session_seen"] = lastSession.LastSeen
		resp["last_session_online"] = lastSession.IsOnline
	}

	return resp
}

func updateMe(c *gin.Context) {
	user := middleware.GetUser(c)
	var body struct {
		DisplayName *string `json:"display_name"`
		Name        *string `json:"name"`
		Email       *string `json:"email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	now := database.TimestampNow()
	name := body.DisplayName
	if name == nil {
		name = body.Name
	}
	if name != nil {
		database.DB.Exec("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?", *name, now, user.ID)
	}
	if body.Email != nil {
		database.DB.Exec("UPDATE users SET email = ?, updated_at = ? WHERE id = ?", *body.Email, now, user.ID)
	}

	updated, err := loadVisibleUserByID(user.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}
	c.JSON(http.StatusOK, userResponse(updated))
}

func deleteMe(c *gin.Context) {
	user := middleware.GetUser(c)
	if err := deleteUserAccount(user.ID, user.ID, true); err != nil {
		var blocked userDeletionBlockedError
		var adminBlocked userDeletionAdminError
		switch {
		case errors.Is(err, sql.ErrNoRows):
			c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		case errors.As(err, &adminBlocked):
			c.JSON(http.StatusConflict, gin.H{"detail": adminBlocked.Error(), "code": "account_deletion_admin_forbidden"})
		case errors.As(err, &blocked):
			c.JSON(http.StatusConflict, gin.H{"detail": blocked.Error(), "code": "account_deletion_active_checkouts", "active_checkouts": blocked.activeCheckouts})
		default:
			log.Printf("Account anonymization error in deleteMe: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		}
		return
	}
	c.Status(http.StatusNoContent)
}

func listUsers(c *gin.Context) {
	var users []middleware.User
	err := database.DB.Select(&users, "SELECT * FROM users WHERE "+visibleUsersWhereClause("")+" ORDER BY created_at DESC")
	if err != nil {
		log.Printf("DB query error in listUsers: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	var result []gin.H
	for _, u := range users {
		uCopy := u
		result = append(result, userResponse(&uCopy))
	}
	if result == nil {
		result = []gin.H{}
	}
	c.JSON(http.StatusOK, result)
}

func lookupUser(c *gin.Context) {
	rows, err := database.DB.Queryx("SELECT id, display_name, email FROM users WHERE is_active = 1 AND " + visibleUsersWhereClause("") + " ORDER BY display_name")
	if err != nil {
		log.Printf("DB query error in lookupUser: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	defer rows.Close()

	var result []gin.H
	for rows.Next() {
		var id int
		var name, email *string
		rows.Scan(&id, &name, &email)
		displayName := "User"
		if name != nil && *name != "" {
			displayName = *name
		} else if email != nil && *email != "" {
			displayName = *email
		}
		result = append(result, gin.H{"id": id, "name": displayName})
	}
	if result == nil {
		result = []gin.H{}
	}
	c.JSON(http.StatusOK, result)
}

func listInactiveUsers(c *gin.Context) {
	var users []middleware.User
	err := database.DB.Select(&users, "SELECT * FROM users WHERE is_active = 0 AND "+visibleUsersWhereClause("")+" ORDER BY created_at DESC")
	if err != nil {
		log.Printf("DB query error in listInactiveUsers: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	var result []gin.H
	for _, u := range users {
		uCopy := u
		result = append(result, userResponse(&uCopy))
	}
	if result == nil {
		result = []gin.H{}
	}
	c.JSON(http.StatusOK, result)
}

func getUser(c *gin.Context) {
	id := c.Param("id")
	user, err := loadVisibleUserByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}

	c.JSON(http.StatusOK, userResponse(user))
}

func updateUser(c *gin.Context) {
	id := c.Param("id")
	var body struct {
		DisplayName *string  `json:"display_name"`
		Name        *string  `json:"name"`
		Email       *string  `json:"email"`
		IsAdmin     *bool    `json:"is_admin"`
		IsActive    *bool    `json:"is_active"`
		Permissions []string `json:"permissions"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	// Read current user to detect activation transition
	current, err := loadVisibleUserByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}
	wasInactive := !current.IsActive

	now := database.TimestampNow()
	name := body.DisplayName
	if name == nil {
		name = body.Name
	}
	if name != nil {
		database.DB.Exec("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?", *name, now, id)
	}
	if body.Email != nil {
		database.DB.Exec("UPDATE users SET email = ?, updated_at = ? WHERE id = ?", *body.Email, now, id)
	}
	if body.IsAdmin != nil {
		database.DB.Exec("UPDATE users SET is_admin = ?, updated_at = ? WHERE id = ?", *body.IsAdmin, now, id)
	}
	if body.IsActive != nil {
		database.DB.Exec("UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?", *body.IsActive, now, id)
	}
	if body.Permissions != nil {
		permsJSON, _ := json.Marshal(body.Permissions)
		database.DB.Exec("UPDATE users SET permissions = ?, updated_at = ? WHERE id = ?", string(permsJSON), now, id)
		adminUser := middleware.GetUser(c)
		audit(adminUser.ID, "user.permissions_changed", fmt.Sprintf("target_user=%s permissions=%s", id, string(permsJSON)))
	}
	if body.IsAdmin != nil {
		adminUser := middleware.GetUser(c)
		audit(adminUser.ID, "user.admin_changed", fmt.Sprintf("target_user=%s is_admin=%v", id, *body.IsAdmin))
	}

	adminUser2 := middleware.GetUser(c)
	audit(adminUser2.ID, "user.update", fmt.Sprintf("target=%s", id))

	updated, err := loadVisibleUserByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}

	// Send activation notification if transitioning inactive -> active
	if wasInactive && updated.IsActive {
		ws.M.SendToUser(updated.ID, "user.activated", nil)
	}

	c.JSON(http.StatusOK, userResponse(updated))
}

func activateUser(c *gin.Context) {
	id := c.Param("id")

	// Check user exists first
	user, err := loadVisibleUserByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}

	now := database.TimestampNow()
	database.DB.Exec("UPDATE users SET is_active = 1, updated_at = ? WHERE id = ?", now, id)

	// Re-read updated user
	user, err = loadVisibleUserByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}

	admin := middleware.GetUser(c)
	audit(admin.ID, "user.activate", fmt.Sprintf("target=%s", id))

	// Notify user via WebSocket
	ws.M.SendToUser(user.ID, "user.activated", nil)

	c.JSON(http.StatusOK, userResponse(user))
}

func deleteUser(c *gin.Context) {
	id := c.Param("id")
	// Prevent self-deletion via admin endpoint
	user := middleware.GetUser(c)
	if fmt.Sprintf("%d", user.ID) == id {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Cannot delete yourself via admin endpoint"})
		return
	}

	var targetID int
	if _, err := fmt.Sscanf(id, "%d", &targetID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid user id"})
		return
	}

	if err := deleteUserAccount(targetID, user.ID, false); err != nil {
		var blocked userDeletionBlockedError
		var adminBlocked userDeletionAdminError
		switch {
		case errors.Is(err, sql.ErrNoRows):
			c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		case errors.As(err, &adminBlocked):
			c.JSON(http.StatusConflict, gin.H{"detail": adminBlocked.Error(), "code": "account_deletion_admin_forbidden"})
		case errors.As(err, &blocked):
			c.JSON(http.StatusConflict, gin.H{"detail": blocked.Error(), "code": "account_deletion_active_checkouts", "active_checkouts": blocked.activeCheckouts})
		default:
			log.Printf("DB delete error in deleteUser: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		}
		return
	}
	c.Status(http.StatusNoContent)
}
