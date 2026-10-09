package operations

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

// adminRecoverBundle restores database, uploads and configuration from a
// backup bundle.
//
// It works in two phases. First everything is prepared without touching the
// running system: the bundle is unpacked and the database to restore is
// built next to the live one. Only when that has succeeded are the live
// parts exchanged, and each exchange registers how to undo it, so a failure
// part-way returns the system to the state it had before.
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

	// ── Phase 1: prepare, nothing live is changed ──

	workDir, err := os.MkdirTemp(backupWorkParent(), ".itemplus-restore-*")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not prepare recovery"})
		return
	}
	defer os.RemoveAll(workDir)

	zipPath := filepath.Join(workDir, "bundle.zip")
	if err := c.SaveUploadedFile(file, zipPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not store uploaded backup bundle"})
		return
	}
	extractDir := filepath.Join(workDir, "bundle")
	if err := os.MkdirAll(extractDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not prepare recovery"})
		return
	}
	bundle, err := extractBackupBundle(zipPath, extractDir)
	_ = os.Remove(zipPath) // the unpacked copy is all that is needed from here on
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

	if restoreConfig && !bundle.hasConfig {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Backup bundle does not contain itemplus.conf"})
		return
	}

	var dbRestore databaseRestore
	if restoreDatabase {
		dbRestore, err = prepareDatabaseRestore(driver, bundle, workDir)
		if err != nil {
			var refused *restoreRefused
			if asRestoreRefused(err, &refused) {
				c.JSON(http.StatusBadRequest, gin.H{"detail": refused.detail, "code": refused.code})
				return
			}
			log.Printf("Recovery: preparing the database failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not prepare restored database"})
			return
		}
		defer dbRestore.discard()
	}

	// ── Phase 2: exchange the live parts, undoing all of them on failure ──

	var undo []func()
	fail := func(detail string, cause error) {
		log.Printf("Recovery failed (%s), returning to the previous state: %v", detail, cause)
		for i := len(undo) - 1; i >= 0; i-- {
			undo[i]()
		}
		c.JSON(http.StatusInternalServerError, gin.H{"detail": detail})
	}

	if restoreUploads {
		previousUploads := filepath.Join(workDir, "previous-uploads")
		if err := moveIfExists(config.C.UploadDir, previousUploads); err != nil {
			fail("Could not set aside current attachments", err)
			return
		}
		undo = append(undo, func() {
			_ = os.RemoveAll(config.C.UploadDir)
			restoreIfPresent(previousUploads, config.C.UploadDir)
		})
		if _, statErr := os.Stat(bundle.uploadsPath); statErr == nil {
			if err := os.Rename(bundle.uploadsPath, config.C.UploadDir); err != nil {
				fail("Could not restore attachments", err)
				return
			}
		} else if err := os.MkdirAll(config.C.UploadDir, 0755); err != nil {
			fail("Could not restore attachments", err)
			return
		}
	}

	if restoreDatabase {
		undoDatabase, err := dbRestore.apply()
		if err != nil {
			fail("Could not restore database", err)
			return
		}
		undo = append(undo, undoDatabase)
	}

	if restoreConfig && strings.TrimSpace(config.C.ConfigPath) != "" {
		previousConfig := filepath.Join(workDir, "previous-itemplus.conf")
		hadConfig := copyFile(config.C.ConfigPath, previousConfig) == nil
		if err := copyFile(bundle.configPath, config.C.ConfigPath); err != nil {
			if hadConfig {
				_ = copyFile(previousConfig, config.C.ConfigPath)
			}
			fail("Could not restore configuration", err)
			return
		}
	}

	if restoreDatabase {
		dbRestore.commit()
	}

	user := middleware.GetUser(c)
	middleware.Audit(user.ID, "database.recover_bundle", fmt.Sprintf("db=%t uploads=%t config=%t source=%s target=%s format=%d",
		restoreDatabase, restoreUploads, restoreConfig, bundle.sourceDriver, driver, bundle.manifest.Version))
	c.JSON(http.StatusOK, gin.H{
		"status":           "ok",
		"requires_restart": restoreConfig,
	})
}

// restoreRefused is a problem with the bundle itself that the administrator
// has to know about, as opposed to a failure on the server.
type restoreRefused struct {
	code   string
	detail string
}

func (e *restoreRefused) Error() string { return e.detail }

func asRestoreRefused(err error, target **restoreRefused) bool {
	refused, ok := err.(*restoreRefused)
	if ok {
		*target = refused
	}
	return ok
}

// databaseRestore is a restore that has been prepared next to the live
// database and is ready to take its place.
type databaseRestore interface {
	// apply puts the restored database in place and reconnects. On success
	// it returns how to undo that. On failure it has already returned to the
	// previous database itself.
	apply() (undo func(), err error)
	// commit ends the possibility to undo and removes what was kept for it.
	commit()
	// discard removes what was prepared; harmless after apply.
	discard()
}

