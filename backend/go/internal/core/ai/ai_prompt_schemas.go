package ai

func buildParseJSONSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"intent":                  map[string]any{"type": "string"},
			"confidence":              map[string]any{"type": "number"},
			"needs_confirmation":      map[string]any{"type": "boolean"},
			"assistant_message":       map[string]any{"type": "string"},
			"suggested_realm":         map[string]any{"type": "string"},
			"suggested_category_id":   map[string]any{"type": []string{"integer", "null"}},
			"suggested_category_name": map[string]any{"type": "string"},
			"category_proposal":       map[string]any{"type": []string{"object", "null"}, "additionalProperties": true},
			"fields":                  map[string]any{"type": "object", "additionalProperties": true},
			"properties":              map[string]any{"type": "object", "additionalProperties": true},
			"missing_required":        map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			"questions":               map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			"notes":                   map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		},
		"required": []string{
			"intent",
			"confidence",
			"needs_confirmation",
			"assistant_message",
			"suggested_realm",
			"suggested_category_name",
			"fields",
			"properties",
			"missing_required",
			"questions",
			"notes",
		},
		"additionalProperties": false,
	}
}

func buildCategoryPropertyJSONSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"confidence":         map[string]any{"type": "number"},
			"needs_confirmation": map[string]any{"type": "boolean"},
			"assistant_message":  map[string]any{"type": "string"},
			"questions":          map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			"notes":              map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			"properties": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"name":          map[string]any{"type": "string"},
						"property_type": map[string]any{"type": "string"},
						"unit":          map[string]any{"type": "string"},
						"required":      map[string]any{"type": "boolean"},
						"show_in_list":  map[string]any{"type": "boolean"},
						"display_width": map[string]any{"type": "string"},
						"options":       map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
					},
					"required":             []string{"name", "property_type"},
					"additionalProperties": false,
				},
			},
		},
		"required":             []string{"confidence", "needs_confirmation", "assistant_message", "questions", "notes", "properties"},
		"additionalProperties": false,
	}
}

func buildPropertyEnhancementJSONSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"confidence":         map[string]any{"type": "number"},
			"needs_confirmation": map[string]any{"type": "boolean"},
			"assistant_message":  map[string]any{"type": "string"},
			"questions":          map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			"notes":              map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			"property": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"name":          map[string]any{"type": "string"},
					"property_type": map[string]any{"type": "string"},
					"unit":          map[string]any{"type": "string"},
					"required":      map[string]any{"type": "boolean"},
					"show_in_list":  map[string]any{"type": "boolean"},
					"display_width": map[string]any{"type": "string"},
					"options":       map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				},
				"required":             []string{"name", "property_type"},
				"additionalProperties": false,
			},
		},
		"required":             []string{"confidence", "needs_confirmation", "assistant_message", "questions", "notes", "property"},
		"additionalProperties": false,
	}
}

func buildVendorSuggestionJSONSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"confidence":         map[string]any{"type": "number"},
			"needs_confirmation": map[string]any{"type": "boolean"},
			"assistant_message":  map[string]any{"type": "string"},
			"questions":          map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			"notes":              map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			"vendor": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"name":              map[string]any{"type": "string"},
					"website":           map[string]any{"type": "string"},
					"external_logo_url": map[string]any{"type": "string"},
					"email":             map[string]any{"type": "string"},
					"phone":             map[string]any{"type": "string"},
					"contact_person":    map[string]any{"type": "string"},
					"customer_number":   map[string]any{"type": "string"},
					"account_manager":   map[string]any{"type": "string"},
					"support_email":     map[string]any{"type": "string"},
					"support_phone":     map[string]any{"type": "string"},
					"support_url":       map[string]any{"type": "string"},
					"address": map[string]any{
						"type": []string{"object", "null"},
						"properties": map[string]any{
							"street":       map[string]any{"type": "string"},
							"house_number": map[string]any{"type": "string"},
							"zip":          map[string]any{"type": "string"},
							"city":         map[string]any{"type": "string"},
						},
						"additionalProperties": false,
					},
				},
				"additionalProperties": false,
			},
		},
		"required":             []string{"confidence", "needs_confirmation", "assistant_message", "questions", "notes", "vendor"},
		"additionalProperties": false,
	}
}

func buildInventoryLookupPlanJSONSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"needs_lookup": map[string]any{"type": "boolean"},
			"reason":       map[string]any{"type": "string"},
			"request": map[string]any{
				"type": []string{"object", "null"},
				"properties": map[string]any{
					"kind":          map[string]any{"type": "string", "enum": []string{"items", "checkouts"}},
					"realm":         map[string]any{"type": "string", "enum": []string{"all", "archive", "collection"}},
					"search":        map[string]any{"type": "string"},
					"location_name": map[string]any{"type": "string"},
					"category_name": map[string]any{"type": "string"},
					"user_name":     map[string]any{"type": "string"},
					"status":        map[string]any{"type": "string"},
					"stock_state":   map[string]any{"type": "string", "enum": []string{"low_stock", "out_of_stock"}},
					"limit":         map[string]any{"type": "integer", "minimum": 1, "maximum": 20},
				},
				"required":             []string{"kind", "realm", "limit"},
				"additionalProperties": false,
			},
		},
		"required":             []string{"needs_lookup", "reason", "request"},
		"additionalProperties": false,
	}
}
