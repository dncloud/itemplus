package ai

import (
	"context"
	"errors"
	"fmt"
	"net"
	"regexp"
	"strings"
)

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
