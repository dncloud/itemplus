package ai

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"golang.org/x/net/html"
)

func normalizeVendorPreviewBaseURL(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	if !strings.HasPrefix(strings.ToLower(trimmed), "http://") && !strings.HasPrefix(strings.ToLower(trimmed), "https://") {
		trimmed = "https://" + trimmed
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Host == "" {
		return ""
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return ""
	}
	parsed.Path = ""
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return parsed.String()
}

func discoverVendorLogoCandidates(client *http.Client, base *url.URL, identityTokens []string) []string {
	candidates := make([]string, 0, 8)
	seen := map[string]struct{}{}
	push := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		if _, ok := seen[value]; ok {
			return
		}
		seen[value] = struct{}{}
		candidates = append(candidates, value)
	}

	req, _ := http.NewRequest(http.MethodGet, base.String(), nil)
	req.Header.Set("User-Agent", "item+/1.0 vendor-logo-preview")
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	if resp, err := client.Do(req); err == nil {
		defer resp.Body.Close()
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			reader := io.LimitReader(resp.Body, 512*1024)
			tokenizer := html.NewTokenizer(reader)
			for {
				tt := tokenizer.Next()
				if tt == html.ErrorToken {
					break
				}
				if tt != html.StartTagToken && tt != html.SelfClosingTagToken {
					continue
				}
				token := tokenizer.Token()
				switch strings.ToLower(token.Data) {
				case "link":
					var href string
					relValues := make([]string, 0, 2)
					for _, attr := range token.Attr {
						switch strings.ToLower(attr.Key) {
						case "href":
							href = strings.TrimSpace(attr.Val)
						case "rel":
							relValues = append(relValues, strings.Fields(strings.ToLower(attr.Val))...)
						}
					}
					if href == "" {
						continue
					}
					for _, rel := range relValues {
						if strings.Contains(rel, "icon") || rel == "mask-icon" || rel == "shortcut" || rel == "apple-touch-icon" {
							if resolved := resolveVendorLogoURL(base, href); resolved != "" {
								push(resolved)
							}
							break
						}
					}
				case "meta":
					var property string
					var content string
					for _, attr := range token.Attr {
						switch strings.ToLower(attr.Key) {
						case "property", "name":
							property = strings.ToLower(strings.TrimSpace(attr.Val))
						case "content":
							content = strings.TrimSpace(attr.Val)
						}
					}
					if (property == "og:image" || property == "twitter:image" || property == "og:logo") && content != "" {
						if resolved := resolveVendorLogoURL(base, content); resolved != "" {
							push(resolved)
						}
					}
				case "img", "source":
					var src string
					var srcset string
					var alt string
					var className string
					var id string
					for _, attr := range token.Attr {
						switch strings.ToLower(attr.Key) {
						case "src", "data-src", "data-logo", "data-image":
							if src == "" {
								src = strings.TrimSpace(attr.Val)
							}
						case "srcset", "data-srcset":
							if srcset == "" {
								srcset = strings.TrimSpace(attr.Val)
							}
						case "alt":
							alt = strings.TrimSpace(attr.Val)
						case "class":
							className = strings.TrimSpace(attr.Val)
						case "id":
							id = strings.TrimSpace(attr.Val)
						}
					}
					if src == "" && srcset != "" {
						src = pickLikelyBestSrcsetURL(srcset)
					}
					if src == "" {
						continue
					}
					if !isLikelyVendorLogoReference(src, alt, className, id, identityTokens) {
						continue
					}
					if resolved := resolveVendorLogoURL(base, src); resolved != "" {
						push(resolved)
					}
				}
			}
		}
	}

	if favicon := resolveVendorLogoURL(base, "/favicon.ico"); favicon != "" {
		push(favicon)
	}
	if appleIcon := resolveVendorLogoURL(base, "/apple-touch-icon.png"); appleIcon != "" {
		push(appleIcon)
	}
	if appleIconPre := resolveVendorLogoURL(base, "/apple-touch-icon-precomposed.png"); appleIconPre != "" {
		push(appleIconPre)
	}
	return candidates
}