func engineName(driver string) string {
	switch driver {
	case "sqlite":
		return "SQLite"
	case "mysql":
		return "MySQL/MariaDB"
	default:
		return driver
	}
}

func prepareDatabaseRestore(driver string, bundle *extractedBackupBundle, workDir string) (databaseRestore, error) {
	if !bundle.hasManifest || bundle.sourceDriver == "" {
		return nil, &restoreRefused{"backup_without_manifest", "Backup bundle does not say which database engine it was created with"}
	}
	// A dump reproduces one engine; it is not converted into another.
	if bundle.sourceDriver != driver {
		return nil, &restoreRefused{"backup_driver_mismatch", fmt.Sprintf(
			"This backup was created with %s and can only be restored into %s. This installation uses %s.",
			engineName(bundle.sourceDriver), engineName(bundle.sourceDriver), engineName(driver))}
	}

	dumpPath := bundle.databasePath()
	if dumpPath == "" && !bundle.hasData {
		return nil, &restoreRefused{"backup_without_database", "Backup bundle does not contain item+ data"}
	}

	switch driver {
	case "sqlite":
		return prepareSQLiteRestore(bundle, dumpPath)
	case "mysql":
		return prepareMySQLRestore(bundle, dumpPath)
	default:
		return nil, &restoreRefused{"backup_engine_unsupported", "Database recovery is not supported for this database engine"}
	}
}

// ── SQLite: build a new database file, then swap files ──

type sqliteRestore struct {
	dbPath       string
	newPath      string
	previousPath string
}

func prepareSQLiteRestore(bundle *extractedBackupBundle, dumpPath string) (databaseRestore, error) {
	dbPath, ok := sqliteDatabasePath()
	if !ok {
		return nil, fmt.Errorf("no SQLite database configured")
	}
	// Next to the live file, so the swap is a rename on one filesystem.
	restore := &sqliteRestore{dbPath: dbPath, newPath: dbPath + ".restore-new", previousPath: dbPath + ".pre-restore"}
	restore.discard()
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		return nil, err
	}

	if dumpPath != "" {
		if filepath.Base(dumpPath) != backupSQLiteName {
			return nil, &restoreRefused{"backup_invalid", "Backup bundle does not contain a SQLite database"}
		}
		if err := database.VerifySQLiteSnapshot(dumpPath); err != nil {
			return nil, &restoreRefused{"backup_invalid", "Backup database cannot be used: " + err.Error()}
		}
		if err := copyFile(dumpPath, restore.newPath); err != nil {
			restore.discard()
			return nil, err
		}
		return restore, nil
	}

	// Format 1: no database file, only exported rows. Build the schema and
	// load them into it.
	data, err := loadBackupBundleData(bundle.dataPath)
	if err != nil {
		return nil, &restoreRefused{"backup_invalid", capitalizeDetail(err.Error())}
	}
	db, err := database.OpenRawSQLite(restore.newPath)
	if err != nil {
		return nil, err
	}
	if err := database.CreateSchemaOnly(db, "sqlite"); err == nil {
		err = importBackupData(db, data, "sqlite")
	}
	if closeErr := db.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		restore.discard()
		return nil, err
	}
	database.RemoveSQLiteSidecars(restore.newPath)
	return restore, nil
}

func (r *sqliteRestore) apply() (func(), error) {
	back := func() {
		_ = database.Close()
		_ = os.Remove(r.dbPath)
		database.RemoveSQLiteSidecars(r.dbPath)
		for _, suffix := range []string{"", "-wal", "-shm"} {
			restoreIfPresent(r.previousPath+suffix, r.dbPath+suffix)
		}
		if err := database.ReconnectConfigured(); err != nil {
			log.Printf("Recovery: could not reopen the previous database: %v", err)
		}
	}

	_ = database.Close()
	// The write-ahead log belongs to the file it sits next to. It moves aside
	// with the old database and must not be found by the new one.
	for _, suffix := range []string{"", "-wal", "-shm"} {
		if err := moveIfExists(r.dbPath+suffix, r.previousPath+suffix); err != nil {
			back()
			return nil, err
		}
	}
	if err := os.Rename(r.newPath, r.dbPath); err != nil {
		back()
		return nil, err
	}
	// Opening runs the migrations, which brings an older backup up to date.
	if err := database.ReconnectConfigured(); err != nil {
		back()
		return nil, err
	}
	finishDatabaseRestore()
	return back, nil
}

func (r *sqliteRestore) commit() {
	for _, suffix := range []string{"", "-wal", "-shm"} {
		_ = os.Remove(r.previousPath + suffix)
	}
}

