package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
)

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
