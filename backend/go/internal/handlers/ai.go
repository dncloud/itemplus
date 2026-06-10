package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
	"github.com/itemplus/backend/internal/services"
)

func RegisterAIRoutes(g *gin.RouterGroup) {
	g.Use(middleware.Auth())
	g.POST("/chat/stream", chatWithAIStream)
	g.POST("/parse-item-intent", middleware.RequirePermission("items.write"), parseItemIntent)
	g.POST("/parse-item-intent/stream", middleware.RequirePermission("items.write"), parseItemIntentStream)
	g.POST("/suggest-category-properties", middleware.RequirePermission("categories.write"), suggestCategoryProperties)
	g.POST("/suggest-property-enhancement", middleware.RequirePermission("categories.write"), suggestPropertyEnhancement)
	g.POST("/temp-image", middleware.RequirePermission("items.write"), uploadAITempImage)
	g.GET("/temp-image/:id", middleware.RequirePermission("items.write"), getAITempImage)
}

func renderAIGatewayError(c *gin.Context, err error) {
	var debugErr *services.AIDebugError
	if errors.As(err, &debugErr) {
		c.JSON(http.StatusBadGateway, gin.H{
			"detail":    debugErr.Error(),
			"raw_debug": debugErr.RawDebug,
			"usage":     debugErr.Usage,
		})
		return
	}
	c.JSON(http.StatusBadGateway, gin.H{"detail": err.Error()})
}

func aiUsageFromError(err error) *services.AIUsage {
	var debugErr *services.AIDebugError
	if errors.As(err, &debugErr) {
		return debugErr.Usage
	}
	return nil
}

func recordAIUsageEvent(user *middleware.User, settings services.AISettings, feature string, transport string, success bool, usage *services.AIUsage, recordErr error) {
	var userID any
	if user != nil {
		userID = user.ID
	}

	inputTokens := 0
	outputTokens := 0
	totalTokens := 0
	reasoningTokens := 0
	webSearchRequests := 0
	webFetchRequests := 0
	if usage != nil {
		inputTokens = usage.InputTokens
		outputTokens = usage.OutputTokens
		totalTokens = usage.TotalTokens
		reasoningTokens = usage.ReasoningTokens
		webSearchRequests = usage.WebSearchRequests
		webFetchRequests = usage.WebFetchRequests
	}

	errorText := ""
	if recordErr != nil {
		errorText = trimAIUsageError(recordErr.Error())
	}

	if _, err := database.DB.Exec(
		`INSERT INTO ai_usage_events (
			user_id, profile_id, profile_name, provider, model, feature, transport, success, error,
			input_tokens, output_tokens, total_tokens, reasoning_tokens, web_search_requests, web_fetch_requests, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		userID,
		settings.ProfileID,
		settings.ProfileName,
		settings.Provider,
		settings.Model,
		feature,
		transport,
		success,
		errorText,
		inputTokens,
		outputTokens,
		totalTokens,
		reasoningTokens,
		webSearchRequests,
		webFetchRequests,
		database.TimestampNow(),
	); err != nil {
		fmt.Printf("AI usage event could not be recorded: %v\n", err)
	}
}

func trimAIUsageError(value string) string {
	value = strings.TrimSpace(value)
	if len(value) <= 1000 {
		return value
	}
	return value[:1000]
}

func chatWithAIStream(c *gin.Context) {
	var body struct {
		Messages       []services.ChatMessage `json:"messages"`
		Locale         string                 `json:"locale"`
		AllowWebSearch bool                   `json:"allow_web_search"`
		TempImageID    string                 `json:"temp_image_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}
	if len(body.Messages) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "At least one message is required"})
		return
	}

	settings := loadAISettingsWithSecret()
	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Streaming not supported"})
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	c.Status(http.StatusOK)
	flusher.Flush()

	emit := func(event services.AIStreamEvent) error {
		payload, err := json.Marshal(event)
		if err != nil {
			return err
		}
		if _, err := c.Writer.Write([]byte("data: " + string(payload) + "\n\n")); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}

	appContext := buildAIChatAppContext(c)
	chatRequest := services.ChatRequest{
		Messages:       body.Messages,
		Locale:         body.Locale,
		AllowWebSearch: body.AllowWebSearch,
		TempImageID:    body.TempImageID,
		AppContext:     appContext,
	}

	if lookupPlan, lookupErr := services.PlanInventoryLookup(settings, chatRequest); lookupErr == nil && lookupPlan != nil && lookupPlan.Request != nil {
		if lookupResult, err := runAIInventoryLookup(middleware.GetUser(c), lookupPlan.Request); err == nil && len(lookupResult) > 0 {
			appContext["inventory_lookup"] = lookupResult
			chatRequest.AppContext = appContext
		}
	}

	user := middleware.GetUser(c)
	result, err := services.ChatWithAIStream(settings, chatRequest, emit)
	if err != nil {
		recordAIUsageEvent(user, settings, "chat", "", false, aiUsageFromError(err), err)
		_ = emit(services.AIStreamEvent{Type: "error", Message: err.Error()})
		return
	}

	recordAIUsageEvent(user, settings, "chat", result.Transport, true, result.Usage, nil)
	audit(user.ID, "ai.chat", fmt.Sprintf("profile=%s provider=%s model=%s", settings.ProfileID, settings.Provider, settings.Model))
	_ = emit(services.AIStreamEvent{
		Type: "done",
		Result: &services.ParseItemIntentResult{
			AssistantMessage: result.AssistantMessage,
			Transport:        result.Transport,
			Model:            result.Model,
			Provider:         result.Provider,
			Usage:            result.Usage,
			Context:          result.Context,
		},
	})
}

