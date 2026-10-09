package auth

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/itemplus/backend/internal/config"
	authcore "github.com/itemplus/backend/internal/core/auth"
	"github.com/itemplus/backend/internal/database"
)

// stubApple makes identity tokens of the form "sub|verified-email" valid and
// records the codes that would have been mailed.
func stubApple(t *testing.T) *[]string {
	t.Helper()
	previousDecode, previousSend := decodeAppleToken, sendAppleLinkCode
	previousSecret, previousDays := config.C.JWTSecret, config.C.JWTExpiryDays
	config.C.JWTSecret, config.C.JWTExpiryDays = "test-secret", 30

	decodeAppleToken = func(token string) (*authcore.AppleClaims, error) {
		parts := bytes.SplitN([]byte(token), []byte("|"), 2)
		if len(parts) != 2 || len(parts[0]) == 0 {
			return nil, errors.New("invalid token")
		}
		raw, _ := json.Marshal(map[string]interface{}{"email": string(parts[1]), "email_verified": len(parts[1]) > 0})
		claims := &authcore.AppleClaims{RegisteredClaims: jwt.RegisteredClaims{Subject: string(parts[0])}}
		_ = json.Unmarshal(raw, claims)
		claims.Subject = string(parts[0])
		return claims, nil
	}
	var sentCodes []string
	sendAppleLinkCode = func(email, code string, validMinutes int, locale string) error {
		sentCodes = append(sentCodes, code)
		return nil
	}
	t.Cleanup(func() {
		decodeAppleToken, sendAppleLinkCode = previousDecode, previousSend
		config.C.JWTSecret, config.C.JWTExpiryDays = previousSecret, previousDays
	})
	return &sentCodes
}

// call runs a handler with a JSON body, optionally as a signed-in user.
func call(t *testing.T, handler gin.HandlerFunc, actorID int, params gin.Params, body map[string]interface{}) (int, map[string]interface{}) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	payload, _ := json.Marshal(body)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = params
	if actorID > 0 {
		actor, err := loadVisibleUserByID(actorID)
		if err != nil {
			t.Fatalf("load actor: %v", err)
		}
		c.Set("user", actor)
	}
	handler(c)
	response := map[string]interface{}{}
	_ = json.Unmarshal(rec.Body.Bytes(), &response)
	return rec.Code, response
}

// The body e-mail was the takeover vector: it must not influence which
// account an Apple sign-in resolves to, nor which address a new account gets.
func TestAppleLoginIgnoresEmailFromRequestBody(t *testing.T) {
	useTestDatabase(t)
	stubApple(t)
	adminID := insertUser(t, "bootstrap_admin@example.de", "admin@example.de", true)

	status, response := call(t, appleLogin, 0, nil, map[string]interface{}{
		"identity_token": "001234.attacker|attacker@evil.example",
		"email":          "admin@example.de",
		"create_account": false,
	})
	if status != http.StatusNotFound || response["code"] != "account_not_found" || response["email"] != "attacker@evil.example" {
		t.Fatalf("status %d, response %v; want 404 account_not_found for the attacker's own address", status, response)
	}

	status, response = call(t, appleLogin, 0, nil, map[string]interface{}{
		"identity_token": "001234.attacker|attacker@evil.example",
		"email":          "admin@example.de",
	})
	if status != http.StatusOK || int(response["user_id"].(float64)) == adminID || response["is_admin"] != false {
		t.Fatalf("status %d, response %v; want a separate non-admin account", status, response)
	}
	if got := appleSubOf(t, adminID); got != "bootstrap_admin@example.de" {
		t.Fatalf("admin account was relinked to %q", got)
	}
	if got := emailOf(t, int(response["user_id"].(float64))); got != "attacker@evil.example" {
		t.Fatalf("new account got e-mail %q, want the address Apple verified", got)
	}
}

