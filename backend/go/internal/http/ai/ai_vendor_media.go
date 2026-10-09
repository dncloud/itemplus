package ai

import (
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	aicore "github.com/itemplus/backend/internal/core/ai"
	"github.com/itemplus/backend/internal/http/middleware"
)

func suggestVendor(c *gin.Context) {
	var body struct {
		Realm          string         `json:"realm"`
		EntityType     string         `json:"entity_type"`
		Prompt         string         `json:"prompt"`
		AllowWebSearch bool           `json:"allow_web_search"`
		Locale         string         `json:"locale"`
		Draft          map[string]any `json:"draft"`
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

	entityType := strings.ToLower(strings.TrimSpace(body.EntityType))
	switch entityType {
	case "manufacturer", "supplier", "vendor", "developer", "publisher", "sales_platform":
	default:
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid entity type"})
		return
	}

	if strings.TrimSpace(body.Prompt) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Prompt is required"})
		return
	}

	settings := loadAISettingsWithSecret()
	result, err := aicore.SuggestVendor(settings, aicore.SuggestVendorRequest{
		Realm:          realm,
		EntityType:     entityType,
		Prompt:         body.Prompt,
		AllowWebSearch: body.AllowWebSearch,
		Locale:         body.Locale,
		Draft:          body.Draft,
	})
	user := middleware.GetUser(c)
	if err != nil {
		recordAIUsageEvent(user, settings, "vendor_suggestions", "", false, aiUsageFromError(err), err)
		renderAIGatewayError(c, err)
		return
	}

	recordAIUsageEvent(user, settings, "vendor_suggestions", result.Transport, true, result.Usage, nil)
	middleware.Audit(user.ID, "ai.suggest_vendor", "realm="+realm+" entity_type="+entityType)
	c.JSON(http.StatusOK, result)
}

func resolveVendorLogo(c *gin.Context) {
	var body struct {
		Name            string `json:"name"`
		Website         string `json:"website"`
		SupportURL      string `json:"support_url"`
		ExternalLogoURL string `json:"external_logo_url"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	result, err := aicore.ResolveVendorLogoPreview(body.Name, body.Website, body.SupportURL, body.ExternalLogoURL)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"detail": err.Error()})
		return
	}

	user := middleware.GetUser(c)
	middleware.Audit(user.ID, "ai.resolve_vendor_logo", strings.TrimSpace(body.Website))
	c.JSON(http.StatusOK, result)
}

func uploadAITempImage(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "No file uploaded"})
		return
	}
	if file.Size > aicore.MaxAITempImageBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"detail": "Image is too large"})
		return
	}
	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Could not open file"})
		return
	}
	defer src.Close()

	// The declared size is not trusted either: read one byte past the limit.
	data, err := io.ReadAll(io.LimitReader(src, aicore.MaxAITempImageBytes+1))
	if err != nil || len(data) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Could not read file"})
		return
	}
	if len(data) > aicore.MaxAITempImageBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"detail": "Image is too large"})
		return
	}

	mimeType, ok := aicore.AITempImageType(data)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Only JPEG, PNG, GIF and WebP images are allowed"})
		return
	}

	tempID := aicore.SaveAITempImage(data, mimeType)
	c.JSON(http.StatusOK, gin.H{"temp_image_id": tempID})
}

func getAITempImage(c *gin.Context) {
	tempID := strings.TrimSpace(c.Param("id"))
	if tempID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Missing temp image id"})
		return
	}

	image, ok := aicore.GetAITempImage(tempID)
	if !ok || len(image.Data) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Temp image not found"})
		return
	}

	// Served with the type found in the content, never one a client chose.
	mimeType, ok := aicore.AITempImageType(image.Data)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Temp image not found"})
		return
	}

	c.Header("Cache-Control", "no-store")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Content-Security-Policy", "default-src 'none'; sandbox")
	c.Data(http.StatusOK, mimeType, image.Data)
}