func buildAIChatAppContext(c *gin.Context) map[string]any {
	user := middleware.GetUser(c)
	if user == nil {
		return nil
	}

	displayName := ""
	if user.DisplayName != nil {
		displayName = strings.TrimSpace(*user.DisplayName)
	}
	email := ""
	if user.Email != nil {
		email = strings.TrimSpace(*user.Email)
	}

	return map[string]any{
		"current_user": map[string]any{
			"id":           user.ID,
			"display_name": displayName,
			"email":        email,
			"is_admin":     user.IsAdmin,
			"permissions":  user.PermissionList(),
		},
	}
}

func runAIInventoryLookup(user *middleware.User, request *services.InventoryLookupRequest) (map[string]any, error) {
	if user == nil || request == nil {
		return nil, nil
	}

	realms := inventoryLookupRealms(request.Realm)
	if len(realms) == 0 {
		return nil, nil
	}

	result := map[string]any{
		"tool":    "inventory.lookup",
		"request": request,
	}

	switch request.Kind {
	case "items":
		if !user.HasPermission("items.read") {
			return nil, nil
		}
		rows := make([]map[string]any, 0)
		totalMatches := int64(0)
		totalQuantity := int64(0)
		totalActiveCheckouts := int64(0)
		for _, realm := range realms {
			realmRows, realmSummary, err := lookupInventoryItems(user, realm, request)
			if err != nil {
				return nil, err
			}
			rows = append(rows, realmRows...)
			totalMatches += realmSummary.TotalMatches
			totalQuantity += realmSummary.TotalQuantity
			totalActiveCheckouts += realmSummary.TotalActiveCheckouts
		}
		sort.Slice(rows, func(i, j int) bool {
			leftName, _ := rows[i]["name"].(string)
			rightName, _ := rows[j]["name"].(string)
			if leftName == rightName {
				leftRealm, _ := rows[i]["realm"].(string)
				rightRealm, _ := rows[j]["realm"].(string)
				return leftRealm < rightRealm
			}
			return strings.ToLower(leftName) < strings.ToLower(rightName)
		})
		if limit := normalizedInventoryLookupLimit(request.Limit); len(rows) > limit {
			rows = rows[:limit]
		}
		summary := map[string]any{
			"total_matches":      totalMatches,
			"total_quantity":     totalQuantity,
			"returned_row_count": len(rows),
		}
		if user.IsAdmin {
			summary["total_active_checkouts"] = totalActiveCheckouts
		}
		result["summary"] = summary
		result["rows"] = rows
	case "checkouts":
		rows := make([]map[string]any, 0)
		totalMatches := int64(0)
		overdueCount := int64(0)
		for _, realm := range realms {
			realmRows, realmSummary, err := lookupInventoryCheckouts(user, realm, request)
			if err != nil {
				return nil, err
			}
			rows = append(rows, realmRows...)
			totalMatches += realmSummary.TotalMatches
			overdueCount += realmSummary.OverdueCount
		}
		sort.Slice(rows, func(i, j int) bool {
			leftOverdue, _ := rows[i]["is_overdue"].(bool)
			rightOverdue, _ := rows[j]["is_overdue"].(bool)
			if leftOverdue != rightOverdue {
				return leftOverdue
			}
			leftName, _ := rows[i]["item_name"].(string)
			rightName, _ := rows[j]["item_name"].(string)
			if leftName == rightName {
				leftRealm, _ := rows[i]["realm"].(string)
				rightRealm, _ := rows[j]["realm"].(string)
				return leftRealm < rightRealm
			}
			return strings.ToLower(leftName) < strings.ToLower(rightName)
		})
		if limit := normalizedInventoryLookupLimit(request.Limit); len(rows) > limit {
			rows = rows[:limit]
		}
		result["summary"] = map[string]any{
			"total_matches":      totalMatches,
			"overdue_count":      overdueCount,
			"returned_row_count": len(rows),
		}
		result["rows"] = rows
	default:
		return nil, nil
	}

	return result, nil
}

