package operations

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
	itemscore "github.com/itemplus/backend/internal/core/items"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

func count(t *testing.T, query string, args ...interface{}) int {
	t.Helper()
	var n int
	if err := database.DB.Get(&n, query, args...); err != nil {
		t.Fatalf("%s: %v", query, err)
	}
	return n
}

// seedItemWithEverything gives item 1 one row in every table that depends on
// an item, plus an uploaded file, and returns the file's full path.
func seedItemWithEverything(t *testing.T) string {
	t.Helper()
	previousUploadDir := config.C.UploadDir
	config.C.UploadDir = t.TempDir()
	t.Cleanup(func() { config.C.UploadDir = previousUploadDir })

	now := database.TimestampNow()
	mustExec(t, "INSERT INTO archive_items (name, quantity, created_at, updated_at) VALUES ('Akku', 1, ?, ?)", now, now) // item 2
	mustExec(t, "INSERT INTO archive_categories (name, created_at, updated_at) VALUES ('Werkzeug', ?, ?)", now, now)
	mustExec(t, "INSERT INTO archive_properties (category_id, name, property_type, created_at, updated_at) VALUES (1, 'Seriennummer', 'text', ?, ?)", now, now)

	relativePath := filepath.Join("archive", "1", "foto.jpg")
	fullPath := filepath.Join(config.C.UploadDir, relativePath)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(fullPath, []byte("jpeg"), 0o644); err != nil {
		t.Fatal(err)
	}

	for _, itemID := range []int{1, 2} {
		file := ""
		if itemID == 1 {
			file = filepath.ToSlash(relativePath)
		}
		mustExec(t, "INSERT INTO archive_attachments (item_id, filename, file_path, storage_backend, attachment_type, created_at, updated_at) VALUES (?, 'foto.jpg', ?, 'local', 'image', ?, ?)", itemID, file, now, now)
		mustExec(t, "INSERT INTO archive_item_properties (item_id, property_id, value) VALUES (?, 1, '\"SN-1\"')", itemID)
		mustExec(t, "INSERT INTO archive_checkouts (item_id, user_id, status, created_at, updated_at) VALUES (?, 1, 'active', ?, ?)", itemID, now, now)
		mustExec(t, "INSERT INTO archive_inventory_movements (item_id, movement_type, quantity_delta, quantity_before, quantity_after, source, created_at) VALUES (?, 'created', 1, 0, 1, 'item', ?)", itemID, now)
		mustExec(t, "INSERT INTO archive_maintenance_reminders (item_id, title, reminder_type, due_date, status, created_by, created_at, updated_at) VALUES (?, 'Pruefen', 'maintenance', '2026-01-01', 'open', 1, ?, ?)", itemID, now, now)
	}
	mustExec(t, "INSERT INTO archive_item_components (parent_item_id, child_item_id) VALUES (1, 2)")
	return fullPath
}

// Rows that mean nothing without their item, and rows that must outlive it.
var (
	itemOwnedTables = []string{"archive_item_properties", "archive_inventory_movements", "archive_maintenance_reminders"}
	itemKeptTables  = []string{"archive_checkouts", "archive_attachments"}
)

