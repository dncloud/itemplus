package ai

import (
	"encoding/json"
	"fmt"
	"strings"
)

func finalizeParseItemIntentResult(outputText, transport, model, provider string, req ParseItemIntentRequest, selectedCategoryID *int64, selectedCategoryName string, filteredProperties []map[string]any) (*ParseItemIntentResult, error) {
	jsonText := extractFirstJSONObject(outputText)
	if strings.TrimSpace(jsonText) == "" {
		preview := partialAIOutputPreview(outputText)
		if preview != "" {
			return nil, fmt.Errorf("Model did not return a complete JSON object. Partial output: %s", preview)
		}
		return nil, fmt.Errorf("Model did not return valid JSON")
	}

	jsonText = sanitizeParseResultJSON(jsonText)

	var result ParseItemIntentResult
	if err := json.Unmarshal([]byte(jsonText), &result); err != nil {
		preview := partialAIOutputPreview(jsonText)
		return nil, fmt.Errorf("Could not parse model JSON: %v. Partial JSON: %s", err, preview)
	}
	if result.Fields == nil {
		result.Fields = map[string]any{}
	}
	result.AssistantMessage = strings.TrimSpace(result.AssistantMessage)
	if result.Properties == nil {
		result.Properties = map[string]any{}
	}
	if result.MissingRequired == nil {
		result.MissingRequired = []string{}
	}
	if result.Questions == nil {
		result.Questions = []string{}
	}
	if result.Notes == nil {
		result.Notes = []string{}
	}
	if req.IdentifyOnly {
		result.SuggestedCategoryID = nil
		result.SuggestedCategoryName = ""
		result.CategoryProposal = nil
		result.Properties = map[string]any{}
		result.MissingRequired = []string{}
	}
	if result.CategoryProposal != nil && strings.TrimSpace(result.CategoryProposal.Name) == "" {
		result.CategoryProposal = nil
	}
	if result.SuggestedCategoryID == nil && selectedCategoryID != nil {
		result.SuggestedCategoryID = selectedCategoryID
	}
	if strings.TrimSpace(result.SuggestedCategoryName) == "" {
		result.SuggestedCategoryName = selectedCategoryName
	}
	if selectedCategoryID == nil {
		if refinedID, refinedName, ok := refineCategoryFromResult(req, &result); ok {
			result.SuggestedCategoryID = refinedID
			result.SuggestedCategoryName = refinedName
			selectedCategoryID = refinedID
			selectedCategoryName = refinedName
		}
	}
	result.Transport = transport
	result.Model = model
	result.Provider = provider
	result.RawPrompt = req.Prompt
	if result.AssistantMessage == "" {
		result.AssistantMessage = fallbackParseAssistantMessage(result, req.Locale)
	}
	result.Context = map[string]any{
		"realm":                   req.Realm,
		"category_count":          len(req.Categories),
		"property_count":          len(req.Properties),
		"selected_category_id":    selectedCategoryID,
		"selected_category_name":  selectedCategoryName,
		"selected_property_count": len(filteredProperties),
	}
	return &result, nil
}

func fallbackParseAssistantMessage(result ParseItemIntentResult, locale string) string {
	german := strings.HasPrefix(strings.ToLower(strings.TrimSpace(locale)), "de")
	if len(result.Questions) > 0 {
		return strings.Join(result.Questions, "\n\n")
	}
	if len(result.Notes) > 0 {
		return strings.Join(result.Notes, "\n\n")
	}
	if german {
		return "Ich habe einen ersten Entwurf vorbereitet."
	}
	return "I prepared a first draft."
}

func sanitizeParseResultJSON(jsonText string) string {
	var payload map[string]any
	if err := json.Unmarshal([]byte(jsonText), &payload); err != nil {
		return jsonText
	}

	rawProposal, ok := payload["category_proposal"]
	if !ok {
		return jsonText
	}
	proposal, ok := rawProposal.(map[string]any)
	if !ok {
		delete(payload, "category_proposal")
		return marshalSanitizedParseResult(payload, jsonText)
	}

	rawProps, hasProps := proposal["properties"]
	if !hasProps {
		return jsonText
	}
	propList, ok := rawProps.([]any)
	if !ok {
		delete(payload, "category_proposal")
		return marshalSanitizedParseResult(payload, jsonText)
	}

	for _, entry := range propList {
		if entry == nil {
			continue
		}
		if _, ok := entry.(map[string]any); !ok {
			delete(payload, "category_proposal")
			return marshalSanitizedParseResult(payload, jsonText)
		}
	}

	return jsonText
}

func marshalSanitizedParseResult(payload map[string]any, fallback string) string {
	bytes, err := json.Marshal(payload)
	if err != nil {
		return fallback
	}
	return string(bytes)
}

func refineCategoryFromResult(req ParseItemIntentRequest, result *ParseItemIntentResult) (*int64, string, bool) {
	if len(req.Categories) == 0 {
		return nil, "", false
	}

	parts := []string{req.Prompt}
	for _, value := range result.Fields {
		parts = append(parts, stringifyAIValue(value))
	}
	for key, value := range result.Properties {
		parts = append(parts, key, stringifyAIValue(value))
	}
	parts = append(parts, result.Questions...)
	parts = append(parts, result.Notes...)
	combined := strings.Join(parts, " ")

	bestIndex, bestScore := scoreBestCategory(req.Categories, combined)
	if bestIndex < 0 || bestScore == 0 {
		return nil, "", false
	}

	category := req.Categories[bestIndex]
	id, ok := mapInt64(category["id"])
	if !ok {
		return nil, "", false
	}
	name, _ := category["name"].(string)
	return &id, strings.TrimSpace(name), true
}

func scoreBestCategory(categories []map[string]any, text string) (int, int) {
	prompt := normalizeAIText(text)
	if prompt == "" {
		return -1, 0
	}

	bestIndex := -1
	bestScore := 0
	for idx, category := range categories {
		name, _ := category["name"].(string)
		description, _ := category["description"].(string)
		tokens := uniqueNormalizedTokens(name + " " + description)
		if len(tokens) == 0 {
			continue
		}
		score := 0
		joinedName := normalizeAIText(name)
		if joinedName != "" && strings.Contains(prompt, joinedName) {
			score += 6
		}
		for _, token := range tokens {
			if len(token) < 2 {
				continue
			}
			if strings.Contains(prompt, token) {
				if len(token) <= 3 {
					score += 2
				} else {
					score++
				}
			}
		}
		if score > bestScore {
			bestScore = score
			bestIndex = idx
		}
	}
	return bestIndex, bestScore
}

func stringifyAIValue(value any) string {
	switch v := value.(type) {
	case string:
		return v
	case float64:
		return fmt.Sprintf("%.0f", v)
	case int:
		return fmt.Sprintf("%d", v)
	case int64:
		return fmt.Sprintf("%d", v)
	case bool:
		if v {
			return "true"
		}
		return "false"
	case []any:
		parts := make([]string, 0, len(v))
		for _, item := range v {
			parts = append(parts, stringifyAIValue(item))
		}
		return strings.Join(parts, " ")
	case []string:
		return strings.Join(v, " ")
	case map[string]any:
		parts := make([]string, 0, len(v))
		for key, val := range v {
			parts = append(parts, key, stringifyAIValue(val))
		}
		return strings.Join(parts, " ")
	default:
		return fmt.Sprintf("%v", value)
	}
}
