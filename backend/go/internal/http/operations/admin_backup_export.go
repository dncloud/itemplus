package operations

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

func adminExportBundle(c *gin.Context) {
	driver := database.CurrentDriver()
	data, err := exportBackupData(database.DB)
	if err != nil {
		log.Printf("DB export error in adminExportBundle (%s): %v", driver, err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not prepare backup data"})
		return
	}

	filename := fmt.Sprintf("itemplus-backup-%s.zip", time.Now().UTC().Format("20060102-150405"))
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

	zipWriter := zip.NewWriter(c.Writer)
	defer zipWriter.Close()

	manifestEntry, err := zipWriter.Create(backupManifestName)
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	manifestBytes, err := json.MarshalIndent(backupBundleManifest{
		Version:   1,
		Driver:    driver,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}, "", "  ")
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	if _, err := manifestEntry.Write(manifestBytes); err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}

	dataEntry, err := zipWriter.Create("data.json")
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	encoder := json.NewEncoder(dataEntry)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(data); err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}

	if err := addDirectoryToZip(zipWriter, config.C.UploadDir, "uploads"); err != nil {
		log.Printf("Upload zip error in adminExportBundle: %v", err)
		c.Status(http.StatusInternalServerError)
		return
	}

	if strings.TrimSpace(config.C.ConfigPath) != "" {
		configEntry, err := zipWriter.Create("itemplus.conf")
		if err != nil {
			c.Status(http.StatusInternalServerError)
			return
		}
		configFile, err := os.Open(config.C.ConfigPath)
		if err != nil {
			c.Status(http.StatusInternalServerError)
			return
		}
		if _, err := io.Copy(configEntry, configFile); err != nil {
			configFile.Close()
			c.Status(http.StatusInternalServerError)
			return
		}
		configFile.Close()
	}

	user := middleware.GetUser(c)
	middleware.Audit(user.ID, "database.export_bundle", fmt.Sprintf("driver=%s uploads=%s", driver, config.C.UploadDir))
}
