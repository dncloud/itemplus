package ai

import (
	"fmt"
	"github.com/itemplus/backend/internal/http/middleware"

	"github.com/itemplus/backend/internal/database"
)

func loadAIContextCategories(realm string) ([]map[string]any, error) {
	rows, err := database.DB.Queryx(fmt.Sprintf("SELECT id, name, description, color FROM %s_categories ORDER BY position, id", realm))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]any
	for rows.Next() {
		row := map[string]any{}
		if rows.MapScan(row) == nil {
			middleware.CleanRow(row)
			result = append(result, row)
		}
	}
	if result == nil {
		result = []map[string]any{}
	}
	return result, nil
}

func loadAIContextProperties(realm string) ([]map[string]any, error) {
	rows, err := database.DB.Queryx(fmt.Sprintf("SELECT id, category_id, name, property_type, unit, options, required FROM %s_properties ORDER BY category_id, position, id", realm))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]any
	for rows.Next() {
		row := map[string]any{}
		if rows.MapScan(row) == nil {
			middleware.CleanRow(row)
			result = append(result, row)
		}
	}
	if result == nil {
		result = []map[string]any{}
	}
	return result, nil
}

func loadAICategoryByID(realm string, categoryID int64) (map[string]any, error) {
	row := map[string]any{}
	sqlRow := database.DB.QueryRowx(
		fmt.Sprintf("SELECT id, name, description, color FROM %s_categories WHERE id = ?", realm),
		categoryID,
	)
	if err := sqlRow.MapScan(row); err != nil {
		return nil, nil
	}
	middleware.CleanRow(row)
	return row, nil
}

func loadAIPropertiesForCategory(realm string, categoryID int64) ([]map[string]any, error) {
	rows, err := database.DB.Queryx(
		fmt.Sprintf("SELECT id, category_id, name, property_type, unit, options, required, show_in_list, display_width FROM %s_properties WHERE category_id = ? ORDER BY position, id", realm),
		categoryID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]any
	for rows.Next() {
		row := map[string]any{}
		if rows.MapScan(row) == nil {
			middleware.CleanRow(row)
			result = append(result, row)
		}
	}
	if result == nil {
		result = []map[string]any{}
	}
	return result, nil
}

func loadAIPropertyByID(realm string, propertyID int64) (map[string]any, error) {
	row := map[string]any{}
	sqlRow := database.DB.QueryRowx(
		fmt.Sprintf("SELECT id, category_id, name, property_type, unit, options, required, show_in_list, display_width FROM %s_properties WHERE id = ?", realm),
		propertyID,
	)
	if err := sqlRow.MapScan(row); err != nil {
		return nil, nil
	}
	middleware.CleanRow(row)
	return row, nil
}

func aiMapInt64(value any) (int64, bool) {
	switch v := value.(type) {
	case int64:
		return v, true
	case int:
		return int64(v), true
	case int32:
		return int64(v), true
	case float64:
		return int64(v), true
	default:
		return 0, false
	}
}
