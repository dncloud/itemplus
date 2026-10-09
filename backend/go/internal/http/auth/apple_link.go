package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"errors"
	"log"
	"math/big"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	authcore "github.com/itemplus/backend/internal/core/auth"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

// Attaching an Apple ID to an account that was registered by e-mail, for the
// cases the automatic match in findAppleLoginUser cannot cover (the Apple ID
// uses a different or hidden address). The user proves ownership of both
// sides: the Apple ID through Apple's signed token, the account either through
// a code mailed to its address or through a QR code shown in a signed-in
// web session.

const (
	appleLinkKindEmail = "email"
	appleLinkKindQR    = "qr"

	appleLinkCodeExpiry  = 10 * time.Minute
	appleLinkQRExpiry    = 120 * time.Second
	appleLinkMaxAttempts = 5
	appleLinkQRScheme    = "itemplus://link-apple/"
)

// Indirections so tests can run without Apple's key server or an SMTP host.
var (
	decodeAppleToken  = authcore.DecodeAppleToken
	sendAppleLinkCode = authcore.SendAppleLinkCode
)

var errAppleIdentityInUse = errors.New("Apple ID is already linked to an account")

type appleLinkToken struct {
	ID        int            `db:"id"`
	Token     string         `db:"token"`
	Kind      string         `db:"kind"`
	UserID    sql.NullInt64  `db:"user_id"`
	AppleSub  sql.NullString `db:"apple_sub"`
	CodeHash  sql.NullString `db:"code_hash"`
	Attempts  int            `db:"attempts"`
	ExpiresAt string         `db:"expires_at"`
	Used      bool           `db:"used"`
}

func (t *appleLinkToken) expired() bool {
	expiry, err := database.ParseTimestamp(t.ExpiresAt)
	return err != nil || time.Now().UTC().After(expiry)
}

func registerAppleLinkRoutes(g *gin.RouterGroup) {
	// Own buckets: limiters with identical settings share their counters.
	requestRL := middleware.RateLimit(6, time.Minute)
	confirmRL := middleware.RateLimit(12, time.Minute)

	g.POST("/email/request", requestRL, appleLinkEmailRequest)
	g.POST("/email/confirm", confirmRL, appleLinkEmailConfirm)
	g.POST("/qr", middleware.Auth(), appleLinkQRCreate)
	g.GET("/qr/:token/status", middleware.Auth(), appleLinkQRStatus)
	g.POST("/qr/confirm", confirmRL, appleLinkQRConfirm)
}

// verifiedAppleSubject validates the identity token and makes sure the Apple
// ID is still free. It writes the error response itself.
func verifiedAppleSubject(c *gin.Context, identityToken string) (string, bool) {
	claims, err := decodeAppleToken(identityToken)
	if err != nil {
		log.Printf("Apple token verification failed: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Invalid Apple token"})
		return "", false
	}
	var count int
	if err := database.DB.Get(&count, "SELECT COUNT(*) FROM users WHERE apple_sub = ?", claims.Subject); err != nil {
		log.Printf("Apple link lookup failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return "", false
	}
	if count > 0 {
		respondAppleLinkError(c, errAppleIdentityInUse)
		return "", false
	}
	return claims.Subject, true
}

func respondAppleLinkError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, errAppleIdentityInUse):
		c.JSON(http.StatusConflict, gin.H{"detail": "This Apple ID is already linked to an account", "code": "apple_identity_in_use"})
	case errors.Is(err, errAppleIdentityConflict):
		c.JSON(http.StatusConflict, gin.H{"detail": "This account is already linked to a different Apple ID", "code": "apple_identity_conflict"})
	default:
		log.Printf("Apple link failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
	}
}

