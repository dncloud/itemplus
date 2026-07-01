package operations

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

func adminRecoverBundle(c *gin.Context) {
	driver := database.CurrentDriver()
	if c.PostForm("confirm") != "RECOVER" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Must confirm destructive recovery with 'RECOVER'"})
		return
	}
	restoreDatabase := c.PostForm("restore_database") != "0"
	restoreUploads := c.PostForm("restore_uploads") != "0"
	restoreConfig := c.PostForm("restore_config") != "0"
	if !restoreDatabase && !restoreUploads && !restoreConfig {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Select at least one part to recover"})
		return
	}
	dbPath, _ := sqliteDatabasePath()

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxRecoverBundleBytes+1)
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "No backup bundle uploaded or bundle is too large"})
		return
	}
	if file.Size <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Backup bundle is empty"})
		return
	}
	if file.Size > maxRecoverBundleBytes {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Backup bundle exceeds the 16 GiB upload limit"})
		return
	}

	tmpDir, err := os.MkdirTemp("", "itemplus-recover-*")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not prepare recovery"})
		return
	}
	defer os.RemoveAll(tmpDir)

	zipPath := filepath.Join(tmpDir, "bundle.zip")
	if err := c.SaveUploadedFile(file, zipPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not store uploaded backup bundle"})
		return
	}

	bundle, err := extractBackupBundle(zipPath, tmpDir)
	if err != nil {
		detail := err.Error()
		status := http.StatusInternalServerError
		switch detail {
		case "invalid backup bundle", "backup bundle contains too many files", "backup bundle exceeds the 24 GiB extracted data limit", "backup bundle metadata could not be read", "backup bundle metadata is invalid", "invalid backup bundle contents", "backup bundle contains inconsistent file sizes":
			status = http.StatusBadRequest
		default:
			if strings.HasPrefix(detail, "backup bundle entry ") {
				status = http.StatusBadRequest
			}
		}
		c.JSON(status, gin.H{"detail": capitalizeDetail(detail)})
		return
	}

	if restoreDatabase && !bundle.hasData {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Backup bundle does not contain item+ data"})
		return
	}
	if restoreConfig && !bundle.hasConfig {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Backup bundle does not contain itemplus.conf"})
		return
	}

	backupDir := filepath.Join(tmpDir, "previous")
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not prepare recovery rollback"})
		return
	}

	previousDBPath := filepath.Join(backupDir, "database.sqlite")
	previousUploadsPath := filepath.Join(backupDir, "uploads")
	previousConfigPath := filepath.Join(backupDir, "itemplus.conf")
	var previousData *backupBundleData
	rollbackDatabase := func() {
		switch driver {
		case "sqlite":
			_ = os.Remove(dbPath)
			restoreIfPresent(previousDBPath, dbPath)
			_ = database.ReconnectConfigured()
		case "mysql":
			if previousData != nil && resetKnownTables(database.DB, "mysql") == nil && database.CreateSchemaOnly(database.DB, "mysql") == nil {
				_ = importBackupData(database.DB, previousData, "mysql")
				_ = database.ReconnectConfigured()
			}
		}
	}

	if restoreDatabase && driver == "sqlite" {
		_ = database.Close()
		if err := moveIfExists(dbPath, previousDBPath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not back up current database"})
			return
		}
	}
	if restoreDatabase && driver == "mysql" {
		previousData, err = exportBackupData(database.DB)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not back up current database"})
			return
		}
	}

	var bundleData backupBundleData
	if restoreDatabase {
		data, err := loadBackupBundleData(bundle.dataPath)
		if err != nil {
			status := http.StatusInternalServerError
			if err.Error() == "backup bundle contains invalid item+ data" {
				status = http.StatusBadRequest
			}
			c.JSON(status, gin.H{"detail": capitalizeDetail(err.Error())})
			return
		}
		bundleData = *data
	}

	if restoreUploads {
		if err := moveIfExists(config.C.UploadDir, previousUploadsPath); err != nil {
			if restoreDatabase {
				rollbackDatabase()
			}
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not back up current attachments"})
			return
		}
	}

	if restoreConfig && strings.TrimSpace(config.C.ConfigPath) != "" {
		if err := moveIfExists(config.C.ConfigPath, previousConfigPath); err != nil {
			if restoreDatabase {
				rollbackDatabase()
			}
			if restoreUploads {
				restoreIfPresent(previousUploadsPath, config.C.UploadDir)
			}
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not back up current configuration"})
			return
		}
	}

	if restoreDatabase {
		switch driver {
		case "sqlite":
			tempDBPath := filepath.Join(tmpDir, "restore-target.sqlite")
			tempDB, err := database.OpenRawSQLite(tempDBPath)
			if err != nil {
				rollbackDatabase()
				c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not prepare restored database"})
				return
			}
			if err := database.CreateSchemaOnly(tempDB, "sqlite"); err != nil {
				tempDB.Close()
				rollbackDatabase()
				c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not prepare restored database"})
				return
			}
			if err := importBackupData(tempDB, &bundleData, "sqlite"); err != nil {
				tempDB.Close()
				rollbackDatabase()
				c.JSON(http.StatusInternalServerError, gin.H{"detail": fmt.Sprintf("Could not restore database: %v", err)})
				return
			}
			if err := tempDB.Close(); err != nil {
				rollbackDatabase()
				c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not finalize restored database"})
				return
			}
			if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil || os.Rename(tempDBPath, dbPath) != nil {
				rollbackDatabase()
				c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not restore database"})
				return
			}
		case "mysql":
			if err := resetKnownTables(database.DB, "mysql"); err != nil {
				rollbackDatabase()
				c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not restore database"})
				return
			}
			if err := database.CreateSchemaOnly(database.DB, "mysql"); err != nil {
				rollbackDatabase()
				c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not prepare restored database"})
				return
			}
			if err := importBackupData(database.DB, &bundleData, "mysql"); err != nil {
				rollbackDatabase()
				c.JSON(http.StatusInternalServerError, gin.H{"detail": fmt.Sprintf("Could not restore database: %v", err)})
				return
			}
			if reconnectErr := database.ReconnectConfigured(); reconnectErr != nil {
				rollbackDatabase()
				c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not reopen restored database"})
				return
			}
		default:
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Database recovery is not supported for this database engine"})
			return
		}
	}

	if restoreUploads {
		_ = os.RemoveAll(config.C.UploadDir)
		if _, err := os.Stat(bundle.uploadsPath); err == nil {
			if err := os.Rename(bundle.uploadsPath, config.C.UploadDir); err != nil {
				rollbackRecoveredState(restoreDatabase, rollbackDatabase, true, previousUploadsPath, config.C.UploadDir, restoreConfig, previousConfigPath, config.C.ConfigPath)
				c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not restore attachments"})
				return
			}
		} else {
			_ = os.MkdirAll(config.C.UploadDir, 0755)
		}
	}

	if restoreConfig && strings.TrimSpace(config.C.ConfigPath) != "" {
		if err := os.MkdirAll(filepath.Dir(config.C.ConfigPath), 0755); err != nil {
			rollbackRecoveredState(restoreDatabase, rollbackDatabase, restoreUploads, previousUploadsPath, config.C.UploadDir, true, previousConfigPath, config.C.ConfigPath)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not prepare configuration target"})
			return
		}
		if err := os.Rename(bundle.configPath, config.C.ConfigPath); err != nil {
			rollbackRecoveredState(restoreDatabase, rollbackDatabase, restoreUploads, previousUploadsPath, config.C.UploadDir, true, previousConfigPath, config.C.ConfigPath)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not restore configuration"})
			return
		}
	}

	if restoreDatabase && driver == "sqlite" {
		if err := database.ReconnectConfigured(); err != nil {
			_ = os.Remove(dbPath)
			restoreIfPresent(previousDBPath, dbPath)
			rollbackUploadsAndConfig(restoreUploads, previousUploadsPath, config.C.UploadDir, restoreConfig, previousConfigPath, config.C.ConfigPath)
			_ = database.ReconnectConfigured()
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not reopen restored database"})
			return
		}
	}

	user := middleware.GetUser(c)
	middleware.Audit(user.ID, "database.recover_bundle", fmt.Sprintf("db=%t uploads=%t config=%t source=%s target=%s", restoreDatabase, restoreUploads, restoreConfig, bundle.sourceDriver, driver))
	c.JSON(http.StatusOK, gin.H{
		"status":           "ok",
		"requires_restart": restoreConfig,
	})
}
