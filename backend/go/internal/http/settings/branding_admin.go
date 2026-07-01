package settings

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

func AdminUpdateBranding(c *gin.Context) {
	var body struct {
		Logo           *string `json:"logo"`
		Title          *string `json:"title"`
		TitleSize      *int    `json:"titleSize"`
		TitlePosition  *string `json:"titlePosition"`
		Subtitle       *string `json:"subtitle"`
		FooterText     *string `json:"footerText"`
		Width          *int    `json:"width"`
		LogoBackground *string `json:"logoBackground"`
		LogoPadding    *int    `json:"logoPadding"`
		LogoRadius     *int    `json:"logoRadius"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	title := "item+"
	if body.Title != nil {
		title = strings.TrimSpace(*body.Title)
		if len(title) > 80 {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Title too long"})
			return
		}
		if title == "" {
			title = "item+"
		}
	}

	titleSize := 17
	if body.TitleSize != nil {
		titleSize = *body.TitleSize
	}
	if titleSize < 12 || titleSize > 72 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Title size must be between 12 and 72 px"})
		return
	}

	titlePosition := "right"
	if body.TitlePosition != nil {
		titlePosition = strings.ToLower(strings.TrimSpace(*body.TitlePosition))
	}
	if titlePosition != "right" && titlePosition != "below" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Title position must be right or below"})
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

	width := 64
	if body.Width != nil {
		width = *body.Width
	}
	if width < 20 || width > 480 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Width must be between 20 and 480 px"})
		return
	}

	logoBackground := ""
	if body.LogoBackground != nil {
		logoBackground = strings.TrimSpace(*body.LogoBackground)
		if logoBackground != "" && !brandingHexColorRe.MatchString(logoBackground) {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Logo background must be a hex color like #ffffff"})
			return
		}
	}

	logoPadding := 0
	if body.LogoPadding != nil {
		logoPadding = *body.LogoPadding
	}
	if logoPadding < 0 || logoPadding > 64 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Logo padding must be between 0 and 64 px"})
		return
	}

	logoRadius := 6
	if body.LogoRadius != nil {
		logoRadius = *body.LogoRadius
	}
	if logoRadius < 0 || logoRadius > 64 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Logo radius must be between 0 and 64 px"})
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

	if err := database.UpsertAppSetting("branding.title", title, now); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not save branding"})
		return
	}
	if err := database.UpsertAppSetting("branding.title_size", strconv.Itoa(titleSize), now); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not save branding"})
		return
	}
	if err := database.UpsertAppSetting("branding.title_position", titlePosition, now); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not save branding"})
		return
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
	if logoBackground == "" {
		if _, err := database.DB.Exec("DELETE FROM app_settings WHERE `key` = ?", "branding.logo_background"); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not save branding"})
			return
		}
	} else {
		if err := database.UpsertAppSetting("branding.logo_background", logoBackground, now); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not save branding"})
			return
		}
	}
	if err := database.UpsertAppSetting("branding.logo_padding", strconv.Itoa(logoPadding), now); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not save branding"})
		return
	}
	if err := database.UpsertAppSetting("branding.logo_radius", strconv.Itoa(logoRadius), now); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not save branding"})
		return
	}

	user := middleware.GetUser(c)
	middleware.Audit(user.ID, "branding.update", "site branding updated")
	c.JSON(http.StatusOK, loadBranding())
}

func AdminResetBranding(c *gin.Context) {
	if _, err := database.DB.Exec(
		"DELETE FROM app_settings WHERE `key` IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		"branding.logo",
		"branding.title",
		"branding.title_size",
		"branding.title_position",
		"branding.subtitle",
		"branding.footer_text",
		"branding.width",
		"branding.logo_background",
		"branding.logo_padding",
		"branding.logo_radius",
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not reset branding"})
		return
	}
	user := middleware.GetUser(c)
	middleware.Audit(user.ID, "branding.reset", "site branding reset")
	c.JSON(http.StatusOK, loadBranding())
}
