package ai

import (
	"encoding/json"
	"fmt"
	"strings"
)

func marshalAIContextJSON(payload map[string]any) (string, error) {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

func runAIDebuggableStructuredRequest(cfg *resolvedAIConfig, apiKey, prompt, input, instructions string, allowWebSearch bool, responseSchema map[string]any) (string, string, *AIUsage, string, error) {
	rawDebugParts := make([]string, 0, 4)
	var webUsage *AIUsage
	var err error

	if allowWebSearch && strings.EqualFold(cfg.Provider, "ollama") {
		input, webUsage, err = maybeAugmentInputWithOllamaWebContext(cfg.Client, cfg.Provider, apiKey, prompt, input, func(raw string) error {
			rawDebugParts = append(rawDebugParts, raw)
			return nil
		})
		if err != nil {
			rawDebug := strings.TrimSpace(strings.Join(rawDebugParts, "\n\n"))
			mergedUsage := mergeAIUsage(webUsage, nil)
			return "", "", mergedUsage, rawDebug, wrapAIDebugError(normalizeAIRequestError(err), rawDebug, mergedUsage)
		}
	}

	outputText, transport, usage, err := generateAIText(
		cfg.Client,
		cfg.BaseURL,
		cfg.Provider,
		cfg.Model,
		apiKey,
		instructions,
		input,
		allowWebSearch,
		nil,
		responseSchema,
		func(raw string) error {
			rawDebugParts = append(rawDebugParts, raw)
			return nil
		},
	)
	rawDebug := strings.TrimSpace(strings.Join(rawDebugParts, "\n\n"))
	mergedUsage := mergeAIUsage(webUsage, usage)
	if err != nil {
		return "", "", mergedUsage, rawDebug, wrapAIDebugError(err, rawDebug, mergedUsage)
	}
	return outputText, transport, mergedUsage, rawDebug, nil
}

func SuggestCategoryProperties(settings AISettings, req SuggestCategoryPropertiesRequest) (*SuggestCategoryPropertiesResult, error) {
	if strings.TrimSpace(req.Prompt) == "" {
		return nil, fmt.Errorf("Prompt is required")
	}
	cfg, err := resolveAIConfig(settings, generateTimeoutForProvider(settings.Provider))
	if err != nil {
		return nil, err
	}

	input, err := marshalAIContextJSON(map[string]any{
		"realm":               req.Realm,
		"locale":              req.Locale,
		"explicit_task":       req.Prompt,
		"category":            buildAISingleCategorySummary(req.Category),
		"existing_properties": buildAIPropertySummary(req.ExistingProperties),
	})
	if err != nil {
		return nil, err
	}

	outputText, transport, usage, rawDebug, err := runAIDebuggableStructuredRequest(
		cfg,
		settings.APIKey,
		req.Prompt,
		input,
		buildCategoryPropertyInstructions(settings.CategoryPropertyPrompt, req.AllowWebSearch, req.Locale, cfg.Provider),
		req.AllowWebSearch,
		buildCategoryPropertyJSONSchema(),
	)
	if err != nil {
		return nil, err
	}

	result, err := finalizeCategoryPropertySuggestions(outputText, transport, cfg.Model, cfg.Provider, req)
	if err != nil {
		return nil, wrapAIDebugError(err, rawDebug, usage)
	}
	result.Usage = usage
	result.RawDebug = rawDebug
	return result, nil
}

func SuggestPropertyEnhancement(settings AISettings, req SuggestPropertyEnhancementRequest) (*SuggestPropertyEnhancementResult, error) {
	if strings.TrimSpace(req.Prompt) == "" {
		return nil, fmt.Errorf("Prompt is required")
	}
	cfg, err := resolveAIConfig(settings, generateTimeoutForProvider(settings.Provider))
	if err != nil {
		return nil, err
	}

	input, err := marshalAIContextJSON(map[string]any{
		"realm":               req.Realm,
		"locale":              req.Locale,
		"explicit_task":       req.Prompt,
		"category":            buildAISingleCategorySummary(req.Category),
		"property":            buildAISinglePropertySummary(req.Property),
		"existing_properties": buildAIPropertySummary(req.ExistingProperties),
	})
	if err != nil {
		return nil, err
	}

	outputText, transport, usage, rawDebug, err := runAIDebuggableStructuredRequest(
		cfg,
		settings.APIKey,
		req.Prompt,
		input,
		buildPropertyEnhancementInstructions(settings.PropertyEnhancementPrompt, req.AllowWebSearch, req.Locale, cfg.Provider),
		req.AllowWebSearch,
		buildPropertyEnhancementJSONSchema(),
	)
	if err != nil {
		return nil, err
	}

	result, err := finalizePropertyEnhancement(outputText, transport, cfg.Model, cfg.Provider, req)
	if err != nil {
		return nil, wrapAIDebugError(err, rawDebug, usage)
	}
	result.Usage = usage
	result.RawDebug = rawDebug
	return result, nil
}

func SuggestVendor(settings AISettings, req SuggestVendorRequest) (*SuggestVendorResult, error) {
	if strings.TrimSpace(req.Prompt) == "" {
		return nil, fmt.Errorf("Prompt is required")
	}
	cfg, err := resolveAIConfig(settings, generateTimeoutForProvider(settings.Provider))
	if err != nil {
		return nil, err
	}

	input, err := marshalAIContextJSON(map[string]any{
		"realm":          req.Realm,
		"locale":         req.Locale,
		"explicit_task":  req.Prompt,
		"entity_type":    req.EntityType,
		"allowed_fields": buildAIVendorAllowedFields(req.EntityType),
		"current_draft":  buildAISingleVendorSummary(req.Draft),
		"field_guidance": buildAIVendorFieldGuidance(req.EntityType),
	})
	if err != nil {
		return nil, err
	}

	outputText, transport, usage, rawDebug, err := runAIDebuggableStructuredRequest(
		cfg,
		settings.APIKey,
		req.Prompt,
		input,
		buildVendorSuggestionInstructions(settings.VendorPrompt, req.AllowWebSearch, req.Locale, cfg.Provider),
		req.AllowWebSearch,
		buildVendorSuggestionJSONSchema(),
	)
	if err != nil {
		return nil, err
	}

	result, err := finalizeVendorSuggestion(outputText, transport, cfg.Model, cfg.Provider, req)
	if err != nil {
		return nil, wrapAIDebugError(err, rawDebug, usage)
	}
	result.Usage = usage
	result.RawDebug = rawDebug
	return result, nil
}

func finalizeVendorSuggestion(outputText, transport, model, provider string, req SuggestVendorRequest) (*SuggestVendorResult, error) {
	jsonText := extractFirstJSONObject(outputText)
	if strings.TrimSpace(jsonText) == "" {
		preview := partialAIOutputPreview(outputText)
		if preview != "" {
			return nil, fmt.Errorf("Model did not return a complete JSON object. Partial output: %s", preview)
		}
		return nil, fmt.Errorf("Model did not return valid JSON")
	}

	var result SuggestVendorResult
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
	normalizeVendorProposal(&result.Vendor)
	if result.AssistantMessage == "" {
		result.AssistantMessage = fallbackVendorAssistantMessage(result, req.Locale)
	}

	result.Transport = transport
	result.Model = model
	result.Provider = provider
	result.RawPrompt = req.Prompt
	result.Context = map[string]any{
		"realm":       req.Realm,
		"entity_type": req.EntityType,
	}

	return &result, nil
}