// The SQLite schema cascades on delete and the MySQL schema has no foreign
// keys, so on its own each database would do something different. Deleting
// an item must give the same result on both: its own data goes, loans and
// uploaded files stay.
func TestDeleteItemKeepsLoansAndFiles(t *testing.T) {
	useSQLite(t)
	uploadedFile := seedItemWithEverything(t)
	now := database.TimestampNow()
	mustExec(t, "INSERT INTO archive_attachments (item_id, filename, file_path, storage_backend, attachment_type, url, created_at, updated_at) VALUES (1, 'Anleitung', '', 'external_url', 'link', 'https://example.org/a.pdf', ?, ?)", now, now)

	found, err := itemscore.DeleteItem("archive", 1)
	if err != nil || !found {
		t.Fatalf("DeleteItem: found=%v err=%v", found, err)
	}

	if n := count(t, "SELECT COUNT(*) FROM archive_items WHERE id = 1"); n != 0 {
		t.Fatal("item still exists")
	}
	for _, table := range itemOwnedTables {
		if n := count(t, "SELECT COUNT(*) FROM "+table+" WHERE item_id = 1"); n != 0 {
			t.Errorf("%s: %d rows of the deleted item are left", table, n)
		}
	}
	for _, table := range append(itemOwnedTables, itemKeptTables...) {
		if n := count(t, "SELECT COUNT(*) FROM "+table+" WHERE item_id = 2"); n != 1 {
			t.Errorf("%s: the other item has %d rows, want 1", table, n)
		}
	}
	if n := count(t, "SELECT COUNT(*) FROM archive_item_components"); n != 0 {
		t.Errorf("%d bundle links are left", n)
	}
	if n := count(t, "SELECT COUNT(*) FROM archive_items WHERE id = 2"); n != 1 {
		t.Error("the former bundle component was deleted as well")
	}

	// The loan goes on, and can still be listed and returned.
	if n := count(t, "SELECT COUNT(*) FROM archive_checkouts WHERE item_id = 1 AND status = 'active'"); n != 1 {
		t.Fatalf("the active loan of the deleted item is gone (%d rows)", n)
	}
	user, _ := loadTestUser(t)
	rec := serve(checkinItem, user, gin.Params{{Key: "realm", Value: "archive"}, {Key: "item_id", Value: "1"}}, map[string]interface{}{})
	if rec.Code != http.StatusOK || count(t, "SELECT COUNT(*) FROM archive_checkouts WHERE item_id = 1 AND status = 'returned'") != 1 {
		t.Fatalf("returning the loan of a deleted item: status %d: %s", rec.Code, rec.Body.String())
	}

	// The file and its record stay for the administrator; the link, which has
	// no file, is gone.
	if _, err := os.Stat(uploadedFile); err != nil {
		t.Fatalf("the uploaded file was removed together with the item: %v", err)
	}
	if n := count(t, "SELECT COUNT(*) FROM archive_attachments WHERE item_id = 1 AND file_path <> ''"); n != 1 {
		t.Errorf("%d records of the kept file, want 1", n)
	}
	if n := count(t, "SELECT COUNT(*) FROM archive_attachments WHERE item_id = 1 AND storage_backend = 'external_url'"); n != 0 {
		t.Errorf("the link attachment of the deleted item is still there")
	}

	if found, err := itemscore.DeleteItem("archive", 1); found || err != nil {
		t.Fatalf("second DeleteItem: found=%v err=%v, want not found", found, err)
	}
	if _, err := itemscore.DeleteItem("archive_items; DROP TABLE users", 1); err == nil {
		t.Fatal("an invalid realm must be refused")
	}
}

func loadTestUser(t *testing.T) (*middleware.User, error) {
	t.Helper()
	var user middleware.User
	if err := database.DB.Get(&user, "SELECT * FROM users WHERE id = 1"); err != nil {
		t.Fatalf("load user: %v", err)
	}
	return &user, nil
}

func unconnectedPaths(t *testing.T) map[string]itemscore.UnconnectedFile {
	t.Helper()
	files, err := itemscore.ListUnconnectedFiles()
	if err != nil {
		t.Fatalf("ListUnconnectedFiles: %v", err)
	}
	byPath := map[string]itemscore.UnconnectedFile{}
	for _, file := range files {
		byPath[file.Path] = file
	}
	return byPath
}

func writeUpload(t *testing.T, relativePath string) string {
	t.Helper()
	fullPath := filepath.Join(config.C.UploadDir, filepath.FromSlash(relativePath))
	if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(fullPath, []byte("data"), 0o644); err != nil {
		t.Fatal(err)
	}
	return fullPath
}

