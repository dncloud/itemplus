package ai

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/anthropics/anthropic-sdk-go/packages/param"
)

// Claude is reached through Anthropic's own SDK and its Messages API, not
// through the OpenAI-compatible routes the other providers share.

const (
	anthropicProvider       = "anthropic"
	anthropicDefaultBaseURL = "https://api.anthropic.com"
	// DefaultAnthropicModel is what a new Claude profile starts with.
	DefaultAnthropicModel = "claude-opus-5-5"

	// Room for the answer and for the thinking that precedes it. item+'s
	// answers are short; this is a ceiling, not a target.
	anthropicMaxTokens = 16000
	// The connection test only needs one sentence back, but on current models
	// thinking is always on and counts against the same limit.
	anthropicConnectionTestMaxTokens = 2048
	anthropicWebSearchMaxUses        = 3
	// A web search can pause a long turn; the request is then sent again with
	// what was produced so far. This is how often that may happen.
	anthropicMaxContinuations = 3
)

func isAnthropicProvider(provider string) bool {
	return strings.EqualFold(strings.TrimSpace(provider), anthropicProvider)
}

// IsAnthropicProvider is isAnthropicProvider for the settings code.
func IsAnthropicProvider(provider string) bool {
	return isAnthropicProvider(provider)
}

func newAnthropicClient(httpClient *http.Client, baseURL, apiKey string) anthropic.Client {
	opts := []option.RequestOption{option.WithAPIKey(strings.TrimSpace(apiKey))}
	if httpClient != nil {
		opts = append(opts, option.WithHTTPClient(httpClient))
	}
	if base := strings.TrimRight(strings.TrimSpace(baseURL), "/"); base != "" && base != anthropicDefaultBaseURL {
		opts = append(opts, option.WithBaseURL(base))
	}
	return anthropic.NewClient(opts...)
}

// anthropicWebSearchTool picks the web search tool the model understands:
// the current one for the models that support it, the basic one otherwise.
func anthropicWebSearchTool(model string) anthropic.ToolUnionParam {
	maxUses := param.NewOpt(int64(anthropicWebSearchMaxUses))
	id := strings.ToLower(strings.TrimSpace(model))
	for _, prefix := range []string{"claude-opus-5", "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6", "claude-sonnet-5", "claude-sonnet-4-6"} {
		if strings.HasPrefix(id, prefix) {
			return anthropic.ToolUnionParam{OfWebSearchTool20260209: &anthropic.WebSearchTool20260209Param{MaxUses: maxUses}}
		}
	}
	return anthropic.ToolUnionParam{OfWebSearchTool20250305: &anthropic.WebSearchTool20250305Param{MaxUses: maxUses}}
}

func anthropicMessageParams(model, instructions, input string, imageInput *AIImageInput, allowWebSearch bool) (anthropic.MessageNewParams, error) {
	blocks := []anthropic.ContentBlockParamUnion{}
	if imageInput != nil && len(imageInput.Data) > 0 {
		mediaType := strings.ToLower(strings.TrimSpace(imageInput.MimeType))
		switch mediaType {
		case "image/jpeg", "image/png", "image/gif", "image/webp":
		default:
			return anthropic.MessageNewParams{}, fmt.Errorf("Claude cannot read images of type %q; use JPEG, PNG, GIF or WebP", imageInput.MimeType)
		}
		blocks = append(blocks, anthropic.NewImageBlockBase64(mediaType, base64.StdEncoding.EncodeToString(imageInput.Data)))
	}
	blocks = append(blocks, anthropic.NewTextBlock(input))

	params := anthropic.MessageNewParams{
		Model:     anthropic.Model(strings.TrimSpace(model)),
		MaxTokens: anthropicMaxTokens,
		System:    []anthropic.TextBlockParam{{Text: instructions}},
		Messages:  []anthropic.MessageParam{anthropic.NewUserMessage(blocks...)},
	}
	if allowWebSearch {
		params.Tools = []anthropic.ToolUnionParam{anthropicWebSearchTool(model)}
	}
	return params, nil
}

