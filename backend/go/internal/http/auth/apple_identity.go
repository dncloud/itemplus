package auth

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

// errAppleIdentityConflict is returned when the verified e-mail belongs to an
// account that is already linked to a different Apple ID.
var errAppleIdentityConflict = errors.New("account is linked to a different Apple ID")

// userByEmailQuery finds the visible account for a normalized e-mail address.
var userByEmailQuery = "SELECT * FROM users WHERE LOWER(email) = ? AND " + VisibleUsersWhereClause("") + " ORDER BY id LIMIT 1"

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// hasPlaceholderIdentity reports whether an account was created by e-mail
// (first-start setup or magic link) and has no Apple ID attached yet.
func hasPlaceholderIdentity(appleSub string) bool {
	return strings.HasPrefix(appleSub, "bootstrap_") || strings.HasPrefix(appleSub, "magic_")
}

// findAppleLoginUser resolves the account for an Apple sign-in.
//
// An account already linked to appleSub wins. Otherwise an account that was
// registered by e-mail is linked when its address equals verifiedEmail, the
// address from Apple's signed token. An existing Apple link is never replaced.
// sql.ErrNoRows means no account matches.
func findAppleLoginUser(appleSub, verifiedEmail string) (*middleware.User, error) {
	var user middleware.User
	err := database.DB.Get(&user, "SELECT * FROM users WHERE apple_sub = ? AND "+VisibleUsersWhereClause(""), appleSub)
	if err == nil {
		return &user, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	if verifiedEmail == "" {
		return nil, sql.ErrNoRows
	}

	if err := database.DB.Get(&user, userByEmailQuery, verifiedEmail); err != nil {
		return nil, err
	}
	if !hasPlaceholderIdentity(user.AppleSub) {
		return nil, errAppleIdentityConflict
	}

	if _, err := database.DB.Exec("UPDATE users SET apple_sub = ?, updated_at = ? WHERE id = ?", appleSub, database.TimestampNow(), user.ID); err != nil {
		return nil, err
	}
	user.AppleSub = appleSub
	middleware.Audit(user.ID, "auth.apple_linked", fmt.Sprintf("email=%s", verifiedEmail))
	return &user, nil
}
