package auth

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
	ws "github.com/itemplus/backend/internal/websocket"
)

func listUsers(c *gin.Context) {
	var users []middleware.User
	err := database.DB.Select(&users, "SELECT * FROM users WHERE "+VisibleUsersWhereClause("")+" ORDER BY created_at DESC")
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
	rows, err := database.DB.Queryx("SELECT id, display_name, email FROM users WHERE is_active = 1 AND " + VisibleUsersWhereClause("") + " ORDER BY display_name")
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
		if err := rows.Scan(&id, &name, &email); err != nil {
			log.Printf("DB scan error in lookupUser: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		displayName := "User"
		if name != nil && *name != "" {
			displayName = *name
		} else if email != nil && *email != "" {
			displayName = *email
		}
		result = append(result, gin.H{"id": id, "name": displayName})
	}
	if err := rows.Err(); err != nil {
		log.Printf("DB rows error in lookupUser: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	if result == nil {
		result = []gin.H{}
	}
	c.JSON(http.StatusOK, result)
}

func listInactiveUsers(c *gin.Context) {
	var users []middleware.User
	err := database.DB.Select(&users, "SELECT * FROM users WHERE is_active = 0 AND "+VisibleUsersWhereClause("")+" ORDER BY created_at DESC")
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
		middleware.Audit(adminUser.ID, "user.permissions_changed", fmt.Sprintf("target_user=%s permissions=%s", id, string(permsJSON)))
	}
	if body.IsAdmin != nil {
		adminUser := middleware.GetUser(c)
		middleware.Audit(adminUser.ID, "user.admin_changed", fmt.Sprintf("target_user=%s is_admin=%v", id, *body.IsAdmin))
	}

	adminUser := middleware.GetUser(c)
	middleware.Audit(adminUser.ID, "user.update", fmt.Sprintf("target=%s", id))

	updated, err := loadVisibleUserByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}

	if wasInactive && updated.IsActive {
		ws.M.SendToUser(updated.ID, "user.activated", nil)
	}

	c.JSON(http.StatusOK, userResponse(updated))
}

func activateUser(c *gin.Context) {
	id := c.Param("id")

	user, err := loadVisibleUserByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}

	now := database.TimestampNow()
	database.DB.Exec("UPDATE users SET is_active = 1, updated_at = ? WHERE id = ?", now, id)

	user, err = loadVisibleUserByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}

	admin := middleware.GetUser(c)
	middleware.Audit(admin.ID, "user.activate", fmt.Sprintf("target=%s", id))

	ws.M.SendToUser(user.ID, "user.activated", nil)

	c.JSON(http.StatusOK, userResponse(user))
}

func deleteUser(c *gin.Context) {
	id := c.Param("id")
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

	if err := DeleteUserAccount(targetID, user.ID, false); err != nil {
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
