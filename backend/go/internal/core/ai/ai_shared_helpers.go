package ai

import (
	"encoding/json"
	"regexp"
	"strings"
)

var aiTokenSplitPattern = regexp.MustCompile(`[^\p{L}\p{N}]+`)

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

func partialAIOutputPreview(text string) string {
	preview := strings.TrimSpace(text)
	if len(preview) > 1200 {
		preview = preview[:1200] + "..."
	}
	return preview
}

func localePrefersGerman(locale string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(locale)), "de")
}

func humanReadableOutputLanguageInstruction(locale string) string {
	if localePrefersGerman(locale) {
		return "Write all human-readable output in German."
	}
	return "Write all human-readable output in English."
}

func humanReadableInterpretationLanguageInstruction(locale string) string {
	if localePrefersGerman(locale) {
		return "Interpret the conversation in German."
	}
	return "Interpret the conversation in English unless the user clearly writes in another language."
}

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
