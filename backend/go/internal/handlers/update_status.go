package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
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
	normalizeUpdateStatusForRunningServer(&status)
	c.JSON(http.StatusOK, gin.H{
		"available":                 status.ReleaseUpdateAvailable || status.CommitUpdateAvailable,
		"checked_at":                status.CheckedAt,
		"installed_version":         status.InstalledVersion,
		"installed_build":           status.InstalledBuild,
		"installed_source":          status.InstalledSource,
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

func normalizeUpdateStatusForRunningServer(status *services.UpdateStatus) {
	runningVersion, runningBuild := services.SplitVersionDisplay(config.C.AppVersion)
	if runningVersion == "" {
		return
	}
	status.InstalledVersion = runningVersion
	status.InstalledBuild = runningBuild
	status.InstalledSource = "running server"

	releaseUpdate := false
	if status.LatestReleaseVersion != "" {
		releaseUpdate = services.CompareVersions(status.LatestReleaseVersion, runningVersion) > 0
	}

	commitUpdate := false
	if releaseUpdate {
		commitUpdate = true
	} else if status.LatestReleaseVersion != "" && services.CompareVersions(status.LatestReleaseVersion, runningVersion) == 0 {
		if status.LatestReleaseBuild != "" {
			commitUpdate = !services.SameCommit(runningBuild, status.LatestReleaseBuild)
		}
		if !commitUpdate && status.LatestCommit != "" {
			commitUpdate = !services.SameCommit(runningBuild, status.LatestCommit)
		}
	}

	status.ReleaseUpdateAvailable = releaseUpdate
	status.CommitUpdateAvailable = commitUpdate
}
