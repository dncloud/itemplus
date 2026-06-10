package handlers

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
	"github.com/jmoiron/sqlx"
)

const (
	maxRecoverBundleBytes      int64  = 16 << 30 // 16 GiB compressed bundle budget
	maxRecoverExtractedBytes   uint64 = 24 << 30 // 24 GiB extracted data budget
	maxRecoverExtractedEntries int    = 100000
	maxRecoverEntryBytes       uint64 = 8 << 30 // 8 GiB per extracted file
	backupManifestName                = "itemplus-backup.json"
)

type backupBundleManifest struct {
	Version   int    `json:"version"`
	Driver    string `json:"driver"`
	CreatedAt string `json:"created_at"`
}

type backupBundleData struct {
	Tables map[string][]map[string]interface{} `json:"tables"`
}

type extractedBackupBundle struct {
	dataPath      string
	uploadsPath   string
	configPath    string
	hasData       bool
	hasConfig     bool
	sourceDriver  string
	extractedSize uint64
}

func capitalizeDetail(detail string) string {
	if detail == "" {
		return detail
	}
	return strings.ToUpper(detail[:1]) + detail[1:]
}

func RegisterAdminRoutes(g *gin.RouterGroup) {
	g.Use(middleware.Auth(), middleware.RequireAdmin())

	g.GET("/export-bundle", adminExportBundle)
	g.POST("/recover-bundle", adminRecoverBundle)
	g.GET("/health/locations", adminHealthLocations)
	g.POST("/health/locations/fix", adminFixLocations)
	g.PUT("/branding", adminUpdateBranding)
	g.DELETE("/branding", adminResetBranding)
	g.GET("/ai-settings", adminGetAISettings)
	g.PUT("/ai-settings", adminUpdateAISettings)
	g.POST("/ai-settings/test", adminTestAISettings)
	g.POST("/ai-settings/models", adminListAIModels)
	registerExternalSourceRoutes(g)
}

func sqliteDatabasePath() (string, bool) {
	const sqlitePrefix = "sqlite+aiosqlite:///"
	if !strings.HasPrefix(config.C.DatabaseURL, sqlitePrefix) {
		return "", false
	}
	return strings.TrimPrefix(config.C.DatabaseURL, sqlitePrefix), true
}

func quotedIdentifiers(columns []string) []string {
	out := make([]string, 0, len(columns))
	for _, column := range columns {
		out = append(out, fmt.Sprintf("`%s`", strings.ReplaceAll(column, "`", "``")))
	}
	return out
}

func normalizeBackupValue(value interface{}) interface{} {
	switch v := value.(type) {
	case nil, bool, string, float32, float64, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return v
	case []byte:
		return string(v)
	case time.Time:
		return v.UTC().Format(time.RFC3339Nano)
	case json.Number:
		return v
	case []interface{}:
		out := make([]interface{}, len(v))
		for i := range v {
			out[i] = normalizeBackupValue(v[i])
		}
		return out
	case map[string]interface{}:
		out := make(map[string]interface{}, len(v))
		for key, nested := range v {
			out[key] = normalizeBackupValue(nested)
		}
		return out
	default:
		return fmt.Sprint(v)
	}
}

func exportBackupData(db *sqlx.DB) (*backupBundleData, error) {
	data := &backupBundleData{Tables: map[string][]map[string]interface{}{}}
	for _, table := range database.BackupTableNames() {
		rows, err := db.Queryx(fmt.Sprintf("SELECT * FROM `%s`", strings.ReplaceAll(table, "`", "``")))
		if err != nil {
			return nil, err
		}
		tableRows := make([]map[string]interface{}, 0)
		for rows.Next() {
			record := map[string]interface{}{}
			if err := rows.MapScan(record); err != nil {
				rows.Close()
				return nil, err
			}
			normalized := make(map[string]interface{}, len(record))
			for key, value := range record {
				normalized[key] = normalizeBackupValue(value)
			}
			tableRows = append(tableRows, normalized)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, err
		}
		rows.Close()
		data.Tables[table] = tableRows
	}
	return data, nil
}

func normalizeImportedValue(value interface{}) interface{} {
	switch v := value.(type) {
	case json.Number:
		if strings.ContainsAny(v.String(), ".eE") {
			if floatValue, err := v.Float64(); err == nil {
				return floatValue
			}
		}
		if intValue, err := v.Int64(); err == nil {
			return intValue
		}
		return v.String()
	case []interface{}:
		out := make([]interface{}, len(v))
		for i := range v {
			out[i] = normalizeImportedValue(v[i])
		}
		return out
	case map[string]interface{}:
		out := make(map[string]interface{}, len(v))
		for key, nested := range v {
			out[key] = normalizeImportedValue(nested)
		}
		return out
	default:
		return v
	}
}