type inventoryItemLookupSummary struct {
	TotalMatches         int64
	TotalQuantity        int64
	TotalActiveCheckouts int64
}

type inventoryCheckoutLookupSummary struct {
	TotalMatches int64
	OverdueCount int64
}

func inventoryLookupRealms(realm string) []string {
	switch strings.ToLower(strings.TrimSpace(realm)) {
	case "archive":
		return []string{"archive"}
	case "collection":
		return []string{"collection"}
	default:
		return []string{"archive", "collection"}
	}
}

func normalizedInventoryLookupLimit(limit int) int {
	if limit <= 0 {
		return 8
	}
	if limit > 20 {
		return 20
	}
	return limit
}

func lookupInventoryItems(user *middleware.User, realm string, request *services.InventoryLookupRequest) ([]map[string]any, inventoryItemLookupSummary, error) {
	rows := make([]map[string]any, 0)
	summary := inventoryItemLookupSummary{}
	if request == nil {
		return rows, summary, nil
	}

	propsTable := realm + "_item_properties"
	propDefsTable := realm + "_properties"
	checkoutTable := realm + "_checkouts"
	limit := normalizedInventoryLookupLimit(request.Limit)

	baseQuery := fmt.Sprintf(` FROM %s_items i
		LEFT JOIN %s_locations l ON i.location_id = l.id
		LEFT JOIN %s_categories c ON i.category_id = c.id
		LEFT JOIN %s_manufacturers m ON i.manufacturer_id = m.id
		LEFT JOIN %s_suppliers s ON i.supplier_id = s.id
		LEFT JOIN %s_vendors v ON i.vendor_id = v.id
		LEFT JOIN generic_sales_platforms sp ON i.sales_platform_id = sp.id`,
		realm, realm, realm, realm, realm, realm)

	conditions := make([]string, 0)
	args := make([]any, 0)

	if search := strings.TrimSpace(strings.ToLower(request.Search)); search != "" {
		like := "%" + search + "%"
		conditions = append(conditions, fmt.Sprintf(`(
			LOWER(i.name) LIKE ? OR
			LOWER(COALESCE(i.description, '')) LIKE ? OR
			LOWER(COALESCE(l.name, '')) LIKE ? OR
			LOWER(COALESCE(c.name, '')) LIKE ? OR
			EXISTS (
				SELECT 1 FROM %s ip
				WHERE ip.item_id = i.id AND LOWER(COALESCE(ip.value, '')) LIKE ?
			)
		)`, propsTable))
		args = append(args, like, like, like, like, like)
	}
	if locationName := strings.TrimSpace(strings.ToLower(request.LocationName)); locationName != "" {
		conditions = append(conditions, "LOWER(COALESCE(l.name, '')) LIKE ?")
		args = append(args, "%"+locationName+"%")
	}
	if categoryName := strings.TrimSpace(strings.ToLower(request.CategoryName)); categoryName != "" {
		conditions = append(conditions, "LOWER(COALESCE(c.name, '')) LIKE ?")
		args = append(args, "%"+categoryName+"%")
	}
	if status := strings.TrimSpace(strings.ToLower(request.Status)); status != "" && status != "all" {
		if status == "checked_out" {
			conditions = append(conditions, fmt.Sprintf("EXISTS (SELECT 1 FROM %s co WHERE co.item_id = i.id AND co.status = 'active')", checkoutTable))
		} else {
			conditions = append(conditions, "LOWER(COALESCE(i.item_status, '')) = ?")
			args = append(args, status)
		}
	}
	switch strings.TrimSpace(strings.ToLower(request.StockState)) {
	case "low_stock":
		conditions = append(conditions, "COALESCE(i.min_quantity, 0) > 0 AND COALESCE(i.quantity, 0) <= COALESCE(i.min_quantity, 0)")
	case "out_of_stock":
		conditions = append(conditions, "COALESCE(i.quantity, 0) <= 0")
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = " WHERE " + strings.Join(conditions, " AND ")
	}

	countQuery := "SELECT COUNT(*), COALESCE(SUM(i.quantity), 0), COALESCE(SUM((SELECT COUNT(*) FROM " + checkoutTable + " co WHERE co.item_id = i.id AND co.status = 'active')), 0)" + baseQuery + whereClause
	if err := database.DB.QueryRow(countQuery, args...).Scan(&summary.TotalMatches, &summary.TotalQuantity, &summary.TotalActiveCheckouts); err != nil {
		return nil, summary, err
	}

	query := fmt.Sprintf(`SELECT i.id, i.name, i.description, i.quantity, i.min_quantity,
		i.item_status, i.serial_number, i.barcode, i.purchase_date, i.purchase_price, i.estimated_value, i.is_bundle,
		COALESCE(l.name, '') AS location_name,
		COALESCE(c.name, '') AS category_name,
		COALESCE(m.name, '') AS manufacturer_name,
		COALESCE(s.name, '') AS supplier_name,
		COALESCE(v.name, '') AS vendor_name,
		COALESCE(sp.name, '') AS sales_platform_name,
		COALESCE((SELECT COUNT(*) FROM %s co WHERE co.item_id = i.id AND co.status = 'active'), 0) AS active_checkout_count
		%s%s
		ORDER BY i.name ASC, i.id ASC
		LIMIT ?`, checkoutTable, baseQuery, whereClause)
	queryArgs := append(append([]any{}, args...), limit)
	queryRows, err := database.DB.Queryx(query, queryArgs...)
	if err != nil {
		return nil, summary, err
	}
	defer queryRows.Close()

	itemIDs := make([]interface{}, 0, limit)
	for queryRows.Next() {
		row := map[string]any{}
		if queryRows.MapScan(row) != nil {
			continue
		}
		cleanRow(row)
		row["realm"] = realm
		if !user.IsAdmin {
			delete(row, "active_checkout_count")
		}
		itemIDs = append(itemIDs, row["id"])
		rows = append(rows, row)
	}

	propsByItem := loadListItemProperties(propsTable, propDefsTable, itemIDs)
	applyInventoryLookupItemEnrichment(rows, propsByItem)

	return rows, summary, queryRows.Err()
}

