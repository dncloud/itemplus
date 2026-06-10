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
	"sort"
	"strings"
	"time"
)

type AISettings struct {
	ProfileID                 string
	ProfileName               string
	Provider                  string
	Model                     string
	BaseURL                   string
	APIKey                    string
	Enabled                   bool
	SupportsVision            bool
	ChatPrompt                string
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

type AIModelOption struct {
	ID      string `json:"id"`
	OwnedBy string `json:"owned_by,omitempty"`
	Created int64  `json:"created,omitempty"`
}

type AIUsage struct {
	InputTokens       int `json:"input_tokens,omitempty"`
	OutputTokens      int `json:"output_tokens,omitempty"`
	TotalTokens       int `json:"total_tokens,omitempty"`
	ReasoningTokens   int `json:"reasoning_tokens,omitempty"`
	WebSearchRequests int `json:"web_search_requests,omitempty"`
	WebFetchRequests  int `json:"web_fetch_requests,omitempty"`
}

type ollamaWebSearchRequest struct {
	Query      string `json:"query"`
	MaxResults int    `json:"max_results,omitempty"`
}

type ollamaWebSearchResult struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Content string `json:"content"`
}

type ollamaWebSearchResponse struct {
	Results []ollamaWebSearchResult `json:"results"`
}

type ollamaWebFetchRequest struct {
	URL string `json:"url"`
}

type ollamaWebFetchResponse struct {
	Title   string   `json:"title"`
	Content string   `json:"content"`
	Links   []string `json:"links"`
}

type AIDebugError struct {
	Err      error
	RawDebug string
	Usage    *AIUsage
}

func (e *AIDebugError) Error() string {
	if e == nil || e.Err == nil {
		return ""
	}
	return e.Err.Error()
}

func (e *AIDebugError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
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
	Usage                 *AIUsage            `json:"usage,omitempty"`
	Context               map[string]any      `json:"context,omitempty"`
}

type AIStreamEvent struct {
	Type    string                 `json:"type"`
	Message string                 `json:"message,omitempty"`
	Delta   string                 `json:"delta,omitempty"`
	Result  *ParseItemIntentResult `json:"result,omitempty"`
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Messages       []ChatMessage  `json:"messages"`
	Locale         string         `json:"locale,omitempty"`
	AllowWebSearch bool           `json:"allow_web_search,omitempty"`
	TempImageID    string         `json:"temp_image_id,omitempty"`
	AppContext     map[string]any `json:"app_context,omitempty"`
}

type ChatResult struct {
	AssistantMessage string         `json:"assistant_message"`
	Transport        string         `json:"transport,omitempty"`
	Model            string         `json:"model,omitempty"`
	Provider         string         `json:"provider,omitempty"`
	Usage            *AIUsage       `json:"usage,omitempty"`
	Context          map[string]any `json:"context,omitempty"`
}

type InventoryLookupRequest struct {
	Kind         string `json:"kind"`
	Realm        string `json:"realm,omitempty"`
	Search       string `json:"search,omitempty"`
	LocationName string `json:"location_name,omitempty"`
	CategoryName string `json:"category_name,omitempty"`
	UserName     string `json:"user_name,omitempty"`
	Status       string `json:"status,omitempty"`
	StockState   string `json:"stock_state,omitempty"`
	Limit        int    `json:"limit,omitempty"`
}

type InventoryLookupPlan struct {
	NeedsLookup bool                    `json:"needs_lookup"`
	Reason      string                  `json:"reason,omitempty"`
	Request     *InventoryLookupRequest `json:"request,omitempty"`
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
	RawDebug          string               `json:"raw_debug,omitempty"`
	Transport         string               `json:"transport,omitempty"`
	Model             string               `json:"model,omitempty"`
	Provider          string               `json:"provider,omitempty"`
	Usage             *AIUsage             `json:"usage,omitempty"`
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
	RawDebug          string             `json:"raw_debug,omitempty"`
	Transport         string             `json:"transport,omitempty"`
	Model             string             `json:"model,omitempty"`
	Provider          string             `json:"provider,omitempty"`
	Usage             *AIUsage           `json:"usage,omitempty"`
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
	Usage *struct {
		InputTokens         int `json:"input_tokens"`
		OutputTokens        int `json:"output_tokens"`
		TotalTokens         int `json:"total_tokens"`
		OutputTokensDetails *struct {
			ReasoningTokens int `json:"reasoning_tokens"`
		} `json:"output_tokens_details"`
	} `json:"usage"`
}

const (
	aiResponsesMaxOutputTokens      = 6000
	aiChatCompletionsMaxTokens      = 4000
	aiConnectionTestMaxOutputTokens = 32
	aiConnectionTestTimeout         = 20 * time.Second
	aiGenerateTimeout               = 180 * time.Second
	aiGenerateTimeoutLocalLLM       = 420 * time.Second
	ollamaWebSearchBaseURL          = "https://ollama.com/api"
	ollamaWebSearchMaxResults       = 3
	ollamaWebFetchMaxPages          = 2
	ollamaWebSearchExcerptChars     = 320
	ollamaWebFetchContentChars      = 2400
	ollamaWebFetchMaxLinks          = 8
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
	Usage *struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
	PromptEvalCount int `json:"prompt_eval_count"`
	EvalCount       int `json:"eval_count"`
}