func anthropicText(message *anthropic.Message) string {
	var builder strings.Builder
	for _, block := range message.Content {
		if text, ok := block.AsAny().(anthropic.TextBlock); ok {
			builder.WriteString(text.Text)
		}
	}
	return builder.String()
}

func usageFromAnthropic(usage anthropic.Usage) *AIUsage {
	input := int(usage.InputTokens + usage.CacheCreationInputTokens + usage.CacheReadInputTokens)
	output := int(usage.OutputTokens)
	return &AIUsage{
		InputTokens:       input,
		OutputTokens:      output,
		TotalTokens:       input + output,
		WebSearchRequests: int(usage.ServerToolUse.WebSearchRequests),
		WebFetchRequests:  int(usage.ServerToolUse.WebFetchRequests),
	}
}

// anthropicStopError turns a way of stopping that left no usable answer into
// an error the user can act on.
func anthropicStopError(message *anthropic.Message) error {
	switch message.StopReason {
	case anthropic.StopReasonRefusal:
		if category := strings.TrimSpace(string(message.StopDetails.Category)); category != "" {
			return fmt.Errorf("Claude declined this request (%s)", category)
		}
		return fmt.Errorf("Claude declined this request")
	case anthropic.StopReasonMaxTokens:
		if strings.TrimSpace(anthropicText(message)) == "" {
			return fmt.Errorf("Claude ran out of room before answering; try a shorter request")
		}
	}
	return nil
}

// anthropicRequestError puts the SDK's error into words: which of the usual
// causes it was, and the request id Anthropic's support asks for.
func anthropicRequestError(err error) error {
	if err == nil {
		return nil
	}
	var apiErr *anthropic.Error
	if !errors.As(err, &apiErr) {
		return normalizeAIRequestError(err)
	}
	reason := ""
	switch {
	case apiErr.StatusCode == http.StatusUnauthorized:
		reason = "the API key was rejected"
	case apiErr.StatusCode == http.StatusForbidden:
		reason = "this API key may not use the requested model or feature"
	case apiErr.StatusCode == http.StatusNotFound:
		reason = "the model was not found; check the model name in the profile"
	case apiErr.StatusCode == http.StatusRequestEntityTooLarge:
		reason = "the request was too large"
	case apiErr.StatusCode == http.StatusTooManyRequests:
		reason = "the rate limit was reached; try again in a moment"
	case apiErr.StatusCode >= 500:
		reason = "Anthropic's service is unavailable or overloaded; try again in a moment"
	default:
		reason = "the request was not accepted"
	}
	message := fmt.Sprintf("Claude request failed (HTTP %d): %s", apiErr.StatusCode, reason)
	if id := strings.TrimSpace(apiErr.RequestID); id != "" {
		message += " [request " + id + "]"
	}
	return errors.New(message)
}

// generateViaAnthropic sends one request and returns the text of the answer.
// The reply is expected as plain text or as one JSON object, as the
// instructions say; the callers read the JSON out of the text themselves.
func generateViaAnthropic(client *http.Client, baseURL, model, apiKey, instructions, input string, allowWebSearch bool, imageInput *AIImageInput, onRaw func(string) error) (string, *AIUsage, error) {
	params, err := anthropicMessageParams(model, instructions, input, imageInput, allowWebSearch)
	if err != nil {
		return "", nil, err
	}
	api := newAnthropicClient(client, baseURL, apiKey)

	var text strings.Builder
	var usage *AIUsage
	for attempt := 0; ; attempt++ {
		message, err := api.Messages.New(context.Background(), params)
		if err != nil {
			return "", usage, anthropicRequestError(err)
		}
		_ = emitAIRaw(onRaw, "ANTHROPIC RESPONSE", message.RawJSON())
		usage = mergeAIUsage(usage, usageFromAnthropic(message.Usage))
		text.WriteString(anthropicText(message))

		if message.StopReason == anthropic.StopReasonPauseTurn && attempt < anthropicMaxContinuations {
			params.Messages = append(params.Messages, message.ToParam())
			continue
		}
		if err := anthropicStopError(message); err != nil {
			return "", usage, err
		}
		return text.String(), usage, nil
	}
}