func TestAppleLinkByEmailCode(t *testing.T) {
	useTestDatabase(t)
	sentCodes := stubApple(t)
	insertUser(t, "bootstrap_admin@example.de", "admin@example.de", true)
	userID := insertUser(t, "magic_max@firma.de", "max@firma.de", false)

	// The Apple ID runs on a different, hidden address: no automatic match.
	identity := "000777.max|xyz@privaterelay.appleid.com"
	status, response := call(t, appleLinkEmailRequest, 0, nil, map[string]interface{}{"identity_token": identity, "email": " Max@Firma.de "})
	if status != http.StatusOK || len(*sentCodes) != 1 {
		t.Fatalf("status %d, response %v, %d mails; want 200 and one mail", status, response, len(*sentCodes))
	}
	linkID, code := response["link_id"].(string), (*sentCodes)[0]

	if status, _ := call(t, appleLinkEmailConfirm, 0, nil, map[string]interface{}{"link_id": linkID, "code": "000000x"}); status != http.StatusBadRequest {
		t.Fatalf("wrong code: status %d, want 400", status)
	}
	if got := appleSubOf(t, userID); got != "magic_max@firma.de" {
		t.Fatalf("wrong code linked the account to %q", got)
	}

	status, response = call(t, appleLinkEmailConfirm, 0, nil, map[string]interface{}{"link_id": linkID, "code": code})
	if status != http.StatusOK || int(response["user_id"].(float64)) != userID || response["access_token"] == "" {
		t.Fatalf("confirm: status %d, response %v", status, response)
	}
	if got := appleSubOf(t, userID); got != "000777.max" {
		t.Fatalf("account linked to %q, want 000777.max", got)
	}

	// The code is single-use, and the Apple ID now signs in directly.
	if status, _ := call(t, appleLinkEmailConfirm, 0, nil, map[string]interface{}{"link_id": linkID, "code": code}); status != http.StatusBadRequest {
		t.Fatalf("reused code: status %d, want 400", status)
	}
	status, response = call(t, appleLogin, 0, nil, map[string]interface{}{"identity_token": identity, "create_account": false})
	if status != http.StatusOK || int(response["user_id"].(float64)) != userID {
		t.Fatalf("sign-in after linking: status %d, response %v", status, response)
	}
}

func TestAppleLinkByEmailDoesNotRevealOrTouchOtherAccounts(t *testing.T) {
	useTestDatabase(t)
	sentCodes := stubApple(t)
	linkedID := insertUser(t, "000999.original", "linked@example.de", false)

	for name, email := range map[string]string{
		"no such account":                 "nobody@example.de",
		"account already has an Apple ID": "linked@example.de",
	} {
		status, response := call(t, appleLinkEmailRequest, 0, nil, map[string]interface{}{"identity_token": "000111.new|", "email": email})
		if status != http.StatusOK || response["link_id"] == "" || len(*sentCodes) != 0 {
			t.Fatalf("%s: status %d, response %v, %d mails; want an indistinguishable 200 without mail", name, status, response, len(*sentCodes))
		}
		if status, _ := call(t, appleLinkEmailConfirm, 0, nil, map[string]interface{}{"link_id": response["link_id"], "code": "123456"}); status != http.StatusBadRequest {
			t.Fatalf("%s: confirm status %d, want 400", name, status)
		}
	}
	if got := appleSubOf(t, linkedID); got != "000999.original" {
		t.Fatalf("existing Apple link replaced by %q", got)
	}

	// An Apple ID that already belongs to an account cannot be linked again.
	status, response := call(t, appleLinkEmailRequest, 0, nil, map[string]interface{}{"identity_token": "000999.original|", "email": "nobody@example.de"})
	if status != http.StatusConflict || response["code"] != "apple_identity_in_use" {
		t.Fatalf("status %d, response %v; want 409 apple_identity_in_use", status, response)
	}
}

func TestAppleLinkCodeLocksAfterTooManyAttempts(t *testing.T) {
	useTestDatabase(t)
	sentCodes := stubApple(t)
	userID := insertUser(t, "magic_max@firma.de", "max@firma.de", false)

	_, response := call(t, appleLinkEmailRequest, 0, nil, map[string]interface{}{"identity_token": "000777.max|", "email": "max@firma.de"})
	linkID, code := response["link_id"].(string), (*sentCodes)[0]

	for i := 0; i < appleLinkMaxAttempts; i++ {
		call(t, appleLinkEmailConfirm, 0, nil, map[string]interface{}{"link_id": linkID, "code": "wrong"})
	}
	if status, _ := call(t, appleLinkEmailConfirm, 0, nil, map[string]interface{}{"link_id": linkID, "code": code}); status != http.StatusBadRequest {
		t.Fatalf("correct code after %d wrong attempts: status %d, want 400", appleLinkMaxAttempts, status)
	}
	if got := appleSubOf(t, userID); got != "magic_max@firma.de" {
		t.Fatalf("locked code still linked the account to %q", got)
	}
}

