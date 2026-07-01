package ai

import (
	"errors"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

func ResolveVendorLogoPreview(name string, website string, supportURL string, externalLogoURL string) (*VendorLogoPreviewResult, error) {
	name = strings.TrimSpace(name)
	externalLogoURL = strings.TrimSpace(externalLogoURL)
	baseURL := normalizeVendorPreviewBaseURL(website)
	if baseURL == "" {
		baseURL = normalizeVendorPreviewBaseURL(supportURL)
	}
	if baseURL == "" && externalLogoURL == "" {
		return nil, errors.New("website is required")
	}

	var parsedBase *url.URL
	if baseURL != "" {
		var err error
		parsedBase, err = url.Parse(baseURL)
		if err != nil || parsedBase.Host == "" {
			return nil, errors.New("invalid website")
		}
	}

	client := &http.Client{Timeout: 8 * time.Second}
	candidateURLs := make([]string, 0, 8)
	if externalLogoURL != "" {
		if resolved := resolveVendorLogoURL(parsedBase, externalLogoURL); resolved != "" {
			candidateURLs = append(candidateURLs, resolved)
		}
	}
	identityTokens := buildVendorIdentityTokens(name, "")
	if parsedBase != nil {
		identityTokens = buildVendorIdentityTokens(name, parsedBase.Hostname())
		candidateURLs = append(candidateURLs, discoverVendorLogoCandidates(client, parsedBase, identityTokens)...)
	}
	if name != "" {
		candidateURLs = append(candidateURLs, discoverWikipediaLogoCandidates(client, name, identityTokens)...)
	}
	if len(candidateURLs) == 0 {
		return nil, errors.New("no logo candidates found")
	}

	candidates := make([]VendorLogoPreviewCandidate, 0, 6)
	seenSource := map[string]struct{}{}
	for _, candidateURL := range candidateURLs {
		candidate, fetchErr := fetchVendorLogoCandidate(client, candidateURL)
		if fetchErr != nil || strings.TrimSpace(candidate.DataURL) == "" {
			continue
		}
		if _, exists := seenSource[candidate.SourceURL]; exists {
			continue
		}
		seenSource[candidate.SourceURL] = struct{}{}
		candidates = append(candidates, candidate)
	}

	if len(candidates) == 0 {
		return nil, errors.New("no usable logo candidates found")
	}

	sort.SliceStable(candidates, func(i, j int) bool {
		return vendorLogoCandidateScore(candidates[i], identityTokens) > vendorLogoCandidateScore(candidates[j], identityTokens)
	})
	if len(candidates) > 6 {
		candidates = candidates[:6]
	}

	return &VendorLogoPreviewResult{
		Domain:     resolveVendorLogoDomain(parsedBase, externalLogoURL),
		Candidates: candidates,
	}, nil
}

func buildAISingleVendorSummary(draft map[string]any) map[string]any {
	if len(draft) == 0 {
		return map[string]any{}
	}
	entry := map[string]any{}
	for _, key := range []string{
		"name",
		"website",
		"external_logo_url",
		"email",
		"phone",
		"contact_person",
		"customer_number",
		"account_manager",
		"support_email",
		"support_phone",
		"support_url",
	} {
		if value := strings.TrimSpace(mapStringValue(draft[key])); value != "" {
			entry[key] = value
		}
	}
	if address, ok := draft["address"].(map[string]any); ok {
		addressEntry := map[string]any{}
		for _, key := range []string{"street", "house_number", "zip", "city"} {
			if value := strings.TrimSpace(mapStringValue(address[key])); value != "" {
				addressEntry[key] = value
			}
		}
		if len(addressEntry) > 0 {
			entry["address"] = addressEntry
		}
	}
	return entry
}

func buildAIVendorAllowedFields(entityType string) []string {
	switch strings.TrimSpace(entityType) {
	case "manufacturer":
		return []string{"name", "website", "external_logo_url", "email", "phone", "address.street", "address.house_number", "address.zip", "address.city", "support_email", "support_phone", "support_url"}
	case "supplier":
		return []string{"name", "website", "external_logo_url", "email", "phone", "address.street", "address.house_number", "address.zip", "address.city", "contact_person", "account_manager"}
	case "vendor", "sales_platform":
		return []string{"name", "website", "external_logo_url", "email", "phone", "address.street", "address.house_number", "address.zip", "address.city", "contact_person", "customer_number"}
	default:
		return []string{"name", "website", "external_logo_url", "email", "phone", "address.street", "address.house_number", "address.zip", "address.city"}
	}
}

func buildAIVendorFieldGuidance(entityType string) string {
	switch strings.TrimSpace(entityType) {
	case "manufacturer":
		return "Focus on official company basics and public support contact details. Do not return supplier-only or customer-only fields."
	case "supplier":
		return "Focus on purchasing contacts and supplier-side coordination. Do not invent internal account managers."
	case "vendor":
		return "Focus on sales-side contact details for the seller. Customer numbers are usually internal and should stay empty unless explicitly provided."
	case "sales_platform":
		return "Focus on the platform's public company or support details. Customer numbers are usually unknown and should stay empty."
	default:
		return ""
	}
}

func mapStringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return ""
	}
}