func applyInventoryLookupItemEnrichment(items []map[string]any, propsByItem map[interface{}][]map[string]interface{}) {
	for _, item := range items {
		id := item["id"]
		if props, ok := propsByItem[id]; ok {
			byID := map[string]interface{}{}
			byName := map[string]interface{}{}
			for _, p := range props {
				propID := fmt.Sprintf("%v", p["property_id"])
				propName, _ := p["property_name"].(string)
				val := parseJSONValue(p["value"])
				byID[propID] = val
				if propName != "" {
					byName[propName] = formatWithUnit(val, p["property_unit"])
				}
			}
			item["properties"] = byID
			item["properties_display"] = byName
		} else {
			item["properties"] = map[string]interface{}{}
			item["properties_display"] = map[string]interface{}{}
		}

		quantity, quantityOK := inventoryLookupInt64(item["quantity"])
		minQuantity, minQuantityOK := inventoryLookupInt64(item["min_quantity"])
		item["stock"] = map[string]any{
			"quantity":      quantity,
			"min_quantity":  minQuantity,
			"has_min_stock": minQuantityOK,
			"is_low_stock":  quantityOK && minQuantityOK && quantity <= minQuantity,
		}

		item["master_data"] = map[string]any{
			"category_name":       item["category_name"],
			"location_name":       item["location_name"],
			"manufacturer_name":   item["manufacturer_name"],
			"supplier_name":       item["supplier_name"],
			"vendor_name":         item["vendor_name"],
			"sales_platform_name": item["sales_platform_name"],
			"serial_number":       item["serial_number"],
			"barcode":             item["barcode"],
			"purchase_date":       item["purchase_date"],
			"purchase_price":      item["purchase_price"],
			"estimated_value":     item["estimated_value"],
			"item_status":         item["item_status"],
			"is_bundle":           item["is_bundle"],
		}
	}
}

