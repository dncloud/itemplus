package operations

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/jmoiron/sqlx"
)

const (
	maxRecoverBundleBytes      int64  = 16 << 30
	maxRecoverExtractedBytes   uint64 = 24 << 30
	maxRecoverExtractedEntries int    = 100000
	maxRecoverEntryBytes       uint64 = 8 << 30
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
