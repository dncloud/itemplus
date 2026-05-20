package handlers

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
	"github.com/itemplus/backend/internal/services"
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

	database.DB.Exec(
		"UPDATE qr_login_tokens SET used = 1, confirmed_by_user_id = ? WHERE id = ?",
		user.ID, qr.ID,
	)

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

	// Confirmed — issue JWT and set cookie
	var user middleware.User
	err = database.DB.Get(&user, "SELECT * FROM users WHERE id = ?", *qr.ConfirmedByUser)
	if err != nil {
		log.Printf("DB query error in pollQRToken: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	jwtToken, _ := services.CreateToken(user.ID, user.AppleSub, user.IsAdmin)
	setAuthCookie(c, jwtToken, cookieMaxAge())
	c.JSON(http.StatusOK, gin.H{
		"status":       "confirmed",
		"access_token": jwtToken,
		"user_id":      user.ID,
		"is_admin":     user.IsAdmin,
	})
}
