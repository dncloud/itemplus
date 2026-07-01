package settings

import (
	"database/sql"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
)

var brandingHexColorRe = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

type brandingResponse struct {
	Logo           *string `json:"logo"`
	Title          string  `json:"title"`
	TitleSize      int     `json:"titleSize"`
	TitlePosition  string  `json:"titlePosition"`
	Subtitle       string  `json:"subtitle"`
	FooterText     string  `json:"footerText"`
	Width          int     `json:"width"`
	LogoBackground string  `json:"logoBackground"`
	LogoPadding    int     `json:"logoPadding"`
	LogoRadius     int     `json:"logoRadius"`
}

func GetBranding(c *gin.Context) {
	c.JSON(http.StatusOK, loadBranding())
}

func loadBranding() brandingResponse {
	var logo sql.NullString
	var title sql.NullString
	var titleSize sql.NullString
	var titlePosition sql.NullString
	var subtitle sql.NullString
	var footerText sql.NullString
	var width sql.NullString
	var logoBackground sql.NullString
	var logoPadding sql.NullString
	var logoRadius sql.NullString

	_ = database.DB.Get(&logo, "SELECT value FROM app_settings WHERE `key` = ?", "branding.logo")
	_ = database.DB.Get(&title, "SELECT value FROM app_settings WHERE `key` = ?", "branding.title")
	_ = database.DB.Get(&titleSize, "SELECT value FROM app_settings WHERE `key` = ?", "branding.title_size")
	_ = database.DB.Get(&titlePosition, "SELECT value FROM app_settings WHERE `key` = ?", "branding.title_position")
	_ = database.DB.Get(&subtitle, "SELECT value FROM app_settings WHERE `key` = ?", "branding.subtitle")
	_ = database.DB.Get(&footerText, "SELECT value FROM app_settings WHERE `key` = ?", "branding.footer_text")
	_ = database.DB.Get(&width, "SELECT value FROM app_settings WHERE `key` = ?", "branding.width")
	_ = database.DB.Get(&logoBackground, "SELECT value FROM app_settings WHERE `key` = ?", "branding.logo_background")
	_ = database.DB.Get(&logoPadding, "SELECT value FROM app_settings WHERE `key` = ?", "branding.logo_padding")
	_ = database.DB.Get(&logoRadius, "SELECT value FROM app_settings WHERE `key` = ?", "branding.logo_radius")

	resp := brandingResponse{Title: "item+", TitleSize: 17, TitlePosition: "right", Subtitle: "", FooterText: "", Width: 64, LogoBackground: "", LogoPadding: 0, LogoRadius: 6}
	if logo.Valid && strings.TrimSpace(logo.String) != "" {
		logoString := logo.String
		resp.Logo = &logoString
	}
	if title.Valid && strings.TrimSpace(title.String) != "" {
		resp.Title = title.String
	}
	if titleSize.Valid {
		if parsed, err := strconv.Atoi(strings.TrimSpace(titleSize.String)); err == nil && parsed >= 12 && parsed <= 72 {
			resp.TitleSize = parsed
		}
	}
	if titlePosition.Valid {
		parsed := strings.ToLower(strings.TrimSpace(titlePosition.String))
		if parsed == "right" || parsed == "below" {
			resp.TitlePosition = parsed
		}
	}
	if subtitle.Valid {
		resp.Subtitle = subtitle.String
	}
	if footerText.Valid {
		resp.FooterText = footerText.String
	}
	if width.Valid {
		if parsed, err := strconv.Atoi(strings.TrimSpace(width.String)); err == nil && parsed >= 20 && parsed <= 480 {
			resp.Width = parsed
		}
	}
	if logoBackground.Valid && brandingHexColorRe.MatchString(strings.TrimSpace(logoBackground.String)) {
		resp.LogoBackground = strings.TrimSpace(logoBackground.String)
	}
	if logoPadding.Valid {
		if parsed, err := strconv.Atoi(strings.TrimSpace(logoPadding.String)); err == nil && parsed >= 0 && parsed <= 64 {
			resp.LogoPadding = parsed
		}
	}
	if logoRadius.Valid {
		if parsed, err := strconv.Atoi(strings.TrimSpace(logoRadius.String)); err == nil && parsed >= 0 && parsed <= 64 {
			resp.LogoRadius = parsed
		}
	}
	return resp
}
