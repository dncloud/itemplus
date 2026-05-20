package middleware

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/services"
)

type User struct {
	ID          int     `db:"id" json:"id"`
	AppleSub    string  `db:"apple_sub" json:"sub"`
	Email       *string `db:"email" json:"email"`
	DisplayName *string `db:"display_name" json:"name"`
	IsAdmin     bool    `db:"is_admin" json:"is_admin"`
	IsActive    bool    `db:"is_active" json:"is_active"`
	Permissions string  `db:"permissions" json:"-"`
	LastLogin   *string `db:"last_login" json:"last_login"`
	CreatedAt   *string `db:"created_at" json:"created_at"`
	UpdatedAt   *string `db:"updated_at" json:"updated_at"`
}

func (u *User) PermissionList() []string {
	var perms []string
	_ = json.Unmarshal([]byte(u.Permissions), &perms)
	return perms
}

// PERMISSIONS lists all valid assignable permissions.
var PERMISSIONS = []string{
	"items.read",
	"items.write",
	"items.delete",
	"attachments.write",
	"checkout.manage",
	"print",
	"categories.read",
	"categories.write",
	"categories.delete",
	"locations.read",
	"locations.write",
	"locations.delete",
	"vendors.read",
	"vendors.write",
	"vendors.delete",
}

func (u *User) HasPermission(perm string) bool {
	if u.IsAdmin {
		return true
	}
	for _, p := range u.PermissionList() {
		if p == perm {
			return true
		}
	}
	return false
}

func (u *User) HasAnyPermission(perms ...string) bool {
	if u.IsAdmin {
		return true
	}
	userPerms := u.PermissionList()
	for _, p := range perms {
		for _, up := range userPerms {
			if up == p {
				return true
			}
		}
	}
	return false
}

// Auth extracts and validates the JWT token, sets "user" in context.
func Auth() gin.HandlerFunc {
	return authMiddleware(true)
}

// AuthAllowInactive extracts user but doesn't require activation.
func AuthAllowInactive() gin.HandlerFunc {
	return authMiddleware(false)
}

func authMiddleware(requireActive bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, err := extractUser(c)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"detail": "Invalid token"})
			return
		}
		if requireActive && !user.IsActive {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"detail": "Account not activated"})
			return
		}
		c.Set("user", user)
		c.Next()
	}
}

// RequireAdmin requires admin role.
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetUser(c)
		if user == nil || !user.IsAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"detail": "Admin required"})
			return
		}
		c.Next()
	}
}

// RequirePermission requires one of the given permissions.
func RequirePermission(perms ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetUser(c)
		if user == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"detail": "Not authenticated"})
			return
		}
		if !user.HasAnyPermission(perms...) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"detail": "Permission required"})
			return
		}
		c.Next()
	}
}

// RequireAllPermissions requires every listed permission.
func RequireAllPermissions(perms ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetUser(c)
		if user == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"detail": "Not authenticated"})
			return
		}
		if user.IsAdmin {
			c.Next()
			return
		}
		for _, perm := range perms {
			if !user.HasPermission(perm) {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"detail": "Permission required"})
				return
			}
		}
		c.Next()
	}
}

// GetUser extracts the authenticated user from context.
func GetUser(c *gin.Context) *User {
	u, exists := c.Get("user")
	if !exists {
		return nil
	}
	user, _ := u.(*User)
	return user
}

func extractUser(c *gin.Context) (*User, error) {
	var tokenStr string

	// 1. Check Authorization: Bearer header (iOS app, API clients)
	if auth := c.GetHeader("Authorization"); strings.HasPrefix(auth, "Bearer ") {
		tokenStr = strings.TrimPrefix(auth, "Bearer ")
	}

	// 2. Fall back to HttpOnly cookie (WebApp)
	if tokenStr == "" {
		if cookie, err := c.Cookie("itemplus_token"); err == nil && cookie != "" {
			tokenStr = cookie
		}
	}

	if tokenStr == "" {
		return nil, errors.New("no token found")
	}

	claims, err := services.DecodeToken(tokenStr)
	if err != nil {
		return nil, err
	}

	var user User
	err = database.DB.Get(&user, "SELECT * FROM users WHERE id = ?", claims.UserID)
	if err != nil {
		return nil, err
	}
	return &user, nil
}
