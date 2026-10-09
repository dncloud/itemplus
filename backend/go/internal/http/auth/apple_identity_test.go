package auth

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
	"github.com/itemplus/backend/internal/testdb"
)

// useTestDatabase points the package-level database at a fresh, empty one.
func useTestDatabase(t *testing.T) {
	t.Helper()
	testdb.Use(t)
}

func insertUser(t *testing.T, appleSub, email string, isAdmin bool) int {
	t.Helper()
	now := database.TimestampNow()
	result, err := database.DB.Exec(
		"INSERT INTO users (apple_sub, email, display_name, is_admin, is_active, permissions, created_at, updated_at) VALUES (?, ?, 'Test', ?, 1, '[]', ?, ?)",
		appleSub, email, isAdmin, now, now,
	)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}
	id, _ := result.LastInsertId()
	return int(id)
}

func appleSubOf(t *testing.T, userID int) string {
	t.Helper()
	var sub string
	if err := database.DB.Get(&sub, "SELECT apple_sub FROM users WHERE id = ?", userID); err != nil {
		t.Fatalf("read apple_sub: %v", err)
	}
	return sub
}

// The takeover this guards against: someone signs in with their own Apple ID
// and merely claims to own the admin's address. Only the address Apple signed
// reaches findAppleLoginUser, so the admin account must stay untouched.
func TestAppleLoginDoesNotLinkForeignAccount(t *testing.T) {
	useTestDatabase(t)
	adminID := insertUser(t, "bootstrap_admin@example.de", "admin@example.de", true)

	for name, verifiedEmail := range map[string]string{
		"own verified address": "attacker@evil.example",
		"no verified address":  "",
	} {
		user, err := findAppleLoginUser("001234.attacker", verifiedEmail)
		if !errors.Is(err, sql.ErrNoRows) {
			t.Fatalf("%s: got user %+v, err %v; want sql.ErrNoRows", name, user, err)
		}
		if got := appleSubOf(t, adminID); got != "bootstrap_admin@example.de" {
			t.Fatalf("%s: admin account was relinked to %q", name, got)
		}
	}
}

func TestAppleLoginLinksAccountRegisteredByEmail(t *testing.T) {
	useTestDatabase(t)
	for _, tc := range []struct{ placeholderSub, storedEmail string }{
		{"magic_oli@example.de", "oli@example.de"},
		{"bootstrap_admin@example.de", "Admin@Example.de"}, // stored with capitals by an older setup
	} {
		userID := insertUser(t, tc.placeholderSub, tc.storedEmail, false)
		appleSub := "000111." + tc.placeholderSub

		user, err := findAppleLoginUser(appleSub, normalizeEmail(tc.storedEmail))
		if err != nil {
			t.Fatalf("%s: %v", tc.storedEmail, err)
		}
		if user.ID != userID || user.AppleSub != appleSub || appleSubOf(t, userID) != appleSub {
			t.Fatalf("%s: linked user %d with sub %q, want user %d with sub %q", tc.storedEmail, user.ID, appleSubOf(t, userID), userID, appleSub)
		}

		// Later sign-ins resolve by the Apple ID alone, even without an address.
		again, err := findAppleLoginUser(appleSub, "")
		if err != nil || again.ID != userID {
			t.Fatalf("%s: second sign-in got %+v, err %v", tc.storedEmail, again, err)
		}
	}
}

func TestAppleLoginNeverReplacesExistingAppleLink(t *testing.T) {
	useTestDatabase(t)
	userID := insertUser(t, "000999.original", "oli@example.de", false)

	user, err := findAppleLoginUser("000555.other", "oli@example.de")
	if !errors.Is(err, errAppleIdentityConflict) {
		t.Fatalf("got user %+v, err %v; want errAppleIdentityConflict", user, err)
	}
	if got := appleSubOf(t, userID); got != "000999.original" {
		t.Fatalf("existing Apple link was replaced by %q", got)
	}
}

func TestAppleLoginIgnoresDeletedAccounts(t *testing.T) {
	useTestDatabase(t)
	insertUser(t, deletedUserPrefix+"7", "oli@example.de", false)

	if user, err := findAppleLoginUser("000555.other", "oli@example.de"); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("got user %+v, err %v; want sql.ErrNoRows", user, err)
	}
}

func putUser(t *testing.T, handler gin.HandlerFunc, actorID int, targetID string, body map[string]interface{}) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	actor, err := loadVisibleUserByID(actorID)
	if err != nil {
		t.Fatalf("load actor: %v", err)
	}
	payload, _ := json.Marshal(body)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPut, "/", bytes.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: targetID}}
	c.Set("user", actor)
	handler(c)
	return rec
}

func emailOf(t *testing.T, userID int) string {
	t.Helper()
	user, err := loadVisibleUserByID(userID)
	if err != nil {
		t.Fatalf("load user: %v", err)
	}
	return middleware.StringValue(user.Email)
}

func TestUsersCannotChangeTheirOwnEmail(t *testing.T) {
	useTestDatabase(t)
	insertUser(t, "bootstrap_admin@example.de", "admin@example.de", true)
	userID := insertUser(t, "magic_oli@example.de", "oli@example.de", false)

	rec := putUser(t, updateMe, userID, "", map[string]interface{}{"email": "admin@example.de", "display_name": "Mallory"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d, want 400: %s", rec.Code, rec.Body.String())
	}
	user, _ := loadVisibleUserByID(userID)
	if emailOf(t, userID) != "oli@example.de" || middleware.StringValue(user.DisplayName) != "Test" {
		t.Fatalf("rejected request still changed the account: %+v", user)
	}

	// Sending the unchanged address along with other fields stays allowed.
	rec = putUser(t, updateMe, userID, "", map[string]interface{}{"email": "Oli@Example.de", "display_name": "Oli"})
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d, want 200: %s", rec.Code, rec.Body.String())
	}
	if user, _ := loadVisibleUserByID(userID); middleware.StringValue(user.DisplayName) != "Oli" {
		t.Fatalf("display name not updated: %+v", user)
	}
}

