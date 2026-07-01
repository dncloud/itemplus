package ai

import (
	"encoding/json"
	"net/http"
	"strings"
)

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
	if !isOllamaProvider(provider) {
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