func inventoryLookupInt64(value any) (int64, bool) {
	switch v := value.(type) {
	case int:
		return int64(v), true
	case int8:
		return int64(v), true
	case int16:
		return int64(v), true
	case int32:
		return int64(v), true
	case int64:
		return v, true
	case float32:
		return int64(v), true
	case float64:
		return int64(v), true
	default:
		return 0, false
	}
}

func lookupInventoryCheckouts(user *middleware.User, realm string, request *services.InventoryLookupRequest) ([]map[string]any, inventoryCheckoutLookupSummary, error) {
	rows := make([]map[string]any, 0)
	summary := inventoryCheckoutLookupSummary{}
	if user == nil || request == nil {
		return rows, summary, nil
	}

	limit := normalizedInventoryLookupLimit(request.Limit)
	baseQuery := fmt.Sprintf(` FROM %s_checkouts co
		JOIN %s_items i ON co.item_id = i.id
		LEFT JOIN %s_locations l ON i.location_id = l.id
		LEFT JOIN %s_categories c ON i.category_id = c.id
		LEFT JOIN users u ON co.user_id = u.id`,
		realm, realm, realm, realm)

	conditions := make([]string, 0)
	args := make([]any, 0)

	status := strings.TrimSpace(strings.ToLower(request.Status))
	switch status {
	case "", "active":
		conditions = append(conditions, "co.status = 'active'")
	case "returned":
		conditions = append(conditions, "co.status = 'returned'")
	case "all":
	default:
		conditions = append(conditions, "LOWER(COALESCE(co.status, '')) = ?")
		args = append(args, status)
	}

	if search := strings.TrimSpace(strings.ToLower(request.Search)); search != "" {
		like := "%" + search + "%"
		conditions = append(conditions, `(LOWER(i.name) LIKE ? OR LOWER(COALESCE(co.notes, '')) LIKE ? OR LOWER(COALESCE(l.name, '')) LIKE ? OR LOWER(COALESCE(c.name, '')) LIKE ? OR LOWER(COALESCE(u.display_name, u.email, '')) LIKE ?)`)
		args = append(args, like, like, like, like, like)
	}
	if locationName := strings.TrimSpace(strings.ToLower(request.LocationName)); locationName != "" {
		conditions = append(conditions, "LOWER(COALESCE(l.name, '')) LIKE ?")
		args = append(args, "%"+locationName+"%")
	}
	if categoryName := strings.TrimSpace(strings.ToLower(request.CategoryName)); categoryName != "" {
		conditions = append(conditions, "LOWER(COALESCE(c.name, '')) LIKE ?")
		args = append(args, "%"+categoryName+"%")
	}
	if userName := strings.TrimSpace(strings.ToLower(request.UserName)); userName != "" {
		conditions = append(conditions, "LOWER(COALESCE(u.display_name, u.email, '')) LIKE ?")
		args = append(args, "%"+userName+"%")
	}
	if !user.IsAdmin {
		conditions = append(conditions, "co.user_id = ?")
		args = append(args, user.ID)
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = " WHERE " + strings.Join(conditions, " AND ")
	}

	countQuery := "SELECT COUNT(*)" + baseQuery + whereClause
	if err := database.DB.QueryRow(countQuery, args...).Scan(&summary.TotalMatches); err != nil {
		return nil, summary, err
	}

	query := "SELECT co.id, co.item_id, co.user_id, co.status, co.due_date, co.returned_at, co.notes, co.created_at, i.name AS item_name, COALESCE(l.name, '') AS location_name, COALESCE(c.name, '') AS category_name, COALESCE(u.display_name, u.email, '') AS user_name" + baseQuery + whereClause + " ORDER BY co.created_at DESC, co.id DESC LIMIT ?"
	queryArgs := append(append([]any{}, args...), limit)
	queryRows, err := database.DB.Queryx(query, queryArgs...)
	if err != nil {
		return nil, summary, err
	}
	defer queryRows.Close()

	for queryRows.Next() {
		row := map[string]any{}
		if queryRows.MapScan(row) != nil {
			continue
		}
		cleanRow(row)
		enrichCheckout(row, realm)
		row["realm"] = realm
		if !user.IsAdmin {
			delete(row, "user_name")
		} else {
			name, _ := row["user_name"].(string)
			if strings.TrimSpace(name) == "" {
				if userID, ok := aiMapInt64(row["user_id"]); ok && userID > 0 {
					row["user_name"] = fmt.Sprintf("User #%d", userID)
				}
			}
		}
		if overdue, ok := row["is_overdue"].(bool); ok && overdue {
			summary.OverdueCount++
		}
		rows = append(rows, row)
	}

	return rows, summary, queryRows.Err()
}

