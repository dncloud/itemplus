package ai

import (
	"fmt"
	"strings"
)

func ChatWithAIStream(settings AISettings, req ChatRequest, emit func(AIStreamEvent) error) (*ChatResult, error) {
	cfg, err := resolveAIConfig(settings, generateTimeoutForProvider(settings.Provider))
	if err != nil {
		return nil, err
	}

	input := buildChatInput(req.Messages, req.AppContext)
	if input == "" {
		return nil, fmt.Errorf("At least one chat message is required")
	}

	var imageInput *AIImageInput
	hasImageAttachment := strings.TrimSpace(req.TempImageID) != ""
	supportsVision := aiSettingsSupportsVision(settings)
	if hasImageAttachment && supportsVision {
		imageInput, _ = loadAIImageInput(req.TempImageID)
	}
	if hasImageAttachment && imageInput == nil && !supportsVision {
		input += "\n\nsystem_context:\nThe user attached an image, but the active AI profile is configured as text-only and cannot inspect images. Tell the user briefly that this model cannot see images and that they should enable a vision-capable Ollama model in the AI settings if they want image analysis."
	}

	webQuery := buildChatSearchQuery(req.Messages)
	effectiveAllowWebSearch := req.AllowWebSearch && imageInput == nil && shouldUseWebSearchForChatQuery(webQuery)
	instructions := buildChatInstructions(settings.ChatPrompt, effectiveAllowWebSearch, req.Locale, cfg.Provider)
	contextMap := map[string]any{
		"profile_id":   settings.ProfileID,
		"profile_name": settings.ProfileName,
	}
	if len(req.AppContext) > 0 {
		contextMap["app_context"] = req.AppContext
	}

	var webUsage *AIUsage
	if req.AllowWebSearch && imageInput == nil && strings.EqualFold(cfg.Provider, "ollama") {
		if effectiveAllowWebSearch {
			input, webUsage, err = maybeAugmentInputWithOllamaWebContext(cfg.Client, cfg.Provider, settings.APIKey, webQuery, input, func(raw string) error {
				if emit != nil {
					return emit(AIStreamEvent{Type: "raw", Message: raw})
				}
				return nil
			})
			if err != nil {
				return nil, normalizeAIRequestError(err)
			}
		} else if emit != nil {
			_ = emit(AIStreamEvent{Type: "raw", Message: `OLLAMA WEB SEARCH
{"status":"skipped","reason":"no_web_intent"}`})
		}
	}

	if imageInput == nil && !effectiveAllowWebSearch {
		var outputBuilder strings.Builder
		var streamUsage *AIUsage
		streamErr := generateViaChatCompletionsStream(cfg.Client, cfg.BaseURL, cfg.Provider, cfg.Model, settings.APIKey, instructions, input, nil, func(delta string) error {
			outputBuilder.WriteString(delta)
			if emit != nil {
				return emit(AIStreamEvent{Type: "delta", Delta: delta})
			}
			return nil
		}, func(usage AIUsage) error {
			streamUsage = &usage
			return nil
		}, func(raw string) error {
			if emit != nil {
				return emit(AIStreamEvent{Type: "raw", Message: raw})
			}
			return nil
		})
		if streamErr == nil {
			message := strings.TrimSpace(outputBuilder.String())
			if message != "" {
				return &ChatResult{
					AssistantMessage: message,
					Transport:        "chat.completions",
					Model:            cfg.Model,
					Provider:         cfg.Provider,
					Usage:            mergeAIUsage(webUsage, streamUsage),
					Context:          contextMap,
				}, nil
			}
		}
		if streamErr != nil && emit != nil {
			_ = emit(AIStreamEvent{Type: "note", Message: "Falling back to a non-streaming response."})
		}
	}

	outputText, transport, usage, err := generateAIText(cfg.Client, cfg.BaseURL, cfg.Provider, cfg.Model, settings.APIKey, instructions, input, effectiveAllowWebSearch, imageInput, nil, func(raw string) error {
		if emit != nil {
			return emit(AIStreamEvent{Type: "raw", Message: raw})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &ChatResult{
		AssistantMessage: strings.TrimSpace(outputText),
		Transport:        transport,
		Model:            cfg.Model,
		Provider:         cfg.Provider,
		Usage:            mergeAIUsage(webUsage, usage),
		Context:          contextMap,
	}, nil
}
