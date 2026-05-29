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
	g.Use(middleware.Auth(), middleware.RequirePermission("items.write"))
	g.POST("/parse-item-intent", parseItemIntent)
	g.POST("/parse-item-intent/stream", parseItemIntentStream)
	g.POST("/temp-image", uploadAITempImage)
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
