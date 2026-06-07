package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"regexp"
	"strings"
	"time"
)

type AISettings struct {
	Provider                  string
	Model                     string
	BaseURL                   string
	APIKey                    string
	Enabled                   bool
	ParseItemPrompt           string
	CategoryPropertyPrompt    string
	PropertyEnhancementPrompt string
}

type AIConnectionTestResult struct {
	Status     string `json:"status"`
	Model      string `json:"model"`
	Provider   string `json:"provider"`
	OutputText string `json:"output_text,omitempty"`
	ResponseID string `json:"response_id,omitempty"`
	RequestID  string `json:"request_id,omitempty"`
	Transport  string `json:"transport,omitempty"`
}

type ParseItemIntentRequest struct {
	Realm              string           `json:"realm"`
	Prompt             string           `json:"prompt"`
	Barcode            string           `json:"barcode,omitempty"`
	TempImageID        string           `json:"temp_image_id,omitempty"`
	AllowWebSearch     bool             `json:"allow_web_search,omitempty"`
	IdentifyOnly       bool             `json:"identify_only,omitempty"`
	SelectedCategoryID *int64           `json:"selected_category_id,omitempty"`
	Categories         []map[string]any `json:"categories,omitempty"`
	Properties         []map[string]any `json:"properties,omitempty"`
	Locale             string           `json:"locale,omitempty"`
}

type AIImageInput struct {
	Data     []byte
	MimeType string
}

type ParseItemIntentResult struct {
	Intent                string              `json:"intent"`
	Confidence            float64             `json:"confidence"`
	NeedsConfirmation     bool                `json:"needs_confirmation"`
	AssistantMessage      string              `json:"assistant_message"`
	SuggestedRealm        string              `json:"suggested_realm"`
	SuggestedCategoryID   *int64              `json:"suggested_category_id,omitempty"`
	SuggestedCategoryName string              `json:"suggested_category_name,omitempty"`
	CategoryProposal      *AICategoryProposal `json:"category_proposal,omitempty"`
	Fields                map[string]any      `json:"fields"`
	Properties            map[string]any      `json:"properties"`
	MissingRequired       []string            `json:"missing_required"`
	Questions             []string            `json:"questions"`
	Notes                 []string            `json:"notes"`
	RawPrompt             string              `json:"raw_prompt,omitempty"`
	Transport             string              `json:"transport,omitempty"`
	Model                 string              `json:"model,omitempty"`
	Provider              string              `json:"provider,omitempty"`
	Context               map[string]any      `json:"context,omitempty"`
}

type AIStreamEvent struct {
	Type    string                 `json:"type"`
	Message string                 `json:"message,omitempty"`
	Delta   string                 `json:"delta,omitempty"`
	Result  *ParseItemIntentResult `json:"result,omitempty"`
}

type AICategoryProposal struct {
	Reason           string               `json:"reason,omitempty"`
	Name             string               `json:"name"`
	Description      string               `json:"description,omitempty"`
	Color            string               `json:"color,omitempty"`
	ManufacturerName string               `json:"manufacturer_name,omitempty"`
	Properties       []AIPropertyProposal `json:"properties,omitempty"`
}

type AIPropertyProposal struct {
	Name         string   `json:"name"`
	PropertyType string   `json:"property_type"`
	Unit         string   `json:"unit,omitempty"`
	Required     bool     `json:"required,omitempty"`
	ShowInList   bool     `json:"show_in_list,omitempty"`
	DisplayWidth string   `json:"display_width,omitempty"`
	Options      []string `json:"options,omitempty"`
}

type SuggestCategoryPropertiesRequest struct {
	Realm              string           `json:"realm"`
	Prompt             string           `json:"prompt"`
	AllowWebSearch     bool             `json:"allow_web_search,omitempty"`
	Locale             string           `json:"locale,omitempty"`
	Category           map[string]any   `json:"category,omitempty"`
	ExistingProperties []map[string]any `json:"existing_properties,omitempty"`
}

type SuggestCategoryPropertiesResult struct {
	Confidence        float64              `json:"confidence"`
	NeedsConfirmation bool                 `json:"needs_confirmation"`
	AssistantMessage  string               `json:"assistant_message"`
	Questions         []string             `json:"questions"`
	Notes             []string             `json:"notes"`
	Properties        []AIPropertyProposal `json:"properties"`
	RawPrompt         string               `json:"raw_prompt,omitempty"`
	Transport         string               `json:"transport,omitempty"`
	Model             string               `json:"model,omitempty"`
	Provider          string               `json:"provider,omitempty"`
	Context           map[string]any       `json:"context,omitempty"`
}

type SuggestPropertyEnhancementRequest struct {
	Realm              string           `json:"realm"`
	Prompt             string           `json:"prompt"`
	AllowWebSearch     bool             `json:"allow_web_search,omitempty"`
	Locale             string           `json:"locale,omitempty"`
	Category           map[string]any   `json:"category,omitempty"`
	Property           map[string]any   `json:"property,omitempty"`
	ExistingProperties []map[string]any `json:"existing_properties,omitempty"`
}