func TestUnconnectedFilesListAndDelete(t *testing.T) {
	useSQLite(t)
	attachmentOfItem1 := seedItemWithEverything(t)
	now := database.TimestampNow()

	// Item 2 keeps an attachment and a file property; both are in use.
	inUseAttachment := writeUpload(t, "archive/2/bild.png")
	mustExec(t, "UPDATE archive_attachments SET file_path = 'archive/2/bild.png' WHERE item_id = 2")
	inUseProperty := writeUpload(t, "archive/2/props/handbuch.pdf")
	mustExec(t, `UPDATE archive_item_properties SET value = '{"filename":"Handbuch.pdf","path":"archive/2/props/handbuch.pdf"}' WHERE item_id = 2`)
	// A stray file in the folder of an existing item, and files elsewhere.
	writeUpload(t, "archive/2/verwaist.jpg")
	avatar := writeUpload(t, "users/1/avatar/ich.png")
	writeUpload(t, "collection/77/cover.jpg") // no such item, no record
	_ = now

	before := unconnectedPaths(t)
	if len(before) != 2 || before["archive/2/verwaist.jpg"].Reason != itemscore.UnconnectedNotReferenced || before["collection/77/cover.jpg"].Reason != itemscore.UnconnectedItemDeleted {
		t.Fatalf("before deleting item 1: %+v; want the stray file and the file of the unknown collection item", before)
	}

	if _, err := itemscore.DeleteItem("archive", 1); err != nil {
		t.Fatal(err)
	}
	listed := unconnectedPaths(t)
	file, ok := listed["archive/1/foto.jpg"]
	if !ok || file.Reason != itemscore.UnconnectedItemDeleted || file.OriginalName != "foto.jpg" || file.ItemID != 1 || file.Realm != "archive" || file.Size != 4 {
		t.Fatalf("file of the deleted item: %+v (listed: %v)", file, ok)
	}
	if len(listed) != 3 {
		t.Fatalf("%d unconnected files, want 3: %+v", len(listed), listed)
	}

	// Only unconnected files can be deleted, whatever the request says.
	deleted, skipped, err := itemscore.DeleteUnconnectedFiles([]string{
		"archive/1/foto.jpg",
		"archive/2/bild.png",           // attachment in use
		"archive/2/props/handbuch.pdf", // file property in use
		"users/1/avatar/ich.png",       // outside the item folders
		"../itemplus.conf",             // outside the upload directory
		"archive/1/gibt-es-nicht.jpg",
	})
	if err != nil || len(deleted) != 1 || deleted[0] != "archive/1/foto.jpg" || len(skipped) != 5 {
		t.Fatalf("deleted %v, skipped %v, err %v; want only the file of the deleted item", deleted, skipped, err)
	}
	for name, path := range map[string]string{"attachment in use": inUseAttachment, "file property in use": inUseProperty, "avatar": avatar} {
		if _, err := os.Stat(path); err != nil {
			t.Errorf("%s was removed: %v", name, err)
		}
	}
	if _, err := os.Stat(attachmentOfItem1); !os.IsNotExist(err) {
		t.Errorf("the selected file is still on disk (err %v)", err)
	}
	if _, err := os.Stat(filepath.Dir(attachmentOfItem1)); !os.IsNotExist(err) {
		t.Errorf("the emptied folder of the deleted item is still on disk (err %v)", err)
	}
	if _, err := os.Stat(filepath.Join(config.C.UploadDir, "archive")); err != nil {
		t.Errorf("the realm folder must stay: %v", err)
	}
	if n := count(t, "SELECT COUNT(*) FROM archive_attachments WHERE item_id = 1"); n != 0 {
		t.Errorf("%d attachment records of the removed file are left", n)
	}
	if after := unconnectedPaths(t); len(after) != 2 {
		t.Errorf("%d unconnected files left, want the 2 that were not selected: %+v", len(after), after)
	}
}

