package auth

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	authcore "github.com/itemplus/backend/internal/core/auth"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

const qrTokenExpiry = 120 // seconds

func RegisterQRLoginRoutes(g *gin.RouterGroup) {
	g.POST("/qr", middleware.RateLimit(10, time.Minute), createQRToken)
	g.POST("/qr/confirm", middleware.Auth(), confirmQRToken)
	g.GET("/qr/:token/status", middleware.RateLimit(60, time.Minute), pollQRToken) // Polls every 2s
}

func createQRToken(c *gin.Context) {
	token, err := randomURLToken(32)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	expiry := time.Now().UTC().Add(time.Duration(qrTokenExpiry) * time.Second)

	_, err = database.DB.Exec(
		"INSERT INTO qr_login_tokens (token, expires_at, used) VALUES (?, ?, 0)",
		token, database.TimestampAt(expiry),
	)
	if err != nil {
		log.Printf("DB insert error in createQRToken: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"qr_token":   token,
		"expires_in": qrTokenExpiry,
		"qr_value":   fmt.Sprintf("itemplus://login/%s", token),
	})
}

func confirmQRToken(c *gin.Context) {
	user := middleware.GetUser(c)
	var body struct {
		QRToken string `json:"qr_token"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.QRToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "qr_token required"})
		return
	}

	var qr struct {
		ID        int    `db:"id"`
		ExpiresAt string `db:"expires_at"`
		Used      bool   `db:"used"`
	}
	err := database.DB.Get(&qr, "SELECT id, expires_at, used FROM qr_login_tokens WHERE token = ? AND used = 0", body.QRToken)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Token not found or already used"})
		return
	}

	expiry, _ := database.ParseTimestamp(qr.ExpiresAt)
	if time.Now().UTC().After(expiry) {
		c.JSON(http.StatusGone, gin.H{"detail": "Token expired"})
		return
	}

	// Conditional update: of two simultaneous confirmations only one wins.
	result, err := database.DB.Exec(
		"UPDATE qr_login_tokens SET used = 1, confirmed_by_user_id = ? WHERE id = ? AND used = 0",
		user.ID, qr.ID,
	)
	if err != nil {
		log.Printf("DB update error in confirmQRToken: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Token not found or already used"})
		return
	}

	displayName := ""
	if user.DisplayName != nil {
		displayName = *user.DisplayName
	}
	c.JSON(http.StatusOK, gin.H{
		"status":       "confirmed",
		"user_id":      user.ID,
		"display_name": displayName,
	})
}

func pollQRToken(c *gin.Context) {
	token := c.Param("token")

	var qr struct {
		ID              int    `db:"id"`
		ExpiresAt       string `db:"expires_at"`
		Used            bool   `db:"used"`
		ConfirmedByUser *int   `db:"confirmed_by_user_id"`
	}
	err := database.DB.Get(&qr, "SELECT id, expires_at, used, confirmed_by_user_id FROM qr_login_tokens WHERE token = ?", token)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Token not found"})
		return
	}

	expiry, _ := database.ParseTimestamp(qr.ExpiresAt)
	if time.Now().UTC().After(expiry) {
		c.JSON(http.StatusOK, gin.H{"status": "expired"})
		return
	}

	if !qr.Used || qr.ConfirmedByUser == nil {
		c.JSON(http.StatusOK, gin.H{"status": "pending"})
		return
	}

	// Confirmed. The session is handed out exactly once: the token is removed
	// first, so anyone else who saw or photographed the QR code and polls with
	// it afterwards gets nothing.
	result, err := database.DB.Exec("DELETE FROM qr_login_tokens WHERE id = ?", qr.ID)
	if err != nil {
		log.Printf("DB delete error in pollQRToken: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Token not found"})
		return
	}

	found, err := loadVisibleUserByID(*qr.ConfirmedByUser)
	if err != nil || !found.IsActive {
		c.JSON(http.StatusForbidden, gin.H{"detail": "Account not available"})
		return
	}
	user := *found

	jwtToken, err := authcore.CreateToken(user.ID, user.AppleSub, user.IsAdmin)
	if err != nil {
		log.Printf("Token creation failed in pollQRToken: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	setAuthCookie(c, jwtToken, cookieMaxAge())
	c.JSON(http.StatusOK, gin.H{
		"status":       "confirmed",
		"access_token": jwtToken,
		"user_id":      user.ID,
		"is_admin":     user.IsAdmin,
	})
}