type SuggestPropertyEnhancementResult struct {
	Confidence        float64            `json:"confidence"`
	NeedsConfirmation bool               `json:"needs_confirmation"`
	AssistantMessage  string             `json:"assistant_message"`
	Questions         []string           `json:"questions"`
	Notes             []string           `json:"notes"`
	Property          AIPropertyProposal `json:"property"`
	RawPrompt         string             `json:"raw_prompt,omitempty"`
	Transport         string             `json:"transport,omitempty"`
	Model             string             `json:"model,omitempty"`
	Provider          string             `json:"provider,omitempty"`
	Context           map[string]any     `json:"context,omitempty"`
}

type categoryInferenceResult struct {
	Intent                string  `json:"intent"`
	Confidence            float64 `json:"confidence"`
	SuggestedRealm        string  `json:"suggested_realm"`
	SuggestedCategoryID   *int64  `json:"suggested_category_id,omitempty"`
	SuggestedCategoryName string  `json:"suggested_category_name,omitempty"`
	Reason                string  `json:"reason,omitempty"`
}

type openAIResponse struct {
	ID                string `json:"id"`
	Status            string `json:"status"`
	OutputText        string `json:"output_text"`
	IncompleteDetails *struct {
		Reason string `json:"reason"`
	} `json:"incomplete_details"`
	Output []struct {
		Type    string `json:"type"`
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	} `json:"output"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

const (
	aiResponsesMaxOutputTokens      = 6000
	aiChatCompletionsMaxTokens      = 4000
	aiConnectionTestMaxOutputTokens = 32
	aiConnectionTestTimeout         = 20 * time.Second
	aiGenerateTimeout               = 180 * time.Second
)

type chatCompletionResponse struct {
	ID      string `json:"id"`
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

type resolvedAIConfig struct {
	Provider string
	Model    string
	BaseURL  string
	Client   *http.Client
}

type preparedParseContext struct {
	SelectedCategoryID   *int64
	SelectedCategoryName string
	FilteredProperties   []map[string]any
	ContextJSON          string
	ImageInput           *AIImageInput
}

func resolveAIConfig(settings AISettings, timeout time.Duration) (*resolvedAIConfig, error) {
	provider := strings.ToLower(strings.TrimSpace(settings.Provider))
	if provider == "" {
		provider = "openai"
	}
	if provider != "openai" && provider != "ollama" && provider != "openai_compatible" {
		return nil, fmt.Errorf("Unsupported AI provider: %s", settings.Provider)
	}
	if !settings.Enabled {
		return nil, fmt.Errorf("AI is disabled")
	}
	if provider != "ollama" && strings.TrimSpace(settings.APIKey) == "" {
		return nil, fmt.Errorf("API key is missing")
	}

	model := strings.TrimSpace(settings.Model)
	if model == "" {
		return nil, fmt.Errorf("Model is required")
	}

	baseURL := strings.TrimRight(strings.TrimSpace(settings.BaseURL), "/")
	if baseURL == "" {
		if provider == "ollama" {
			baseURL = "http://localhost:11434/v1"
		} else {
			baseURL = "https://api.openai.com/v1"
		}
	}

	return &resolvedAIConfig{
		Provider: provider,
		Model:    model,
		BaseURL:  baseURL,
		Client:   &http.Client{Timeout: timeout},
	}, nil
}

func prepareParseContext(req ParseItemIntentRequest) (*preparedParseContext, error) {
	if req.IdentifyOnly {
		contextPayload := map[string]any{
			"realm":   req.Realm,
			"prompt":  req.Prompt,
			"barcode": req.Barcode,
			"locale":  req.Locale,
		}
		if strings.TrimSpace(req.TempImageID) != "" {
			contextPayload["has_image"] = true
		}
		contextJSON, err := json.Marshal(contextPayload)
		if err != nil {
			return nil, err
		}
		imageInput, _ := loadAIImageInput(req.TempImageID)
		return &preparedParseContext{
			ContextJSON: string(contextJSON),
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
	if strings.TrimSpace(req.TempImageID) != "" {
		contextPayload["has_image"] = true
	}
	contextJSON, err := json.Marshal(contextPayload)
	if err != nil {
		return nil, err
	}
	imageInput, _ := loadAIImageInput(req.TempImageID)
	return &preparedParseContext{
		SelectedCategoryID:   selectedCategoryID,
		SelectedCategoryName: selectedCategoryName,
		FilteredProperties:   filteredProperties,
		ContextJSON:          string(contextJSON),
		ImageInput:           imageInput,
	}, nil
}

func TestAIConnection(settings AISettings) (*AIConnectionTestResult, error) {
	cfg, err := resolveAIConfig(settings, aiConnectionTestTimeout)
	if err != nil {
		return nil, err
	}

	result, statusCode, err := testResponsesAPI(cfg.Client, cfg.BaseURL, cfg.Provider, cfg.Model, settings.APIKey)
	if err == nil {
		return result, nil
	}

	if cfg.Provider != "openai" && statusCode == http.StatusNotFound {
		return testChatCompletionsAPI(cfg.Client, cfg.BaseURL, cfg.Provider, cfg.Model, settings.APIKey)
	}

	return nil, err
}

func ParseItemIntent(settings AISettings, req ParseItemIntentRequest) (*ParseItemIntentResult, error) {
	if strings.TrimSpace(req.Prompt) == "" {
		return nil, fmt.Errorf("Prompt is required")
	}
	cfg, err := resolveAIConfig(settings, aiGenerateTimeout)
	if err != nil {
		return nil, err
	}
	parseCtx, err := prepareParseContext(req)
	if err != nil {
		return nil, err
	}

	outputText, transport, err := generateAIText(cfg.Client, cfg.BaseURL, cfg.Provider, cfg.Model, settings.APIKey, buildParseInstructions(settings.ParseItemPrompt, req.AllowWebSearch, req.Locale, req.IdentifyOnly), parseCtx.ContextJSON, req.AllowWebSearch, parseCtx.ImageInput, buildParseJSONSchema())
	if err != nil {
		return nil, err
	}
	return finalizeParseItemIntentResult(outputText, transport, cfg.Model, cfg.Provider, req, parseCtx.SelectedCategoryID, parseCtx.SelectedCategoryName, parseCtx.FilteredProperties)
}

func ParseItemIntentStream(settings AISettings, req ParseItemIntentRequest, emit func(AIStreamEvent) error) (*ParseItemIntentResult, error) {
	if strings.TrimSpace(req.Prompt) == "" {
		return nil, fmt.Errorf("Prompt is required")
	}
	cfg, err := resolveAIConfig(settings, aiGenerateTimeout)
	if err != nil {
		return nil, err
	}
	parseCtx, err := prepareParseContext(req)
	if err != nil {
		return nil, err
	}

	if emit != nil {
		categoryMessage := "Ermittle Kategorie..."
		if req.IdentifyOnly {
			categoryMessage = "Identifiziere Produkt..."
		} else if parseCtx.SelectedCategoryName != "" {
			categoryMessage = fmt.Sprintf("Kategorie: %s", parseCtx.SelectedCategoryName)
		}
		if err := emit(AIStreamEvent{Type: "note", Message: categoryMessage}); err != nil {
			return nil, err
		}
		if err := emit(AIStreamEvent{Type: "note", Message: "Ich analysiere deine Anfrage und gleiche sie mit den verfügbaren Feldern ab..."}); err != nil {
			return nil, err
		}
		if err := emit(AIStreamEvent{Type: "note", Message: "Ich sammle jetzt die Informationen, die ich schon sinnvoll vorbefüllen kann..."}); err != nil {
			return nil, err
		}
		if err := emit(AIStreamEvent{Type: "status", Message: "KI erstellt gerade einen Entwurf..."}); err != nil {
			return nil, err
		}
	}
	if emit != nil {
		var pretty bytes.Buffer
		if err := json.Indent(&pretty, []byte(parseCtx.ContextJSON), "", "  "); err == nil {
			if err := emit(AIStreamEvent{Type: "request", Message: pretty.String()}); err != nil {
				return nil, err
			}
		} else {
			if err := emit(AIStreamEvent{Type: "request", Message: parseCtx.ContextJSON}); err != nil {
				return nil, err
			}
		}
	}

	var outputText string
	var transport string
	hadStreamDelta := false

	if cfg.Provider != "openai" && parseCtx.ImageInput == nil {
		var builder strings.Builder
		streamErr := generateViaChatCompletionsStream(cfg.Client, cfg.BaseURL, cfg.Provider, cfg.Model, settings.APIKey, buildParseInstructions(settings.ParseItemPrompt, req.AllowWebSearch, req.Locale, req.IdentifyOnly), parseCtx.ContextJSON, buildParseJSONSchema(), func(delta string) error {
			hadStreamDelta = true
			builder.WriteString(delta)
			if emit != nil {
				return emit(AIStreamEvent{Type: "delta", Delta: delta})
			}
			return nil
		})
		if streamErr == nil && strings.TrimSpace(builder.String()) != "" {
			outputText = builder.String()
			transport = "chat.completions.stream"
		}
	}

	if strings.TrimSpace(outputText) == "" {
		outputText, transport, err = generateAIText(cfg.Client, cfg.BaseURL, cfg.Provider, cfg.Model, settings.APIKey, buildParseInstructions(settings.ParseItemPrompt, req.AllowWebSearch, req.Locale, req.IdentifyOnly), parseCtx.ContextJSON, req.AllowWebSearch, parseCtx.ImageInput, buildParseJSONSchema())
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
	if emit != nil {
		if len(result.Questions) > 0 {
			if err := emit(AIStreamEvent{Type: "note", Message: "Ich habe einen ersten Entwurf. Ein paar Details brauche ich noch von dir."}); err != nil {
				return nil, err
			}
		} else {
			if err := emit(AIStreamEvent{Type: "note", Message: "Der erste Entwurf ist fertig und ich konnte schon einiges vorbefüllen."}); err != nil {
				return nil, err
			}
		}
		if err := emit(AIStreamEvent{Type: "result", Result: result}); err != nil {
			return nil, err
		}
	}
	return result, nil
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

func SuggestCategoryProperties(settings AISettings, req SuggestCategoryPropertiesRequest) (*SuggestCategoryPropertiesResult, error) {
	if strings.TrimSpace(req.Prompt) == "" {
		return nil, fmt.Errorf("Prompt is required")
	}
	cfg, err := resolveAIConfig(settings, aiGenerateTimeout)
	if err != nil {
		return nil, err
	}

	contextPayload := map[string]any{
		"realm":               req.Realm,
		"locale":              req.Locale,
		"explicit_task":       req.Prompt,
		"category":            buildAISingleCategorySummary(req.Category),
		"existing_properties": buildAIPropertySummary(req.ExistingProperties),
	}
	contextJSON, err := json.Marshal(contextPayload)
	if err != nil {
		return nil, err
	}

	outputText, transport, err := generateAIText(
		cfg.Client,
		cfg.BaseURL,
		cfg.Provider,
		cfg.Model,
		settings.APIKey,
		buildCategoryPropertyInstructions(settings.CategoryPropertyPrompt, req.AllowWebSearch, req.Locale),
		string(contextJSON),
		req.AllowWebSearch,
		nil,
		buildCategoryPropertyJSONSchema(),
	)
	if err != nil {
		return nil, err
	}

	return finalizeCategoryPropertySuggestions(outputText, transport, cfg.Model, cfg.Provider, req)
}

func SuggestPropertyEnhancement(settings AISettings, req SuggestPropertyEnhancementRequest) (*SuggestPropertyEnhancementResult, error) {
	if strings.TrimSpace(req.Prompt) == "" {
		return nil, fmt.Errorf("Prompt is required")
	}
	cfg, err := resolveAIConfig(settings, aiGenerateTimeout)
	if err != nil {
		return nil, err
	}

	contextPayload := map[string]any{
		"realm":               req.Realm,
		"locale":              req.Locale,
		"explicit_task":       req.Prompt,
		"category":            buildAISingleCategorySummary(req.Category),
		"property":            buildAISinglePropertySummary(req.Property),
		"existing_properties": buildAIPropertySummary(req.ExistingProperties),
	}
	contextJSON, err := json.Marshal(contextPayload)
	if err != nil {
		return nil, err
	}

	outputText, transport, err := generateAIText(
		cfg.Client,
		cfg.BaseURL,
		cfg.Provider,
		cfg.Model,
		settings.APIKey,
		buildPropertyEnhancementInstructions(settings.PropertyEnhancementPrompt, req.AllowWebSearch, req.Locale),
		string(contextJSON),
		req.AllowWebSearch,
		nil,
		buildPropertyEnhancementJSONSchema(),
	)
	if err != nil {
		return nil, err
	}

	return finalizePropertyEnhancement(outputText, transport, cfg.Model, cfg.Provider, req)
}

func loadAIImageInput(tempImageID string) (*AIImageInput, bool) {
	if strings.TrimSpace(tempImageID) == "" {
		return nil, false
	}
	image, ok := GetAITempImage(strings.TrimSpace(tempImageID))
	if !ok {
		return nil, false
	}
	return &AIImageInput{Data: image.Data, MimeType: image.MimeType}, true
}

var aiTokenSplitPattern = regexp.MustCompile(`[^\p{L}\p{N}]+`)

func normalizeAIText(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = aiTokenSplitPattern.ReplaceAllString(value, " ")
	return strings.Join(strings.Fields(value), " ")
}

func uniqueNormalizedTokens(value string) []string {
	normalized := normalizeAIText(value)
	if normalized == "" {
		return nil
	}
	seen := make(map[string]struct{})
	tokens := make([]string, 0)
	for _, token := range strings.Fields(normalized) {
		if _, exists := seen[token]; exists {
			continue
		}
		seen[token] = struct{}{}
		tokens = append(tokens, token)
	}
	return tokens
}

func DefaultParseItemPromptTemplate() string {
	return `You work inside item+, an inventory and collection management system.
Your assistant name is Ina ("Intelligence Neuronatic Assistant").

You receive:
- the user's item request
- the selected category, if one is already chosen
- the available property schema for that category

Your job:
- identify the item correctly
- fill the matching fields and properties with reliable details

Rules:
- first use user-provided information
- then use reliable general knowledge
- if a category is already selected, keep that category
- if no category is selected, choose the best available category only when it is reasonably clear
- use only the provided properties
- prefer property IDs as keys when IDs are available
- leave unclear or variant-specific values out
- do not invent values just to fill every field
- focus on the actionable part of the request
- ignore small talk, mood, weather, and unrelated side remarks unless they change the task
- for number properties, return only the number and use the schema unit
- keep quantity at 1 unless the prompt clearly says otherwise
- if multiple variants are plausible, ask a short question instead of guessing
- omit unknown properties instead of returning empty strings
- keep description short and factual
- write assistant_message like a short natural reply to the user
- assistant_message must sound conversational, not like a report
- when you refer to yourself, call yourself Ina
- do not use headings such as "Open questions", "Notes", or "Status"
- if you need clarification, ask naturally inside assistant_message`
}

func buildParseInstructions(basePrompt string, allowWebSearch bool, locale string, identifyOnly bool) string {
	languageInstruction := "Write all human-readable output in English."
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(locale)), "de") {
		languageInstruction = "Write all human-readable output in German."
	}

	if identifyOnly {
		return `You identify products from a barcode, prompt, and optional image.
Your assistant name is Ina ("Intelligence Neuronatic Assistant").

Goal:
- determine the most likely product or title
- return a short factual description
- do not do category mapping or property enrichment yet

Rules:
- prefer a correct product name over a broad guess
- use web search only when it helps confirm the exact product
- if identification is uncertain, lower confidence and ask a short question
- do not invent technical details, pricing, categories, or properties
- keep quantity at 1 unless the prompt clearly says otherwise
- keep purchase_price null and purchase_currency empty
- keep suggested_category_id null
- keep suggested_category_name empty
- keep category_proposal null
- keep properties as an empty object
- keep missing_required as an empty array
- keep notes short and factual
- keep official product titles unchanged when appropriate
- write assistant_message like a short natural reply to the user
- assistant_message must sound conversational, not like a report
- when you refer to yourself, call yourself Ina
- do not use headings such as "Open questions", "Notes", or "Status"
- if you need clarification, ask naturally inside assistant_message

` + languageInstruction + `

Return exactly one JSON object and no markdown.

Use this shape:
{
  "intent": "create_item",
  "confidence": 0.0,
  "needs_confirmation": true,
  "assistant_message": "",
  "suggested_realm": "archive",
  "suggested_category_id": null,
  "suggested_category_name": "",
  "category_proposal": null,
  "fields": {
    "name": "",
    "description": "",
    "quantity": 1,
    "purchase_price": null,
    "purchase_currency": ""
  },
  "properties": {},
  "missing_required": [],
  "questions": [],
  "notes": []
}`
	}

	instructions := strings.TrimSpace(basePrompt)
	if instructions == "" {
		instructions = DefaultParseItemPromptTemplate()
	}

	if allowWebSearch {
		instructions += `
- web search is allowed when it helps confirm missing details`
	} else {
		instructions += `
- do not rely on web search`
	}

	instructions += `

` + languageInstruction + `

Fields:
- always fill name
- always fill quantity (default 1)
- fill description as a short factual summary when enough information is available

Questions:
- ask only when it resolves real ambiguity
- keep questions short
- maximum 5 questions

Notes:
- briefly mention helpful inferred or web-supported details when useful
- write assistant_message like a short natural reply to the user
- assistant_message must sound conversational, not like a report
- when you refer to yourself, call yourself Ina
- do not use headings such as "Open questions", "Notes", or "Status"
- if you need clarification, ask naturally inside assistant_message

Return exactly one JSON object and no markdown.

Use this shape:
{
  "intent": "create_item",
  "confidence": 0.0,
  "needs_confirmation": true,
  "assistant_message": "",
  "suggested_realm": "archive",
  "suggested_category_id": null,
  "suggested_category_name": "",
  "category_proposal": null,
  "fields": {
    "name": "",
    "description": "",
    "quantity": 1,
    "purchase_price": null,
    "purchase_currency": ""
  },
  "properties": {},
  "missing_required": [],
  "questions": [],
  "notes": []
}

ADDITIONAL RULES:
- If the user asks to create an item, the intent should be "create_item".
- Confidence must be between 0 and 1.
- If a selected category is provided, suggested_category_id must match it.
- If no category is clear, keep suggested_category_id null and suggested_category_name empty.`

	return instructions
}

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

func partialAIOutputPreview(text string) string {
	preview := strings.TrimSpace(text)
	if len(preview) > 1200 {
		preview = preview[:1200] + "..."
	}
	return preview
}

func extractAITextFromRawJSON(raw []byte) string {
	var decoded any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return ""
	}

	texts := make([]string, 0)
	var walk func(any)
	walk = func(node any) {
		switch v := node.(type) {
		case map[string]any:
			if textValue, ok := v["text"].(string); ok && strings.TrimSpace(textValue) != "" {
				texts = append(texts, strings.TrimSpace(textValue))
			}
			if textValue, ok := v["output_text"].(string); ok && strings.TrimSpace(textValue) != "" {
				texts = append(texts, strings.TrimSpace(textValue))
			}
			for _, child := range v {
				walk(child)
			}
		case []any:
			for _, child := range v {
				walk(child)
			}
		}
	}
	walk(decoded)
	return strings.TrimSpace(strings.Join(texts, "\n"))
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

func testResponsesAPI(client *http.Client, baseURL, provider, model, apiKey string) (*AIConnectionTestResult, int, error) {
	payload := map[string]any{
		"model":             model,
		"input":             "Please reply with exactly: item+ connection ok",
		"instructions":      "You are validating an API connection for item+. Respond with the exact confirmation text only.",
		"max_output_tokens": aiConnectionTestMaxOutputTokens,
		"store":             false,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, 0, err
	}

	req, err := http.NewRequest(http.MethodPost, baseURL+"/responses", bytes.NewReader(body))
	if err != nil {
		return nil, 0, err
	}
	applyAIHeaders(req, provider, apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var apiErr openAIResponse
		if json.Unmarshal(raw, &apiErr) == nil && apiErr.Error != nil && strings.TrimSpace(apiErr.Error.Message) != "" {
			return nil, resp.StatusCode, errors.New(apiErr.Error.Message)
		}
		return nil, resp.StatusCode, fmt.Errorf("AI request failed with HTTP %d", resp.StatusCode)
	}

	var parsed openAIResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, resp.StatusCode, err
	}

	outputText := strings.TrimSpace(parsed.OutputText)
	if outputText == "" {
		for _, item := range parsed.Output {
			for _, content := range item.Content {
				if strings.TrimSpace(content.Text) != "" {
					outputText = strings.TrimSpace(content.Text)
					break
				}
			}
			if outputText != "" {
				break
			}
		}
	}

	return &AIConnectionTestResult{
		Status:     "ok",
		Model:      model,
		Provider:   provider,
		OutputText: outputText,
		ResponseID: parsed.ID,
		RequestID:  strings.TrimSpace(resp.Header.Get("x-request-id")),
		Transport:  "responses",
	}, resp.StatusCode, nil
}

func generateAIText(client *http.Client, baseURL, provider, model, apiKey, instructions, input string, allowWebSearch bool, imageInput *AIImageInput, responseSchema map[string]any) (string, string, error) {
	text, statusCode, err := generateViaResponses(client, baseURL, provider, model, apiKey, instructions, input, allowWebSearch, imageInput)
	if err == nil {
		return text, "responses", nil
	}
	if provider != "openai" && statusCode == http.StatusNotFound && imageInput == nil {
		text, err = generateViaChatCompletions(client, baseURL, provider, model, apiKey, instructions, input, responseSchema)
		if err == nil {
			return text, "chat.completions", nil
		}
		return "", "", err
	}
	return "", "", normalizeAIRequestError(err)
}

func normalizeAIRequestError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return fmt.Errorf("Die KI-Antwort hat zu lange gedauert. Bitte versuche es erneut oder reduziere die Anfrage etwas.")
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return fmt.Errorf("Die KI-Antwort hat zu lange gedauert. Bitte versuche es erneut oder reduziere die Anfrage etwas.")
	}
	if strings.Contains(strings.ToLower(err.Error()), "client.timeout exceeded while awaiting headers") {
		return fmt.Errorf("Die KI-Antwort hat zu lange gedauert. Bitte versuche es erneut oder reduziere die Anfrage etwas.")
	}
	return err
}

func generateViaResponses(client *http.Client, baseURL, provider, model, apiKey, instructions, input string, allowWebSearch bool, imageInput *AIImageInput) (string, int, error) {
	requestInput := input
	if provider == "openai" && !strings.Contains(strings.ToLower(requestInput), "json") {
		requestInput += "\n\nReturn valid JSON only."
	}

	inputPayload := any(requestInput)
	if imageInput != nil && provider == "openai" {
		dataURL := fmt.Sprintf("data:%s;base64,%s", imageInput.MimeType, base64.StdEncoding.EncodeToString(imageInput.Data))
		inputPayload = []map[string]any{
			{
				"role": "user",
				"content": []map[string]any{
					{"type": "input_text", "text": requestInput},
					{"type": "input_image", "image_url": dataURL},
				},
			},
		}
	}

	payload := map[string]any{
		"model":             model,
		"input":             inputPayload,
		"instructions":      instructions,
		"max_output_tokens": aiResponsesMaxOutputTokens,
		"store":             false,
	}
	if provider == "openai" && !allowWebSearch {
		payload["text"] = map[string]any{
			"format": map[string]any{
				"type": "json_object",
			},
		}
	}
	if provider == "openai" && allowWebSearch {
		payload["tools"] = []map[string]any{
			{"type": "web_search"},
		}
		payload["tool_choice"] = "auto"
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", 0, err
	}

	req, err := http.NewRequest(http.MethodPost, baseURL+"/responses", bytes.NewReader(body))
	if err != nil {
		return "", 0, err
	}
	applyAIHeaders(req, provider, apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", resp.StatusCode, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var apiErr openAIResponse
		if json.Unmarshal(raw, &apiErr) == nil && apiErr.Error != nil && strings.TrimSpace(apiErr.Error.Message) != "" {
			return "", resp.StatusCode, errors.New(apiErr.Error.Message)
		}
		return "", resp.StatusCode, fmt.Errorf("AI request failed with HTTP %d", resp.StatusCode)
	}

	var parsed openAIResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", resp.StatusCode, err
	}
	outputText := strings.TrimSpace(parsed.OutputText)
	if outputText == "" {
		for _, item := range parsed.Output {
			for _, content := range item.Content {
				if strings.TrimSpace(content.Text) != "" {
					outputText = strings.TrimSpace(content.Text)
					break
				}
			}
			if outputText != "" {
				break
			}
		}
	}
	if outputText == "" {
		outputText = extractAITextFromRawJSON(raw)
	}
	if outputText == "" {
		if parsed.IncompleteDetails != nil && strings.TrimSpace(parsed.IncompleteDetails.Reason) == "max_output_tokens" {
			return "", resp.StatusCode, fmt.Errorf("AI response hit the output limit before a readable result was returned")
		}
		return "", resp.StatusCode, fmt.Errorf("Provider returned no readable output text. Raw response: %s", partialAIOutputPreview(string(raw)))
	}
	return outputText, resp.StatusCode, nil
}

func generateViaChatCompletions(client *http.Client, baseURL, provider, model, apiKey, instructions, input string, responseSchema map[string]any) (string, error) {
	payload := map[string]any{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": instructions},
			{"role": "user", "content": input},
		},
		"stream":      false,
		"max_tokens":  aiChatCompletionsMaxTokens,
		"temperature": 0.1,
	}
	if provider == "ollama" && responseSchema != nil {
		payload["response_format"] = map[string]any{
			"type": "json_schema",
			"json_schema": map[string]any{
				"name":   "itemplus_item_draft",
				"schema": responseSchema,
			},
		}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest(http.MethodPost, baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	applyAIHeaders(req, provider, apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var apiErr chatCompletionResponse
		if json.Unmarshal(raw, &apiErr) == nil && apiErr.Error != nil && strings.TrimSpace(apiErr.Error.Message) != "" {
			return "", errors.New(apiErr.Error.Message)
		}
		return "", fmt.Errorf("AI request failed with HTTP %d", resp.StatusCode)
	}

	var parsed chatCompletionResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("Model returned no choices")
	}
	return strings.TrimSpace(parsed.Choices[0].Message.Content), nil
}

func generateViaChatCompletionsStream(client *http.Client, baseURL, provider, model, apiKey, instructions, input string, responseSchema map[string]any, onDelta func(string) error) error {
	payload := map[string]any{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": instructions},
			{"role": "user", "content": input},
		},
		"stream":      true,
		"max_tokens":  aiChatCompletionsMaxTokens,
		"temperature": 0.1,
	}
	if provider == "ollama" && responseSchema != nil {
		payload["response_format"] = map[string]any{
			"type": "json_schema",
			"json_schema": map[string]any{
				"name":   "itemplus_item_draft",
				"schema": responseSchema,
			},
		}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return err
	}
	applyAIHeaders(req, provider, apiKey)
	req.Header.Set("Accept", "text/event-stream")

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			return readErr
		}
		var apiErr chatCompletionResponse
		if json.Unmarshal(raw, &apiErr) == nil && apiErr.Error != nil && strings.TrimSpace(apiErr.Error.Message) != "" {
			return errors.New(apiErr.Error.Message)
		}
		return fmt.Errorf("AI request failed with HTTP %d", resp.StatusCode)
	}

	type streamChunk struct {
		Choices []struct {
			Delta struct {
				Content string `json:"content"`
			} `json:"delta"`
		} `json:"choices"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	readBuf := make([]byte, 4096)
	remaining := ""

	processFrame := func(frame string) error {
		for _, line := range strings.Split(frame, "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, ":") || !strings.HasPrefix(line, "data:") {
				continue
			}
			payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			if payload == "" {
				continue
			}
			if payload == "[DONE]" {
				return io.EOF
			}
			var chunk streamChunk
			if err := json.Unmarshal([]byte(payload), &chunk); err != nil {
				continue
			}
			if chunk.Error != nil && strings.TrimSpace(chunk.Error.Message) != "" {
				return errors.New(strings.TrimSpace(chunk.Error.Message))
			}
			for _, choice := range chunk.Choices {
				if choice.Delta.Content == "" {
					continue
				}
				if onDelta != nil {
					if cbErr := onDelta(choice.Delta.Content); cbErr != nil {
						return cbErr
					}
				}
			}
		}
		return nil
	}

	for {
		n, err := resp.Body.Read(readBuf)
		if n > 0 {
			remaining += string(readBuf[:n])
			for {
				idx := strings.Index(remaining, "\n\n")
				if idx < 0 {
					break
				}
				frame := remaining[:idx]
				remaining = remaining[idx+2:]
				if frameErr := processFrame(frame); frameErr != nil {
					if errors.Is(frameErr, io.EOF) {
						return nil
					}
					return frameErr
				}
			}
		}
		if err != nil {
			if errors.Is(err, io.EOF) {
				if strings.TrimSpace(remaining) != "" {
					if frameErr := processFrame(remaining); frameErr != nil && !errors.Is(frameErr, io.EOF) {
						return frameErr
					}
				}
				return nil
			}
			return err
		}
	}
}