func TestDeleteAttachmentRemovesItsFile(t *testing.T) {
	useSQLite(t)
	uploadedFile := seedItemWithEverything(t)
	// A sibling file keeps the folder alive.
	sibling := filepath.Join(filepath.Dir(uploadedFile), "anderes.jpg")
	if err := os.WriteFile(sibling, []byte("jpeg"), 0o644); err != nil {
		t.Fatal(err)
	}

	found, err := itemscore.DeleteAttachment("archive", 1)
	if err != nil || !found {
		t.Fatalf("DeleteAttachment: found=%v err=%v", found, err)
	}
	if _, err := os.Stat(uploadedFile); !os.IsNotExist(err) {
		t.Errorf("uploaded file is still on disk (err %v)", err)
	}
	if _, err := os.Stat(sibling); err != nil {
		t.Errorf("another file in the same folder was removed: %v", err)
	}
	if n := count(t, "SELECT COUNT(*) FROM archive_attachments"); n != 1 {
		t.Errorf("%d attachment rows left, want the other item's one", n)
	}
	if found, _ := itemscore.DeleteAttachment("archive", 1); found {
		t.Error("second DeleteAttachment reported success")
	}
}

func TestDeletePropertyRemovesItsValues(t *testing.T) {
	useSQLite(t)
	seedItemWithEverything(t)

	found, err := itemscore.DeleteProperty("archive", 1)
	if err != nil || !found {
		t.Fatalf("DeleteProperty: found=%v err=%v", found, err)
	}
	if n := count(t, "SELECT COUNT(*) FROM archive_item_properties"); n != 0 {
		t.Errorf("%d values of the deleted property are left", n)
	}
	if n := count(t, "SELECT COUNT(*) FROM archive_items"); n != 2 {
		t.Errorf("%d items left, want 2", n)
	}
}

// The iPhone confirmation is a second pair of eyes. It must not be possible
// to skip it by sending the confirmation from the browser, or to confirm
// something nobody asked for.
func TestDeleteConfirmationNeedsOpenRequestFromIPhone(t *testing.T) {
	user := useSQLite(t)
	seedItemWithEverything(t)
	confirm := map[string]interface{}{"entity_type": "item", "entity_id": float64(1), "realm": "archive"}
	itemExists := func() bool { return count(t, "SELECT COUNT(*) FROM archive_items WHERE id = 1") == 1 }

	handleDeleteConfirm(confirm, user.ID, "ios")
	if !itemExists() {
		t.Fatal("an iPhone confirmation without a request deleted the item")
	}

	key := pendingDeleteKey{user.ID, "item", 1}
	rememberPendingDelete(key, "archive", 0)
	handleDeleteConfirm(confirm, user.ID, "browser")
	if !itemExists() {
		t.Fatal("a confirmation sent by a browser deleted the item")
	}

	// Someone else's confirmation does not count for this user's request.
	handleDeleteConfirm(confirm, user.ID+1, "ios")
	if !itemExists() {
		t.Fatal("another user's confirmation deleted the item")
	}

	// The realm of the request decides, not the one in the confirmation.
	wrongRealm := map[string]interface{}{"entity_type": "item", "entity_id": float64(1), "realm": "collection"}
	handleDeleteConfirm(wrongRealm, user.ID, "ios")
	if itemExists() {
		t.Fatal("the confirmed item was not deleted")
	}
	if n := count(t, "SELECT COUNT(*) FROM archive_item_properties WHERE item_id = 1"); n != 0 {
		t.Fatalf("%d property values of the deleted item are left", n)
	}

	// A request is used up by its confirmation.
	if _, open := takePendingDelete(key); open {
		t.Fatal("the request is still open after it was confirmed")
	}
}

func TestRejectedDeleteRequestCannotBeConfirmedLater(t *testing.T) {
	user := useSQLite(t)
	seedItemWithEverything(t)
	message := map[string]interface{}{"type": "delete.reject", "entity_type": "item", "entity_id": float64(1)}

	rememberPendingDelete(pendingDeleteKey{user.ID, "item", 1}, "archive", 0)
	handleWSMessage(message, user.ID, 0, "ios")
	handleDeleteConfirm(map[string]interface{}{"entity_type": "item", "entity_id": float64(1)}, user.ID, "ios")

	if count(t, "SELECT COUNT(*) FROM archive_items WHERE id = 1") != 1 {
		t.Fatal("a rejected request was confirmed afterwards")
	}
}

