package auth

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
	authcore "github.com/itemplus/backend/internal/core/auth"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

func appleLogin(c *gin.Context) {
	// The body deliberately has no e-mail field: an address supplied by the
	// client proves nothing. Accounts are matched only by what Apple signed.
	var body struct {
		IdentityToken string  `json:"identity_token"`
		DisplayName   *string `json:"display_name"`
		Locale        *string `json:"locale"`
		CreateAccount *bool   `json:"create_account"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	claims, err := decodeAppleToken(body.IdentityToken)
	if err != nil {
		log.Printf("Apple token verification failed: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Invalid Apple token"})
		return
	}

	appleSub := claims.Subject
	verifiedEmail := claims.VerifiedEmail()
	createAccount := body.CreateAccount == nil || *body.CreateAccount

	var user middleware.User
	found, err := findAppleLoginUser(appleSub, verifiedEmail)
	switch {
	case errors.Is(err, errAppleIdentityConflict):
		c.JSON(http.StatusConflict, gin.H{
			"detail": "This account is already linked to a different Apple ID",
			"code":   "apple_identity_conflict",
		})
		return
	case errors.Is(err, sql.ErrNoRows):
		var email *string
		if verifiedEmail != "" {
			email = &verifiedEmail
		}
		if !createAccount {
			c.JSON(http.StatusNotFound, gin.H{
				"detail":       "No account exists for this identity",
				"code":         "account_not_found",
				"email":        email,
				"display_name": body.DisplayName,
			})
			return
		}
		createdUser, _, insertErr := createUserForLogin(appleSub, email, body.DisplayName, body.Locale)
		if insertErr != nil {
			log.Printf("Apple login user insert failed: %v", insertErr)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Benutzer konnte nicht angelegt werden"})
			return
		}
		user = *createdUser
	case err != nil:
		log.Printf("Apple login user lookup failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Benutzer konnte nicht geladen werden"})
		return
	default:
		user = *found
		if normalizedLocale := normalizedUserLocale(body.Locale); normalizedLocale != nil {
			database.DB.Exec("UPDATE users SET locale = ?, updated_at = ? WHERE id = ?", *normalizedLocale, database.TimestampNow(), user.ID)
			user.Locale = normalizedLocale
		}
	}
	database.DB.Exec("UPDATE users SET last_login = ? WHERE id = ?", database.TimestampNow(), user.ID)

	token, _ := authcore.CreateToken(user.ID, user.AppleSub, user.IsAdmin)

	email := ""
	if user.Email != nil {
		email = *user.Email
	}
	middleware.Audit(user.ID, "auth.apple", "email="+email)

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
		Email  string  `json:"email"`
		Locale *string `json:"locale"`
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
		"INSERT INTO magic_link_tokens (email, locale, token, expires_at, used) VALUES (?, ?, ?, ?, 0)",
		email, normalizedUserLocale(body.Locale), token, database.TimestampAt(expiry),
	)

	var existing middleware.User
	isNew := database.DB.Get(&existing, userByEmailQuery, email) != nil

	if err := authcore.SendMagicLink(email, token, isNew, stringValueOrDefault(body.Locale, "")); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"detail": "E-Mail konnte nicht gesendet werden"})
		return
	}

	middleware.Audit(0, "auth.magic_request", "email="+email)
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
		ID        int     `db:"id"`
		Email     string  `db:"email"`
		Locale    *string `db:"locale"` // NULL when the link was requested without a language
		ExpiresAt string  `db:"expires_at"`
	}
	err := database.DB.Get(&ml, "SELECT id, email, locale, expires_at FROM magic_link_tokens WHERE token = ? AND used = 0", token)
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

	// Redeem the link before doing anything else. The condition makes this
	// atomic: of two simultaneous requests with the same link only one signs in.
	redeemed, err := database.DB.Exec("UPDATE magic_link_tokens SET used = 1 WHERE id = ? AND used = 0", ml.ID)
	if err != nil {
		log.Printf("Magic link token update failed: %v (id=%d)", err, ml.ID)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Link konnte nicht verarbeitet werden"})
		return
	}
	if affected, _ := redeemed.RowsAffected(); affected == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Ungültiger oder abgelaufener Link"})
		return
	}

	var user middleware.User
	err = database.DB.Get(&user, userByEmailQuery, strings.ToLower(strings.TrimSpace(ml.Email)))
	if err == sql.ErrNoRows {
		createdUser, _, insertErr := createUserForLogin("magic_"+ml.Email, &ml.Email, nil, ml.Locale)
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
	if normalizedLocale := normalizedUserLocale(ml.Locale); normalizedLocale != nil {
		database.DB.Exec("UPDATE users SET locale = ?, updated_at = ? WHERE id = ?", *normalizedLocale, database.TimestampNow(), user.ID)
		user.Locale = normalizedLocale
	}

	database.DB.Exec("UPDATE users SET last_login = ? WHERE id = ?", database.TimestampNow(), user.ID)

	middleware.Audit(user.ID, "auth.magic_verify", "email="+ml.Email)

	jwtToken, _ := authcore.CreateToken(user.ID, user.AppleSub, user.IsAdmin)
	setAuthCookie(c, jwtToken, cookieMaxAge())
	c.JSON(http.StatusOK, gin.H{
		"access_token": jwtToken,
		"user_id":      user.ID,
		"is_admin":     user.IsAdmin,
		"is_active":    user.IsActive,
	})
}

func authLogout(c *gin.Context) {
	secure := requestIsHTTPS(c)
	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie("itemplus_token", "", -1, "/", "", secure, true)
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func stringValueOrDefault(value *string, fallback string) string {
	if value == nil {
		return fallback
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return fallback
	}
	return trimmed
}
