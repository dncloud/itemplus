package operations

import (
	"net/http"

	"github.com/gin-gonic/gin"
	checkoutcore "github.com/itemplus/backend/internal/core/checkouts"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

func enrichCheckout(row map[string]interface{}, realm string) {
	checkoutcore.EnrichCheckoutRow(row, realm)
}

func ensureCheckoutRealm(c *gin.Context, realm string) bool {
	if realm == "archive" || realm == "collection" {
		return true
	}
	c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid realm"})
	return false
}

func loadCheckoutRow(query string, realm string, args ...interface{}) (map[string]interface{}, error) {
	row := map[string]interface{}{}
	if err := database.DB.QueryRowx(query, args...).MapScan(row); err != nil {
		return nil, err
	}
	middleware.CleanRow(row)
	enrichCheckout(row, realm)
	return row, nil
}

func loadCheckoutRows(query string, realm string, args ...interface{}) ([]map[string]interface{}, error) {
	rows, err := database.DB.Queryx(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		row := map[string]interface{}{}
		if rows.MapScan(row) == nil {
			middleware.CleanRow(row)
			enrichCheckout(row, realm)
			result = append(result, row)
		}
	}
	if result == nil {
		result = []map[string]interface{}{}
	}
	return result, nil
}

func loadCheckoutRequestRow(query string, args ...interface{}) (map[string]interface{}, error) {
	row := map[string]interface{}{}
	if err := database.DB.QueryRowx(query, args...).MapScan(row); err != nil {
		return nil, err
	}
	middleware.CleanRow(row)
	enrichCheckoutRequestComponents(row)
	enrichCheckoutRequest(row)
	return row, nil
}

func normalizeNullableDBValue(v interface{}) interface{} {
	return checkoutcore.NormalizeNullableDBValue(v)
}
