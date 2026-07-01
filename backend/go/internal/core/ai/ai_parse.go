package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
)

func ParseItemIntent(settings AISettings, req ParseItemIntentRequest) (*ParseItemIntentResult, error) {
	if strings.TrimSpace(req.Prompt) == "" {
		return nil, fmt.Errorf("Prompt is required")
	}
	cfg, err := resolveAIConfig(settings, generateTimeoutForProvider(settings.Provider))
	if err != nil {
		return nil, err
	}
	parseCtx, err := prepareParseContext(req, aiSettingsSupportsVision(settings))
	if err != nil {
		return nil, err
	}

	input := parseCtx.ContextJSON
	var webUsage *AIUsage
	if req.AllowWebSearch && strings.EqualFold(cfg.Provider, "ollama") {
		input, webUsage, err = maybeAugmentInputWithOllamaWebContext(cfg.Client, cfg.Provider, settings.APIKey, req.Prompt, parseCtx.ContextJSON, nil)
		if err != nil {
			return nil, normalizeAIRequestError(err)
		}
	}

	outputText, transport, usage, err := generateAIText(
		cfg.Client,
		cfg.BaseURL,
		cfg.Provider,
		cfg.Model,
		settings.APIKey,
		buildParseInstructions(settings.ParseItemPrompt, req.AllowWebSearch, req.Locale, req.IdentifyOnly, cfg.Provider),
		input,
		req.AllowWebSearch,
		parseCtx.ImageInput,
		buildParseJSONSchema(),
		nil,
	)
	if err != nil {
		return nil, err
	}
	result, err := finalizeParseItemIntentResult(outputText, transport, cfg.Model, cfg.Provider, req, parseCtx.SelectedCategoryID, parseCtx.SelectedCategoryName, parseCtx.FilteredProperties)
	if err != nil {
		return nil, err
	}
	result.Usage = mergeAIUsage(webUsage, usage)
	return result, nil
}

func ParseItemIntentStream(settings AISettings, req ParseItemIntentRequest, emit func(AIStreamEvent) error) (*ParseItemIntentResult, error) {
	if strings.TrimSpace(req.Prompt) == "" {
		return nil, fmt.Errorf("Prompt is required")
	}
	cfg, err := resolveAIConfig(settings, generateTimeoutForProvider(settings.Provider))
	if err != nil {
		return nil, err
	}
	parseCtx, err := prepareParseContext(req, aiSettingsSupportsVision(settings))
	if err != nil {
		return nil, err
	}

	input := parseCtx.ContextJSON
	var webUsage *AIUsage
	if req.AllowWebSearch && strings.EqualFold(cfg.Provider, "ollama") {
		input, webUsage, err = maybeAugmentInputWithOllamaWebContext(cfg.Client, cfg.Provider, settings.APIKey, req.Prompt, parseCtx.ContextJSON, func(raw string) error {
			if emit != nil {
				return emit(AIStreamEvent{Type: "raw", Message: raw})
			}
			return nil
		})
		if err != nil {
			return nil, normalizeAIRequestError(err)
		}
	}

	if err := emitParseContextStatus(req, parseCtx, emit); err != nil {
		return nil, err
	}
	if err := emitParseRequestContext(parseCtx.ContextJSON, emit); err != nil {
		return nil, err
	}

	outputText, transport, usage, hadStreamDelta := tryStreamParseIntent(cfg, settings, req, parseCtx, input, emit)
	if strings.TrimSpace(outputText) == "" {
		outputText, transport, usage, err = generateAIText(
			cfg.Client,
			cfg.BaseURL,
			cfg.Provider,
			cfg.Model,
			settings.APIKey,
			buildParseInstructions(settings.ParseItemPrompt, req.AllowWebSearch, req.Locale, req.IdentifyOnly, cfg.Provider),
			input,
			req.AllowWebSearch,
			parseCtx.ImageInput,
			buildParseJSONSchema(),
			func(raw string) error {
				if emit != nil {
					return emit(AIStreamEvent{Type: "raw", Message: raw})
				}
				return nil
			},
		)
		if err != nil {
			return nil, err
		}
		if emit != nil && strings.TrimSpace(outputText) != "" && !hadStreamDelta {
			if err := emit(AIStreamEvent{Type: "delta", Delta: outputText}); err != nil {
				return nil, err
			}
		}
	}

	result, err := finalizeParseItemIntentResult(outputText, transport, cfg.Model, cfg.Provider, req, parseCtx.SelectedCategoryID, parseCtx.SelectedCategoryName, parseCtx.FilteredProperties)
	if err != nil {
		return nil, err
	}
	result.Usage = mergeAIUsage(webUsage, usage)
	if err := emitParseResultStatus(result, emit); err != nil {
		return nil, err
	}
	return result, nil
}