func parseItemIntent(c *gin.Context) {
	var body struct {
		Realm              string `json:"realm"`
		Prompt             string `json:"prompt"`
		Barcode            string `json:"barcode"`
		TempImageID        string `json:"temp_image_id"`
		AllowWebSearch     bool   `json:"allow_web_search"`
		IdentifyOnly       bool   `json:"identify_only"`
		Locale             string `json:"locale"`
		SelectedCategoryID *int64 `json:"selected_category_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	realm := strings.ToLower(strings.TrimSpace(body.Realm))
	if realm != "archive" && realm != "collection" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid realm"})
		return
	}
	if strings.TrimSpace(body.Prompt) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Prompt is required"})
		return
	}

	settings := loadAISettingsWithSecret()
	categories, err := loadAIContextCategories(realm)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not load categories"})
		return
	}
	properties, err := loadAIContextProperties(realm)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not load properties"})
		return
	}

	result, err := services.ParseItemIntent(settings, services.ParseItemIntentRequest{
		Realm:              realm,
		Prompt:             body.Prompt,
		Barcode:            body.Barcode,
		TempImageID:        body.TempImageID,
		AllowWebSearch:     body.AllowWebSearch,
		IdentifyOnly:       body.IdentifyOnly,
		Locale:             body.Locale,
		SelectedCategoryID: body.SelectedCategoryID,
		Categories:         categories,
		Properties:         properties,
	})
	user := middleware.GetUser(c)
	if err != nil {
		recordAIUsageEvent(user, settings, "parse_item", "", false, aiUsageFromError(err), err)
		c.JSON(http.StatusBadGateway, gin.H{"detail": err.Error()})
		return
	}

	recordAIUsageEvent(user, settings, "parse_item", result.Transport, true, result.Usage, nil)
	audit(user.ID, "ai.parse_item_intent", fmt.Sprintf("realm=%s", realm))
	c.JSON(http.StatusOK, result)
}

func parseItemIntentStream(c *gin.Context) {
	var body struct {
		Realm              string `json:"realm"`
		Prompt             string `json:"prompt"`
		Barcode            string `json:"barcode"`
		TempImageID        string `json:"temp_image_id"`
		AllowWebSearch     bool   `json:"allow_web_search"`
		IdentifyOnly       bool   `json:"identify_only"`
		Locale             string `json:"locale"`
		SelectedCategoryID *int64 `json:"selected_category_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	realm := strings.ToLower(strings.TrimSpace(body.Realm))
	if realm != "archive" && realm != "collection" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid realm"})
		return
	}
	if strings.TrimSpace(body.Prompt) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Prompt is required"})
		return
	}

	settings := loadAISettingsWithSecret()
	categories, err := loadAIContextCategories(realm)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not load categories"})
		return
	}
	properties, err := loadAIContextProperties(realm)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not load properties"})
		return
	}

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Streaming not supported"})
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	c.Status(http.StatusOK)
	flusher.Flush()

	emit := func(event services.AIStreamEvent) error {
		payload, err := json.Marshal(event)
		if err != nil {
			return err
		}
		if _, err := c.Writer.Write([]byte("data: " + string(payload) + "\n\n")); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}

	user := middleware.GetUser(c)
	result, err := services.ParseItemIntentStream(settings, services.ParseItemIntentRequest{
		Realm:              realm,
		Prompt:             body.Prompt,
		Barcode:            body.Barcode,
		TempImageID:        body.TempImageID,
		AllowWebSearch:     body.AllowWebSearch,
		IdentifyOnly:       body.IdentifyOnly,
		Locale:             body.Locale,
		SelectedCategoryID: body.SelectedCategoryID,
		Categories:         categories,
		Properties:         properties,
	}, emit)
	if err != nil {
		recordAIUsageEvent(user, settings, "parse_item", "", false, aiUsageFromError(err), err)
		_ = emit(services.AIStreamEvent{Type: "error", Message: err.Error()})
		return
	}

	recordAIUsageEvent(user, settings, "parse_item", result.Transport, true, result.Usage, nil)
	audit(user.ID, "ai.parse_item_intent", fmt.Sprintf("realm=%s", realm))
	_ = emit(services.AIStreamEvent{Type: "done", Result: result})
}

