package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"log"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
	"github.com/itemplus/backend/internal/services"
	"github.com/itemplus/backend/internal/ws"
)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// ── WebSocket Ticket Store ──

type wsTicket struct {
	UserID int
	Expiry time.Time
	Used   bool
}

var (
	wsTickets   = make(map[string]*wsTicket)
	wsTicketsMu sync.Mutex
)

func init() {
	// Periodically clean up expired tickets
	go func() {
		for {
			time.Sleep(30 * time.Second)
			wsTicketsMu.Lock()
			now := time.Now()
			for k, t := range wsTickets {
				if now.After(t.Expiry) || t.Used {
					delete(wsTickets, k)
				}
			}
			wsTicketsMu.Unlock()
		}
	}()
}

// ValidateWSTicket checks a WebSocket ticket and returns the user ID if valid.
// The ticket is consumed (single-use).
func ValidateWSTicket(ticket string) (int, bool) {
	wsTicketsMu.Lock()
	defer wsTicketsMu.Unlock()
	t, ok := wsTickets[ticket]
	if !ok || t.Used || time.Now().After(t.Expiry) {
		if ok {
			delete(wsTickets, ticket)
		}
		return 0, false
	}
	t.Used = true
	userID := t.UserID
	delete(wsTickets, ticket)
	return userID, true
}

func RegisterAuthRoutes(g *gin.RouterGroup) {
	authRL := middleware.RateLimit(5, time.Minute)
	g.POST("/apple", authRL, appleLogin)
	g.GET("/status", middleware.AuthAllowInactive(), authStatus)
	g.POST("/magic/request", authRL, magicLinkRequest)
	g.POST("/magic/verify", magicLinkVerify)
	g.POST("/logout", authLogout)
	g.POST("/ws-ticket", middleware.Auth(), wsTicketGenerate)
}

func randomURLToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

func resolvedLoginEmail(explicit *string, fallback string) *string {
	if explicit != nil && strings.TrimSpace(*explicit) != "" {
		return explicit
	}
	if strings.TrimSpace(fallback) == "" {
		return nil
	}
	return &fallback
}

func createUserForLogin(appleSub string, email *string, displayName *string) (*middleware.User, bool, error) {
	var count int
	database.DB.Get(&count, "SELECT COUNT(*) FROM users")
	isFirst := count == 0
	isActive := isFirst || config.C.AutoActivated
	now := database.TimestampNow()

	result, err := database.DB.Exec(
		"INSERT INTO users (apple_sub, email, display_name, is_admin, is_active, permissions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '[]', ?, ?)",
		appleSub, email, displayName, isFirst, isActive, now, now,
	)
	if err != nil {
		return nil, false, err
	}

	newID, _ := result.LastInsertId()
	var user middleware.User
	if err := database.DB.Get(&user, "SELECT * FROM users WHERE id = ?", newID); err != nil {
		return nil, false, err
	}

	if !isFirst {
		ws.M.SendToAdmins("admin.new_user_registered", map[string]interface{}{"user_id": newID})
	}

	regEmail := ""
	if email != nil {
		regEmail = *email
	}
	audit(int(newID), "auth.register", "email="+regEmail)
	return &user, isFirst, nil
}

// setAuthCookie sets the HttpOnly auth cookie on the response.
func setAuthCookie(c *gin.Context, token string, maxAge int) {
	secure := requestIsHTTPS(c)
	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie("itemplus_token", token, maxAge, "/", "", secure, true)
}

