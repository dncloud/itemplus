package ai

import (
	"encoding/json"
	"strings"
)

func PlanInventoryLookup(settings AISettings, req ChatRequest) (*InventoryLookupPlan, error) {
	cfg, err := resolveAIConfig(settings, generateTimeoutForProvider(settings.Provider))
	if err != nil {
		return nil, err
	}

	input := buildChatInput(req.Messages, req.AppContext)
	if strings.TrimSpace(input) == "" {
		return nil, nil
	}

	outputText, _, _, err := generateAIText(
		cfg.Client,
		cfg.BaseURL,
		cfg.Provider,
		cfg.Model,
		settings.APIKey,
		buildInventoryLookupPlannerInstructions(req.Locale, cfg.Provider),
		input,
		false,
		nil,
		buildInventoryLookupPlanJSONSchema(),
		nil,
	)
	if err != nil {
		return nil, err
	}

	jsonText := extractFirstJSONObject(outputText)
	if strings.TrimSpace(jsonText) == "" {
		return nil, nil
	}

	var plan InventoryLookupPlan
	if err := json.Unmarshal([]byte(jsonText), &plan); err != nil {
		return nil, err
	}

	normalizeInventoryLookupPlan(&plan)
	if !plan.NeedsLookup || plan.Request == nil {
		return nil, nil
	}
	return &plan, nil
}

func normalizeInventoryLookupPlan(plan *InventoryLookupPlan) {
	if plan == nil {
		return
	}
	plan.Reason = strings.TrimSpace(plan.Reason)
	if !plan.NeedsLookup || plan.Request == nil {
		plan.NeedsLookup = false
		plan.Request = nil
		return
	}

	request := plan.Request
	request.Kind = strings.ToLower(strings.TrimSpace(request.Kind))
	request.Realm = strings.ToLower(strings.TrimSpace(request.Realm))
	request.Search = strings.TrimSpace(request.Search)
	request.LocationName = strings.TrimSpace(request.LocationName)
	request.CategoryName = strings.TrimSpace(request.CategoryName)
	request.UserName = strings.TrimSpace(request.UserName)
	request.Status = strings.ToLower(strings.TrimSpace(request.Status))
	request.StockState = strings.ToLower(strings.TrimSpace(request.StockState))

	if request.Kind != "items" && request.Kind != "checkouts" {
		plan.NeedsLookup = false
		plan.Request = nil
		return
	}
	if request.Realm != "archive" && request.Realm != "collection" {
		request.Realm = "all"
	}
	switch request.StockState {
	case "", "low_stock", "out_of_stock":
	default:
		request.StockState = ""
	}
	if request.Limit <= 0 {
		request.Limit = 8
	}
	if request.Limit > 20 {
		request.Limit = 20
	}
}
