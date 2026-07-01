package auth

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

const deletedUserPrefix = "deleted_user_"
const sidebarFavoritesSettingKey = "sidebar.favorites"

type sidebarFavorite struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	Href  string `json:"href"`
}

var defaultSidebarFavorites = []sidebarFavorite{
	{ID: "items", Label: "Items", Icon: "items", Href: "/items"},
}

var sidebarFavoriteIcons = map[string]bool{
	"dashboard":  true,
	"items":      true,
	"plus":       true,
	"categories": true,
	"locations":  true,
	"vendors":    true,
	"movements":  true,
	"checkouts":  true,
	"chat":       true,
	"ai":         true,
	"users":      true,
	"settings":   true,
}

func VisibleUsersWhereClause(alias string) string {
	column := "apple_sub"
	if alias != "" {
		column = alias + ".apple_sub"
	}
	return fmt.Sprintf("%s NOT LIKE '%s%%'", column, deletedUserPrefix)
}

func countVisibleUsers() int {
	var count int
	if err := database.DB.Get(&count, "SELECT COUNT(*) FROM users WHERE "+VisibleUsersWhereClause("")); err != nil {
		return 0
	}
	return count
}

func loadVisibleUserByID(id interface{}) (*middleware.User, error) {
	var user middleware.User
	if err := database.DB.Get(&user, "SELECT * FROM users WHERE id = ? AND "+VisibleUsersWhereClause(""), id); err != nil {
		return nil, err
	}
	return &user, nil
}

func loadSidebarFavorites(userID int) ([]sidebarFavorite, error) {
	var raw string
	err := database.DB.Get(&raw, "SELECT value FROM user_settings WHERE user_id = ? AND setting_key = ?", userID, sidebarFavoritesSettingKey)
	if errors.Is(err, sql.ErrNoRows) {
		return defaultSidebarFavorites, nil
	}
	if err != nil {
		return nil, err
	}
	var favorites []sidebarFavorite
	if err := json.Unmarshal([]byte(raw), &favorites); err != nil {
		return defaultSidebarFavorites, nil
	}
	sanitized, err := sanitizeSidebarFavorites(favorites)
	if err != nil {
		return defaultSidebarFavorites, nil
	}
	return sanitized, nil
}

func sanitizeSidebarFavorites(input []sidebarFavorite) ([]sidebarFavorite, error) {
	if len(input) > 16 {
		return nil, fmt.Errorf("Too many favorites")
	}
	out := make([]sidebarFavorite, 0, len(input))
	seen := map[string]bool{}
	for index, favorite := range input {
		label := strings.TrimSpace(favorite.Label)
		href := strings.TrimSpace(favorite.Href)
		icon := strings.TrimSpace(favorite.Icon)
		id := strings.TrimSpace(favorite.ID)
		if id == "" {
			id = fmt.Sprintf("favorite-%d", index+1)
		}
		if label == "" || href == "" {
			return nil, fmt.Errorf("Favorite label and target are required")
		}
		if len(label) > 48 {
			label = label[:48]
		}
		if len(href) > 200 {
			return nil, fmt.Errorf("Favorite target is too long")
		}
		if !strings.HasPrefix(href, "/") || strings.HasPrefix(href, "//") || strings.Contains(href, "://") {
			return nil, fmt.Errorf("Favorite target must be an internal path")
		}
		if !sidebarFavoriteIcons[icon] {
			icon = "dashboard"
		}
		baseID := id
		for suffix := 2; seen[id]; suffix++ {
			id = fmt.Sprintf("%s-%d", baseID, suffix)
		}
		seen[id] = true
		out = append(out, sidebarFavorite{ID: id, Label: label, Icon: icon, Href: href})
	}
	return out, nil
}