func shouldNormalizeTimestampColumn(column string) bool {
	switch column {
	case "created_at", "updated_at", "last_login", "last_seen", "expires_at":
		return true
	default:
		return false
	}
}

func normalizeImportedValueForColumn(driver, column string, value interface{}) interface{} {
	value = normalizeImportedValue(value)
	if driver != "mysql" {
		return value
	}

	text, ok := value.(string)
	if !ok || !shouldNormalizeTimestampColumn(column) {
		return value
	}
	parsed, err := database.ParseTimestamp(strings.TrimSpace(text))
	if err != nil {
		return value
	}
	return database.TimestampForURL("mysql://", parsed)
}

func resetKnownTables(db *sqlx.DB, driver string) error {
	if driver == "mysql" {
		if _, err := db.Exec("SET FOREIGN_KEY_CHECKS = 0"); err != nil {
			return err
		}
		defer db.Exec("SET FOREIGN_KEY_CHECKS = 1")
	}
	tables := database.LogicalTableNames()
	for i := len(tables) - 1; i >= 0; i-- {
		if _, err := db.Exec(fmt.Sprintf("DROP TABLE IF EXISTS `%s`", strings.ReplaceAll(tables[i], "`", "``"))); err != nil {
			return err
		}
	}
	return nil
}

func importBackupData(db *sqlx.DB, data *backupBundleData, driver string) error {
	if driver == "mysql" {
		if _, err := db.Exec("SET FOREIGN_KEY_CHECKS = 0"); err != nil {
			return err
		}
		defer db.Exec("SET FOREIGN_KEY_CHECKS = 1")
	} else {
		if _, err := db.Exec("PRAGMA foreign_keys = OFF"); err == nil {
			defer db.Exec("PRAGMA foreign_keys = ON")
		}
	}

	for _, table := range database.BackupTableNames() {
		rows := data.Tables[table]
		for _, row := range rows {
			columns := make([]string, 0, len(row))
			for column := range row {
				columns = append(columns, column)
			}
			// Keep inserts deterministic for easier debugging.
			slices.Sort(columns)

			args := make([]interface{}, 0, len(columns))
			placeholders := make([]string, 0, len(columns))
			for _, column := range columns {
				args = append(args, normalizeImportedValueForColumn(driver, column, row[column]))
				placeholders = append(placeholders, "?")
			}

			query := fmt.Sprintf(
				"INSERT INTO `%s` (%s) VALUES (%s)",
				strings.ReplaceAll(table, "`", "``"),
				strings.Join(quotedIdentifiers(columns), ", "),
				strings.Join(placeholders, ", "),
			)
			if _, err := db.Exec(query, args...); err != nil {
				return fmt.Errorf("%s: %w", table, err)
			}
		}
	}
	return nil
}