func prepareParseContext(req ParseItemIntentRequest, supportsVision bool) (*preparedParseContext, error) {
	if req.IdentifyOnly {
		contextPayload := map[string]any{
			"realm":   req.Realm,
			"prompt":  req.Prompt,
			"barcode": req.Barcode,
			"locale":  req.Locale,
		}
		if supportsVision && strings.TrimSpace(req.TempImageID) != "" {
			contextPayload["has_image"] = true
		}
		contextJSON, err := marshalAIContextJSON(contextPayload)
		if err != nil {
			return nil, err
		}
		var imageInput *AIImageInput
		if supportsVision {
			imageInput, _ = loadAIImageInput(req.TempImageID)
		}
		return &preparedParseContext{
			ContextJSON: contextJSON,
			ImageInput:  imageInput,
		}, nil
	}

	selectedCategoryID := req.SelectedCategoryID
	if selectedCategoryID == nil {
		if inferred := inferCategoryLocally(req); inferred != nil {
			selectedCategoryID = inferred.SuggestedCategoryID
		}
	}
	filteredProperties := filterPropertiesForCategory(req.Properties, selectedCategoryID)
	selectedCategory := findCategoryByID(req.Categories, selectedCategoryID)
	selectedCategoryName := ""
	if selectedCategory != nil {
		if name, ok := selectedCategory["name"].(string); ok {
			selectedCategoryName = strings.TrimSpace(name)
		}
	}
	propertySummary := buildAIPropertySummary(filteredProperties)

	contextPayload := map[string]any{
		"realm":             req.Realm,
		"prompt":            req.Prompt,
		"barcode":           req.Barcode,
		"locale":            req.Locale,
		"selected_category": selectedCategory,
		"properties":        propertySummary,
	}
	if selectedCategoryID == nil {
		contextPayload["available_categories"] = buildAICategorySummary(req.Categories)
	}
	if supportsVision && strings.TrimSpace(req.TempImageID) != "" {
		contextPayload["has_image"] = true
	}
	contextJSON, err := marshalAIContextJSON(contextPayload)
	if err != nil {
		return nil, err
	}
	var imageInput *AIImageInput
	if supportsVision {
		imageInput, _ = loadAIImageInput(req.TempImageID)
	}
	return &preparedParseContext{
		SelectedCategoryID:   selectedCategoryID,
		SelectedCategoryName: selectedCategoryName,
		FilteredProperties:   filteredProperties,
		ContextJSON:          contextJSON,
		ImageInput:           imageInput,
	}, nil
}

func inferCategoryLocally(req ParseItemIntentRequest) *categoryInferenceResult {
	if len(req.Categories) == 0 {
		return nil
	}
	if len(req.Categories) == 1 {
		category := req.Categories[0]
		id, _ := mapInt64(category["id"])
		name, _ := category["name"].(string)
		return &categoryInferenceResult{
			Intent:                "create_item",
			Confidence:            0.99,
			SuggestedRealm:        req.Realm,
			SuggestedCategoryID:   &id,
			SuggestedCategoryName: strings.TrimSpace(name),
			Reason:                "single available category",
		}
	}

	prompt := normalizeAIText(req.Prompt)
	if prompt == "" {
		return nil
	}

	bestIndex, bestScore := scoreBestCategory(req.Categories, prompt)
	if bestIndex < 0 || bestScore == 0 {
		return nil
	}

	category := req.Categories[bestIndex]
	id, ok := mapInt64(category["id"])
	if !ok {
		return nil
	}
	name, _ := category["name"].(string)
	return &categoryInferenceResult{
		Intent:                "create_item",
		Confidence:            0.92,
		SuggestedRealm:        req.Realm,
		SuggestedCategoryID:   &id,
		SuggestedCategoryName: strings.TrimSpace(name),
		Reason:                "matched category name or description locally",
	}
}