func fallbackVendorAssistantMessage(result SuggestVendorResult, locale string) string {
	if len(result.Questions) > 0 {
		return strings.Join(result.Questions, "\n\n")
	}
	if len(result.Notes) > 0 {
		return strings.Join(result.Notes, "\n\n")
	}
	if vendorProposalHasData(result.Vendor) {
		if localePrefersGerman(locale) {
			return "Ich habe passende Stammdaten-Vorschläge vorbereitet."
		}
		return "I prepared a few master-data suggestions."
	}
	if localePrefersGerman(locale) {
		return "Ich konnte gerade keine belastbaren Stammdaten ergänzen."
	}
	return "I couldn't find reliable master-data details to add right now."
}

func vendorProposalHasData(proposal AIVendorProposal) bool {
	return proposal.Name != "" ||
		proposal.Website != "" ||
		proposal.ExternalLogoURL != "" ||
		proposal.Email != "" ||
		proposal.Phone != "" ||
		proposal.ContactPerson != "" ||
		proposal.CustomerNumber != "" ||
		proposal.AccountManager != "" ||
		proposal.SupportEmail != "" ||
		proposal.SupportPhone != "" ||
		proposal.SupportURL != "" ||
		proposal.Address != nil
}

func normalizeVendorProposal(proposal *AIVendorProposal) {
	if proposal == nil {
		return
	}
	proposal.Name = strings.TrimSpace(proposal.Name)
	proposal.Website = strings.TrimSpace(proposal.Website)
	proposal.ExternalLogoURL = strings.TrimSpace(proposal.ExternalLogoURL)
	proposal.Email = strings.TrimSpace(proposal.Email)
	proposal.Phone = strings.TrimSpace(proposal.Phone)
	proposal.ContactPerson = strings.TrimSpace(proposal.ContactPerson)
	proposal.CustomerNumber = strings.TrimSpace(proposal.CustomerNumber)
	proposal.AccountManager = strings.TrimSpace(proposal.AccountManager)
	proposal.SupportEmail = strings.TrimSpace(proposal.SupportEmail)
	proposal.SupportPhone = strings.TrimSpace(proposal.SupportPhone)
	proposal.SupportURL = strings.TrimSpace(proposal.SupportURL)
	if proposal.Address != nil {
		proposal.Address.Street = strings.TrimSpace(proposal.Address.Street)
		proposal.Address.HouseNumber = strings.TrimSpace(proposal.Address.HouseNumber)
		proposal.Address.ZIP = strings.TrimSpace(proposal.Address.ZIP)
		proposal.Address.City = strings.TrimSpace(proposal.Address.City)
		if proposal.Address.Street == "" && proposal.Address.HouseNumber == "" && proposal.Address.ZIP == "" && proposal.Address.City == "" {
			proposal.Address = nil
		}
	}
}