type openAIModelListResponse struct {
	Data  []AIModelOption `json:"data"`
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
	if provider != "openai" && provider != "ollama" {
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

func generateTimeoutForProvider(provider string) time.Duration {
	if strings.EqualFold(strings.TrimSpace(provider), "ollama") {
		return aiGenerateTimeoutLocalLLM
	}
	return aiGenerateTimeout
}

func aiSettingsSupportsVision(settings AISettings) bool {
	if strings.EqualFold(strings.TrimSpace(settings.Provider), "openai") {
		return true
	}
	return settings.SupportsVision
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
		contextJSON, err := json.Marshal(contextPayload)
		if err != nil {
			return nil, err
		}
		var imageInput *AIImageInput
		if supportsVision {
			imageInput, _ = loadAIImageInput(req.TempImageID)
		}
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
	if supportsVision && strings.TrimSpace(req.TempImageID) != "" {
		contextPayload["has_image"] = true
	}
	contextJSON, err := json.Marshal(contextPayload)
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

func ListOpenAIModels(settings AISettings) ([]AIModelOption, error) {
	provider := strings.ToLower(strings.TrimSpace(settings.Provider))
	if provider == "" {
		provider = "openai"
	}
	if provider != "openai" {
		return nil, fmt.Errorf("Model loading is only supported for OpenAI profiles")
	}

	apiKey := strings.TrimSpace(settings.APIKey)
	if apiKey == "" {
		return nil, fmt.Errorf("API key is missing")
	}

	baseURL := strings.TrimRight(strings.TrimSpace(settings.BaseURL), "/")
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}

	client := &http.Client{Timeout: aiConnectionTestTimeout}
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, baseURL+"/models", nil)
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
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("Model list request failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var parsed openAIModelListResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}
	if parsed.Error != nil && strings.TrimSpace(parsed.Error.Message) != "" {
		return nil, errors.New(strings.TrimSpace(parsed.Error.Message))
	}

	models := make([]AIModelOption, 0, len(parsed.Data))
	seen := make(map[string]struct{}, len(parsed.Data))
	for _, option := range parsed.Data {
		id := strings.TrimSpace(option.ID)
		if id == "" {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		option.ID = id
		option.OwnedBy = strings.TrimSpace(option.OwnedBy)
		models = append(models, option)
	}
	sort.Slice(models, func(i, j int) bool {
		return strings.ToLower(models[i].ID) < strings.ToLower(models[j].ID)
	})

	return models, nil
}

func emitAIRaw(onRaw func(string) error, parts ...string) error {
	if onRaw == nil {
		return nil
	}
	return onRaw(sanitizeAIRawDebug(strings.Join(parts, "\n")))
}

var aiRawDataURLPattern = regexp.MustCompile(`data:image/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+`)

func sanitizeAIRawDebug(raw string) string {
	return aiRawDataURLPattern.ReplaceAllString(raw, "data:image/*;base64,[image omitted]")
}

func usageFromOpenAIResponse(parsed openAIResponse) *AIUsage {
	if parsed.Usage == nil {
		return nil
	}
	usage := &AIUsage{
		InputTokens:  parsed.Usage.InputTokens,
		OutputTokens: parsed.Usage.OutputTokens,
		TotalTokens:  parsed.Usage.TotalTokens,
	}
	if parsed.Usage.OutputTokensDetails != nil {
		usage.ReasoningTokens = parsed.Usage.OutputTokensDetails.ReasoningTokens
	}
	if usage.InputTokens == 0 && usage.OutputTokens == 0 && usage.TotalTokens == 0 && usage.ReasoningTokens == 0 {
		return nil
	}
	return usage
}

func usageFromChatCompletionResponse(parsed chatCompletionResponse) *AIUsage {
	if parsed.Usage != nil {
		usage := &AIUsage{
			InputTokens:  parsed.Usage.PromptTokens,
			OutputTokens: parsed.Usage.CompletionTokens,
			TotalTokens:  parsed.Usage.TotalTokens,
		}
		if usage.InputTokens != 0 || usage.OutputTokens != 0 || usage.TotalTokens != 0 {
			return usage
		}
	}
	if parsed.PromptEvalCount != 0 || parsed.EvalCount != 0 {
		return &AIUsage{
			InputTokens:  parsed.PromptEvalCount,
			OutputTokens: parsed.EvalCount,
			TotalTokens:  parsed.PromptEvalCount + parsed.EvalCount,
		}
	}
	return nil
}

func mergeAIUsage(parts ...*AIUsage) *AIUsage {
	merged := &AIUsage{}
	for _, part := range parts {
		if part == nil {
			continue
		}
		merged.InputTokens += part.InputTokens
		merged.OutputTokens += part.OutputTokens
		merged.TotalTokens += part.TotalTokens
		merged.ReasoningTokens += part.ReasoningTokens
		merged.WebSearchRequests += part.WebSearchRequests
		merged.WebFetchRequests += part.WebFetchRequests
	}
	if merged.InputTokens == 0 &&
		merged.OutputTokens == 0 &&
		merged.TotalTokens == 0 &&
		merged.ReasoningTokens == 0 &&
		merged.WebSearchRequests == 0 &&
		merged.WebFetchRequests == 0 {
		return nil
	}
	return merged
}

func buildChatConversationInput(messages []ChatMessage) string {
	lines := make([]string, 0, len(messages))
	for _, message := range messages {
		content := strings.TrimSpace(message.Content)
		if content == "" {
			continue
		}
		role := strings.ToLower(strings.TrimSpace(message.Role))
		switch role {
		case "assistant":
			lines = append(lines, "Ina: "+content)
		default:
			lines = append(lines, "User: "+content)
		}
	}
	return strings.TrimSpace(strings.Join(lines, "\n"))
}

func buildChatInput(messages []ChatMessage, appContext map[string]any) string {
	conversation := buildChatConversationInput(messages)
	if len(appContext) == 0 {
		return conversation
	}

	contextJSON, err := json.Marshal(appContext)
	if err != nil {
		return conversation
	}

	if strings.TrimSpace(conversation) == "" {
		return "app_context:\n" + string(contextJSON)
	}

	return "app_context:\n" + string(contextJSON) + "\n\nconversation:\n" + conversation
}

func buildChatSearchQuery(messages []ChatMessage) string {
	for idx := len(messages) - 1; idx >= 0; idx-- {
		message := messages[idx]
		if !strings.EqualFold(strings.TrimSpace(message.Role), "user") {
			continue
		}
		content := strings.TrimSpace(message.Content)
		if content != "" {
			return content
		}
	}
	return ""
}

func shouldUseWebSearchForChatQuery(query string) bool {
	normalized := strings.ToLower(strings.TrimSpace(query))
	if normalized == "" {
		return false
	}

	trimmed := strings.Trim(normalized, " \t\r\n.!?,;:-_\"'()[]{}")
	if trimmed == "" {
		return false
	}

	casualMessages := map[string]struct{}{
		"hi": {}, "hey": {}, "hello": {}, "moin": {}, "servus": {}, "hallo": {}, "hey buddy": {},
		"danke": {}, "thanks": {}, "thank you": {}, "ok": {}, "okay": {}, "cool": {}, "nice": {},
	}
	if _, casual := casualMessages[trimmed]; casual {
		return false
	}

	researchSignals := []string{
		"search", "web", "online", "latest", "current", "today", "news", "source", "website", "internet",
		"suche", "such", "web", "online", "aktuell", "heute", "nachrichten", "quelle", "website", "internet",
	}
	for _, signal := range researchSignals {
		if strings.Contains(normalized, signal) {
			return true
		}
	}

	questionSignals := []string{
		"when ", "where ", "which latest", "which current", "who is currently ",
		"wann ", "wo spielt", "welche aktuellen", "welcher aktuelle", "welches aktuelle", "wer ist aktuell ",
	}
	for _, signal := range questionSignals {
		if strings.Contains(normalized, signal) {
			return true
		}
	}

	return false
}

func maybeAugmentInputWithOllamaWebContext(client *http.Client, provider, apiKey, query, input string, onRaw func(string) error) (string, *AIUsage, error) {
	if !strings.EqualFold(strings.TrimSpace(provider), "ollama") {
		return input, nil, nil
	}

	query = strings.TrimSpace(query)
	if query == "" {
		return input, nil, nil
	}

	if strings.TrimSpace(apiKey) == "" {
		_ = emitAIRaw(onRaw, "OLLAMA WEB SEARCH", `{"status":"skipped","reason":"missing_api_key"}`)
		return input, nil, nil
	}

	contextJSON, webUsage, err := buildOllamaWebContext(client, apiKey, query, onRaw)
	if err != nil {
		_ = emitAIRaw(onRaw, "OLLAMA WEB SEARCH ERROR", err.Error())
		return input, webUsage, nil
	}
	if strings.TrimSpace(contextJSON) == "" {
		return input, webUsage, nil
	}

	return "web_context:\n" + contextJSON + "\n\nrequest_input:\n" + input, webUsage, nil
}

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

func PlanInventoryLookup(settings AISettings, req ChatRequest) (*InventoryLookupPlan, error) {
	cfg, err := resolveAIConfig(settings, generateTimeoutForProvider(settings.Provider))
	if err != nil {
		return nil, err
	}

	input := buildChatInput(req.Messages, req.AppContext)
	if strings.TrimSpace(input) == "" {
		return nil, nil
	}

	outputText, _, _, err := generateAIText(
		cfg.Client,
		cfg.BaseURL,
		cfg.Provider,
		cfg.Model,
		settings.APIKey,
		buildInventoryLookupPlannerInstructions(req.Locale, cfg.Provider),
		input,
		false,
		nil,
		buildInventoryLookupPlanJSONSchema(),
		nil,
	)
	if err != nil {
		return nil, err
	}

	jsonText := extractFirstJSONObject(outputText)
	if strings.TrimSpace(jsonText) == "" {
		return nil, nil
	}

	var plan InventoryLookupPlan
	if err := json.Unmarshal([]byte(jsonText), &plan); err != nil {
		return nil, err
	}

	normalizeInventoryLookupPlan(&plan)
	if !plan.NeedsLookup || plan.Request == nil {
		return nil, nil
	}
	return &plan, nil
}

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

	outputText, transport, usage, err := generateAIText(cfg.Client, cfg.BaseURL, cfg.Provider, cfg.Model, settings.APIKey, buildParseInstructions(settings.ParseItemPrompt, req.AllowWebSearch, req.Locale, req.IdentifyOnly, cfg.Provider), input, req.AllowWebSearch, parseCtx.ImageInput, buildParseJSONSchema(), nil)
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
	var usage *AIUsage

	if cfg.Provider != "openai" && parseCtx.ImageInput == nil {
		var builder strings.Builder
		streamErr := generateViaChatCompletionsStream(cfg.Client, cfg.BaseURL, cfg.Provider, cfg.Model, settings.APIKey, buildParseInstructions(settings.ParseItemPrompt, req.AllowWebSearch, req.Locale, req.IdentifyOnly, cfg.Provider), input, buildParseJSONSchema(), func(delta string) error {
			hadStreamDelta = true
			builder.WriteString(delta)
			if emit != nil {
				return emit(AIStreamEvent{Type: "delta", Delta: delta})
			}
			return nil
		}, func(nextUsage AIUsage) error {
			usage = &nextUsage
			return nil
		}, func(raw string) error {
			if emit != nil {
				return emit(AIStreamEvent{Type: "raw", Message: raw})
			}
			return nil
		})
		if streamErr == nil && strings.TrimSpace(builder.String()) != "" {
			outputText = builder.String()
			transport = "chat.completions.stream"
		}
	}

	if strings.TrimSpace(outputText) == "" {
		outputText, transport, usage, err = generateAIText(cfg.Client, cfg.BaseURL, cfg.Provider, cfg.Model, settings.APIKey, buildParseInstructions(settings.ParseItemPrompt, req.AllowWebSearch, req.Locale, req.IdentifyOnly, cfg.Provider), input, req.AllowWebSearch, parseCtx.ImageInput, buildParseJSONSchema(), func(raw string) error {
			if emit != nil {
				return emit(AIStreamEvent{Type: "raw", Message: raw})
			}
			return nil
		})
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
	cfg, err := resolveAIConfig(settings, generateTimeoutForProvider(settings.Provider))
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
	input := string(contextJSON)

	rawDebugParts := make([]string, 0, 4)
	var webUsage *AIUsage
	if req.AllowWebSearch && strings.EqualFold(cfg.Provider, "ollama") {
		input, webUsage, err = maybeAugmentInputWithOllamaWebContext(cfg.Client, cfg.Provider, settings.APIKey, req.Prompt, input, func(raw string) error {
			rawDebugParts = append(rawDebugParts, raw)
			return nil
		})
		if err != nil {
			return nil, wrapAIDebugError(normalizeAIRequestError(err), strings.Join(rawDebugParts, "\n\n"), nil)
		}
	}
	outputText, transport, usage, err := generateAIText(
		cfg.Client,
		cfg.BaseURL,
		cfg.Provider,
		cfg.Model,
		settings.APIKey,
		buildCategoryPropertyInstructions(settings.CategoryPropertyPrompt, req.AllowWebSearch, req.Locale, cfg.Provider),
		input,
		req.AllowWebSearch,
		nil,
		buildCategoryPropertyJSONSchema(),
		func(raw string) error {
			rawDebugParts = append(rawDebugParts, raw)
			return nil
		},
	)
	if err != nil {
		return nil, wrapAIDebugError(err, strings.Join(rawDebugParts, "\n\n"), mergeAIUsage(webUsage, usage))
	}
	result, err := finalizeCategoryPropertySuggestions(outputText, transport, cfg.Model, cfg.Provider, req)
	if err != nil {
		return nil, wrapAIDebugError(err, strings.Join(rawDebugParts, "\n\n"), mergeAIUsage(webUsage, usage))
	}
	result.Usage = mergeAIUsage(webUsage, usage)
	result.RawDebug = strings.TrimSpace(strings.Join(rawDebugParts, "\n\n"))
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
	input := string(contextJSON)

	rawDebugParts := make([]string, 0, 4)
	var webUsage *AIUsage
	if req.AllowWebSearch && strings.EqualFold(cfg.Provider, "ollama") {
		input, webUsage, err = maybeAugmentInputWithOllamaWebContext(cfg.Client, cfg.Provider, settings.APIKey, req.Prompt, input, func(raw string) error {
			rawDebugParts = append(rawDebugParts, raw)
			return nil
		})
		if err != nil {
			return nil, wrapAIDebugError(normalizeAIRequestError(err), strings.Join(rawDebugParts, "\n\n"), nil)
		}
	}
	outputText, transport, usage, err := generateAIText(
		cfg.Client,
		cfg.BaseURL,
		cfg.Provider,
		cfg.Model,
		settings.APIKey,
		buildPropertyEnhancementInstructions(settings.PropertyEnhancementPrompt, req.AllowWebSearch, req.Locale, cfg.Provider),
		input,
		req.AllowWebSearch,
		nil,
		buildPropertyEnhancementJSONSchema(),
		func(raw string) error {
			rawDebugParts = append(rawDebugParts, raw)
			return nil
		},
	)
	if err != nil {
		return nil, wrapAIDebugError(err, strings.Join(rawDebugParts, "\n\n"), mergeAIUsage(webUsage, usage))
	}
	result, err := finalizePropertyEnhancement(outputText, transport, cfg.Model, cfg.Provider, req)
	if err != nil {
		return nil, wrapAIDebugError(err, strings.Join(rawDebugParts, "\n\n"), mergeAIUsage(webUsage, usage))
	}
	result.Usage = mergeAIUsage(webUsage, usage)
	result.RawDebug = strings.TrimSpace(strings.Join(rawDebugParts, "\n\n"))
	return result, nil
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

func DefaultChatPromptTemplate() string {
	return DefaultChatPromptTemplateForProvider("openai")
}

func DefaultChatPromptTemplateForProvider(provider string) string {
	base := `You are Ina ("Intelligence Neuronatic Assistant"), the AI assistant inside item+, an inventory and collection management system.

You talk to the user naturally inside the app.

Rules:
- be concise, warm, and directly useful
- focus on the actionable part of the user's message
- ignore small talk, mood, weather, and unrelated side remarks unless they change the task
- when the user asks about an item, collection, category, or property, stay grounded in the context they gave you
- ask a short follow-up question when key information is missing
- prefer saying "I don't know yet" over inventing facts
- if the user only acknowledges or thanks you, respond briefly and naturally
- assume this chat is read-only unless item+ explicitly provides a tool or result that proves an action can be performed from here
- do not offer actions such as returning items, extending due dates, sending reminders, editing stock, creating reservations, exporting data, or changing records unless the chat explicitly has that capability
- if a useful next step would require an app action that the chat cannot perform, say that plainly and suggest checking it in the app instead of pretending you can do it here
- do not write like a report
- do not use headings such as "Open questions", "Notes", or "Status" unless the user explicitly wants that style
- if an image is attached, use it as context when helpful`

	if strings.EqualFold(strings.TrimSpace(provider), "ollama") {
		return base + `
- keep replies extra direct and concrete
- avoid long preambles and avoid repeating the whole request back to the user
- if you are unsure, ask one short question instead of filling gaps with guesses`
	}
	return base
}

func DefaultParseItemPromptTemplate() string {
	return DefaultParseItemPromptTemplateForProvider("openai")
}

func DefaultParseItemPromptTemplateForProvider(provider string) string {
	base := `You work inside item+, an inventory and collection management system.
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

	if strings.EqualFold(strings.TrimSpace(provider), "ollama") {
		return base + `
- be more conservative with technical details when the exact edition, revision, or platform is unclear
- keep missing values empty instead of guessing from partial context
- prefer one short clarification question over broad speculation
- do not merge original releases, ports, remasters, or later editions unless the user explicitly combines them`
	}
	return base
}

func DefaultCategoryPropertyPromptTemplate() string {
	return DefaultCategoryPropertyPromptTemplateForProvider("openai")
}

func DefaultCategoryPropertyPromptTemplateForProvider(provider string) string {
	base := `You work inside item+, an inventory and collection management system.
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

	if strings.EqualFold(strings.TrimSpace(provider), "ollama") {
		return base + `
- keep the scope especially tight
- if the task sounds like a single property addition or one focused correction, return exactly that and nothing broader`
	}
	return base
}

func DefaultPropertyEnhancementPromptTemplate() string {
	return DefaultPropertyEnhancementPromptTemplateForProvider("openai")
}

func DefaultPropertyEnhancementPromptTemplateForProvider(provider string) string {
	base := `You work inside item+, an inventory and collection management system.
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

	if strings.EqualFold(strings.TrimSpace(provider), "ollama") {
		return base + `
- prefer minimal edits over broad rewrites
- if the user intent is underspecified, ask one short question before changing the property structure`
	}
	return base
}

func buildChatInstructions(basePrompt string, allowWebSearch bool, locale string, provider string) string {
	languageInstruction := "Write all human-readable output in English."
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(locale)), "de") {
		languageInstruction = "Write all human-readable output in German."
	}

	instructions := strings.TrimSpace(basePrompt)
	if instructions == "" {
		instructions = DefaultChatPromptTemplateForProvider(provider)
	}

	if allowWebSearch {
		instructions += `
- web search is allowed when it helps answer the user's request more accurately`
	} else {
		instructions += `
- do not rely on web search`
	}

	instructions += `

` + languageInstruction + `

You may receive an app_context object from the authenticated item+ session.

Rules for app_context:
- treat app_context as trusted read-only context from item+
- if the user asks about their own account, display name, e-mail, role, permissions, or current item+ session, use app_context directly when it contains the answer
- if app_context contains inventory_lookup, treat it as a trusted read-only lookup result from item+
- use inventory_lookup when the user asks about current inventory, locations, categories, quantities, or active checkouts and the answer is present there
- do not turn inventory_lookup results into promises that you can now change data, send reminders, process returns, or trigger workflows
- do not pretend you need extra access, login, API keys, OAuth, or permission setup when the answer is already present in app_context
- do not say you opened, clicked, or navigated somewhere unless the app actually gave you that result in app_context
- if app_context does not contain the requested detail, say so plainly instead of acting like you can fetch it live

Rules for web_context:
- if web_context is present, treat it as trusted read-only web research prepared by item+
- prefer web_context over stale general knowledge for current facts
- do not mention internal endpoint names such as web_search or web_fetch unless the user explicitly asks

Reply in normal prose only. Do not return JSON or markdown tables unless the user explicitly asks for them.`

	return instructions
}

func buildInventoryLookupPlannerInstructions(locale string, provider string) string {
	languageInstruction := "Interpret the conversation in English unless the user clearly writes in another language."
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(locale)), "de") {
		languageInstruction = "Interpret the conversation in German."
	}

	instructions := `You are an internal tool router for item+.

You are in planning mode for one internal read-only tool called inventory.lookup.

Decide whether Ina needs inventory.lookup before answering.

Use inventory.lookup only when the answer depends on current item+ data that may change over time, for example:
- which items exist
- quantities or stock levels
- locations or categories of current items
- which items are currently checked out
- who currently has a checkout

Do not use inventory.lookup when:
- app_context already contains the answer
- the user is just chatting, thanking, greeting, or asking for general knowledge
- the user is asking to change data rather than inspect it

Always use inventory.lookup when the user asks about current or live app data such as:
- what exists right now
- how many items are in a place
- what is currently checked out
- who currently has an item
- whether something is overdue
- anything with wording like currently, right now, gerade, aktuell, momentan

The tool can search read-only inventory data with these fields:
- kind: "items" or "checkouts"
- realm: "all", "archive", or "collection"
- search: free-text search for item content
- location_name: optional location filter by name
- category_name: optional category filter by name
- user_name: optional checkout-user filter by name
- status: optional status filter
- stock_state: optional item stock filter such as "low_stock" or "out_of_stock"
- limit: result size, usually 5 to 10

Examples:
- "What does Oli currently have checked out?" => needs_lookup=true, request.kind="checkouts", request.realm="all", request.user_name="Oli", request.status="active", request.limit=8
- "How many matchboxes are in the kitchen?" => needs_lookup=true, request.kind="items", request.realm="all", request.search="matchboxes", request.location_name="kitchen", request.limit=8
- "Which cameras are in the office?" => needs_lookup=true, request.kind="items", request.realm="all", request.search="cameras", request.location_name="office", request.limit=8
- "Which items should I reorder soon?" => needs_lookup=true, request.kind="items", request.realm="all", request.stock_state="low_stock", request.limit=8
- "What is out of stock right now?" => needs_lookup=true, request.kind="items", request.realm="all", request.stock_state="out_of_stock", request.limit=8
- "Thanks" => needs_lookup=false, request=null
- "Who are you?" => needs_lookup=false, request=null

If the user asks about themselves and app_context.current_user contains a display name or e-mail, use that as request.user_name when helpful.

Return a tool request, not a chat reply.

Return exactly one JSON object and no markdown.`

	instructions += "\n\n" + languageInstruction
	if strings.EqualFold(strings.TrimSpace(provider), "ollama") {
		instructions += `

Be especially literal and decisive. Prefer a lookup over hesitation when the request is about current inventory data.`
	}
	return instructions
}

func buildParseInstructions(basePrompt string, allowWebSearch bool, locale string, identifyOnly bool, provider string) string {
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

If web_context is present, treat it as trusted read-only web research prepared by item+.

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
		instructions = DefaultParseItemPromptTemplateForProvider(provider)
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
- if web_context is present, treat it as trusted read-only web research prepared by item+

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

func normalizeInventoryLookupPlan(plan *InventoryLookupPlan) {
	if plan == nil {
		return
	}
	plan.Reason = strings.TrimSpace(plan.Reason)
	if !plan.NeedsLookup || plan.Request == nil {
		plan.NeedsLookup = false
		plan.Request = nil
		return
	}

	request := plan.Request
	request.Kind = strings.ToLower(strings.TrimSpace(request.Kind))
	request.Realm = strings.ToLower(strings.TrimSpace(request.Realm))
	request.Search = strings.TrimSpace(request.Search)
	request.LocationName = strings.TrimSpace(request.LocationName)
	request.CategoryName = strings.TrimSpace(request.CategoryName)
	request.UserName = strings.TrimSpace(request.UserName)
	request.Status = strings.ToLower(strings.TrimSpace(request.Status))
	request.StockState = strings.ToLower(strings.TrimSpace(request.StockState))

	if request.Kind != "items" && request.Kind != "checkouts" {
		plan.NeedsLookup = false
		plan.Request = nil
		return
	}
	if request.Realm != "archive" && request.Realm != "collection" {
		request.Realm = "all"
	}
	switch request.StockState {
	case "", "low_stock", "out_of_stock":
	default:
		request.StockState = ""
	}
	if request.Limit <= 0 {
		request.Limit = 8
	}
	if request.Limit > 20 {
		request.Limit = 20
	}
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

func generateAIText(client *http.Client, baseURL, provider, model, apiKey, instructions, input string, allowWebSearch bool, imageInput *AIImageInput, responseSchema map[string]any, onRaw func(string) error) (string, string, *AIUsage, error) {
	if provider != "openai" && imageInput != nil {
		text, usage, err := generateViaChatCompletions(client, baseURL, provider, model, apiKey, instructions, input, imageInput, responseSchema, onRaw)
		if err == nil {
			return text, "chat.completions", usage, nil
		}
		return "", "", usage, normalizeAIRequestError(err)
	}

	text, statusCode, usage, err := generateViaResponses(client, baseURL, provider, model, apiKey, instructions, input, allowWebSearch, imageInput, responseSchema != nil, onRaw)
	if err == nil {
		return text, "responses", usage, nil
	}
	if provider != "openai" && statusCode == http.StatusNotFound {
		text, usage, err = generateViaChatCompletions(client, baseURL, provider, model, apiKey, instructions, input, imageInput, responseSchema, onRaw)
		if err == nil {
			return text, "chat.completions", usage, nil
		}
		return "", "", usage, normalizeAIRequestError(err)
	}
	return "", "", usage, normalizeAIRequestError(err)
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
	lowerErr := strings.ToLower(err.Error())
	if strings.Contains(lowerErr, "http 504") || strings.Contains(lowerErr, "gateway timeout") {
		return fmt.Errorf("Die KI-Antwort hat zu lange gedauert. Bitte versuche es erneut oder reduziere die Anfrage etwas.")
	}
	return err
}

func wrapAIDebugError(err error, rawDebug string, usage *AIUsage) error {
	if err == nil {
		return nil
	}
	trimmedRaw := strings.TrimSpace(rawDebug)
	if trimmedRaw == "" && usage == nil {
		return err
	}
	return &AIDebugError{
		Err:      err,
		RawDebug: trimmedRaw,
		Usage:    usage,
	}
}

func buildOllamaWebContext(client *http.Client, apiKey, query string, onRaw func(string) error) (string, *AIUsage, error) {
	webUsage := &AIUsage{}
	query = strings.TrimSpace(query)
	if query == "" {
		return "", nil, nil
	}

	webUsage.WebSearchRequests++
	searchResults, err := performOllamaWebSearch(client, apiKey, query, onRaw)
	if err != nil {
		return "", webUsage, err
	}
	if len(searchResults) == 0 {
		return "", webUsage, nil
	}

	urlsToFetch := collectOllamaWebFetchURLs(query, searchResults)
	fetchedPages := make([]map[string]any, 0, len(urlsToFetch))
	for _, url := range urlsToFetch {
		webUsage.WebFetchRequests++
		page, fetchErr := performOllamaWebFetch(client, apiKey, url, onRaw)
		if fetchErr != nil {
			if err := emitAIRaw(onRaw, "OLLAMA WEB FETCH ERROR", fetchErr.Error()); err != nil {
				return "", webUsage, err
			}
			continue
		}
		fetchedPages = append(fetchedPages, map[string]any{
			"url":     url,
			"title":   strings.TrimSpace(page.Title),
			"content": trimAIText(page.Content, ollamaWebFetchContentChars),
			"links":   trimAISlice(page.Links, ollamaWebFetchMaxLinks),
		})
	}

	contextPayload := map[string]any{
		"provider": "ollama_web_search",
		"query":    query,
		"results":  summarizeOllamaWebSearchResults(searchResults),
	}
	if len(fetchedPages) > 0 {
		contextPayload["fetched_pages"] = fetchedPages
	}

	bytes, err := json.Marshal(contextPayload)
	if err != nil {
		return "", webUsage, err
	}
	return string(bytes), webUsage, nil
}

func performOllamaWebSearch(client *http.Client, apiKey, query string, onRaw func(string) error) ([]ollamaWebSearchResult, error) {
	payload := ollamaWebSearchRequest{
		Query:      query,
		MaxResults: ollamaWebSearchMaxResults,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	if err := emitAIRaw(onRaw, "REQUEST /web_search", string(body)); err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, ollamaWebSearchBaseURL+"/web_search", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(apiKey))
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if err := emitAIRaw(onRaw, fmt.Sprintf("RESPONSE /web_search HTTP %d", resp.StatusCode), string(raw)); err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("Ollama web search failed with HTTP %d", resp.StatusCode)
	}

	var parsed ollamaWebSearchResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}
	return parsed.Results, nil
}

func performOllamaWebFetch(client *http.Client, apiKey, url string, onRaw func(string) error) (*ollamaWebFetchResponse, error) {
	payload := ollamaWebFetchRequest{URL: url}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	if err := emitAIRaw(onRaw, "REQUEST /web_fetch", string(body)); err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, ollamaWebSearchBaseURL+"/web_fetch", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(apiKey))
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if err := emitAIRaw(onRaw, fmt.Sprintf("RESPONSE /web_fetch HTTP %d", resp.StatusCode), string(raw)); err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("Ollama web fetch failed with HTTP %d", resp.StatusCode)
	}

	var parsed ollamaWebFetchResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}
	return &parsed, nil
}