func emitParseContextStatus(req ParseItemIntentRequest, parseCtx *preparedParseContext, emit func(AIStreamEvent) error) error {
	if emit == nil {
		return nil
	}

	categoryMessage := "Ermittle Kategorie..."
	if req.IdentifyOnly {
		categoryMessage = "Identifiziere Produkt..."
	} else if parseCtx.SelectedCategoryName != "" {
		categoryMessage = fmt.Sprintf("Kategorie: %s", parseCtx.SelectedCategoryName)
	}
	if err := emit(AIStreamEvent{Type: "note", Message: categoryMessage}); err != nil {
		return err
	}
	if err := emit(AIStreamEvent{Type: "note", Message: "Ich analysiere deine Anfrage und gleiche sie mit den verfügbaren Feldern ab..."}); err != nil {
		return err
	}
	if err := emit(AIStreamEvent{Type: "note", Message: "Ich sammle jetzt die Informationen, die ich schon sinnvoll vorbefüllen kann..."}); err != nil {
		return err
	}
	return emit(AIStreamEvent{Type: "status", Message: "KI erstellt gerade einen Entwurf..."})
}

func emitParseRequestContext(contextJSON string, emit func(AIStreamEvent) error) error {
	if emit == nil {
		return nil
	}
	var pretty bytes.Buffer
	if err := json.Indent(&pretty, []byte(contextJSON), "", "  "); err == nil {
		return emit(AIStreamEvent{Type: "request", Message: pretty.String()})
	}
	return emit(AIStreamEvent{Type: "request", Message: contextJSON})
}

func tryStreamParseIntent(cfg *resolvedAIConfig, settings AISettings, req ParseItemIntentRequest, parseCtx *preparedParseContext, input string, emit func(AIStreamEvent) error) (string, string, *AIUsage, bool) {
	if cfg.Provider == "openai" || parseCtx.ImageInput != nil {
		return "", "", nil, false
	}

	var builder strings.Builder
	var usage *AIUsage
	hadStreamDelta := false
	streamErr := generateViaChatCompletionsStream(
		cfg.Client,
		cfg.BaseURL,
		cfg.Provider,
		cfg.Model,
		settings.APIKey,
		buildParseInstructions(settings.ParseItemPrompt, req.AllowWebSearch, req.Locale, req.IdentifyOnly, cfg.Provider),
		input,
		buildParseJSONSchema(),
		func(delta string) error {
			hadStreamDelta = true
			builder.WriteString(delta)
			if emit != nil {
				return emit(AIStreamEvent{Type: "delta", Delta: delta})
			}
			return nil
		},
		func(nextUsage AIUsage) error {
			usage = &nextUsage
			return nil
		},
		func(raw string) error {
			if emit != nil {
				return emit(AIStreamEvent{Type: "raw", Message: raw})
			}
			return nil
		},
	)
	if streamErr == nil && strings.TrimSpace(builder.String()) != "" {
		return builder.String(), "chat.completions.stream", usage, hadStreamDelta
	}
	return "", "", usage, hadStreamDelta
}

func emitParseResultStatus(result *ParseItemIntentResult, emit func(AIStreamEvent) error) error {
	if emit == nil {
		return nil
	}
	if len(result.Questions) > 0 {
		if err := emit(AIStreamEvent{Type: "note", Message: "Ich habe einen ersten Entwurf. Ein paar Details brauche ich noch von dir."}); err != nil {
			return err
		}
	} else {
		if err := emit(AIStreamEvent{Type: "note", Message: "Der erste Entwurf ist fertig und ich konnte schon einiges vorbefüllen."}); err != nil {
			return err
		}
	}
	return emit(AIStreamEvent{Type: "result", Result: result})
}
