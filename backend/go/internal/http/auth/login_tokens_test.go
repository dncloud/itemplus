package auth

import (
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
)

func insertMagicLink(t *testing.T, token, email string, locale interface{}) {
	t.Helper()
	expiry := database.TimestampAt(time.Now().UTC().Add(10 * time.Minute))
	if _, err := database.DB.Exec("INSERT INTO magic_link_tokens (email, locale, token, expires_at, used) VALUES (?, ?, ?, ?, 0)", email, locale, token, expiry); err != nil {
		t.Fatalf("insert magic link: %v", err)
	}
}

// A link requested without a language is stored with locale NULL. Reading
// that used to fail and was reported as "invalid or expired link".
func TestMagicLinkWithoutLocaleSignsIn(t *testing.T) {
	useTestDatabase(t)
	stubApple(t)
	userID := insertUser(t, "magic_oli@example.de", "oli@example.de", false)

	for name, locale := range map[string]interface{}{"no locale": nil, "empty locale": "", "german": "de"} {
		token := "link-" + name
		insertMagicLink(t, token, "oli@example.de", locale)
		status, response := call(t, magicLinkVerify, 0, nil, map[string]interface{}{"token": token})
		if status != http.StatusOK || int(response["user_id"].(float64)) != userID {
			t.Errorf("%s: status %d, response %v", name, status, response)
		}
	}

	// A new address without a locale creates the account as well.
	insertMagicLink(t, "link-new", "new@example.de", nil)
	if status, response := call(t, magicLinkVerify, 0, nil, map[string]interface{}{"token": "link-new"}); status != http.StatusOK {
		t.Fatalf("new account: status %d, response %v", status, response)
	}
}

func TestMagicLinkWorksOnlyOnce(t *testing.T) {
	useTestDatabase(t)
	stubApple(t)
	insertUser(t, "magic_oli@example.de", "oli@example.de", false)
	insertMagicLink(t, "single-use", "oli@example.de", "de")

	// Fire the same link from several clients at once.
	const clients = 8
	statuses := make([]int, clients)
	var wg sync.WaitGroup
	for i := 0; i < clients; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			statuses[i], _ = call(t, magicLinkVerify, 0, nil, map[string]interface{}{"token": "single-use"})
		}(i)
	}
	wg.Wait()

	signedIn := 0
	for _, status := range statuses {
		switch status {
		case http.StatusOK:
			signedIn++
		case http.StatusUnauthorized:
		default:
			t.Errorf("unexpected status %d", status)
		}
	}
	if signedIn != 1 {
		t.Fatalf("%d of %d simultaneous requests signed in with one link, want exactly 1", signedIn, clients)
	}
}

// After the iPhone confirmed a QR login, the browser collects the session by
// polling. Whoever else knows the code (it is shown on screen) must not be
// able to collect a second one.
func TestQRLoginSessionIsHandedOutOnce(t *testing.T) {
	useTestDatabase(t)
	stubApple(t)
	userID := insertUser(t, "000111.oli", "oli@example.de", false)

	_, created := call(t, createQRToken, 0, nil, nil)
	token := created["qr_token"].(string)
	params := gin.Params{{Key: "token", Value: token}}

	if status, response := call(t, pollQRToken, 0, params, nil); status != http.StatusOK || response["status"] != "pending" {
		t.Fatalf("before confirmation: %d %v", status, response)
	}
	if status, _ := call(t, confirmQRToken, userID, nil, map[string]interface{}{"qr_token": token}); status != http.StatusOK {
		t.Fatalf("confirm: status %d", status)
	}
	if status, _ := call(t, confirmQRToken, userID, nil, map[string]interface{}{"qr_token": token}); status != http.StatusNotFound {
		t.Fatalf("second confirmation: status %d, want 404", status)
	}

	status, response := call(t, pollQRToken, 0, params, nil)
	if status != http.StatusOK || response["status"] != "confirmed" || response["access_token"] == nil || int(response["user_id"].(float64)) != userID {
		t.Fatalf("first poll after confirmation: %d %v", status, response)
	}

	status, response = call(t, pollQRToken, 0, params, nil)
	if status != http.StatusNotFound || response["access_token"] != nil {
		t.Fatalf("second poll after confirmation: %d %v; want 404 without a session", status, response)
	}
}

func TestQRLoginDoesNotSignInDeactivatedAccount(t *testing.T) {
	useTestDatabase(t)
	stubApple(t)
	userID := insertUser(t, "000111.oli", "oli@example.de", false)

	_, created := call(t, createQRToken, 0, nil, nil)
	token := created["qr_token"].(string)
	call(t, confirmQRToken, userID, nil, map[string]interface{}{"qr_token": token})
	if _, err := database.DB.Exec("UPDATE users SET is_active = 0 WHERE id = ?", userID); err != nil {
		t.Fatal(err)
	}

	status, response := call(t, pollQRToken, 0, gin.Params{{Key: "token", Value: token}}, nil)
	if status != http.StatusForbidden || response["access_token"] != nil {
		t.Fatalf("deactivated account: %d %v; want 403 without a session", status, response)
	}
}
