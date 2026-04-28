package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
)

func Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"app":     "itemplus",
		"version": config.C.AppVersion,
	})
}

func Root(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"name":    config.C.AppName,
		"version": config.C.AppVersion,
	})
}