func testChatCompletionsAPI(client *http.Client, baseURL, provider, model, apiKey string) (*AIConnectionTestResult, error) {
	payload := map[string]any{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": "You are validating an API connection for item+. Respond with the exact confirmation text only."},
			{"role": "user", "content": "Please reply with exactly: item+ connection ok"},
		},
		"stream": false,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	applyAIHeaders(req, provider, apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var apiErr chatCompletionResponse
		if json.Unmarshal(raw, &apiErr) == nil && apiErr.Error != nil && strings.TrimSpace(apiErr.Error.Message) != "" {
			return nil, errors.New(apiErr.Error.Message)
		}
		return nil, fmt.Errorf("AI request failed with HTTP %d", resp.StatusCode)
	}

	var parsed chatCompletionResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}

	outputText := ""
	if len(parsed.Choices) > 0 {
		outputText = strings.TrimSpace(parsed.Choices[0].Message.Content)
	}

	return &AIConnectionTestResult{
		Status:     "ok",
		Model:      model,
		Provider:   provider,
		OutputText: outputText,
		ResponseID: parsed.ID,
		RequestID:  strings.TrimSpace(resp.Header.Get("x-request-id")),
		Transport:  "chat.completions",
	}, nil
}

func applyAIHeaders(req *http.Request, provider, apiKey string) {
	req.Header.Set("Content-Type", "application/json")
	if provider == "ollama" {
		req.Header.Set("Authorization", "Bearer ollama")
		return
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(apiKey))
}

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