func addDirectoryToZip(zipWriter *zip.Writer, rootPath, zipPrefix string) error {
	info, err := os.Stat(rootPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if !info.IsDir() {
		return nil
	}
	return filepath.Walk(rootPath, func(path string, fileInfo os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if fileInfo.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(rootPath, path)
		if err != nil {
			return err
		}
		entry, err := zipWriter.Create(filepath.ToSlash(filepath.Join(zipPrefix, rel)))
		if err != nil {
			return err
		}
		file, err := os.Open(path)
		if err != nil {
			return err
		}
		defer file.Close()
		_, err = io.Copy(entry, file)
		return err
	})
}

func extractBackupBundle(zipPath, tmpDir string) (*extractedBackupBundle, error) {
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, fmt.Errorf("invalid backup bundle")
	}
	defer reader.Close()

	bundle := &extractedBackupBundle{
		dataPath:    filepath.Join(tmpDir, "data.json"),
		uploadsPath: filepath.Join(tmpDir, "uploads"),
		configPath:  filepath.Join(tmpDir, "itemplus.conf"),
	}

	if len(reader.File) > maxRecoverExtractedEntries {
		return nil, fmt.Errorf("backup bundle contains too many files")
	}

	for _, zipFile := range reader.File {
		cleanName := filepath.Clean(zipFile.Name)
		if cleanName == "." || strings.HasPrefix(cleanName, "..") {
			continue
		}
		if zipFile.UncompressedSize64 > maxRecoverEntryBytes {
			return nil, fmt.Errorf("backup bundle entry %q exceeds the 8 GiB file limit", cleanName)
		}
		if bundle.extractedSize+zipFile.UncompressedSize64 > maxRecoverExtractedBytes {
			return nil, fmt.Errorf("backup bundle exceeds the 24 GiB extracted data limit")
		}
		switch cleanName {
		case "data.json":
			bundle.hasData = true
		case "itemplus.conf":
			bundle.hasConfig = true
		case backupManifestName:
			manifestFile, err := zipFile.Open()
			if err != nil {
				return nil, fmt.Errorf("backup bundle metadata could not be read")
			}
			manifestBytes, err := io.ReadAll(manifestFile)
			manifestFile.Close()
			if err != nil {
				return nil, fmt.Errorf("backup bundle metadata could not be read")
			}
			var manifest backupBundleManifest
			if err := json.Unmarshal(manifestBytes, &manifest); err != nil {
				return nil, fmt.Errorf("backup bundle metadata is invalid")
			}
			bundle.sourceDriver = strings.TrimSpace(manifest.Driver)
		}

		targetPath := filepath.Join(tmpDir, cleanName)
		if !strings.HasPrefix(targetPath, tmpDir+string(os.PathSeparator)) && targetPath != tmpDir {
			continue
		}
		if zipFile.FileInfo().IsDir() {
			if err := os.MkdirAll(targetPath, 0755); err != nil {
				return nil, fmt.Errorf("could not prepare recovery data")
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
			return nil, fmt.Errorf("could not prepare recovery data")
		}
		src, err := zipFile.Open()
		if err != nil {
			return nil, fmt.Errorf("invalid backup bundle contents")
		}
		dst, err := os.Create(targetPath)
		if err != nil {
			src.Close()
			return nil, fmt.Errorf("could not prepare recovery data")
		}
		written, err := io.CopyN(dst, src, int64(zipFile.UncompressedSize64)+1)
		if err != nil && err != io.EOF {
			dst.Close()
			src.Close()
			return nil, fmt.Errorf("could not extract backup bundle")
		}
		if uint64(written) != zipFile.UncompressedSize64 {
			dst.Close()
			src.Close()
			return nil, fmt.Errorf("backup bundle contains inconsistent file sizes")
		}
		bundle.extractedSize += uint64(written)
		dst.Close()
		src.Close()
	}

	return bundle, nil
}

func loadBackupBundleData(path string) (*backupBundleData, error) {
	dataFile, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("could not read backup data")
	}
	defer dataFile.Close()

	var bundleData backupBundleData
	decoder := json.NewDecoder(dataFile)
	decoder.UseNumber()
	if err := decoder.Decode(&bundleData); err != nil {
		return nil, fmt.Errorf("backup bundle contains invalid item+ data")
	}
	return &bundleData, nil
}

func moveIfExists(src, dst string) error {
	if _, err := os.Stat(src); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}
	return os.Rename(src, dst)
}

func restoreIfPresent(src, dst string) {
	if err := moveIfExists(src, dst); err != nil {
		_ = err
	}
}

func rollbackUploadsAndConfig(restoreUploads bool, previousUploadsPath, uploadDir string, restoreConfig bool, previousConfigPath, envPath string) {
	if restoreUploads {
		_ = os.RemoveAll(uploadDir)
		restoreIfPresent(previousUploadsPath, uploadDir)
	}
	if restoreConfig && strings.TrimSpace(envPath) != "" {
		restoreIfPresent(previousConfigPath, envPath)
	}
}

func rollbackRecoveredState(restoreDatabase bool, rollbackDatabase func(), restoreUploads bool, previousUploadsPath, uploadDir string, restoreConfig bool, previousConfigPath, envPath string) {
	if restoreDatabase {
		rollbackDatabase()
	}
	rollbackUploadsAndConfig(restoreUploads, previousUploadsPath, uploadDir, restoreConfig, previousConfigPath, envPath)
}

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

	if strings.TrimSpace(config.C.EnvPath) != "" {
		configEntry, err := zipWriter.Create("itemplus.conf")
		if err != nil {
			c.Status(http.StatusInternalServerError)
			return
		}
		configFile, err := os.Open(config.C.EnvPath)
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
	audit(user.ID, "database.export_bundle", fmt.Sprintf("driver=%s uploads=%s", driver, config.C.UploadDir))
}

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

	if restoreConfig && strings.TrimSpace(config.C.EnvPath) != "" {
		if err := moveIfExists(config.C.EnvPath, previousConfigPath); err != nil {
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
				rollbackRecoveredState(restoreDatabase, rollbackDatabase, true, previousUploadsPath, config.C.UploadDir, restoreConfig, previousConfigPath, config.C.EnvPath)
				c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not restore attachments"})
				return
			}
		} else {
			_ = os.MkdirAll(config.C.UploadDir, 0755)
		}
	}

	if restoreConfig && strings.TrimSpace(config.C.EnvPath) != "" {
		if err := os.MkdirAll(filepath.Dir(config.C.EnvPath), 0755); err != nil {
			rollbackRecoveredState(restoreDatabase, rollbackDatabase, restoreUploads, previousUploadsPath, config.C.UploadDir, true, previousConfigPath, config.C.EnvPath)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not prepare configuration target"})
			return
		}
		if err := os.Rename(bundle.configPath, config.C.EnvPath); err != nil {
			rollbackRecoveredState(restoreDatabase, rollbackDatabase, restoreUploads, previousUploadsPath, config.C.UploadDir, true, previousConfigPath, config.C.EnvPath)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not restore configuration"})
			return
		}
	}

	if restoreDatabase && driver == "sqlite" {
		if err := database.ReconnectConfigured(); err != nil {
			_ = os.Remove(dbPath)
			restoreIfPresent(previousDBPath, dbPath)
			rollbackUploadsAndConfig(restoreUploads, previousUploadsPath, config.C.UploadDir, restoreConfig, previousConfigPath, config.C.EnvPath)
			_ = database.ReconnectConfigured()
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not reopen restored database"})
			return
		}
	}

	user := middleware.GetUser(c)
	audit(user.ID, "database.recover_bundle", fmt.Sprintf("db=%t uploads=%t config=%t source=%s target=%s", restoreDatabase, restoreUploads, restoreConfig, bundle.sourceDriver, driver))
	c.JSON(http.StatusOK, gin.H{
		"status":           "ok",
		"requires_restart": restoreConfig,
	})
}