// generateViaAnthropicStream is generateViaAnthropic for the chat: the text
// is handed on piece by piece as it arrives.
func generateViaAnthropicStream(client *http.Client, baseURL, model, apiKey, instructions, input string, onDelta func(string) error, onUsage func(AIUsage) error, onRaw func(string) error) error {
	params, err := anthropicMessageParams(model, instructions, input, nil, false)
	if err != nil {
		return err
	}
	api := newAnthropicClient(client, baseURL, apiKey)

	stream := api.Messages.NewStreaming(context.Background(), params)
	defer stream.Close()
	message := anthropic.Message{}
	for stream.Next() {
		event := stream.Current()
		if err := message.Accumulate(event); err != nil {
			return err
		}
		if delta, ok := event.AsAny().(anthropic.ContentBlockDeltaEvent); ok {
			if textDelta, ok := delta.Delta.AsAny().(anthropic.TextDelta); ok && textDelta.Text != "" && onDelta != nil {
				if err := onDelta(textDelta.Text); err != nil {
					return err
				}
			}
		}
	}
	if err := stream.Err(); err != nil {
		return anthropicRequestError(err)
	}
	_ = emitAIRaw(onRaw, "ANTHROPIC STREAM", fmt.Sprintf(`{"id":%q,"stop_reason":%q}`, message.ID, message.StopReason))
	if onUsage != nil {
		if err := onUsage(*usageFromAnthropic(message.Usage)); err != nil {
			return err
		}
	}
	return anthropicStopError(&message)
}

func testAnthropicConnection(client *http.Client, baseURL, model, apiKey string) (*AIConnectionTestResult, error) {
	api := newAnthropicClient(client, baseURL, apiKey)
	message, err := api.Messages.New(context.Background(), anthropic.MessageNewParams{
		Model:     anthropic.Model(strings.TrimSpace(model)),
		MaxTokens: anthropicConnectionTestMaxTokens,
		System:    []anthropic.TextBlockParam{{Text: "You are validating an API connection for item+. Respond with the exact confirmation text only."}},
		Messages:  []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock("Please reply with exactly: item+ connection ok"))},
	})
	if err != nil {
		return nil, anthropicRequestError(err)
	}
	if err := anthropicStopError(message); err != nil {
		return nil, err
	}
	return &AIConnectionTestResult{
		Status:     "ok",
		Model:      string(message.Model),
		Provider:   anthropicProvider,
		OutputText: strings.TrimSpace(anthropicText(message)),
		ResponseID: message.ID,
		Transport:  "anthropic.messages",
	}, nil
}

// listAnthropicModels asks Anthropic which models this key can use.
func listAnthropicModels(settings AISettings) ([]AIModelOption, error) {
	apiKey := strings.TrimSpace(settings.APIKey)
	if apiKey == "" {
		return nil, fmt.Errorf("API key is missing")
	}
	api := newAnthropicClient(&http.Client{Timeout: aiConnectionTestTimeout}, settings.BaseURL, apiKey)

	models := []AIModelOption{}
	pager := api.Models.ListAutoPaging(context.Background(), anthropic.ModelListParams{})
	for pager.Next() {
		model := pager.Current()
		if id := strings.TrimSpace(model.ID); id != "" {
			models = append(models, AIModelOption{ID: id, OwnedBy: anthropicProvider, Created: model.CreatedAt.Unix()})
		}
	}
	if err := pager.Err(); err != nil {
		return nil, anthropicRequestError(err)
	}
	// Newest first: that is the order someone choosing a model wants.
	sort.SliceStable(models, func(i, j int) bool { return models[i].Created > models[j].Created })
	return models, nil
}
