package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
)

type brandingResponse struct {
	Logo     *string `json:"logo"`
	Subtitle string  `json:"subtitle"`
	Width    int     `json:"width"`
}

func GetBranding(c *gin.Context) {
	c.JSON(http.StatusOK, loadBranding())
}

func adminUpdateBranding(c *gin.Context) {
	var body struct {
		Logo     *string `json:"logo"`
		Subtitle *string `json:"subtitle"`
		Width    *int    `json:"width"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	subtitle := ""
	if body.Subtitle != nil {
		subtitle = strings.TrimSpace(*body.Subtitle)
		if len(subtitle) > 200 {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Subtitle too long"})
			return
		}
	}

	var logoValue *string
	if body.Logo != nil {
		trimmed := strings.TrimSpace(*body.Logo)
		if trimmed != "" {
			if !strings.HasPrefix(trimmed, "data:image/") {
				c.JSON(http.StatusBadRequest, gin.H{"detail": "Logo must be an image data URL"})
				return
			}
			if len(trimmed) > 3*1024*1024 {
				c.JSON(http.StatusBadRequest, gin.H{"detail": "Logo is too large"})
				return
			}
			logoValue = &trimmed
		}
	}

	width := 180
	if body.Width != nil {
		width = *body.Width
	}
	if width < 80 || width > 480 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Width must be between 80 and 480 px"})
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if logoValue == nil {
		database.DB.MustExec("DELETE FROM app_settings WHERE key = ?", "branding.logo")
	} else {
		database.DB.MustExec(
			"INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
			"branding.logo", *logoValue, now,
		)
	}

	database.DB.MustExec(
		"INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
		"branding.subtitle", subtitle, now,
	)
	database.DB.MustExec(
		"INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
		"branding.width", strconv.Itoa(width), now,
	)

	user := middleware.GetUser(c)
	audit(user.ID, "branding.update", "site branding updated")
	c.JSON(http.StatusOK, loadBranding())
}

func adminResetBranding(c *gin.Context) {
	database.DB.MustExec("DELETE FROM app_settings WHERE key IN (?, ?, ?)", "branding.logo", "branding.subtitle", "branding.width")
	user := middleware.GetUser(c)
	audit(user.ID, "branding.reset", "site branding reset")
	c.JSON(http.StatusOK, loadBranding())
}

func loadBranding() brandingResponse {
	var logo sql.NullString
	var subtitle sql.NullString
	var width sql.NullString

	_ = database.DB.Get(&logo, "SELECT value FROM app_settings WHERE key = ?", "branding.logo")
	_ = database.DB.Get(&subtitle, "SELECT value FROM app_settings WHERE key = ?", "branding.subtitle")
	_ = database.DB.Get(&width, "SELECT value FROM app_settings WHERE key = ?", "branding.width")

	resp := brandingResponse{Subtitle: "", Width: 180}
	if logo.Valid && strings.TrimSpace(logo.String) != "" {
		logoString := logo.String
		resp.Logo = &logoString
	}
	if subtitle.Valid {
		resp.Subtitle = subtitle.String
	}
	if width.Valid {
		if parsed, err := strconv.Atoi(strings.TrimSpace(width.String)); err == nil && parsed >= 80 && parsed <= 480 {
			resp.Width = parsed
		}
	}
	return resp
}
