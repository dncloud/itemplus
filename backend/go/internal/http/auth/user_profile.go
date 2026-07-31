package auth

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
	"github.com/itemplus/backend/internal/storage"
)

func getMe(c *gin.Context) {
	user := middleware.GetUser(c)
	resp := userResponse(user)
	resp["current_ip"] = c.ClientIP()
	if activeCheckouts, err := countUserDeleteBlocks(user.ID); err == nil {
		resp["active_checkouts"] = activeCheckouts
	}
	c.JSON(http.StatusOK, resp)
}

func userResponse(user *middleware.User) gin.H {
	resp := gin.H{
		"id":          user.ID,
		"sub":         user.AppleSub,
		"email":       user.Email,
		"name":        user.DisplayName,
		"locale":      user.Locale,
		"avatar_path": user.AvatarPath,
		"is_admin":    user.IsAdmin,
		"is_active":   user.IsActive,
		"permissions": user.PermissionList(),
		"last_login":  user.LastLogin,
		"created_at":  user.CreatedAt,
	}
	if user.AvatarPath != nil && strings.TrimSpace(*user.AvatarPath) != "" {
		resp["avatar_url"] = "/uploads/" + strings.TrimPrefix(*user.AvatarPath, "/")
	}

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

func getSidebarFavorites(c *gin.Context) {
	user := middleware.GetUser(c)
	favorites, err := loadSidebarFavorites(user.ID)
	if err != nil {
		log.Printf("Load sidebar favorites error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"favorites": favorites})
}

func updateSidebarFavorites(c *gin.Context) {
	user := middleware.GetUser(c)
	var body struct {
		Favorites []sidebarFavorite `json:"favorites"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}
	favorites, err := sanitizeSidebarFavorites(body.Favorites)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	raw, err := json.Marshal(favorites)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	if err := database.UpsertUserSetting(user.ID, sidebarFavoritesSettingKey, string(raw), database.TimestampNow()); err != nil {
		log.Printf("Save sidebar favorites error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"favorites": favorites})
}

func updateMe(c *gin.Context) {
	user := middleware.GetUser(c)
	var body struct {
		DisplayName *string `json:"display_name"`
		Name        *string `json:"name"`
		Email       *string `json:"email"`
		Locale      *string `json:"locale"`
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
	if normalizedLocale := normalizedUserLocale(body.Locale); normalizedLocale != nil {
		database.DB.Exec("UPDATE users SET locale = ?, updated_at = ? WHERE id = ?", *normalizedLocale, now, user.ID)
	}

	updated, err := loadVisibleUserByID(user.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}
	c.JSON(http.StatusOK, userResponse(updated))
}

func uploadMyAvatar(c *gin.Context) {
	user := middleware.GetUser(c)
	file, err := c.FormFile("file")
	if err != nil || file == nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "No file provided"})
		return
	}

	current, err := loadVisibleUserByID(user.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}

	relativeDir := path.Join("users", fmt.Sprintf("%d", user.ID), "avatar")
	destinationDir := filepath.Join(config.C.UploadDir, "users", fmt.Sprintf("%d", user.ID), "avatar")
	upload, err := storage.StoreUploadedFile(c, file, destinationDir, relativeDir)
	if err != nil {
		switch err.Error() {
		case "File too large":
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"detail": err.Error()})
		case "No file provided", "File type not allowed", "File content does not match its extension":
			c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		}
		return
	}

	if err := deleteUserAvatarFile(current.AvatarPath); err != nil {
		log.Printf("Avatar cleanup error in uploadMyAvatar: %v", err)
	}

	now := database.TimestampNow()
	if _, err := database.DB.Exec("UPDATE users SET avatar_path = ?, updated_at = ? WHERE id = ?", upload.RelativePath, now, user.ID); err != nil {
		log.Printf("DB update error in uploadMyAvatar: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	updated, err := loadVisibleUserByID(user.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}
	middleware.Audit(user.ID, "user.avatar_upload", fmt.Sprintf("user=%d file=%s", user.ID, upload.OriginalName))
	c.JSON(http.StatusOK, userResponse(updated))
}

func deleteMyAvatar(c *gin.Context) {
	user := middleware.GetUser(c)
	current, err := loadVisibleUserByID(user.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}

	if err := deleteUserAvatarFile(current.AvatarPath); err != nil {
		log.Printf("Avatar cleanup error in deleteMyAvatar: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	now := database.TimestampNow()
	if _, err := database.DB.Exec("UPDATE users SET avatar_path = NULL, updated_at = ? WHERE id = ?", now, user.ID); err != nil {
		log.Printf("DB update error in deleteMyAvatar: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	updated, err := loadVisibleUserByID(user.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}
	middleware.Audit(user.ID, "user.avatar_delete", fmt.Sprintf("user=%d", user.ID))
	c.JSON(http.StatusOK, userResponse(updated))
}

func deleteMe(c *gin.Context) {
	user := middleware.GetUser(c)
	if err := DeleteUserAccount(user.ID, user.ID, true); err != nil {
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
