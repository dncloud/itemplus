package ai

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"

	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	"golang.org/x/net/html"
)

func fetchVendorLogoCandidate(client *http.Client, rawURL string) (VendorLogoPreviewCandidate, error) {
	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return VendorLogoPreviewCandidate{}, err
	}
	req.Header.Set("User-Agent", "item+/1.0 vendor-logo-preview")
	req.Header.Set("Accept", "image/*,*/*;q=0.8")
	resp, err := client.Do(req)
	if err != nil {
		return VendorLogoPreviewCandidate{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return VendorLogoPreviewCandidate{}, fmt.Errorf("logo fetch failed: %s", resp.Status)
	}
	contentType := strings.ToLower(strings.TrimSpace(strings.Split(resp.Header.Get("Content-Type"), ";")[0]))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	if !strings.HasPrefix(contentType, "image/") {
		return VendorLogoPreviewCandidate{}, fmt.Errorf("unsupported content type: %s", contentType)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 768*1024))
	if err != nil {
		return VendorLogoPreviewCandidate{}, err
	}
	if len(body) == 0 {
		return VendorLogoPreviewCandidate{}, errors.New("empty image")
	}
	width, height := detectVendorLogoDimensions(body, contentType)
	return VendorLogoPreviewCandidate{
		DataURL:   "data:" + contentType + ";base64," + base64.StdEncoding.EncodeToString(body),
		SourceURL: rawURL,
		Kind:      contentType,
		Width:     width,
		Height:    height,
	}, nil
}

func detectVendorLogoDimensions(body []byte, contentType string) (int, int) {
	if strings.Contains(contentType, "svg") || bytes.Contains(bytes.ToLower(body[:minInt(len(body), 512)]), []byte("<svg")) {
		return detectSVGDimensions(string(body))
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(body))
	if err != nil {
		return 0, 0
	}
	return cfg.Width, cfg.Height
}

func detectSVGDimensions(content string) (int, int) {
	tokenizer := html.NewTokenizer(strings.NewReader(content))
	for {
		tt := tokenizer.Next()
		if tt == html.ErrorToken {
			break
		}
		if tt != html.StartTagToken && tt != html.SelfClosingTagToken {
			continue
		}
		token := tokenizer.Token()
		if strings.ToLower(token.Data) != "svg" {
			continue
		}
		var width int
		var height int
		var viewBox string
		for _, attr := range token.Attr {
			switch strings.ToLower(attr.Key) {
			case "width":
				width = parseSVGDimension(attr.Val)
			case "height":
				height = parseSVGDimension(attr.Val)
			case "viewbox":
				viewBox = attr.Val
			}
		}
		if (width == 0 || height == 0) && strings.TrimSpace(viewBox) != "" {
			parts := strings.Fields(strings.ReplaceAll(viewBox, ",", " "))
			if len(parts) == 4 {
				if width == 0 {
					width = parseSVGDimension(parts[2])
				}
				if height == 0 {
					height = parseSVGDimension(parts[3])
				}
			}
		}
		return width, height
	}
	return 0, 0
}

func parseSVGDimension(value string) int {
	value = strings.TrimSpace(strings.ToLower(value))
	value = strings.TrimSuffix(value, "px")
	if value == "" {
		return 0
	}
	if strings.Contains(value, ".") {
		if parsedFloat, err := strconv.ParseFloat(value, 64); err == nil {
			return int(parsedFloat)
		}
	}
	parsedInt, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return parsedInt
}

func vendorLogoCandidateScore(candidate VendorLogoPreviewCandidate, identityTokens []string) int {
	score := 0
	switch {
	case strings.Contains(candidate.Kind, "svg"):
		score += 5000
	case strings.Contains(candidate.Kind, "png"):
		score += 3000
	case strings.Contains(candidate.Kind, "webp"):
		score += 2500
	case strings.Contains(candidate.Kind, "jpeg"), strings.Contains(candidate.Kind, "jpg"):
		score += 2000
	case strings.Contains(candidate.Kind, "icon"):
		score += 1000
	}

	maxDim := candidate.Width
	if candidate.Height > maxDim {
		maxDim = candidate.Height
	}
	switch {
	case maxDim >= 2048:
		score += 1800
	case maxDim >= 1024:
		score += 1400
	case maxDim >= 512:
		score += 700
	case maxDim >= 256:
		score += 250
	}

	lowerURL := strings.ToLower(candidate.SourceURL)
	if hasConflictingBrandTokenInSourceURL(candidate.SourceURL, identityTokens) {
		score -= 10000
	}
	if strings.Contains(lowerURL, "logo") {
		score += 4500
	}
	if strings.Contains(lowerURL, "brand") || strings.Contains(lowerURL, "wordmark") {
		score += 2500
	}
	if strings.Contains(lowerURL, "header") {
		score += 600
	}
	for _, token := range identityTokens {
		if strings.Contains(lowerURL, token) {
			score += 2200
			break
		}
	}
	if !hasConflictingBrandTokenInSourceURL(candidate.SourceURL, identityTokens) {
		if parsed, err := url.Parse(candidate.SourceURL); err == nil {
			baseName := strings.ToLower(path.Base(parsed.Path))
			baseName = strings.TrimSuffix(baseName, path.Ext(baseName))
			for _, token := range identityTokens {
				if strings.Contains(baseName, token) {
					score += 3500
					break
				}
			}
		}
	}
	if strings.Contains(lowerURL, "wikimedia.org") || strings.Contains(lowerURL, "wikipedia.org") {
		score += 300
	}
	if strings.Contains(lowerURL, "upload.wikimedia.org") {
		score += 500
	}
	if strings.Contains(lowerURL, "apple-touch-icon") {
		score -= 3000
	}
	if strings.Contains(lowerURL, "mask-icon") {
		score -= 2200
	}
	if strings.Contains(lowerURL, "favicon") {
		score -= 6500
	}
	if strings.HasSuffix(lowerURL, ".ico") {
		score -= 1800
	}
	switch {
	case maxDim > 0 && maxDim <= 64:
		score -= 3500
	case maxDim <= 128:
		score -= 2400
	case maxDim <= 180:
		score -= 1500
	case maxDim <= 256:
		score -= 700
	}
	if candidate.Width > 0 && candidate.Height > 0 && candidate.Width == candidate.Height && maxDim <= 256 {
		score -= 500
	}
	return score
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
