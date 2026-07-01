package ai

import "net/http"

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