func TestAdminEmailChangeIsValidatedAndUnique(t *testing.T) {
	useTestDatabase(t)
	adminID := insertUser(t, "bootstrap_admin@example.de", "admin@example.de", true)
	userID := insertUser(t, "magic_oli@example.de", "oli@example.de", false)
	target := "2"
	if userID != 2 {
		t.Fatalf("unexpected user id %d", userID)
	}

	for name, tc := range map[string]struct {
		email      string
		wantStatus int
		wantEmail  string
	}{
		"taken by another account":  {"ADMIN@example.de", http.StatusConflict, "oli@example.de"},
		"not an address":            {"not-an-address", http.StatusBadRequest, "oli@example.de"},
		"new address is normalized": {" New.Oli@Example.de ", http.StatusOK, "new.oli@example.de"},
	} {
		if _, err := database.DB.Exec("UPDATE users SET email = 'oli@example.de' WHERE id = ?", userID); err != nil {
			t.Fatal(err)
		}
		rec := putUser(t, updateUser, adminID, target, map[string]interface{}{"email": tc.email})
		if rec.Code != tc.wantStatus {
			t.Errorf("%s: status %d, want %d: %s", name, rec.Code, tc.wantStatus, rec.Body.String())
		}
		if got := emailOf(t, userID); got != tc.wantEmail {
			t.Errorf("%s: e-mail is %q, want %q", name, got, tc.wantEmail)
		}
	}
}

func isAdminActive(t *testing.T, userID int) (bool, bool) {
	t.Helper()
	user, err := loadVisibleUserByID(userID)
	if err != nil {
		t.Fatalf("load user: %v", err)
	}
	return user.IsAdmin, user.IsActive
}

// Without an administrator nobody can manage users any more, and the only way
// back would be editing the database by hand.
func TestLastAdministratorCannotBeDemotedOrDeactivated(t *testing.T) {
	useTestDatabase(t)
	adminID := insertUser(t, "bootstrap_admin@example.de", "admin@example.de", true)
	insertUser(t, "magic_oli@example.de", "oli@example.de", false)
	inactiveAdminID := insertUser(t, "magic_old@example.de", "old@example.de", true)
	if _, err := database.DB.Exec("UPDATE users SET is_active = 0 WHERE id = ?", inactiveAdminID); err != nil {
		t.Fatal(err)
	}

	for name, body := range map[string]map[string]interface{}{
		"demote":     {"is_admin": false},
		"deactivate": {"is_active": false},
	} {
		rec := putUser(t, updateUser, adminID, "1", body)
		if rec.Code != http.StatusConflict {
			t.Errorf("%s: status %d, want 409: %s", name, rec.Code, rec.Body.String())
		}
		if isAdmin, isActive := isAdminActive(t, adminID); !isAdmin || !isActive {
			t.Fatalf("%s: the last administrator is now admin=%v active=%v", name, isAdmin, isActive)
		}
	}

	// Other changes to the last administrator stay possible.
	if rec := putUser(t, updateUser, adminID, "1", map[string]interface{}{"display_name": "Chef", "is_admin": true}); rec.Code != http.StatusOK {
		t.Fatalf("rename: status %d: %s", rec.Code, rec.Body.String())
	}

	// With a second active administrator the first may step down.
	if rec := putUser(t, updateUser, adminID, "2", map[string]interface{}{"is_admin": true}); rec.Code != http.StatusOK {
		t.Fatalf("promote second admin: status %d", rec.Code)
	}
	if rec := putUser(t, updateUser, adminID, "1", map[string]interface{}{"is_admin": false}); rec.Code != http.StatusOK {
		t.Fatalf("demote with another admin present: status %d: %s", rec.Code, rec.Body.String())
	}
	if isAdmin, _ := isAdminActive(t, adminID); isAdmin {
		t.Fatal("demotion was not applied")
	}
}

func TestUnknownPermissionsAreRejected(t *testing.T) {
	useTestDatabase(t)
	adminID := insertUser(t, "bootstrap_admin@example.de", "admin@example.de", true)
	userID := insertUser(t, "magic_oli@example.de", "oli@example.de", false)

	rec := putUser(t, updateUser, adminID, "2", map[string]interface{}{"permissions": []string{"items.read", "items.everything"}})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d, want 400: %s", rec.Code, rec.Body.String())
	}
	if user, _ := loadVisibleUserByID(userID); len(user.PermissionList()) != 0 {
		t.Fatalf("rejected request still stored permissions %v", user.PermissionList())
	}

	rec = putUser(t, updateUser, adminID, "2", map[string]interface{}{"permissions": []string{"items.read", "print"}})
	if rec.Code != http.StatusOK {
		t.Fatalf("valid permissions: status %d: %s", rec.Code, rec.Body.String())
	}
	if user, _ := loadVisibleUserByID(userID); len(user.PermissionList()) != 2 {
		t.Fatalf("permissions = %v, want two", user.PermissionList())
	}
}
