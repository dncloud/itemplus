package operations

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

// allTables asks the database which tables exist, like the dump does.
func allTables(t *testing.T) []string {
	t.Helper()
	query := "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
	if database.CurrentDriver() == "mysql" {
		query = "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name"
	}
	var tables []string
	if err := database.DB.Select(&tables, query); err != nil {
		t.Fatalf("list tables: %v", err)
	}
	return tables
}

// tableContents returns every row of every table as text, one sorted list
// per table, so two states of the database can be compared exactly.
func tableContents(t *testing.T) map[string][]string {
	t.Helper()
	contents := map[string][]string{}
	for _, table := range allTables(t) {
		rows, err := database.DB.Queryx("SELECT * FROM `" + table + "`")
		if err != nil {
			t.Fatalf("%s: %v", table, err)
		}
		lines := []string{}
		for rows.Next() {
			row := map[string]interface{}{}
			if err := rows.MapScan(row); err != nil {
				rows.Close()
				t.Fatalf("%s: %v", table, err)
			}
			for key, value := range row {
				if raw, ok := value.([]byte); ok {
					row[key] = string(raw)
				}
			}
			encoded, _ := json.Marshal(row)
			lines = append(lines, string(encoded))
		}
		rows.Close()
		sort.Strings(lines)
		contents[table] = lines
	}
	return contents
}

// Tables whose content is deliberately not carried over by a restore.
var notRestoredAsIs = map[string]bool{
	"magic_link_tokens": true, "qr_login_tokens": true, "apple_link_tokens": true, "device_sessions": true,
}

func diffContents(t *testing.T, want, got map[string][]string) {
	t.Helper()
	for table, wantRows := range want {
		if notRestoredAsIs[table] {
			continue
		}
		gotRows, exists := got[table]
		if !exists {
			t.Errorf("%s: table is missing after the restore", table)
			continue
		}
		if strings.Join(wantRows, "\n") != strings.Join(gotRows, "\n") {
			t.Errorf("%s: content differs after the restore\n  backed up (%d rows): %.300s\n  restored  (%d rows): %.300s",
				table, len(wantRows), strings.Join(wantRows, " | "), len(gotRows), strings.Join(gotRows, " | "))
		}
	}
}