func summarizeOllamaWebSearchResults(results []ollamaWebSearchResult) []map[string]any {
	summary := make([]map[string]any, 0, len(results))
	for _, result := range results {
		url := strings.TrimSpace(result.URL)
		title := strings.TrimSpace(result.Title)
		content := trimAIText(result.Content, ollamaWebSearchExcerptChars)
		if url == "" && title == "" && content == "" {
			continue
		}
		summary = append(summary, map[string]any{
			"title":   title,
			"url":     url,
			"content": content,
		})
	}
	return summary
}

func collectOllamaWebFetchURLs(query string, results []ollamaWebSearchResult) []string {
	urls := make([]string, 0, ollamaWebFetchMaxPages)
	seen := map[string]struct{}{}
	for _, candidate := range extractURLsFromText(query) {
		candidate = strings.TrimSpace(candidate)
		if candidate == "" {
			continue
		}
		if _, exists := seen[candidate]; exists {
			continue
		}
		seen[candidate] = struct{}{}
		urls = append(urls, candidate)
		if len(urls) >= ollamaWebFetchMaxPages {
			return urls
		}
	}
	for _, result := range results {
		candidate := strings.TrimSpace(result.URL)
		if candidate == "" {
			continue
		}
		if _, exists := seen[candidate]; exists {
			continue
		}
		seen[candidate] = struct{}{}
		urls = append(urls, candidate)
		if len(urls) >= ollamaWebFetchMaxPages {
			return urls
		}
	}
	return urls
}

