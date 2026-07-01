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
