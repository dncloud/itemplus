package operations

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

// adminExportBundle streams a backup bundle: a manifest, a complete dump of
// the database, the upload directory and the configuration file.
//
// The database part is prepared completely before the first byte is sent.
// Once the download has started, a failure can no longer be reported with a
// status code, so everything that can reasonably fail is done first.
func adminExportBundle(c *gin.Context) {
	driver := database.CurrentDriver()

	workDir, err := os.MkdirTemp(backupWorkParent(), ".itemplus-export-*")
	if err != nil {
		log.Printf("Backup export: could not create work directory: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not prepare backup data"})
		return
	}
	defer os.RemoveAll(workDir)

	databaseEntry, databasePath, err := writeDatabaseDump(driver, workDir)
	if err != nil {
		log.Printf("DB export error in adminExportBundle (%s): %v", driver, err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not prepare backup data"})
		return
	}

	filename := fmt.Sprintf("itemplus-backup-%s.zip", time.Now().UTC().Format("20060102-150405"))
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

	zipWriter := zip.NewWriter(c.Writer)
	if err := writeBackupBundle(zipWriter, driver, databaseEntry, databasePath); err != nil {
		// The response is already under way; cutting it off without the zip
		// end marker makes the file fail to open instead of looking complete.
		log.Printf("Backup export failed while streaming: %v", err)
		c.Abort()
		return
	}
	if err := zipWriter.Close(); err != nil {
		log.Printf("Backup export failed while finishing: %v", err)
		return
	}

	user := middleware.GetUser(c)
	middleware.Audit(user.ID, "database.export_bundle", fmt.Sprintf("driver=%s uploads=%s", driver, config.C.UploadDir))
}

// writeDatabaseDump writes the complete database to a file in workDir and
// returns the name it gets inside the bundle together with its path.
func writeDatabaseDump(driver, workDir string) (entryName, path string, err error) {
	switch driver {
	case "sqlite":
		path = filepath.Join(workDir, backupSQLiteName)
		return backupSQLiteName, path, database.SnapshotSQLite(database.DB, path)
	case "mysql":
		dump, err := database.ExportMySQLDump(database.DB)
		if err != nil {
			return "", "", err
		}
		path = filepath.Join(workDir, backupMySQLName)
		file, err := os.Create(path)
		if err != nil {
			return "", "", err
		}
		if err := json.NewEncoder(file).Encode(dump); err != nil {
			file.Close()
			return "", "", err
		}
		return backupMySQLName, path, file.Close()
	default:
		return "", "", fmt.Errorf("unsupported database engine %q", driver)
	}
}

func writeBackupBundle(zipWriter *zip.Writer, driver, databaseEntry, databasePath string) error {
	manifest, err := json.MarshalIndent(backupBundleManifest{
		Version:   backupFormatVersion,
		Driver:    driver,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		Database:  databaseEntry,
	}, "", "  ")
	if err != nil {
		return err
	}
	manifestEntry, err := zipWriter.Create(backupManifestName)
	if err != nil {
		return err
	}
	if _, err := manifestEntry.Write(manifest); err != nil {
		return err
	}

	if err := addFileToZip(zipWriter, databasePath, databaseEntry); err != nil {
		return err
	}
	if err := addDirectoryToZip(zipWriter, config.C.UploadDir, "uploads"); err != nil {
		return err
	}
	if strings.TrimSpace(config.C.ConfigPath) != "" {
		if err := addFileToZip(zipWriter, config.C.ConfigPath, "itemplus.conf"); err != nil {
			return err
		}
	}
	return nil
}

func addFileToZip(zipWriter *zip.Writer, path, entryName string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()
	entry, err := zipWriter.Create(entryName)
	if err != nil {
		return err
	}
	_, err = io.Copy(entry, file)
	return err
}