func extractURLsFromText(text string) []string {
	re := regexp.MustCompile(`https?://[^\s<>"')]+`)
	return re.FindAllString(text, -1)
}

func trimAIText(text string, maxChars int) string {
	text = strings.TrimSpace(text)
	if maxChars <= 0 || len(text) <= maxChars {
		return text
	}
	return strings.TrimSpace(text[:maxChars]) + "..."
}

func trimAISlice(values []string, limit int) []string {
	if limit <= 0 || len(values) <= limit {
		return values
	}
	return append([]string{}, values[:limit]...)
}

func generateViaResponses(client *http.Client, baseURL, provider, model, apiKey, instructions, input string, allowWebSearch bool, imageInput *AIImageInput, enforceJSON bool, onRaw func(string) error) (string, int, *AIUsage, error) {
	requestInput := input
	if enforceJSON && provider == "openai" && !strings.Contains(strings.ToLower(requestInput), "json") {
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
	if enforceJSON && provider == "openai" && !allowWebSearch {
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
		return "", 0, nil, err
	}
	if err := emitAIRaw(onRaw, "REQUEST /responses", string(body)); err != nil {
		return "", 0, nil, err
	}

	req, err := http.NewRequest(http.MethodPost, baseURL+"/responses", bytes.NewReader(body))
	if err != nil {
		return "", 0, nil, err
	}
	applyAIHeaders(req, provider, apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return "", 0, nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", resp.StatusCode, nil, err
	}
	if err := emitAIRaw(onRaw, fmt.Sprintf("RESPONSE /responses HTTP %d", resp.StatusCode), string(raw)); err != nil {
		return "", resp.StatusCode, nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var apiErr openAIResponse
		if json.Unmarshal(raw, &apiErr) == nil && apiErr.Error != nil && strings.TrimSpace(apiErr.Error.Message) != "" {
			return "", resp.StatusCode, nil, errors.New(apiErr.Error.Message)
		}
		return "", resp.StatusCode, nil, fmt.Errorf("AI request failed with HTTP %d", resp.StatusCode)
	}

	var parsed openAIResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", resp.StatusCode, nil, err
	}
	usage := usageFromOpenAIResponse(parsed)
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
			return "", resp.StatusCode, usage, fmt.Errorf("AI response hit the output limit before a readable result was returned")
		}
		return "", resp.StatusCode, usage, fmt.Errorf("Provider returned no readable output text. Raw response: %s", partialAIOutputPreview(string(raw)))
	}
	return outputText, resp.StatusCode, usage, nil
}

