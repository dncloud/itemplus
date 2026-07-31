package auth

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
	ws "github.com/itemplus/backend/internal/websocket"
)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

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

func normalizedUserLocale(locale *string) *string {
	if locale == nil {
		return nil
	}
	trimmed := strings.ToLower(strings.TrimSpace(*locale))
	if trimmed == "" {
		return nil
	}
	normalized := "en"
	if strings.HasPrefix(trimmed, "de") {
		normalized = "de"
	}
	return &normalized
}

func createUserForLogin(appleSub string, email *string, displayName *string, locale *string) (*middleware.User, bool, error) {
	count := countVisibleUsers()
	isFirst := count == 0
	isActive := isFirst || config.C.AutoActivated
	permissions := "[]"
	userLocale := normalizedUserLocale(locale)
	if !isFirst && config.C.IOSReviewPermissions {
		if data, err := json.Marshal(middleware.PERMISSIONS); err == nil {
			permissions = string(data)
		}
	}
	now := database.TimestampNow()

	result, err := database.DB.Exec(
		"INSERT INTO users (apple_sub, email, display_name, locale, is_admin, is_active, permissions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		appleSub, email, displayName, userLocale, isFirst, isActive, permissions, now, now,
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
	middleware.Audit(int(newID), "auth.register", "email="+regEmail)
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
