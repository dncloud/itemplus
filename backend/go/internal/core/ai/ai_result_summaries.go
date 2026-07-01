package ai

import (
	"encoding/json"
	"strings"
)

func filterPropertiesForCategory(properties []map[string]any, categoryID *int64) []map[string]any {
	if categoryID == nil {
		return properties
	}
	filtered := make([]map[string]any, 0)
	for _, property := range properties {
		if propertyCategoryID, ok := mapInt64(property["category_id"]); ok && propertyCategoryID == *categoryID {
			filtered = append(filtered, property)
		}
	}
	return filtered
}

func buildAICategorySummary(categories []map[string]any) []map[string]any {
	summary := make([]map[string]any, 0, len(categories))
	for _, category := range categories {
		entry := map[string]any{}
		if id, ok := mapInt64(category["id"]); ok {
			entry["id"] = id
		}
		if name, ok := category["name"].(string); ok && strings.TrimSpace(name) != "" {
			entry["name"] = strings.TrimSpace(name)
		}
		if description, ok := category["description"].(string); ok && strings.TrimSpace(description) != "" {
			entry["description"] = strings.TrimSpace(description)
		}
		summary = append(summary, entry)
	}
	return summary
}

func buildAIPropertySummary(properties []map[string]any) []map[string]any {
	summary := make([]map[string]any, 0, len(properties))
	for _, property := range properties {
		entry := map[string]any{}
		if id, ok := mapInt64(property["id"]); ok {
			entry["id"] = id
		}
		if name, ok := property["name"].(string); ok && strings.TrimSpace(name) != "" {
			entry["name"] = strings.TrimSpace(name)
		}
		if propertyType, ok := property["property_type"].(string); ok && strings.TrimSpace(propertyType) != "" {
			entry["type"] = strings.TrimSpace(propertyType)
		}
		if required, ok := property["required"].(bool); ok {
			entry["required"] = required
		}
		if showInList, ok := property["show_in_list"].(bool); ok {
			entry["show_in_list"] = showInList
		}
		if unit, ok := property["unit"].(string); ok && strings.TrimSpace(unit) != "" {
			entry["unit"] = strings.TrimSpace(unit)
		}
		if displayWidth, ok := property["display_width"].(string); ok && strings.TrimSpace(displayWidth) != "" {
			entry["display_width"] = strings.TrimSpace(displayWidth)
		}
		if options := normalizeAIPropertyOptions(property["options"]); len(options) > 0 {
			entry["options"] = options
		}
		summary = append(summary, entry)
	}
	return summary
}

func buildAISinglePropertySummary(property map[string]any) map[string]any {
	if len(property) == 0 {
		return map[string]any{}
	}
	summary := buildAIPropertySummary([]map[string]any{property})
	if len(summary) == 0 {
		return map[string]any{}
	}
	return summary[0]
}

func normalizeAIPropertyOptions(value any) []string {
	switch v := value.(type) {
	case []string:
		return v
	case []any:
		out := make([]string, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok && strings.TrimSpace(s) != "" {
				out = append(out, strings.TrimSpace(s))
			}
		}
		return out
	case string:
		raw := strings.TrimSpace(v)
		if raw == "" || raw == "{}" || raw == "[]" {
			return nil
		}
		var parsed []string
		if json.Unmarshal([]byte(raw), &parsed) == nil {
			return parsed
		}
		var parsedAny []any
		if json.Unmarshal([]byte(raw), &parsedAny) == nil {
			return normalizeAIPropertyOptions(parsedAny)
		}
	}
	return nil
}

func buildAISingleCategorySummary(category map[string]any) map[string]any {
	if len(category) == 0 {
		return map[string]any{}
	}
	entry := map[string]any{}
	if id, ok := mapInt64(category["id"]); ok {
		entry["id"] = id
	}
	if name, ok := category["name"].(string); ok && strings.TrimSpace(name) != "" {
		entry["name"] = strings.TrimSpace(name)
	}
	if description, ok := category["description"].(string); ok && strings.TrimSpace(description) != "" {
		entry["description"] = strings.TrimSpace(description)
	}
	return entry
}

func findCategoryByID(categories []map[string]any, categoryID *int64) map[string]any {
	if categoryID == nil {
		return nil
	}
	for _, category := range categories {
		if id, ok := mapInt64(category["id"]); ok && id == *categoryID {
			return category
		}
	}
	return nil
}