func generateViaChatCompletions(client *http.Client, baseURL, provider, model, apiKey, instructions, input string, imageInput *AIImageInput, responseSchema map[string]any, onRaw func(string) error) (string, *AIUsage, error) {
	userMessage := map[string]any{
		"role":    "user",
		"content": input,
	}
	if imageInput != nil {
		dataURL := fmt.Sprintf("data:%s;base64,%s", imageInput.MimeType, base64.StdEncoding.EncodeToString(imageInput.Data))
		userMessage["content"] = []map[string]any{
			{"type": "text", "text": input},
			{"type": "image_url", "image_url": map[string]any{"url": dataURL}},
		}
	}
	payload := map[string]any{
		"model": model,
		"messages": []map[string]any{
			{"role": "system", "content": instructions},
			userMessage,
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
		return "", nil, err
	}
	if err := emitAIRaw(onRaw, "REQUEST /chat/completions", string(body)); err != nil {
		return "", nil, err
	}

	req, err := http.NewRequest(http.MethodPost, baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", nil, err
	}
	applyAIHeaders(req, provider, apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return "", nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, err
	}
	if err := emitAIRaw(onRaw, fmt.Sprintf("RESPONSE /chat/completions HTTP %d", resp.StatusCode), string(raw)); err != nil {
		return "", nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var apiErr chatCompletionResponse
		if json.Unmarshal(raw, &apiErr) == nil && apiErr.Error != nil && strings.TrimSpace(apiErr.Error.Message) != "" {
			return "", nil, errors.New(apiErr.Error.Message)
		}
		return "", nil, fmt.Errorf("AI request failed with HTTP %d", resp.StatusCode)
	}

	var parsed chatCompletionResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", nil, err
	}
	if len(parsed.Choices) == 0 {
		return "", usageFromChatCompletionResponse(parsed), fmt.Errorf("Model returned no choices")
	}
	return strings.TrimSpace(parsed.Choices[0].Message.Content), usageFromChatCompletionResponse(parsed), nil
}