func (r *sqliteRestore) discard() {
	_ = os.Remove(r.newPath)
	database.RemoveSQLiteSidecars(r.newPath)
}

// ── MySQL / MariaDB: load into staged tables, then swap atomically ──

type mysqlRestore struct {
	dump *database.MySQLDump
}

func prepareMySQLRestore(bundle *extractedBackupBundle, dumpPath string) (databaseRestore, error) {
	if dumpPath == "" {
		return prepareLegacyMySQLRestore(bundle)
	}
	if filepath.Base(dumpPath) != backupMySQLName {
		return nil, &restoreRefused{"backup_invalid", "Backup bundle does not contain a MySQL/MariaDB dump"}
	}
	dump, err := database.DecodeMySQLDump(dumpPath)
	if err != nil {
		return nil, &restoreRefused{"backup_invalid", "Backup database cannot be read"}
	}
	if err := database.StageMySQLDump(database.DB, dump); err != nil {
		return nil, &restoreRefused{"backup_invalid", "Backup database cannot be used: " + err.Error()}
	}
	return &mysqlRestore{dump: dump}, nil
}

func (r *mysqlRestore) apply() (func(), error) {
	back := func() {
		if err := database.RevertMySQLSwap(database.DB); err != nil {
			log.Printf("Recovery: could not return to the previous tables: %v", err)
		}
		if err := database.ReconnectConfigured(); err != nil {
			log.Printf("Recovery: could not reopen the previous database: %v", err)
		}
	}
	if err := database.SwapStagedMySQLTables(database.DB, r.dump); err != nil {
		return nil, err // the rename is atomic: nothing was exchanged
	}
	if err := database.ReconnectConfigured(); err != nil {
		back()
		return nil, err
	}
	finishDatabaseRestore()
	return back, nil
}

func (r *mysqlRestore) commit()  { _ = database.DropStagedMySQLTables(database.DB) }
func (r *mysqlRestore) discard() { _ = database.DropStagedMySQLTables(database.DB) }

// legacyMySQLRestore handles format 1 bundles, which have rows but no table
// definitions. The schema has to be created by the application under the
// real table names, so this cannot be staged; a dump of the current state is
// kept to return to.
type legacyMySQLRestore struct {
	data     *backupBundleData
	previous *database.MySQLDump
}

func prepareLegacyMySQLRestore(bundle *extractedBackupBundle) (databaseRestore, error) {
	data, err := loadBackupBundleData(bundle.dataPath)
	if err != nil {
		return nil, &restoreRefused{"backup_invalid", capitalizeDetail(err.Error())}
	}
	previous, err := database.ExportMySQLDump(database.DB)
	if err != nil {
		return nil, fmt.Errorf("could not secure the current database: %w", err)
	}
	return &legacyMySQLRestore{data: data, previous: previous}, nil
}

func (r *legacyMySQLRestore) apply() (func(), error) {
	back := func() {
		// Everything is dropped first so the previous state returns exactly.
		err := database.DropAllMySQLTables(database.DB)
		if err == nil {
			err = database.StageMySQLDump(database.DB, r.previous)
		}
		if err == nil {
			err = database.SwapStagedMySQLTables(database.DB, r.previous)
		}
		if err != nil {
			log.Printf("Recovery: could not return to the previous database: %v", err)
		}
		if err := database.ReconnectConfigured(); err != nil {
			log.Printf("Recovery: could not reopen the previous database: %v", err)
		}
	}

	// All tables go, not only the ones the old format knew: rows left in the
	// others would attach themselves to restored items with the same id.
	err := database.DropAllMySQLTables(database.DB)
	if err == nil {
		err = database.CreateSchemaOnly(database.DB, "mysql")
	}
	if err == nil {
		err = importBackupData(database.DB, r.data, "mysql")
	}
	if err == nil {
		err = database.ReconnectConfigured()
	}
	if err != nil {
		back()
		return nil, err
	}
	finishDatabaseRestore()
	return back, nil
}

func (r *legacyMySQLRestore) commit()  {}
func (r *legacyMySQLRestore) discard() {}

// finishDatabaseRestore clears what must not come back to life from a
// backup: one-time login tokens and the "online" state of devices.
func finishDatabaseRestore() {
	for _, table := range []string{"magic_link_tokens", "qr_login_tokens", "apple_link_tokens"} {
		if _, err := database.DB.Exec("DELETE FROM " + table); err != nil {
			log.Printf("Recovery: could not clear %s: %v", table, err)
		}
	}
	if err := database.MarkAllDeviceSessionsOffline(); err != nil {
		log.Printf("Recovery: could not reset device sessions: %v", err)
	}
}

func copyFile(source, target string) error {
	in, err := os.Open(source)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(target)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}
