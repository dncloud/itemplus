package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
	"github.com/itemplus/backend/internal/ws"
)

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

	// Include last session info (last_ip, last_device)
	var lastSession struct {
		IPAddress  *string `db:"ip_address"`
		DeviceName *string `db:"device_name"`
		DeviceType *string `db:"device_type"`
	}
	if err := database.DB.Get(&lastSession,
		"SELECT ip_address, device_name, device_type FROM device_sessions WHERE user_id = ? ORDER BY last_seen DESC LIMIT 1",
		user.ID,
	); err == nil {
		resp["last_ip"] = lastSession.IPAddress
		if lastSession.DeviceName != nil && *lastSession.DeviceName != "" {
			resp["last_device"] = lastSession.DeviceName
		} else {
			resp["last_device"] = lastSession.DeviceType
		}
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

	now := time.Now().UTC().Format(time.RFC3339)
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

	var updated middleware.User
	database.DB.Get(&updated, "SELECT * FROM users WHERE id = ?", user.ID)
	c.JSON(http.StatusOK, userResponse(&updated))
}

func deleteMe(c *gin.Context) {
	user := middleware.GetUser(c)
	database.DB.Exec("DELETE FROM users WHERE id = ?", user.ID)
	c.Status(http.StatusNoContent)
}

func listUsers(c *gin.Context) {
	var users []middleware.User
	err := database.DB.Select(&users, "SELECT * FROM users ORDER BY created_at DESC")
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
	rows, err := database.DB.Queryx("SELECT id, display_name, email FROM users WHERE is_active = 1 ORDER BY display_name")
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
	err := database.DB.Select(&users, "SELECT * FROM users WHERE is_active = 0 ORDER BY created_at DESC")
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
	var user middleware.User
	err := database.DB.Get(&user, "SELECT * FROM users WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}

	c.JSON(http.StatusOK, userResponse(&user))
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
	var current middleware.User
	if err := database.DB.Get(&current, "SELECT * FROM users WHERE id = ?", id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}
	wasInactive := !current.IsActive

	now := time.Now().UTC().Format(time.RFC3339)
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

	var updated middleware.User
	database.DB.Get(&updated, "SELECT * FROM users WHERE id = ?", id)

	// Send activation notification if transitioning inactive -> active
	if wasInactive && updated.IsActive {
		ws.M.SendToUser(updated.ID, "user.activated", nil)
	}

	c.JSON(http.StatusOK, userResponse(&updated))
}

func activateUser(c *gin.Context) {
	id := c.Param("id")

	// Check user exists first
	var user middleware.User
	if err := database.DB.Get(&user, "SELECT * FROM users WHERE id = ?", id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	database.DB.Exec("UPDATE users SET is_active = 1, updated_at = ? WHERE id = ?", now, id)

	// Re-read updated user
	database.DB.Get(&user, "SELECT * FROM users WHERE id = ?", id)

	admin := middleware.GetUser(c)
	audit(admin.ID, "user.activate", fmt.Sprintf("target=%s", id))

	// Notify user via WebSocket
	ws.M.SendToUser(user.ID, "user.activated", nil)

	c.JSON(http.StatusOK, userResponse(&user))
}

func deleteUser(c *gin.Context) {
	id := c.Param("id")
	// Prevent self-deletion via admin endpoint
	user := middleware.GetUser(c)
	if fmt.Sprintf("%d", user.ID) == id {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Cannot delete yourself via admin endpoint"})
		return
	}

	result, err := database.DB.Exec("DELETE FROM users WHERE id = ?", id)
	if err != nil {
		log.Printf("DB delete error in deleteUser: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}
	audit(user.ID, "user.delete", fmt.Sprintf("target_user=%s", id))
	c.Status(http.StatusNoContent)
}