func generateViaChatCompletionsStream(client *http.Client, baseURL, provider, model, apiKey, instructions, input string, responseSchema map[string]any, onDelta func(string) error, onUsage func(AIUsage) error, onRaw func(string) error) error {
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
	if err := emitAIRaw(onRaw, "REQUEST /chat/completions (stream)", string(body)); err != nil {
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
		if err := emitAIRaw(onRaw, fmt.Sprintf("RESPONSE /chat/completions (stream) HTTP %d", resp.StatusCode), string(raw)); err != nil {
			return err
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
		Usage *struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
		PromptEvalCount int `json:"prompt_eval_count"`
		EvalCount       int `json:"eval_count"`
		Error           *struct {
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
			if onRaw != nil {
				if cbErr := onRaw(payload); cbErr != nil {
					return cbErr
				}
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
			if onUsage != nil {
				usage := usageFromChatCompletionResponse(chatCompletionResponse{
					Usage:           chunk.Usage,
					PromptEvalCount: chunk.PromptEvalCount,
					EvalCount:       chunk.EvalCount,
				})
				if usage != nil {
					if cbErr := onUsage(*usage); cbErr != nil {
						return cbErr
					}
				}
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

func buildCategoryPropertyInstructions(basePrompt string, allowWebSearch bool, locale string, provider string) string {
	languageInstruction := "Write all human-readable output in English."
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(locale)), "de") {
		languageInstruction = "Write all human-readable output in German."
	}

	instructions := strings.TrimSpace(basePrompt)
	if instructions == "" {
		instructions = DefaultCategoryPropertyPromptTemplateForProvider(provider)
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

If web_context is present, treat it as trusted read-only web research prepared by item+.

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

func buildPropertyEnhancementInstructions(basePrompt string, allowWebSearch bool, locale string, provider string) string {
	languageInstruction := "Write all human-readable output in English."
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(locale)), "de") {
		languageInstruction = "Write all human-readable output in German."
	}

	instructions := strings.TrimSpace(basePrompt)
	if instructions == "" {
		instructions = DefaultPropertyEnhancementPromptTemplateForProvider(provider)
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

If web_context is present, treat it as trusted read-only web research prepared by item+.

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
