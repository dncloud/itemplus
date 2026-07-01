package ai

import (
	"net/http"

	"github.com/gin-gonic/gin"
	aicore "github.com/itemplus/backend/internal/core/ai"
	"github.com/itemplus/backend/internal/http/middleware"
)

var (
	AdminGetAISettings    = adminGetAISettings
	AdminUpdateAISettings = adminUpdateAISettings
	AdminTestAISettings   = adminTestAISettings
	AdminListAIModels     = adminListAIModels
)

func adminGetAISettings(c *gin.Context) {
	c.JSON(http.StatusOK, loadAISettings())
}

func adminUpdateAISettings(c *gin.Context) {
	activeProfileID, profiles, err := parseAISettingsPayload(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	if err := saveAISettingsBundle(activeProfileID, profiles); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not save AI settings"})
		return
	}

	user := middleware.GetUser(c)
	middleware.Audit(user.ID, "ai.settings.update", "AI settings updated")
	c.JSON(http.StatusOK, loadAISettings())
}

func adminTestAISettings(c *gin.Context) {
	profile, err := parseAIProfilePayload(c, false)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	result, err := aicore.TestAIConnection(profile)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"detail": err.Error()})
		return
	}

	user := middleware.GetUser(c)
	middleware.Audit(user.ID, "ai.settings.test", "AI connection test succeeded")
	c.JSON(http.StatusOK, result)
}

func adminListAIModels(c *gin.Context) {
	profile, err := parseAIProfilePayload(c, false)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	if profile.Provider != "openai" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Model loading is only supported for OpenAI profiles"})
		return
	}

	models, err := aicore.ListOpenAIModels(profile)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, aiModelListResponse{Models: models})
}