// linkAppleIdentity attaches appleSub to the account, but only while the
// account still has no Apple ID of its own.
func linkAppleIdentity(userID int64, appleSub string) (*middleware.User, error) {
	result, err := database.DB.Exec(
		"UPDATE users SET apple_sub = ?, updated_at = ? WHERE id = ? AND (apple_sub LIKE 'bootstrap_%' OR apple_sub LIKE 'magic_%')",
		appleSub, database.TimestampNow(), userID,
	)
	if err != nil {
		// apple_sub is unique: a concurrent sign-in may have taken the Apple ID.
		var count int
		if database.DB.Get(&count, "SELECT COUNT(*) FROM users WHERE apple_sub = ?", appleSub) == nil && count > 0 {
			return nil, errAppleIdentityInUse
		}
		return nil, err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return nil, errAppleIdentityConflict
	}
	return loadVisibleUserByID(userID)
}

// consumeAppleLinkToken marks the token used; false means someone else was faster.
func consumeAppleLinkToken(id int) bool {
	result, err := database.DB.Exec("UPDATE apple_link_tokens SET used = 1 WHERE id = ? AND used = 0", id)
	if err != nil {
		return false
	}
	affected, _ := result.RowsAffected()
	return affected == 1
}

func storeAppleLinkToken(token, kind string, userID int, appleSub, codeHash interface{}, lifetime time.Duration) error {
	now := time.Now().UTC()
	database.DB.Exec("DELETE FROM apple_link_tokens WHERE expires_at < ?", database.TimestampAt(now.Add(-time.Hour)))
	_, err := database.DB.Exec(
		"INSERT INTO apple_link_tokens (token, kind, user_id, apple_sub, code_hash, attempts, expires_at, used) VALUES (?, ?, ?, ?, ?, 0, ?, 0)",
		token, kind, userID, appleSub, codeHash, database.TimestampAt(now.Add(lifetime)),
	)
	return err
}

// respondWithSession signs the user in, exactly like a regular login.
func respondWithSession(c *gin.Context, user *middleware.User, auditAction string) {
	database.DB.Exec("UPDATE users SET last_login = ? WHERE id = ?", database.TimestampNow(), user.ID)
	middleware.Audit(user.ID, auditAction, "email="+middleware.StringValue(user.Email))

	token, err := authcore.CreateToken(user.ID, user.AppleSub, user.IsAdmin)
	if err != nil {
		log.Printf("Token creation failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	setAuthCookie(c, token, cookieMaxAge())
	c.JSON(http.StatusOK, gin.H{
		"access_token": token,
		"user_id":      user.ID,
		"is_admin":     user.IsAdmin,
		"is_active":    user.IsActive,
	})
}

func appleLinkCodeHash(linkID, code string) string {
	sum := sha256.Sum256([]byte(linkID + ":" + code))
	return hex.EncodeToString(sum[:])
}

func randomDigits(n int) (string, error) {
	digits := make([]byte, n)
	for i := range digits {
		d, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		digits[i] = byte('0' + d.Int64())
	}
	return string(digits), nil
}

// ── E-mail code ──

func appleLinkEmailRequest(c *gin.Context) {
	var body struct {
		IdentityToken string  `json:"identity_token"`
		Email         string  `json:"email"`
		Locale        *string `json:"locale"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}
	email := normalizeEmail(body.Email)
	if !emailRegex.MatchString(email) {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid email"})
		return
	}
	appleSub, ok := verifiedAppleSubject(c, body.IdentityToken)
	if !ok {
		return
	}

	linkID, err := randomURLToken(32)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	// The answer is the same whether or not the address has a linkable
	// account, so this endpoint cannot be used to probe for accounts.
	var target middleware.User
	if err := database.DB.Get(&target, userByEmailQuery, email); err == nil && hasPlaceholderIdentity(target.AppleSub) {
		code, err := randomDigits(6)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		if err := storeAppleLinkToken(linkID, appleLinkKindEmail, target.ID, appleSub, appleLinkCodeHash(linkID, code), appleLinkCodeExpiry); err != nil {
			log.Printf("Apple link token insert failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		locale := stringValueOrDefault(body.Locale, middleware.StringValue(target.Locale))
		if err := sendAppleLinkCode(email, code, int(appleLinkCodeExpiry/time.Minute), locale); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"detail": "E-Mail konnte nicht gesendet werden"})
			return
		}
		middleware.Audit(target.ID, "auth.apple_link_code_sent", "email="+email)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     "sent",
		"link_id":    linkID,
		"expires_in": int(appleLinkCodeExpiry / time.Second),
	})
}

func appleLinkEmailConfirm(c *gin.Context) {
	var body struct {
		LinkID string `json:"link_id"`
		Code   string `json:"code"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.LinkID == "" || body.Code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "link_id and code required"})
		return
	}
	invalid := func() {
		// 400 rather than 401: clients treat 401 as "session ended" and sign out.
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid or expired code", "code": "invalid_link_code"})
	}

	var token appleLinkToken
	err := database.DB.Get(&token, "SELECT * FROM apple_link_tokens WHERE token = ? AND kind = ? AND used = 0", body.LinkID, appleLinkKindEmail)
	if err != nil || token.expired() || !token.UserID.Valid || !token.AppleSub.Valid {
		invalid()
		return
	}
	if token.Attempts >= appleLinkMaxAttempts {
		consumeAppleLinkToken(token.ID)
		invalid()
		return
	}
	// Count the attempt before comparing, so parallel guesses cannot exceed the limit.
	database.DB.Exec("UPDATE apple_link_tokens SET attempts = attempts + 1 WHERE id = ?", token.ID)
	expected := appleLinkCodeHash(token.Token, body.Code)
	if subtle.ConstantTimeCompare([]byte(expected), []byte(token.CodeHash.String)) != 1 {
		invalid()
		return
	}
	if !consumeAppleLinkToken(token.ID) {
		invalid()
		return
	}

	user, err := linkAppleIdentity(token.UserID.Int64, token.AppleSub.String)
	if err != nil {
		respondAppleLinkError(c, err)
		return
	}
	respondWithSession(c, user, "auth.apple_linked_by_code")
}