func suggestCategoryProperties(c *gin.Context) {
	var body struct {
		Realm          string `json:"realm"`
		Prompt         string `json:"prompt"`
		AllowWebSearch bool   `json:"allow_web_search"`
		Locale         string `json:"locale"`
		CategoryID     int64  `json:"category_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	realm := strings.ToLower(strings.TrimSpace(body.Realm))
	if realm != "archive" && realm != "collection" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid realm"})
		return
	}
	if body.CategoryID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Category is required"})
		return
	}
	if strings.TrimSpace(body.Prompt) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Prompt is required"})
		return
	}

	category, err := loadAICategoryByID(realm, body.CategoryID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not load category"})
		return
	}
	if len(category) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Category not found"})
		return
	}
	properties, err := loadAIPropertiesForCategory(realm, body.CategoryID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not load category properties"})
		return
	}

	settings := loadAISettingsWithSecret()
	result, err := services.SuggestCategoryProperties(settings, services.SuggestCategoryPropertiesRequest{
		Realm:              realm,
		Prompt:             body.Prompt,
		AllowWebSearch:     body.AllowWebSearch,
		Locale:             body.Locale,
		Category:           category,
		ExistingProperties: properties,
	})
	user := middleware.GetUser(c)
	if err != nil {
		recordAIUsageEvent(user, settings, "category_properties", "", false, aiUsageFromError(err), err)
		renderAIGatewayError(c, err)
		return
	}

	recordAIUsageEvent(user, settings, "category_properties", result.Transport, true, result.Usage, nil)
	audit(user.ID, "ai.suggest_category_properties", fmt.Sprintf("realm=%s category_id=%d", realm, body.CategoryID))
	c.JSON(http.StatusOK, result)
}

func suggestPropertyEnhancement(c *gin.Context) {
	var body struct {
		Realm          string `json:"realm"`
		Prompt         string `json:"prompt"`
		AllowWebSearch bool   `json:"allow_web_search"`
		Locale         string `json:"locale"`
		CategoryID     int64  `json:"category_id"`
		PropertyID     int64  `json:"property_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	realm := strings.ToLower(strings.TrimSpace(body.Realm))
	if realm != "archive" && realm != "collection" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid realm"})
		return
	}
	if body.CategoryID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Category is required"})
		return
	}
	if body.PropertyID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Property is required"})
		return
	}
	if strings.TrimSpace(body.Prompt) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Prompt is required"})
		return
	}

	category, err := loadAICategoryByID(realm, body.CategoryID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not load category"})
		return
	}
	if len(category) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Category not found"})
		return
	}
	property, err := loadAIPropertyByID(realm, body.PropertyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not load property"})
		return
	}
	if len(property) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Property not found"})
		return
	}
	propertyCategoryID, _ := aiMapInt64(property["category_id"])
	if propertyCategoryID != body.CategoryID {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Property does not belong to category"})
		return
	}
	properties, err := loadAIPropertiesForCategory(realm, body.CategoryID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not load category properties"})
		return
	}

	settings := loadAISettingsWithSecret()
	result, err := services.SuggestPropertyEnhancement(settings, services.SuggestPropertyEnhancementRequest{
		Realm:              realm,
		Prompt:             body.Prompt,
		AllowWebSearch:     body.AllowWebSearch,
		Locale:             body.Locale,
		Category:           category,
		Property:           property,
		ExistingProperties: properties,
	})
	user := middleware.GetUser(c)
	if err != nil {
		recordAIUsageEvent(user, settings, "property_enhancement", "", false, aiUsageFromError(err), err)
		renderAIGatewayError(c, err)
		return
	}

	recordAIUsageEvent(user, settings, "property_enhancement", result.Transport, true, result.Usage, nil)
	audit(user.ID, "ai.suggest_property_enhancement", fmt.Sprintf("realm=%s category_id=%d property_id=%d", realm, body.CategoryID, body.PropertyID))
	c.JSON(http.StatusOK, result)
}