func DefaultCategoryPropertyPromptTemplate() string {
	return `You work inside item+, an inventory and collection management system.
Your assistant name is Ina ("Intelligence Neuronatic Assistant").

You receive:
- an explicit_task
- one category
- existing_properties that already exist in that category

Your job:
- carry out the explicit_task
- use category and existing_properties only as context

Rules:
- explicit_task is authoritative
- do only what explicit_task asks for
- do not turn a narrow request into a full category optimization
- if explicit_task asks for one focused property or one focused change, return only that
- suggest multiple properties only when explicit_task clearly asks for a broader set
- focus on the actionable part of the message
- ignore small talk, mood, weather, and other irrelevant side remarks unless they change the task
- avoid duplicates of existing_properties
- keep property names concise and reusable
- use only these property types:
  text, textblock, number, boolean, date, time, select, multiselect, rating, dimensions, age_rating, condition, priority, weight
- prefer select or multiselect with concrete options when a fixed list is genuinely useful
- prefer multiselect when multiple options can apply at once
- prefer select when only one option is usually chosen
- use number with unit for measurable values
- use weight only for physical weight
- use condition and priority only when they genuinely help
- set show_in_list true only for genuinely useful scannable properties
- display_width must be one of: third, half, full
- if explicit_task is ambiguous, ask a short question instead of expanding scope
- write assistant_message like a short natural reply to the user
- assistant_message must sound conversational, not like a report
- when you refer to yourself, call yourself Ina
- do not use headings such as "Open questions", "Notes", "Status", or bullet labels unless the user asked for that style
- if you need clarification, ask naturally inside assistant_message
- if the message only contains acknowledgement or casual chatter, respond briefly and naturally in assistant_message and leave properties unchanged
- keep notes short and factual`
}

