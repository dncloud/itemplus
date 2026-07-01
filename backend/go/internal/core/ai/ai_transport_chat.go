package ai

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

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
			return errors.New(strings.TrimSpace(apiErr.Error.Message))
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
