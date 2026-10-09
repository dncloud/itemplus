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

// Bundle format 2 carries a complete dump of the database (see
// database/dump.go). Format 1, written up to version 1.3.3, carried a JSON
// export of a fixed list of tables in data.json and is still accepted for
// restoring; it contains only what that list covered.
const (
	backupFormatVersion = 2
	backupSQLiteName    = "database.sqlite"
	backupMySQLName     = "database.json"
	backupLegacyName    = "data.json"
)

type backupBundleManifest struct {
	Version   int    `json:"version"`
	Driver    string `json:"driver"`
	CreatedAt string `json:"created_at"`
	// Database names the entry that holds the database dump (format 2).
	Database string `json:"database,omitempty"`
}

// backupWorkParent returns the folder in which backup and restore keep their
// temporary files: next to the upload directory, and therefore on the same
// filesystem. The system temp directory is avoided on purpose. It often is a
// different filesystem, across which nothing can be moved into place
// atomically, and frequently a RAM disk, which a multi-gigabyte bundle must
// not fill.
func backupWorkParent() string {
	uploadDir, err := filepath.Abs(config.C.UploadDir)
	if err != nil {
		return os.TempDir()
	}
	parent := filepath.Dir(uploadDir)
	if err := os.MkdirAll(parent, 0755); err != nil {
		return os.TempDir()
	}
	return parent
}

type backupBundleData struct {
	Tables map[string][]map[string]interface{} `json:"tables"`
}

type extractedBackupBundle struct {
	dataPath      string // legacy data.json (format 1)
	uploadsPath   string
	configPath    string
	hasData       bool // legacy data.json is present
	hasConfig     bool
	hasManifest   bool
	manifest      backupBundleManifest
	sourceDriver  string
	extractedSize uint64
	root          string
}

// databasePath returns the extracted database dump of a format 2 bundle, or
// "" when the bundle has none. Only the two known entry names are accepted,
// whatever the manifest says.
func (b *extractedBackupBundle) databasePath() string {
	if b.manifest.Version < 2 {
		return ""
	}
	name := b.manifest.Database
	if name != backupSQLiteName && name != backupMySQLName {
		return ""
	}
	path := filepath.Join(b.root, name)
	if info, err := os.Stat(path); err != nil || info.IsDir() {
		return ""
	}
	return path
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
		root:        tmpDir,
		dataPath:    filepath.Join(tmpDir, backupLegacyName),
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
			bundle.hasManifest = true
			bundle.manifest = manifest
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
