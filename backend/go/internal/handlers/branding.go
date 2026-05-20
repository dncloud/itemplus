package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
)

type brandingResponse struct {
	Logo       *string `json:"logo"`
	Subtitle   string  `json:"subtitle"`
	FooterText string  `json:"footerText"`
	Width      int     `json:"width"`
}

func GetBranding(c *gin.Context) {
	c.JSON(http.StatusOK, loadBranding())
}

func adminUpdateBranding(c *gin.Context) {
	var body struct {
		Logo       *string `json:"logo"`
		Subtitle   *string `json:"subtitle"`
		FooterText *string `json:"footerText"`
		Width      *int    `json:"width"`
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

	footerText := ""
	if body.FooterText != nil {
		footerText = strings.TrimSpace(*body.FooterText)
		if len(footerText) > 200 {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Footer text too long"})
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

	now := database.TimestampNow()
	if logoValue == nil {
		if _, err := database.DB.Exec("DELETE FROM app_settings WHERE `key` = ?", "branding.logo"); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not save branding"})
			return
		}
	} else {
		if err := database.UpsertAppSetting("branding.logo", *logoValue, now); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not save branding"})
			return
		}
	}

	if err := database.UpsertAppSetting("branding.subtitle", subtitle, now); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not save branding"})
		return
	}
	if err := database.UpsertAppSetting("branding.footer_text", footerText, now); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not save branding"})
		return
	}
	if err := database.UpsertAppSetting("branding.width", strconv.Itoa(width), now); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not save branding"})
		return
	}

	user := middleware.GetUser(c)
	audit(user.ID, "branding.update", "site branding updated")
	c.JSON(http.StatusOK, loadBranding())
}

func adminResetBranding(c *gin.Context) {
	if _, err := database.DB.Exec(
		"DELETE FROM app_settings WHERE `key` IN (?, ?, ?, ?)",
		"branding.logo",
		"branding.subtitle",
		"branding.footer_text",
		"branding.width",
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not reset branding"})
		return
	}
	user := middleware.GetUser(c)
	audit(user.ID, "branding.reset", "site branding reset")
	c.JSON(http.StatusOK, loadBranding())
}

func loadBranding() brandingResponse {
	var logo sql.NullString
	var subtitle sql.NullString
	var footerText sql.NullString
	var width sql.NullString

	_ = database.DB.Get(&logo, "SELECT value FROM app_settings WHERE `key` = ?", "branding.logo")
	_ = database.DB.Get(&subtitle, "SELECT value FROM app_settings WHERE `key` = ?", "branding.subtitle")
	_ = database.DB.Get(&footerText, "SELECT value FROM app_settings WHERE `key` = ?", "branding.footer_text")
	_ = database.DB.Get(&width, "SELECT value FROM app_settings WHERE `key` = ?", "branding.width")

	resp := brandingResponse{Subtitle: "", FooterText: "", Width: 180}
	if logo.Valid && strings.TrimSpace(logo.String) != "" {
		logoString := logo.String
		resp.Logo = &logoString
	}
	if subtitle.Valid {
		resp.Subtitle = subtitle.String
	}
	if footerText.Valid {
		resp.FooterText = footerText.String
	}
	if width.Valid {
		if parsed, err := strconv.Atoi(strings.TrimSpace(width.String)); err == nil && parsed >= 80 && parsed <= 480 {
			resp.Width = parsed
		}
	}
	return resp
}