func requestIsHTTPS(c *gin.Context) bool {
	if c.Request.TLS != nil {
		return true
	}
	if !config.RequestCameThroughTrustedProxy(c.Request.RemoteAddr) {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")), "https")
}

// cookieMaxAge returns the cookie max-age in seconds based on JWT expiry config.
func cookieMaxAge() int {
	return config.C.JWTExpiryDays * 24 * 60 * 60
}

func appleLogin(c *gin.Context) {
	var body struct {
		IdentityToken string  `json:"identity_token"`
		Email         *string `json:"email"`
		DisplayName   *string `json:"display_name"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	claims, err := services.DecodeAppleToken(body.IdentityToken)
	if err != nil {
		log.Printf("Apple token verification failed: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Invalid Apple token"})
		return
	}

	appleSub := claims.Subject

	var user middleware.User
	err = database.DB.Get(&user, "SELECT * FROM users WHERE apple_sub = ?", appleSub)
	if err != nil {
		// Try matching by email (e.g. seed user with placeholder apple_sub)
		email := body.Email
		if email == nil && claims.Email != "" {
			email = &claims.Email
		}
		if email != nil && *email != "" {
			if emailErr := database.DB.Get(&user, "SELECT * FROM users WHERE email = ?", *email); emailErr == nil {
				// Found by email — update apple_sub to real one
				database.DB.Exec("UPDATE users SET apple_sub = ? WHERE id = ?", appleSub, user.ID)
				user.AppleSub = appleSub
				err = nil
			}
		}
	}
	if err != nil {
		email := resolvedLoginEmail(body.Email, claims.Email)
		createdUser, _, insertErr := createUserForLogin(appleSub, email, body.DisplayName)
		if insertErr != nil {
			log.Printf("Apple login user insert failed: %v", insertErr)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Benutzer konnte nicht angelegt werden"})
			return
		}
		user = *createdUser
	}

	database.DB.Exec("UPDATE users SET last_login = ? WHERE id = ?", database.TimestampNow(), user.ID)

	token, _ := services.CreateToken(user.ID, user.AppleSub, user.IsAdmin)

	email := ""
	if user.Email != nil {
		email = *user.Email
	}
	audit(user.ID, "auth.apple", "email="+email)

	setAuthCookie(c, token, cookieMaxAge())
	c.JSON(http.StatusOK, gin.H{
		"access_token": token,
		"user_id":      user.ID,
		"is_admin":     user.IsAdmin,
		"is_active":    user.IsActive,
	})
}

func authStatus(c *gin.Context) {
	user := middleware.GetUser(c)
	c.JSON(http.StatusOK, gin.H{
		"is_active": user.IsActive,
		"is_admin":  user.IsAdmin,
	})
}

func magicLinkRequest(c *gin.Context) {
	var body struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	email := strings.TrimSpace(strings.ToLower(body.Email))
	if email == "" || !emailRegex.MatchString(email) {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid email"})
		return
	}

	token, err := randomURLToken(36)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Token could not be created"})
		return
	}
	expiry := time.Now().UTC().Add(time.Duration(config.C.MagicLinkExpiryMinutes) * time.Minute)

	database.DB.Exec(
		"INSERT INTO magic_link_tokens (email, token, expires_at, used) VALUES (?, ?, ?, 0)",
		email, token, database.TimestampAt(expiry),
	)

	// Check if user exists
	var existing middleware.User
	isNew := database.DB.Get(&existing, "SELECT * FROM users WHERE email = ?", email) != nil

	sent := services.SendMagicLink(email, token, isNew)
	if !sent {
		c.JSON(http.StatusServiceUnavailable, gin.H{"detail": "E-Mail konnte nicht gesendet werden"})
		return
	}

	audit(0, "auth.magic_request", "email="+email)
	c.JSON(http.StatusOK, gin.H{"status": "sent"})
}

func magicLinkVerify(c *gin.Context) {
	var body struct {
		Token string `json:"token"`
	}
	_ = c.ShouldBindJSON(&body)
	token := body.Token
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Token required"})
		return
	}

	var ml struct {
		ID        int    `db:"id"`
		Email     string `db:"email"`
		ExpiresAt string `db:"expires_at"`
	}
	err := database.DB.Get(&ml, "SELECT id, email, expires_at FROM magic_link_tokens WHERE token = ? AND used = 0", token)
	if err != nil {
		log.Printf("Magic link verify failed: %v (token=%s...)", err, token[:min(len(token), 10)])
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Ungültiger oder abgelaufener Link"})
		return
	}

	expiry, parseErr := database.ParseTimestamp(ml.ExpiresAt)
	if parseErr != nil {
		log.Printf("Magic link expiry parse error: %v (value=%s)", parseErr, ml.ExpiresAt)
	}
	if time.Now().UTC().After(expiry) {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Ungültiger oder abgelaufener Link"})
		return
	}

	var user middleware.User
	err = database.DB.Get(&user, "SELECT * FROM users WHERE email = ?", ml.Email)
	if err == sql.ErrNoRows {
		createdUser, _, insertErr := createUserForLogin("magic_"+ml.Email, &ml.Email, nil)
		if insertErr != nil {
			log.Printf("Magic link user insert failed: %v (email=%s)", insertErr, ml.Email)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Benutzer konnte nicht angelegt werden"})
			return
		}
		user = *createdUser
	} else if err != nil {
		log.Printf("Magic link user lookup failed: %v (email=%s)", err, ml.Email)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Benutzer konnte nicht geladen werden"})
		return
	}

	if _, err := database.DB.Exec("UPDATE magic_link_tokens SET used = 1 WHERE id = ?", ml.ID); err != nil {
		log.Printf("Magic link token update failed: %v (id=%d)", err, ml.ID)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Link konnte nicht verarbeitet werden"})
		return
	}

	database.DB.Exec("UPDATE users SET last_login = ? WHERE id = ?", database.TimestampNow(), user.ID)

	audit(user.ID, "auth.magic_verify", "email="+ml.Email)

	jwtToken, _ := services.CreateToken(user.ID, user.AppleSub, user.IsAdmin)
	setAuthCookie(c, jwtToken, cookieMaxAge())
	c.JSON(http.StatusOK, gin.H{
		"access_token": jwtToken,
		"user_id":      user.ID,
		"is_admin":     user.IsAdmin,
		"is_active":    user.IsActive,
	})
}

// ── Logout ──

func authLogout(c *gin.Context) {
	secure := requestIsHTTPS(c)
	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie("itemplus_token", "", -1, "/", "", secure, true)
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// ── WebSocket Ticket ──

func wsTicketGenerate(c *gin.Context) {
	user := middleware.GetUser(c)

	ticket, err := randomURLToken(32)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Ticket could not be created"})
		return
	}

	wsTicketsMu.Lock()
	wsTickets[ticket] = &wsTicket{
		UserID: user.ID,
		Expiry: time.Now().Add(30 * time.Second),
	}
	wsTicketsMu.Unlock()

	c.JSON(http.StatusOK, gin.H{"ticket": ticket})
}
