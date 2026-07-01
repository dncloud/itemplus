package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
)

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