func discoverWikipediaLogoCandidates(client *http.Client, name string, identityTokens []string) []string {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil
	}

	type wikiPage struct {
		Title     string `json:"title"`
		PageProps struct {
			WikibaseItem string `json:"wikibase_item"`
		} `json:"pageprops"`
	}
	type wikiQueryResponse struct {
		Query struct {
			Pages map[string]wikiPage `json:"pages"`
		} `json:"query"`
	}

	searchTerms := []string{name}
	if len(name) > 3 {
		searchTerms = append(searchTerms, fmt.Sprintf("%s company", name))
	}

	candidates := make([]string, 0, 6)
	seen := map[string]struct{}{}
	push := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		if _, ok := seen[value]; ok {
			return
		}
		seen[value] = struct{}{}
		candidates = append(candidates, value)
	}

	for _, language := range []string{"en", "de"} {
		for _, searchTerm := range searchTerms {
			reqURL := fmt.Sprintf(
				"https://%s.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=%s&gsrlimit=4&prop=pageprops&ppprop=wikibase_item&format=json",
				language,
				url.QueryEscape(searchTerm),
			)
			req, _ := http.NewRequest(http.MethodGet, reqURL, nil)
			req.Header.Set("User-Agent", "item+/1.0 vendor-logo-preview")
			req.Header.Set("Accept", "application/json")
			resp, err := client.Do(req)
			if err != nil {
				continue
			}
			func() {
				defer resp.Body.Close()
				if resp.StatusCode < 200 || resp.StatusCode >= 300 {
					return
				}
				var payload wikiQueryResponse
				if err := json.NewDecoder(io.LimitReader(resp.Body, 512*1024)).Decode(&payload); err != nil {
					return
				}
				pages := make([]wikiPage, 0, len(payload.Query.Pages))
				for _, page := range payload.Query.Pages {
					pages = append(pages, page)
				}
				sort.SliceStable(pages, func(i, j int) bool {
					return strings.EqualFold(pages[i].Title, name) && !strings.EqualFold(pages[j].Title, name)
				})
				for _, page := range pages {
					if !wikipediaTitleMatchesVendorIdentity(page.Title, name, identityTokens) {
						continue
					}
					entityID := strings.TrimSpace(page.PageProps.WikibaseItem)
					if entityID == "" {
						continue
					}
					for _, logoURL := range fetchWikidataLogoCandidates(client, entityID) {
						push(logoURL)
					}
				}
			}()
			if len(candidates) >= 6 {
				return candidates
			}
		}
	}

	return candidates
}

func wikipediaTitleMatchesVendorIdentity(title string, name string, identityTokens []string) bool {
	title = strings.TrimSpace(strings.ToLower(title))
	name = strings.TrimSpace(strings.ToLower(name))
	if title == "" {
		return false
	}
	if name != "" {
		if title == name || strings.HasPrefix(title, name+" ") || strings.Contains(title, "("+name+")") {
			return true
		}
	}

	matches := 0
	for _, token := range identityTokens {
		if strings.Contains(title, token) {
			matches++
		}
	}
	if matches >= 2 {
		return true
	}
	if matches == 1 {
		for _, token := range identityTokens {
			if title == token || strings.HasPrefix(title, token+" ") || strings.Contains(title, " "+token+" ") {
				return true
			}
		}
	}
	return false
}

func fetchWikidataLogoCandidates(client *http.Client, entityID string) []string {
	entityID = strings.TrimSpace(entityID)
	if entityID == "" {
		return nil
	}

	type wikiDataSnakDataValue struct {
		Value any `json:"value"`
	}
	type wikiDataSnak struct {
		DataValue *wikiDataSnakDataValue `json:"datavalue"`
	}
	type wikiDataClaim struct {
		MainSnak *wikiDataSnak `json:"mainsnak"`
	}
	type wikiDataEntity struct {
		Claims map[string][]wikiDataClaim `json:"claims"`
	}
	type wikiDataResponse struct {
		Entities map[string]wikiDataEntity `json:"entities"`
	}

	reqURL := fmt.Sprintf(
		"https://www.wikidata.org/w/api.php?action=wbgetentities&ids=%s&props=claims&format=json",
		url.QueryEscape(entityID),
	)
	req, _ := http.NewRequest(http.MethodGet, reqURL, nil)
	req.Header.Set("User-Agent", "item+/1.0 vendor-logo-preview")
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil
	}

	var payload wikiDataResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 512*1024)).Decode(&payload); err != nil {
		return nil
	}
	entity, ok := payload.Entities[entityID]
	if !ok || len(entity.Claims) == 0 {
		return nil
	}

	candidates := make([]string, 0, 4)
	seen := map[string]struct{}{}
	push := func(fileName string) {
		fileName = strings.TrimSpace(fileName)
		if fileName == "" {
			return
		}
		if _, exists := seen[fileName]; exists {
			return
		}
		seen[fileName] = struct{}{}
		candidates = append(candidates, "https://commons.wikimedia.org/wiki/Special:FilePath/"+url.PathEscape(fileName))
	}

	for _, claim := range entity.Claims["P154"] {
		if claim.MainSnak == nil || claim.MainSnak.DataValue == nil {
			continue
		}
		if value, ok := claim.MainSnak.DataValue.Value.(string); ok {
			push(value)
		}
	}

	return candidates
}

func pickLikelyBestSrcsetURL(srcset string) string {
	bestURL := ""
	bestWidth := 0
	for _, part := range strings.Split(srcset, ",") {
		fields := strings.Fields(strings.TrimSpace(part))
		if len(fields) == 0 {
			continue
		}
		rawURL := fields[0]
		width := 0
		if len(fields) > 1 {
			descriptor := strings.TrimSpace(fields[len(fields)-1])
			if strings.HasSuffix(descriptor, "w") {
				if parsed, err := strconv.Atoi(strings.TrimSuffix(descriptor, "w")); err == nil {
					width = parsed
				}
			}
		}
		if bestURL == "" || width >= bestWidth {
			bestURL = rawURL
			bestWidth = width
		}
	}
	return bestURL
}

