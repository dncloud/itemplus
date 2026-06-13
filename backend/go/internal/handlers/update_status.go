package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
	"github.com/itemplus/backend/internal/services"
)

func RegisterUpdateStatusRoutes(api *gin.RouterGroup) {
	api.GET("/update-status", middleware.Auth(), getUpdateStatus)
}

func getUpdateStatus(c *gin.Context) {
	var raw string
	err := database.DB.Get(&raw, "SELECT value FROM app_settings WHERE `key` = ?", services.UpdateStatusSettingKey)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusOK, gin.H{"available": false})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not load update status"})
		return
	}

	var status services.UpdateStatus
	if err := json.Unmarshal([]byte(raw), &status); err != nil {
		c.JSON(http.StatusOK, gin.H{"available": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"available":                 status.ReleaseUpdateAvailable || status.CommitUpdateAvailable,
		"checked_at":                status.CheckedAt,
		"installed_version":         status.InstalledVersion,
		"installed_build":           status.InstalledBuild,
		"latest_release_version":    status.LatestReleaseVersion,
		"latest_release_build":      status.LatestReleaseBuild,
		"latest_release_url":        status.LatestReleaseURL,
		"latest_release_asset_name": status.LatestReleaseAssetName,
		"latest_commit":             status.LatestCommit,
		"downloaded_at":             status.DownloadedAt,
		"downloaded_version":        status.DownloadedVersion,
		"downloaded_build":          status.DownloadedBuild,
		"downloaded_path":           status.DownloadedPath,
		"downloaded_asset_name":     status.DownloadedAssetName,
		"release_update_available":  status.ReleaseUpdateAvailable,
		"commit_update_available":   status.CommitUpdateAvailable,
		"status":                    status.Status,
		"error":                     status.Error,
	})
}