func adminHealthLocations(c *gin.Context) {
	issues := []gin.H{}
	totalChecked := 0

	for _, realm := range []string{"archive", "collection"} {
		// Load all locations into a map for parent-chain walking
		type loc struct {
			ID       int64  `db:"id"`
			Name     string `db:"name"`
			ParentID *int64 `db:"parent_id"`
		}

		var locations []loc
		err := database.DB.Select(&locations, fmt.Sprintf(
			"SELECT id, name, parent_id FROM %s_locations", realm))
		if err != nil {
			continue
		}
		totalChecked += len(locations)

		locMap := map[int64]*loc{}
		for i := range locations {
			locMap[locations[i].ID] = &locations[i]
		}

		for _, l := range locations {
			if l.ParentID == nil {
				continue
			}

			// Self-parenting
			if *l.ParentID == l.ID {
				issues = append(issues, gin.H{
					"realm": realm,
					"id":    l.ID,
					"name":  l.Name,
					"type":  "self_parent",
				})
				continue
			}

			// Deep cycle detection — walk the parent chain
			visited := map[int64]bool{}
			current := l.ParentID
			for current != nil {
				if *current == l.ID {
					issues = append(issues, gin.H{
						"realm": realm,
						"id":    l.ID,
						"name":  l.Name,
						"type":  "cycle",
					})
					break
				}
				if visited[*current] {
					break
				}
				visited[*current] = true
				parent, ok := locMap[*current]
				if !ok {
					break
				}
				current = parent.ParentID
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"issues":        issues,
		"total_checked": totalChecked,
	})
}

func adminFixLocations(c *gin.Context) {
	fixed := 0

	for _, realm := range []string{"archive", "collection"} {
		// Load all locations for cycle detection
		type loc struct {
			ID       int64  `db:"id"`
			ParentID *int64 `db:"parent_id"`
		}

		var locations []loc
		err := database.DB.Select(&locations, fmt.Sprintf(
			"SELECT id, parent_id FROM %s_locations", realm))
		if err != nil {
			continue
		}

		locMap := map[int64]*loc{}
		for i := range locations {
			locMap[locations[i].ID] = &locations[i]
		}

		// Detect and fix all cycles (self-parent and deep cycles)
		var toFix []int64
		for _, l := range locations {
			if l.ParentID == nil {
				continue
			}

			shouldFix := false

			// Self-parenting
			if *l.ParentID == l.ID {
				shouldFix = true
			} else {
				// Deep cycle detection
				visited := map[int64]bool{}
				current := l.ParentID
				for current != nil {
					if *current == l.ID {
						shouldFix = true
						break
					}
					if visited[*current] {
						break
					}
					visited[*current] = true
					parent, ok := locMap[*current]
					if !ok {
						break
					}
					current = parent.ParentID
				}
			}

			if shouldFix {
				toFix = append(toFix, l.ID)
			}
		}

		// Apply fixes
		for _, id := range toFix {
			result, err := database.DB.Exec(fmt.Sprintf(
				"UPDATE %s_locations SET parent_id = NULL WHERE id = ?", realm), id)
			if err == nil {
				affected, _ := result.RowsAffected()
				fixed += int(affected)
			}
			// Update in-memory map so subsequent checks use fixed state
			if entry, ok := locMap[id]; ok {
				entry.ParentID = nil
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"fixed": fixed})
}

func mapKeys(m map[string]json.RawMessage) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
