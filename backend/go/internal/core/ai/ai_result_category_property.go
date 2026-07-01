package ai

import (
	"encoding/json"
	"fmt"
	"strings"
)

func finalizeCategoryPropertySuggestions(outputText, transport, model, provider string, req SuggestCategoryPropertiesRequest) (*SuggestCategoryPropertiesResult, error) {
	jsonText := extractFirstJSONObject(outputText)
	if strings.TrimSpace(jsonText) == "" {
		preview := partialAIOutputPreview(outputText)
		if preview != "" {
			return nil, fmt.Errorf("Model did not return a complete JSON object. Partial output: %s", preview)
		}
		return nil, fmt.Errorf("Model did not return valid JSON")
	}

	var result SuggestCategoryPropertiesResult
	if err := json.Unmarshal([]byte(jsonText), &result); err != nil {
		preview := partialAIOutputPreview(jsonText)
		return nil, fmt.Errorf("Could not parse model JSON: %v. Partial JSON: %s", err, preview)
	}

	if result.Questions == nil {
		result.Questions = []string{}
	}
	if result.Notes == nil {
		result.Notes = []string{}
	}
	result.AssistantMessage = strings.TrimSpace(result.AssistantMessage)
	if result.Properties == nil {
		result.Properties = []AIPropertyProposal{}
	}

	existingNames := make(map[string]struct{}, len(req.ExistingProperties))
	for _, property := range req.ExistingProperties {
		if name, ok := property["name"].(string); ok {
			normalized := normalizeAIText(name)
			if normalized != "" {
				existingNames[normalized] = struct{}{}
			}
		}
	}

	seenNames := make(map[string]struct{})
	cleaned := make([]AIPropertyProposal, 0, len(result.Properties))
	for _, proposal := range result.Properties {
		proposal.Name = strings.TrimSpace(proposal.Name)
		proposal.PropertyType = normalizeSuggestedPropertyType(proposal.PropertyType)
		proposal.Unit = strings.TrimSpace(proposal.Unit)
		proposal.DisplayWidth = normalizeSuggestedDisplayWidth(proposal.DisplayWidth)
		proposal.Options = sanitizeSuggestedOptions(proposal.Options)
		if proposal.Name == "" || proposal.PropertyType == "" {
			continue
		}
		normalized := normalizeAIText(proposal.Name)
		if normalized == "" {
			continue
		}
		if _, exists := existingNames[normalized]; exists {
			continue
		}
		if _, exists := seenNames[normalized]; exists {
			continue
		}
		if proposal.PropertyType != "select" && proposal.PropertyType != "multiselect" {
			proposal.Options = nil
		}
		seenNames[normalized] = struct{}{}
		cleaned = append(cleaned, proposal)
	}

	result.Properties = cleaned
	if result.AssistantMessage == "" {
		result.AssistantMessage = fallbackCategoryAssistantMessage(result, req.Locale)
	}
	result.Transport = transport
	result.Model = model
	result.Provider = provider
	result.RawPrompt = req.Prompt
	result.Context = map[string]any{
		"realm":                   req.Realm,
		"category_name":           req.Category["name"],
		"existing_property_count": len(req.ExistingProperties),
	}

	return &result, nil
}