func buildCategoryPropertyInstructions(basePrompt string, allowWebSearch bool, locale string) string {
	languageInstruction := "Write all human-readable output in English."
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(locale)), "de") {
		languageInstruction = "Write all human-readable output in German."
	}

	instructions := strings.TrimSpace(basePrompt)
	if instructions == "" {
		instructions = DefaultCategoryPropertyPromptTemplate()
	}

	if allowWebSearch {
		instructions += `
- web search is allowed when it helps confirm common standards or option sets`
	} else {
		instructions += `
- do not rely on web search`
	}

	instructions += `

` + languageInstruction + `

Return exactly one JSON object and no markdown.

Use this shape:
{
  "confidence": 0.0,
  "needs_confirmation": false,
  "assistant_message": "",
  "questions": [],
  "notes": [],
  "properties": [
    {
      "name": "",
      "property_type": "text",
      "unit": "",
      "required": false,
      "show_in_list": true,
      "display_width": "third",
      "options": []
    }
  ]
}`

	return instructions
}

func DefaultPropertyEnhancementPromptTemplate() string {
	return `You work inside item+, an inventory and collection management system.
Your assistant name is Ina ("Intelligence Neuronatic Assistant").

You receive:
- an explicit_task
- one category
- one existing property
- existing_properties from the same category

Your job:
- carry out the explicit_task for that one property
- use category and existing_properties only as context

Rules:
- explicit_task is authoritative
- do only what explicit_task asks for
- do not broaden the task into a full category cleanup
- this is about one property, not a full property list
- focus on the actionable part of the message
- ignore small talk, mood, weather, and other irrelevant side remarks unless they change the task
- you may keep the current property unchanged when it already fits well
- improve the property type only when that clearly helps the explicit_task
- prefer select or multiselect with concrete options when known standards or fixed variants are genuinely useful
- prefer multiselect when multiple values can apply at the same time
- prefer select when only one value is usually chosen
- keep names concise and reusable
- do not turn this property into a duplicate of another existing property
- use number with unit for measurable values
- display_width must be one of: third, half, full
- if explicit_task is ambiguous, ask a short question instead of making unrelated changes
- write assistant_message like a short natural reply to the user
- assistant_message must sound conversational, not like a report
- when you refer to yourself, call yourself Ina
- do not use headings such as "Open questions", "Notes", "Status", or bullet labels unless the user asked for that style
- if you need clarification, ask naturally inside assistant_message
- if the message only contains acknowledgement or casual chatter, respond briefly and naturally in assistant_message and keep the property unchanged
- keep notes short and factual`
}