func buildVendorIdentityTokens(name string, host string) []string {
	seen := map[string]struct{}{}
	push := func(token string, target *[]string) {
		token = strings.TrimSpace(strings.ToLower(token))
		if len(token) < 3 {
			return
		}
		switch token {
		case "www", "com", "net", "org", "de", "co", "inc", "llc", "ltd", "gmbh", "ag", "kg", "corp", "company", "group", "the":
			return
		}
		if _, exists := seen[token]; exists {
			return
		}
		seen[token] = struct{}{}
		*target = append(*target, token)
	}

	tokens := make([]string, 0, 8)
	tokenize := func(value string) {
		for _, part := range regexp.MustCompile(`[^a-z0-9]+`).Split(strings.ToLower(value), -1) {
			push(part, &tokens)
		}
	}

	tokenize(name)
	host = strings.TrimSpace(strings.ToLower(host))
	host = strings.TrimPrefix(host, "www.")
	if host != "" {
		if first := strings.Split(host, ".")[0]; first != "" {
			tokenize(first)
		}
	}

	return tokens
}

func isLikelyVendorLogoReference(src string, alt string, className string, id string, identityTokens []string) bool {
	value := strings.ToLower(strings.Join([]string{src, alt, className, id}, " "))
	if value == "" {
		return false
	}
	if hasConflictingBrandTokenInSourceURL(src, identityTokens) {
		return false
	}

	strongIndicators := []string{
		"site-logo",
		"header-logo",
		"brand-logo",
		"company-logo",
		"corporate-logo",
		"navbar-brand",
		"nav-logo",
		"logo-link",
		"wordmark",
		"logotype",
	}
	for _, indicator := range strongIndicators {
		if strings.Contains(value, indicator) {
			return true
		}
	}

	hasIdentityMatch := false
	for _, token := range identityTokens {
		if strings.Contains(value, token) {
			hasIdentityMatch = true
			break
		}
	}

	hasGenericLogoHint := strings.Contains(value, "logo") || strings.Contains(value, "brand")
	hasLayoutContext := strings.Contains(value, "header") || strings.Contains(value, "nav") || strings.Contains(value, "navbar") || strings.Contains(value, "site") || strings.Contains(value, "home")

	if hasIdentityMatch && (hasGenericLogoHint || strings.Contains(value, "svg") || strings.Contains(value, "wordmark")) {
		return true
	}
	if hasGenericLogoHint && hasLayoutContext {
		return true
	}
	return false
}

func hasConflictingBrandTokenInSourceURL(rawURL string, identityTokens []string) bool {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return false
	}
	baseName := strings.ToLower(path.Base(parsed.Path))
	baseName = strings.TrimSuffix(baseName, path.Ext(baseName))
	if baseName == "" || baseName == "." || baseName == "/" {
		return false
	}

	tokens := extractMeaningfulBrandTokens(baseName)
	if len(tokens) == 0 {
		return false
	}

	for _, token := range tokens {
		for _, identity := range identityTokens {
			if token == identity {
				return false
			}
		}
	}

	return true
}

func extractMeaningfulBrandTokens(value string) []string {
	parts := regexp.MustCompile(`[^a-z0-9]+`).Split(strings.ToLower(value), -1)
	result := make([]string, 0, len(parts))
	seen := map[string]struct{}{}
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if len(part) < 3 {
			continue
		}
		switch part {
		case "logo", "logos", "brand", "brands", "wordmark", "logotype", "icon", "icons", "site", "header", "footer", "home", "homepage", "nav", "navbar", "main", "corporate", "company", "group", "white", "black", "blue", "red", "green", "gray", "grey", "dark", "light", "small", "large", "horizontal", "vertical", "symbol", "mark":
			continue
		}
		if _, exists := seen[part]; exists {
			continue
		}
		seen[part] = struct{}{}
		result = append(result, part)
	}
	return result
}

func resolveVendorLogoURL(base *url.URL, href string) string {
	href = strings.TrimSpace(href)
	if href == "" {
		return ""
	}
	parsed, err := url.Parse(href)
	if err != nil {
		return ""
	}
	var resolved *url.URL
	if base != nil {
		resolved = base.ResolveReference(parsed)
	} else {
		resolved = parsed
	}
	if resolved.Host == "" || (resolved.Scheme != "http" && resolved.Scheme != "https") {
		return ""
	}
	return resolved.String()
}

func resolveVendorLogoDomain(base *url.URL, externalLogoURL string) string {
	if base != nil && base.Host != "" {
		return strings.TrimPrefix(strings.ToLower(base.Host), "www.")
	}
	if resolved := resolveVendorLogoURL(nil, externalLogoURL); resolved != "" {
		if parsed, err := url.Parse(resolved); err == nil && parsed.Host != "" {
			return strings.TrimPrefix(strings.ToLower(parsed.Host), "www.")
		}
	}
	return ""
}