func finalizePropertyEnhancement(outputText, transport, model, provider string, req SuggestPropertyEnhancementRequest) (*SuggestPropertyEnhancementResult, error) {
	jsonText := extractFirstJSONObject(outputText)
	if strings.TrimSpace(jsonText) == "" {
		preview := partialAIOutputPreview(outputText)
		if preview != "" {
			return nil, fmt.Errorf("Model did not return a complete JSON object. Partial output: %s", preview)
		}
		return nil, fmt.Errorf("Model did not return valid JSON")
	}

	var result SuggestPropertyEnhancementResult
	if err := json.Unmarshal([]byte(jsonText), &result); err != nil {
		preview := partialAIOutputPreview(jsonText)
		return nil, fmt.Errorf("Could not parse model JSON: %v. Partial JSON: %s", err, preview)
	}

	if result.Questions == nil {
		result.Questions = []string{}
	}
	if result.Notes == nil {
		result.Notes = []string{}
	}
	result.AssistantMessage = strings.TrimSpace(result.AssistantMessage)

	current := buildAISinglePropertySummary(req.Property)
	currentID, _ := mapInt64(req.Property["id"])
	currentName, _ := current["name"].(string)
	currentType, _ := current["type"].(string)
	currentUnit, _ := current["unit"].(string)
	currentRequired, _ := current["required"].(bool)
	currentShowInList, currentShowInListOK := current["show_in_list"].(bool)
	currentDisplayWidth, _ := current["display_width"].(string)
	currentOptions := normalizeAIPropertyOptions(current["options"])

	result.Property.Name = strings.TrimSpace(result.Property.Name)
	if result.Property.Name == "" {
		result.Property.Name = strings.TrimSpace(currentName)
	}
	if strings.TrimSpace(result.Property.PropertyType) == "" {
		result.Property.PropertyType = normalizeSuggestedPropertyType(currentType)
	} else {
		result.Property.PropertyType = normalizeSuggestedPropertyType(result.Property.PropertyType)
	}
	result.Property.Unit = strings.TrimSpace(result.Property.Unit)
	if result.Property.Unit == "" {
		result.Property.Unit = strings.TrimSpace(currentUnit)
	}
	if strings.TrimSpace(result.Property.DisplayWidth) == "" {
		result.Property.DisplayWidth = normalizeSuggestedDisplayWidth(currentDisplayWidth)
	} else {
		result.Property.DisplayWidth = normalizeSuggestedDisplayWidth(result.Property.DisplayWidth)
	}
	result.Property.Options = sanitizeSuggestedOptions(result.Property.Options)
	if len(result.Property.Options) == 0 && (result.Property.PropertyType == "select" || result.Property.PropertyType == "multiselect") {
		result.Property.Options = sanitizeSuggestedOptions(currentOptions)
	}
	if result.Property.PropertyType != "select" && result.Property.PropertyType != "multiselect" {
		result.Property.Options = nil
	}
	if !result.Property.Required && currentRequired {
		result.Property.Required = true
	}
	if !result.Property.ShowInList && currentShowInListOK && currentShowInList {
		result.Property.ShowInList = true
	}

	existingNames := make(map[string]struct{}, len(req.ExistingProperties))
	for _, property := range req.ExistingProperties {
		propertyID, _ := mapInt64(property["id"])
		if propertyID == currentID {
			continue
		}
		if name, ok := property["name"].(string); ok {
			normalized := normalizeAIText(name)
			if normalized != "" {
				existingNames[normalized] = struct{}{}
			}
		}
	}
	if normalizedName := normalizeAIText(result.Property.Name); normalizedName != "" {
		if _, exists := existingNames[normalizedName]; exists {
			result.Property.Name = strings.TrimSpace(currentName)
		}
	}
	if result.AssistantMessage == "" {
		result.AssistantMessage = fallbackPropertyAssistantMessage(result, req.Locale)
	}

	result.Transport = transport
	result.Model = model
	result.Provider = provider
	result.RawPrompt = req.Prompt
	result.Context = map[string]any{
		"realm":                   req.Realm,
		"category_name":           req.Category["name"],
		"property_name":           currentName,
		"existing_property_count": len(req.ExistingProperties),
	}

	return &result, nil
}

func fallbackCategoryAssistantMessage(result SuggestCategoryPropertiesResult, locale string) string {
	german := strings.HasPrefix(strings.ToLower(strings.TrimSpace(locale)), "de")
	if len(result.Questions) > 0 {
		return strings.Join(result.Questions, "\n\n")
	}
	if len(result.Notes) > 0 {
		return strings.Join(result.Notes, "\n\n")
	}
	if len(result.Properties) > 0 {
		if german {
			return "Ich habe ein paar Vorschläge vorbereitet."
		}
		return "I prepared a few suggestions."
	}
	if german {
		return "Ich habe gerade nichts Sinnvolles zum Ergänzen gefunden."
	}
	return "I couldn't find anything useful to add right now."
}

func fallbackPropertyAssistantMessage(result SuggestPropertyEnhancementResult, locale string) string {
	german := strings.HasPrefix(strings.ToLower(strings.TrimSpace(locale)), "de")
	if len(result.Questions) > 0 {
		return strings.Join(result.Questions, "\n\n")
	}
	if len(result.Notes) > 0 {
		return strings.Join(result.Notes, "\n\n")
	}
	if german {
		return "Ich habe den Property-Entwurf angepasst."
	}
	return "I updated the property draft."
}

func normalizeSuggestedPropertyType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "text", "textblock", "number", "boolean", "date", "time", "select", "multiselect", "rating", "dimensions", "age_rating", "condition", "priority", "weight":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "text"
	}
}

func normalizeSuggestedDisplayWidth(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "half", "full":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "third"
	}
}

func sanitizeSuggestedOptions(options []string) []string {
	if len(options) == 0 {
		return nil
	}
	seen := make(map[string]struct{})
	cleaned := make([]string, 0, len(options))
	for _, option := range options {
		option = strings.TrimSpace(option)
		if option == "" {
			continue
		}
		key := strings.ToLower(option)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		cleaned = append(cleaned, option)
	}
	if len(cleaned) == 0 {
		return nil
	}
	return cleaned
}