// ── QR code from a signed-in web session ──

func appleLinkQRCreate(c *gin.Context) {
	user := middleware.GetUser(c)
	if !hasPlaceholderIdentity(user.AppleSub) {
		c.JSON(http.StatusConflict, gin.H{"detail": "This account is already linked to an Apple ID", "code": "apple_already_linked"})
		return
	}
	token, err := randomURLToken(32)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	if err := storeAppleLinkToken(token, appleLinkKindQR, user.ID, nil, nil, appleLinkQRExpiry); err != nil {
		log.Printf("Apple link token insert failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"link_token": token,
		"qr_value":   appleLinkQRScheme + token,
		"expires_in": int(appleLinkQRExpiry / time.Second),
	})
}

func appleLinkQRStatus(c *gin.Context) {
	user := middleware.GetUser(c)
	var token appleLinkToken
	err := database.DB.Get(&token, "SELECT * FROM apple_link_tokens WHERE token = ? AND kind = ? AND user_id = ?", c.Param("token"), appleLinkKindQR, user.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Token not found"})
		return
	}
	status := "pending"
	switch {
	case token.Used:
		status = "linked"
	case token.expired():
		status = "expired"
	}
	c.JSON(http.StatusOK, gin.H{"status": status})
}

func appleLinkQRConfirm(c *gin.Context) {
	var body struct {
		IdentityToken string `json:"identity_token"`
		LinkToken     string `json:"link_token"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.LinkToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "link_token required"})
		return
	}
	appleSub, ok := verifiedAppleSubject(c, body.IdentityToken)
	if !ok {
		return
	}

	var token appleLinkToken
	err := database.DB.Get(&token, "SELECT * FROM apple_link_tokens WHERE token = ? AND kind = ? AND used = 0", body.LinkToken, appleLinkKindQR)
	if err != nil || token.expired() || !token.UserID.Valid || !consumeAppleLinkToken(token.ID) {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid or expired QR code", "code": "invalid_link_token"})
		return
	}

	user, err := linkAppleIdentity(token.UserID.Int64, appleSub)
	if err != nil {
		// Give the code back: nothing was linked, the user may retry.
		database.DB.Exec("UPDATE apple_link_tokens SET used = 0 WHERE id = ?", token.ID)
		respondAppleLinkError(c, err)
		return
	}
	respondWithSession(c, user, "auth.apple_linked_by_qr")
}