func loadAIContextCategories(realm string) ([]map[string]any, error) {
	rows, err := database.DB.Queryx(fmt.Sprintf("SELECT id, name, description, color FROM %s_categories ORDER BY position, id", realm))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]any
	for rows.Next() {
		row := map[string]any{}
		if rows.MapScan(row) == nil {
			cleanRow(row)
			result = append(result, row)
		}
	}
	if result == nil {
		result = []map[string]any{}
	}
	return result, nil
}

func loadAIContextProperties(realm string) ([]map[string]any, error) {
	rows, err := database.DB.Queryx(fmt.Sprintf("SELECT id, category_id, name, property_type, unit, options, required FROM %s_properties ORDER BY category_id, position, id", realm))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]any
	for rows.Next() {
		row := map[string]any{}
		if rows.MapScan(row) == nil {
			cleanRow(row)
			result = append(result, row)
		}
	}
	if result == nil {
		result = []map[string]any{}
	}
	return result, nil
}

func loadAICategoryByID(realm string, categoryID int64) (map[string]any, error) {
	row := map[string]any{}
	sqlRow := database.DB.QueryRowx(
		fmt.Sprintf("SELECT id, name, description, color FROM %s_categories WHERE id = ?", realm),
		categoryID,
	)
	if err := sqlRow.MapScan(row); err != nil {
		return nil, nil
	}
	cleanRow(row)
	return row, nil
}

func loadAIPropertiesForCategory(realm string, categoryID int64) ([]map[string]any, error) {
	rows, err := database.DB.Queryx(
		fmt.Sprintf("SELECT id, category_id, name, property_type, unit, options, required, show_in_list, display_width FROM %s_properties WHERE category_id = ? ORDER BY position, id", realm),
		categoryID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]any
	for rows.Next() {
		row := map[string]any{}
		if rows.MapScan(row) == nil {
			cleanRow(row)
			result = append(result, row)
		}
	}
	if result == nil {
		result = []map[string]any{}
	}
	return result, nil
}

func loadAIPropertyByID(realm string, propertyID int64) (map[string]any, error) {
	row := map[string]any{}
	sqlRow := database.DB.QueryRowx(
		fmt.Sprintf("SELECT id, category_id, name, property_type, unit, options, required, show_in_list, display_width FROM %s_properties WHERE id = ?", realm),
		propertyID,
	)
	if err := sqlRow.MapScan(row); err != nil {
		return nil, nil
	}
	cleanRow(row)
	return row, nil
}

func aiMapInt64(value any) (int64, bool) {
	switch v := value.(type) {
	case int64:
		return v, true
	case int:
		return int64(v), true
	case int32:
		return int64(v), true
	case float64:
		return int64(v), true
	default:
		return 0, false
	}
}

func uploadAITempImage(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "No file uploaded"})
		return
	}
	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Could not open file"})
		return
	}
	defer src.Close()

	data, err := io.ReadAll(src)
	if err != nil || len(data) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Could not read file"})
		return
	}

	mimeType := strings.TrimSpace(file.Header.Get("Content-Type"))
	if mimeType == "" {
		mimeType = http.DetectContentType(data)
	}
	if !strings.HasPrefix(mimeType, "image/") {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Only images are allowed"})
		return
	}

	tempID := services.SaveAITempImage(data, mimeType)
	c.JSON(http.StatusOK, gin.H{"temp_image_id": tempID})
}

func getAITempImage(c *gin.Context) {
	tempID := strings.TrimSpace(c.Param("id"))
	if tempID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Missing temp image id"})
		return
	}

	image, ok := services.GetAITempImage(tempID)
	if !ok || len(image.Data) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Temp image not found"})
		return
	}

	mimeType := strings.TrimSpace(image.MimeType)
	if mimeType == "" {
		mimeType = http.DetectContentType(image.Data)
	}

	c.Header("Cache-Control", "no-store")
	c.Data(http.StatusOK, mimeType, image.Data)
}