// A category or location that items still belong to must not disappear from
// under them, on either database.
func TestCategoryInUseCannotBeDeleted(t *testing.T) {
	useSQLite(t)
	seedItemWithEverything(t) // creates category 1 with one property and a value per item
	mustExec(t, "UPDATE archive_items SET category_id = 1 WHERE id = 1")

	found, err := itemscore.DeleteCategory("archive", 1)
	var inUse *itemscore.InUseError
	if found || !errors.As(err, &inUse) || inUse.Items != 1 {
		t.Fatalf("found=%v err=%v; want an InUseError for 1 item", found, err)
	}
	if count(t, "SELECT COUNT(*) FROM archive_categories WHERE id = 1") != 1 || count(t, "SELECT COUNT(*) FROM archive_properties WHERE category_id = 1") != 1 {
		t.Fatal("the category in use, or its properties, were deleted")
	}

	// Once no item uses it, it goes together with its property definitions.
	mustExec(t, "UPDATE archive_items SET category_id = NULL WHERE id = 1")
	if found, err := itemscore.DeleteCategory("archive", 1); !found || err != nil {
		t.Fatalf("unused category: found=%v err=%v", found, err)
	}
	for _, table := range []string{"archive_categories", "archive_properties", "archive_item_properties"} {
		if n := count(t, "SELECT COUNT(*) FROM "+table); n != 0 {
			t.Errorf("%s: %d rows left after deleting the unused category", table, n)
		}
	}
	if found, err := itemscore.DeleteCategory("archive", 1); found || err != nil {
		t.Fatalf("second delete: found=%v err=%v, want not found", found, err)
	}
}

func TestLocationInUseCannotBeDeleted(t *testing.T) {
	useSQLite(t)
	now := database.TimestampNow()
	mustExec(t, "INSERT INTO archive_locations (name, created_at, updated_at) VALUES ('Keller', ?, ?)", now, now)
	mustExec(t, "INSERT INTO archive_locations (name, parent_id, created_at, updated_at) VALUES ('Regal A', 1, ?, ?)", now, now)
	mustExec(t, "UPDATE archive_items SET location_id = 2 WHERE id = 1")

	var inUse *itemscore.InUseError
	if found, err := itemscore.DeleteLocation("archive", 1); found || !errors.As(err, &inUse) || inUse.Children != 1 || inUse.Items != 0 {
		t.Fatalf("location with a sub-location: found=%v err=%v", found, err)
	}
	if found, err := itemscore.DeleteLocation("archive", 2); found || !errors.As(err, &inUse) || inUse.Items != 1 {
		t.Fatalf("location with an item: found=%v err=%v", found, err)
	}
	if count(t, "SELECT COUNT(*) FROM archive_locations") != 2 {
		t.Fatal("a location in use was deleted")
	}

	mustExec(t, "UPDATE archive_items SET location_id = NULL WHERE id = 1")
	if found, err := itemscore.DeleteLocation("archive", 2); !found || err != nil {
		t.Fatalf("empty sub-location: found=%v err=%v", found, err)
	}
	if found, err := itemscore.DeleteLocation("archive", 1); !found || err != nil {
		t.Fatalf("location without sub-locations: found=%v err=%v", found, err)
	}
}

// The iPhone is not even asked to confirm a deletion that would be refused,
// and a confirmation cannot force it either.
func TestInUseCategoryIsRefusedOnTheConfirmationRoute(t *testing.T) {
	user := useSQLite(t)
	seedItemWithEverything(t)
	mustExec(t, "UPDATE archive_items SET category_id = 1 WHERE id = 1")
	key := pendingDeleteKey{user.ID, "category", 1}

	handleDeleteRequest(map[string]interface{}{"entity_type": "category", "entity_id": float64(1), "realm": "archive"}, user.ID, 0)
	if _, open := takePendingDelete(key); open {
		t.Fatal("a request for a category in use was forwarded for confirmation")
	}

	rememberPendingDelete(key, "archive", 0)
	handleDeleteConfirm(map[string]interface{}{"entity_type": "category", "entity_id": float64(1)}, user.ID, "ios")
	if count(t, "SELECT COUNT(*) FROM archive_categories WHERE id = 1") != 1 {
		t.Fatal("a confirmed request deleted a category that is in use")
	}
}