func TestAppleLinkByQRCode(t *testing.T) {
	useTestDatabase(t)
	stubApple(t)
	userID := insertUser(t, "magic_max@firma.de", "max@firma.de", false)
	otherID := insertUser(t, "magic_eve@example.de", "eve@example.de", false)

	status, response := call(t, appleLinkQRCreate, userID, nil, nil)
	if status != http.StatusOK || response["qr_value"] != appleLinkQRScheme+response["link_token"].(string) {
		t.Fatalf("create: status %d, response %v", status, response)
	}
	token := response["link_token"].(string)
	params := gin.Params{{Key: "token", Value: token}}

	if status, response := call(t, appleLinkQRStatus, userID, params, nil); status != http.StatusOK || response["status"] != "pending" {
		t.Fatalf("status before scan: %d %v", status, response)
	}
	if status, _ := call(t, appleLinkQRStatus, otherID, params, nil); status != http.StatusNotFound {
		t.Fatalf("another user could read the link status: %d", status)
	}

	status, response = call(t, appleLinkQRConfirm, 0, nil, map[string]interface{}{"identity_token": "000777.max|other@icloud.com", "link_token": token})
	if status != http.StatusOK || int(response["user_id"].(float64)) != userID {
		t.Fatalf("confirm: status %d, response %v", status, response)
	}
	if got := appleSubOf(t, userID); got != "000777.max" {
		t.Fatalf("account linked to %q, want 000777.max", got)
	}
	if status, response := call(t, appleLinkQRStatus, userID, params, nil); response["status"] != "linked" {
		t.Fatalf("status after scan: %d %v", status, response)
	}

	// Single-use, and a linked account cannot start another link.
	if status, _ := call(t, appleLinkQRConfirm, 0, nil, map[string]interface{}{"identity_token": "000888.eve|", "link_token": token}); status != http.StatusBadRequest {
		t.Fatalf("reused QR token: status %d, want 400", status)
	}
	if status, response := call(t, appleLinkQRCreate, userID, nil, nil); status != http.StatusConflict || response["code"] != "apple_already_linked" {
		t.Fatalf("second link for a linked account: %d %v", status, response)
	}
}

func TestAppleLinkQRRejectsExpiredTokenAndUsedAppleID(t *testing.T) {
	useTestDatabase(t)
	stubApple(t)
	userID := insertUser(t, "magic_max@firma.de", "max@firma.de", false)
	insertUser(t, "000999.taken", "taken@example.de", false)

	_, response := call(t, appleLinkQRCreate, userID, nil, nil)
	token := response["link_token"].(string)

	// An Apple ID that already belongs to an account is refused; the QR code stays usable.
	if status, response := call(t, appleLinkQRConfirm, 0, nil, map[string]interface{}{"identity_token": "000999.taken|", "link_token": token}); status != http.StatusConflict || response["code"] != "apple_identity_in_use" {
		t.Fatalf("used Apple ID: %d %v", status, response)
	}

	past := database.TimestampAt(time.Now().UTC().Add(-time.Minute))
	if _, err := database.DB.Exec("UPDATE apple_link_tokens SET expires_at = ? WHERE token = ?", past, token); err != nil {
		t.Fatal(err)
	}
	if status, _ := call(t, appleLinkQRConfirm, 0, nil, map[string]interface{}{"identity_token": "000777.max|", "link_token": token}); status != http.StatusBadRequest {
		t.Fatalf("expired QR token: status %d, want 400", status)
	}
	if got := appleSubOf(t, userID); got != "magic_max@firma.de" {
		t.Fatalf("expired token linked the account to %q", got)
	}
	if status, response := call(t, appleLinkQRStatus, userID, gin.Params{{Key: "token", Value: token}}, nil); response["status"] != "expired" {
		t.Fatalf("status of expired token: %d %v", status, response)
	}
}
