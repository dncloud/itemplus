package operations

import (
	"fmt"
	"log"
	"net/http"
	"sort"

	"github.com/gin-gonic/gin"
	checkoutcore "github.com/itemplus/backend/internal/core/checkouts"
	"github.com/itemplus/backend/internal/http/middleware"
)

func listActiveCheckouts(c *gin.Context) {
	realm := c.Param("realm")
	table := realm + "_checkouts"
	itemsTable := realm + "_items"

	if !ensureCheckoutRealm(c, realm) {
		return
	}

	query := fmt.Sprintf(
		`SELECT co.*, i.name AS item_name, COALESCE(u.display_name, u.email) AS user_name
		FROM %s co
		LEFT JOIN %s i ON co.item_id = i.id
		LEFT JOIN users u ON co.user_id = u.id
		WHERE co.status = 'active' AND co.bundle_parent_item_id IS NULL
		ORDER BY co.created_at DESC`, table, itemsTable)

	result, err := loadCheckoutRows(query, realm)
	if err != nil {
		log.Printf("DB query error in listActiveCheckouts: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	for _, row := range result {
		enrichActiveCheckoutComponents(row)
	}
	c.JSON(http.StatusOK, result)
}

func listCheckoutHistory(c *gin.Context) {
	realm := c.Param("realm")
	table := realm + "_checkouts"
	itemsTable := realm + "_items"

	if !ensureCheckoutRealm(c, realm) {
		return
	}

	query := fmt.Sprintf(
		`SELECT co.*, i.name AS item_name, COALESCE(u.display_name, u.email) AS user_name
		FROM %s co
		LEFT JOIN %s i ON co.item_id = i.id
		LEFT JOIN users u ON co.user_id = u.id
		WHERE co.status = 'returned' AND co.bundle_parent_item_id IS NULL
		ORDER BY co.updated_at DESC
		LIMIT 50`, table, itemsTable)

	result, err := loadCheckoutRows(query, realm)
	if err != nil {
		log.Printf("DB query error in listCheckoutHistory: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	c.JSON(http.StatusOK, result)
}

func listMyOverdueCheckouts(c *gin.Context) {
	user := middleware.GetUser(c)
	allOverdue := collectOverdueCheckouts(&user.ID)
	c.JSON(http.StatusOK, allOverdue)
}

func listOverdueCheckouts(c *gin.Context) {
	allOverdue := collectOverdueCheckouts(nil)
	c.JSON(http.StatusOK, allOverdue)
}

func collectOverdueCheckouts(userID *int) []map[string]interface{} {
	var allOverdue []map[string]interface{}
	for _, realm := range []string{"archive", "collection"} {
		table := realm + "_checkouts"
		itemsTable := realm + "_items"

		userFilter := ""
		args := []interface{}{}
		if userID != nil {
			userFilter = "AND co.user_id = ?"
			args = append(args, *userID)
		}

		query := fmt.Sprintf(
			`SELECT co.*, i.name AS item_name, COALESCE(u.display_name, u.email) AS user_name, '%s' AS realm
			FROM %s co
			LEFT JOIN %s i ON co.item_id = i.id
			LEFT JOIN users u ON co.user_id = u.id
			WHERE co.status = 'active' AND co.due_date IS NOT NULL AND co.bundle_parent_item_id IS NULL %s
			ORDER BY co.due_date`, realm, table, itemsTable, userFilter)

		rows, err := loadCheckoutRows(query, realm, args...)
		if err != nil {
			continue
		}
		for _, row := range rows {
			if isOverdue, ok := row["is_overdue"].(bool); ok && isOverdue {
				allOverdue = append(allOverdue, row)
			}
		}
	}

	if allOverdue == nil {
		allOverdue = []map[string]interface{}{}
	}
	sort.SliceStable(allOverdue, func(i, j int) bool {
		return checkoutcore.ParseCheckoutTime(allOverdue[i]["due_date"]).Before(checkoutcore.ParseCheckoutTime(allOverdue[j]["due_date"]))
	})
	return allOverdue
}
