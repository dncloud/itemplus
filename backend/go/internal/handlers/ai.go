package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
	"github.com/itemplus/backend/internal/services"
)

func RegisterAIRoutes(g *gin.RouterGroup) {
	g.Use(middleware.Auth())
	g.POST("/parse-item-intent", middleware.RequirePermission("items.write"), parseItemIntent)
	g.POST("/parse-item-intent/stream", middleware.RequirePermission("items.write"), parseItemIntentStream)
	g.POST("/suggest-category-properties", middleware.RequirePermission("categories.write"), suggestCategoryProperties)
	g.POST("/suggest-property-enhancement", middleware.RequirePermission("categories.write"), suggestPropertyEnhancement)
	g.POST("/temp-image", middleware.RequirePermission("items.write"), uploadAITempImage)
	g.GET("/temp-image/:id", middleware.RequirePermission("items.write"), getAITempImage)
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
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"detail": err.Error()})
		return
	}

	user := middleware.GetUser(c)
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
		_ = emit(services.AIStreamEvent{Type: "error", Message: err.Error()})
		return
	}

	user := middleware.GetUser(c)
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
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"detail": err.Error()})
		return
	}

	user := middleware.GetUser(c)
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
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"detail": err.Error()})
		return
	}

	user := middleware.GetUser(c)
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