func buildPropertyEnhancementInstructions(basePrompt string, allowWebSearch bool, locale string) string {
	languageInstruction := "Write all human-readable output in English."
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(locale)), "de") {
		languageInstruction = "Write all human-readable output in German."
	}

	instructions := strings.TrimSpace(basePrompt)
	if instructions == "" {
		instructions = DefaultPropertyEnhancementPromptTemplate()
	}

	if allowWebSearch {
		instructions += `
- web search is allowed when it helps confirm common standards or option sets`
	} else {
		instructions += `
- do not rely on web search`
	}

	instructions += `

` + languageInstruction + `

Return exactly one JSON object and no markdown.

Use this shape:
{
  "confidence": 0.0,
  "needs_confirmation": false,
  "assistant_message": "",
  "questions": [],
  "notes": [],
  "property": {
    "name": "",
    "property_type": "text",
    "unit": "",
    "required": false,
    "show_in_list": true,
    "display_width": "third",
    "options": []
  }
}`

	return instructions
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

func mapInt64(value any) (int64, bool) {
	switch v := value.(type) {
	case int:
		return int64(v), true
	case int32:
		return int64(v), true
	case int64:
		return v, true
	case float64:
		return int64(v), true
	case json.Number:
		parsed, err := v.Int64()
		return parsed, err == nil
	default:
		return 0, false
	}
}

func extractFirstJSONObject(text string) string {
	start := strings.Index(text, "{")
	if start < 0 {
		return ""
	}
	depth := 0
	inString := false
	escaped := false
	for i := start; i < len(text); i++ {
		ch := text[i]
		if escaped {
			escaped = false
			continue
		}
		if ch == '\\' && inString {
			escaped = true
			continue
		}
		if ch == '"' {
			inString = !inString
			continue
		}
		if inString {
			continue
		}
		if ch == '{' {
			depth++
		}
		if ch == '}' {
			depth--
			if depth == 0 {
				return text[start : i+1]
			}
		}
	}
	return ""
}
