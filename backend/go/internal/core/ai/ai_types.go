package ai

import (
	"fmt"
	"net/http"
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
	VendorPrompt              string
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

type AIVendorAddressProposal struct {
	Street      string `json:"street,omitempty"`
	HouseNumber string `json:"house_number,omitempty"`
	ZIP         string `json:"zip,omitempty"`
	City        string `json:"city,omitempty"`
}

type AIVendorProposal struct {
	Name            string                   `json:"name,omitempty"`
	Website         string                   `json:"website,omitempty"`
	ExternalLogoURL string                   `json:"external_logo_url,omitempty"`
	Email           string                   `json:"email,omitempty"`
	Phone           string                   `json:"phone,omitempty"`
	ContactPerson   string                   `json:"contact_person,omitempty"`
	CustomerNumber  string                   `json:"customer_number,omitempty"`
	AccountManager  string                   `json:"account_manager,omitempty"`
	SupportEmail    string                   `json:"support_email,omitempty"`
	SupportPhone    string                   `json:"support_phone,omitempty"`
	SupportURL      string                   `json:"support_url,omitempty"`
	Address         *AIVendorAddressProposal `json:"address,omitempty"`
}

type SuggestVendorRequest struct {
	Realm          string         `json:"realm"`
	EntityType     string         `json:"entity_type"`
	Prompt         string         `json:"prompt"`
	AllowWebSearch bool           `json:"allow_web_search,omitempty"`
	Locale         string         `json:"locale,omitempty"`
	Draft          map[string]any `json:"draft,omitempty"`
}

type SuggestVendorResult struct {
	Confidence        float64          `json:"confidence"`
	NeedsConfirmation bool             `json:"needs_confirmation"`
	AssistantMessage  string           `json:"assistant_message"`
	Questions         []string         `json:"questions"`
	Notes             []string         `json:"notes"`
	Vendor            AIVendorProposal `json:"vendor"`
	RawPrompt         string           `json:"raw_prompt,omitempty"`
	RawDebug          string           `json:"raw_debug,omitempty"`
	Transport         string           `json:"transport,omitempty"`
	Model             string           `json:"model,omitempty"`
	Provider          string           `json:"provider,omitempty"`
	Usage             *AIUsage         `json:"usage,omitempty"`
	Context           map[string]any   `json:"context,omitempty"`
}

type VendorLogoPreviewCandidate struct {
	DataURL   string `json:"data_url"`
	SourceURL string `json:"source_url,omitempty"`
	Kind      string `json:"kind,omitempty"`
	Width     int    `json:"width,omitempty"`
	Height    int    `json:"height,omitempty"`
}

type VendorLogoPreviewResult struct {
	Domain     string                       `json:"domain"`
	Candidates []VendorLogoPreviewCandidate `json:"candidates"`
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
	if isOllamaProvider(provider) {
		return aiGenerateTimeoutLocalLLM
	}
	return aiGenerateTimeout
}

func aiSettingsSupportsVision(settings AISettings) bool {
	if isOpenAIProvider(settings.Provider) {
		return true
	}
	return settings.SupportsVision
}

func isOllamaProvider(provider string) bool {
	return strings.EqualFold(strings.TrimSpace(provider), "ollama")
}

func isOpenAIProvider(provider string) bool {
	return strings.EqualFold(strings.TrimSpace(provider), "openai")
}
