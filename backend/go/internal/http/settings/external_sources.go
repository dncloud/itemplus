package settings

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type ExternalSource struct {
	ID           int     `db:"id"`
	Name         string  `db:"name"`
	Description  *string `db:"description"`
	SourceType   string  `db:"source_type"`
	Host         string  `db:"host"`
	Port         int     `db:"port"`
	Username     string  `db:"username"`
	AuthType     string  `db:"auth_type"`
	Password     *string `db:"password"`
	PrivateKey   *string `db:"private_key"`
	KnownHostKey string  `db:"known_host_key"`
	BasePath     string  `db:"base_path"`
	IsActive     bool    `db:"is_active"`
	CreatedAt    *string `db:"created_at"`
	UpdatedAt    *string `db:"updated_at"`
}

type externalSourcePayload struct {
	Name         *string `json:"name"`
	Description  *string `json:"description"`
	SourceType   *string `json:"source_type"`
	Host         *string `json:"host"`
	Port         *int    `json:"port"`
	Username     *string `json:"username"`
	AuthType     *string `json:"auth_type"`
	Password     *string `json:"password"`
	PrivateKey   *string `json:"private_key"`
	KnownHostKey *string `json:"known_host_key"`
	BasePath     *string `json:"base_path"`
	IsActive     *bool   `json:"is_active"`
}

func registerExternalSourceRoutes(g *gin.RouterGroup) {
	g.GET("/external-sources", listExternalSources)
	g.GET("/external-sources/:id", getExternalSource)
	g.POST("/external-sources/fetch-host-key", fetchExternalSourceHostKey)
	g.POST("/external-sources/test", testExternalSourceConnection)
	g.POST("/external-sources", createExternalSource)
	g.PUT("/external-sources/:id", updateExternalSource)
	g.DELETE("/external-sources/:id", deleteExternalSource)
}

func RegisterExternalSourceRoutes(g *gin.RouterGroup) {
	registerExternalSourceRoutes(g)
}

func respondExternalSources(c *gin.Context, sources []ExternalSource) {
	resp := make([]gin.H, 0, len(sources))
	for _, src := range sources {
		resp = append(resp, externalSourceResponse(src))
	}
	if resp == nil {
		resp = []gin.H{}
	}
	c.JSON(http.StatusOK, resp)
}

func requireExternalSourceFields(c *gin.Context, body externalSourcePayload, requireName bool) bool {
	if requireName && body.Name == nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Missing required fields"})
		return false
	}
	if body.Host == nil || body.Username == nil || body.AuthType == nil || body.KnownHostKey == nil || body.BasePath == nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Missing required fields"})
		return false
	}
	return true
}