// useBackupEnvironment gives the test a database with a row in every area of
// the application, an upload directory with a file and a configuration file.
func useBackupEnvironment(t *testing.T) (*middleware.User, string) {
	t.Helper()
	user := useSQLite(t)
	uploadedFile := seedItemWithEverything(t) // also points config.C.UploadDir at a temp directory

	previousConfig := config.C.ConfigPath
	config.C.ConfigPath = filepath.Join(t.TempDir(), "itemplus.conf")
	t.Cleanup(func() { config.C.ConfigPath = previousConfig })
	if err := os.WriteFile(config.C.ConfigPath, []byte("APP_NAME=backed-up\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	// The areas that backups used to leave out.
	now := database.TimestampNow()
	mustExec(t, "INSERT INTO generic_sales_platforms (name, created_at, updated_at) VALUES ('eBay', ?, ?)", now, now)
	mustExec(t, "UPDATE archive_items SET sales_platform_id = 1 WHERE id = 1")
	mustExec(t, "INSERT INTO archive_maintenance_history (reminder_id, item_id, action, title, due_date, performed_at) VALUES (1, 1, 'completed', 'Pruefen', '2026-01-01', ?)", now)
	mustExec(t, "INSERT INTO inventory_sessions (realm, title) VALUES ('archive', 'Jahresinventur')")
	mustExec(t, "INSERT INTO inventory_session_entries (session_id, item_id, item_name) VALUES (1, 1, 'Bohrmaschine')")
	mustExec(t, "INSERT INTO user_settings (user_id, setting_key, value) VALUES (1, 'sidebar.favorites', '[]')")
	mustExec(t, "INSERT INTO collection_items (name, quantity, created_at, updated_at) VALUES ('007 Nightfire', 1, ?, ?)", now, now)

	// Rows written directly like the ones above skip what the application
	// keeps consistent (bundle flags, the stock movement of a checkout).
	// Opening the database again runs the migrations that repair that, as a
	// restore does; afterwards the data is in the state a backup would see.
	if err := database.ReconnectConfigured(); err != nil {
		t.Fatalf("reopen database: %v", err)
	}
	return user, uploadedFile
}

func exportBundle(t *testing.T, user *middleware.User) []byte {
	t.Helper()
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	c.Set("user", user)
	adminExportBundle(c)
	if rec.Code != http.StatusOK || rec.Body.Len() == 0 {
		t.Fatalf("export: status %d: %.200s", rec.Code, rec.Body.String())
	}
	return rec.Body.Bytes()
}

func recoverBundle(t *testing.T, user *middleware.User, bundle []byte, fields map[string]string) (int, map[string]interface{}) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	body := &bytes.Buffer{}
	form := multipart.NewWriter(body)
	_ = form.WriteField("confirm", "RECOVER")
	for key, value := range fields {
		_ = form.WriteField(key, value)
	}
	part, _ := form.CreateFormFile("file", "backup.zip")
	_, _ = part.Write(bundle)
	_ = form.Close()

	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/", body)
	c.Request.Header.Set("Content-Type", form.FormDataContentType())
	c.Set("user", user)
	adminRecoverBundle(c)

	response := map[string]interface{}{}
	_ = json.Unmarshal(rec.Body.Bytes(), &response)
	return rec.Code, response
}

// rewriteBundle returns a copy of the bundle with some entries replaced
// (or, with nil content, removed) and others added.
func rewriteBundle(t *testing.T, bundle []byte, replace map[string][]byte) []byte {
	t.Helper()
	reader, err := zip.NewReader(bytes.NewReader(bundle), int64(len(bundle)))
	if err != nil {
		t.Fatal(err)
	}
	out := &bytes.Buffer{}
	writer := zip.NewWriter(out)
	written := map[string]bool{}
	for _, file := range reader.File {
		content, replaced := replace[file.Name]
		if replaced && content == nil {
			continue
		}
		if !replaced {
			src, _ := file.Open()
			content, _ = io.ReadAll(src)
			src.Close()
		}
		entry, _ := writer.Create(file.Name)
		_, _ = entry.Write(content)
		written[file.Name] = true
	}
	for name, content := range replace {
		if !written[name] && content != nil {
			entry, _ := writer.Create(name)
			_, _ = entry.Write(content)
		}
	}
	_ = writer.Close()
	return out.Bytes()
}

func bundleEntries(t *testing.T, bundle []byte) map[string][]byte {
	t.Helper()
	reader, err := zip.NewReader(bytes.NewReader(bundle), int64(len(bundle)))
	if err != nil {
		t.Fatalf("the export is not a readable zip file: %v", err)
	}
	entries := map[string][]byte{}
	for _, file := range reader.File {
		src, _ := file.Open()
		entries[file.Name], _ = io.ReadAll(src)
		src.Close()
	}
	return entries
}

// damageEverything changes every part a restore is supposed to bring back.
func damageEverything(t *testing.T, uploadedFile string) {
	t.Helper()
	for _, statement := range []string{
		"DELETE FROM archive_items",
		"DELETE FROM archive_inventory_movements",
		"DELETE FROM archive_maintenance_reminders",
		"DELETE FROM archive_maintenance_history",
		"DELETE FROM archive_item_components",
		"DELETE FROM generic_sales_platforms",
		"DELETE FROM inventory_session_entries",
		"DELETE FROM user_settings",
		"UPDATE users SET display_name = 'changed after the backup'",
		"INSERT INTO archive_categories (name) VALUES ('created after the backup')",
		// A row that would attach itself to restored item 1 if it survived.
		"INSERT INTO collection_inventory_movements (item_id, movement_type, quantity_delta, quantity_before, quantity_after, source) VALUES (1, 'consumed', -1, 1, 0, 'manual')",
	} {
		mustExec(t, statement)
	}
	if err := os.WriteFile(uploadedFile, []byte("overwritten"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(config.C.UploadDir, "added-later.txt"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(config.C.ConfigPath, []byte("APP_NAME=changed\n"), 0o600); err != nil {
		t.Fatal(err)
	}
}

// The point of a backup: after a restore, every table has exactly the rows
// it had, the uploads are back and so is the configuration. The comparison
// covers whatever tables the database has, so a table added in the future is
// checked without anyone remembering to list it.
func TestBackupRestoresEveryTableUploadsAndConfig(t *testing.T) {
	user, uploadedFile := useBackupEnvironment(t)
	before := tableContents(t)
	for _, table := range []string{"archive_inventory_movements", "archive_maintenance_reminders", "archive_maintenance_history", "archive_item_components", "generic_sales_platforms", "inventory_sessions", "inventory_session_entries", "user_settings"} {
		if len(before[table]) == 0 {
			t.Fatalf("test setup: %s is empty, the test would not notice if it were left out", table)
		}
	}

	bundle := exportBundle(t, user)
	entries := bundleEntries(t, bundle)
	var manifest backupBundleManifest
	if err := json.Unmarshal(entries[backupManifestName], &manifest); err != nil || manifest.Version != backupFormatVersion || manifest.Driver != database.CurrentDriver() || len(entries[manifest.Database]) == 0 {
		t.Fatalf("manifest %+v (err %v) does not describe a database dump in the bundle", manifest, err)
	}

	damageEverything(t, uploadedFile)

	status, response := recoverBundle(t, user, bundle, nil)
	if status != http.StatusOK {
		t.Fatalf("recover: status %d: %v", status, response)
	}

	diffContents(t, before, tableContents(t))
	if content, err := os.ReadFile(uploadedFile); err != nil || string(content) != "jpeg" {
		t.Errorf("uploaded file after the restore: %q (err %v), want the backed-up content", content, err)
	}
	if _, err := os.Stat(filepath.Join(config.C.UploadDir, "added-later.txt")); !os.IsNotExist(err) {
		t.Errorf("a file added after the backup is still in the upload directory")
	}
	if content, _ := os.ReadFile(config.C.ConfigPath); string(content) != "APP_NAME=backed-up\n" {
		t.Errorf("configuration after the restore: %q", content)
	}
	if n := count(t, "SELECT COUNT(*) FROM collection_inventory_movements"); n != 0 {
		t.Errorf("%d rows written after the backup survived the restore", n)
	}

	// The restored database is in use: reading and writing work.
	mustExec(t, "INSERT INTO archive_categories (name) VALUES ('after the restore')")
	leftovers, _ := filepath.Glob(filepath.Join(filepath.Dir(config.C.UploadDir), ".itemplus-*"))
	if len(leftovers) != 0 {
		t.Errorf("work directories were left behind: %v", leftovers)
	}
}

func TestRestoreOnlySelectedParts(t *testing.T) {
	user, uploadedFile := useBackupEnvironment(t)
	before := tableContents(t)
	bundle := exportBundle(t, user)
	damageEverything(t, uploadedFile)

	status, response := recoverBundle(t, user, bundle, map[string]string{"restore_uploads": "0", "restore_config": "0"})
	if status != http.StatusOK {
		t.Fatalf("recover: status %d: %v", status, response)
	}
	diffContents(t, before, tableContents(t))
	if content, _ := os.ReadFile(uploadedFile); string(content) != "overwritten" {
		t.Errorf("uploads were restored although they were not selected: %q", content)
	}
	if content, _ := os.ReadFile(config.C.ConfigPath); string(content) != "APP_NAME=changed\n" {
		t.Errorf("configuration was restored although it was not selected: %q", content)
	}
}

// A dump reproduces the engine it came from. Restoring it into the other
// engine is refused before anything is touched.
func TestRestoreRefusesBackupOfAnotherEngine(t *testing.T) {
	user, uploadedFile := useBackupEnvironment(t)
	bundle := exportBundle(t, user)
	damageEverything(t, uploadedFile)
	afterDamage := tableContents(t)

	other := "mysql"
	if database.CurrentDriver() == "mysql" {
		other = "sqlite"
	}
	manifest := fmt.Sprintf(`{"version":2,"driver":%q,"database":"database.json"}`, other)
	status, response := recoverBundle(t, user, rewriteBundle(t, bundle, map[string][]byte{backupManifestName: []byte(manifest)}), nil)
	if status != http.StatusBadRequest || response["code"] != "backup_driver_mismatch" {
		t.Fatalf("status %d, response %v; want 400 backup_driver_mismatch", status, response)
	}

	status, response = recoverBundle(t, user, rewriteBundle(t, bundle, map[string][]byte{backupManifestName: nil}), nil)
	if status != http.StatusBadRequest || response["code"] != "backup_without_manifest" {
		t.Fatalf("bundle without manifest: status %d, response %v", status, response)
	}

	diffContents(t, afterDamage, tableContents(t))
	if content, _ := os.ReadFile(uploadedFile); string(content) != "overwritten" {
		t.Errorf("a refused restore replaced the uploads: %q", content)
	}
}

// A bundle whose database part is unusable must leave the running system
// exactly as it was, and usable.
func TestRestoreWithDamagedDatabaseChangesNothing(t *testing.T) {
	user, uploadedFile := useBackupEnvironment(t)
	bundle := exportBundle(t, user)
	entries := bundleEntries(t, bundle)
	var manifest backupBundleManifest
	_ = json.Unmarshal(entries[backupManifestName], &manifest)
	damageEverything(t, uploadedFile)
	afterDamage := tableContents(t)

	for name, content := range map[string][]byte{
		"garbage":   []byte("this is not a database"),
		"truncated": entries[manifest.Database][:len(entries[manifest.Database])/2],
	} {
		status, response := recoverBundle(t, user, rewriteBundle(t, bundle, map[string][]byte{manifest.Database: content}), nil)
		if status != http.StatusBadRequest {
			t.Errorf("%s: status %d, response %v; want 400", name, status, response)
		}
		diffContents(t, afterDamage, tableContents(t))
		if content, _ := os.ReadFile(uploadedFile); string(content) != "overwritten" {
			t.Errorf("%s: the uploads were replaced although the restore failed", name)
		}
	}
	mustExec(t, "INSERT INTO archive_categories (name) VALUES ('still usable')")
}

// Bundles written up to 1.3.3 hold rows of a fixed list of tables. They can
// still be restored, and what they do not contain must end up empty instead
// of keeping rows that belong to the state before the restore.
func TestRestoreOfOldFormatBundle(t *testing.T) {
	user, uploadedFile := useBackupEnvironment(t)
	driver := database.CurrentDriver()
	damageEverything(t, uploadedFile)

	data := map[string]interface{}{"tables": map[string]interface{}{
		"users":         []map[string]interface{}{{"id": 1, "apple_sub": "magic_a@example.de", "email": "a@example.de", "display_name": "Aus altem Backup", "is_admin": 1, "is_active": 1, "permissions": "[]"}},
		"archive_items": []map[string]interface{}{{"id": 1, "name": "Aus altem Backup", "quantity": 4}},
	}}
	dataJSON, _ := json.Marshal(data)
	out := &bytes.Buffer{}
	writer := zip.NewWriter(out)
	for name, content := range map[string][]byte{
		backupManifestName: []byte(fmt.Sprintf(`{"version":1,"driver":%q}`, driver)),
		backupLegacyName:   dataJSON,
	} {
		entry, _ := writer.Create(name)
		_, _ = entry.Write(content)
	}
	_ = writer.Close()

	status, response := recoverBundle(t, user, out.Bytes(), map[string]string{"restore_uploads": "0", "restore_config": "0"})
	if status != http.StatusOK {
		t.Fatalf("recover: status %d: %v", status, response)
	}
	var name string
	if err := database.DB.Get(&name, "SELECT name FROM archive_items WHERE id = 1"); err != nil || name != "Aus altem Backup" {
		t.Fatalf("item from the old bundle: %q (err %v)", name, err)
	}
	for _, table := range []string{"collection_inventory_movements", "archive_categories", "inventory_sessions", "generic_sales_platforms"} {
		if n := count(t, "SELECT COUNT(*) FROM "+table); n != 0 {
			t.Errorf("%s: %d rows from before the restore are still there", table, n)
		}
	}
}
