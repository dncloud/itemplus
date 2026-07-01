package ai

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	aicore "github.com/itemplus/backend/internal/core/ai"
	"github.com/itemplus/backend/internal/http/middleware"
)

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

	result, err := aicore.ParseItemIntent(settings, aicore.ParseItemIntentRequest{
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
	middleware.Audit(user.ID, "ai.parse_item_intent", fmt.Sprintf("realm=%s", realm))
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

	emit := func(event aicore.AIStreamEvent) error {
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
	result, err := aicore.ParseItemIntentStream(settings, aicore.ParseItemIntentRequest{
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
		_ = emit(aicore.AIStreamEvent{Type: "error", Message: err.Error()})
		return
	}

	recordAIUsageEvent(user, settings, "parse_item", result.Transport, true, result.Usage, nil)
	middleware.Audit(user.ID, "ai.parse_item_intent", fmt.Sprintf("realm=%s", realm))
	_ = emit(aicore.AIStreamEvent{Type: "done", Result: result})
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
	result, err := aicore.SuggestCategoryProperties(settings, aicore.SuggestCategoryPropertiesRequest{
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
	middleware.Audit(user.ID, "ai.suggest_category_properties", fmt.Sprintf("realm=%s category_id=%d", realm, body.CategoryID))
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
	result, err := aicore.SuggestPropertyEnhancement(settings, aicore.SuggestPropertyEnhancementRequest{
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
	middleware.Audit(user.ID, "ai.suggest_property_enhancement", fmt.Sprintf("realm=%s category_id=%d property_id=%d", realm, body.CategoryID, body.PropertyID))
	c.JSON(http.StatusOK, result)
}
