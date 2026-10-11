package items

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
	"github.com/itemplus/backend/internal/testdb"
)

func seedAttachmentItems(t *testing.T) {
	t.Helper()
	now := database.TimestampNow()
	mustExec(t, "INSERT INTO collection_categories (id, name, created_at, updated_at) VALUES (1, 'Spiele', ?, ?)", now, now)
	mustExec(t, "INSERT INTO collection_items (id, name, category_id, created_at, updated_at) VALUES (1, 'Mortal Kombat 3', 1, ?, ?), (2, 'Tetris', 1, ?, ?)", now, now, now, now)
}

func addAttachment(t *testing.T, itemID int, name string, order int) int64 {
	t.Helper()
	now := database.TimestampNow()
	result, err := database.DB.Exec("INSERT INTO collection_attachments (item_id, filename, `order`, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", itemID, name, order, now, now)
	if err != nil {
		t.Fatal(err)
	}
	id, _ := result.LastInsertId()
	return id
}

// attachmentNames lists the attachments of an item in their order and fails
// when two of them stand at the same position.
func attachmentNames(t *testing.T, itemID int) []string {
	t.Helper()
	var rows []struct {
		Filename string `db:"filename"`
		Order    int    `db:"order"`
	}
	if err := database.DB.Select(&rows, "SELECT filename, `order` FROM collection_attachments WHERE item_id = ? ORDER BY `order`, id", itemID); err != nil {
		t.Fatal(err)
	}
	names := make([]string, 0, len(rows))
	for index, row := range rows {
		if index > 0 && rows[index-1].Order == row.Order {
			t.Fatalf("%s and %s both stand at position %d", rows[index-1].Filename, row.Filename, row.Order)
		}
		names = append(names, row.Filename)
	}
	return names
}

func attachmentCall(t *testing.T, method, target string, handler gin.HandlerFunc, body interface{}) int {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set("user", &middleware.User{ID: 1}); c.Next() })
	router.PUT("/items/:id/attachments/order", handler)
	router.POST("/items/:id/attachments/link", handler)
	router.PUT("/attachments/:attId", handler)
	payload, _ := json.Marshal(body)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(method, target, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	return rec.Code
}

// What 1.3.4 left behind: the catalog numbered every 25 images from 0 again.
// At the start the images get the order they were added in, an image made
// the main picture by hand stays in front, and other items are not touched.
func TestStartRepairsPositionsThatWereStoredTwice(t *testing.T) {
	testdb.Use(t)
	seedAttachmentItems(t)
	for index := 0; index < 5; index++ {
		addAttachment(t, 1, fmt.Sprintf("cover-%d", index), index)
	}
	for index := 0; index < 3; index++ {
		addAttachment(t, 1, fmt.Sprintf("shot-%d", index), index)
	}
	addAttachment(t, 1, "main", -1)
	addAttachment(t, 2, "b", 7)
	addAttachment(t, 2, "a", 3)

	repaired, err := database.RepairAttachmentOrder(database.DB)
	if err != nil || repaired != 1 {
		t.Fatalf("repaired %d items, error %v; want 1", repaired, err)
	}
	want := "[main cover-0 cover-1 cover-2 cover-3 cover-4 shot-0 shot-1 shot-2]"
	if got := fmt.Sprint(attachmentNames(t, 1)); got != want {
		t.Fatalf("order after the repair:\n got %s\nwant %s", got, want)
	}
	if n := countRows(t, "SELECT COUNT(*) FROM collection_attachments WHERE item_id = 2 AND `order` IN (3, 7)"); n != 2 {
		t.Fatal("an item with distinct positions was changed")
	}
	if repaired, _ := database.RepairAttachmentOrder(database.DB); repaired != 0 {
		t.Fatalf("a second run found %d items to repair", repaired)
	}
}

// Adding goes to the end whatever the client asks for, the arranged order is
// stored as arranged, and setting one position moves the others out of the way.
func TestAttachmentsNeverShareAPosition(t *testing.T) {
	testdb.Use(t)
	seedAttachmentItems(t)
	a := addAttachment(t, 1, "a", 0)
	b := addAttachment(t, 1, "b", 1)
	c := addAttachment(t, 1, "c", 2)
	other := addAttachment(t, 2, "other", 0)

	// Two links added with the position an old client would send for both.
	for _, name := range []string{"d", "e"} {
		body := map[string]interface{}{"url": "https://example.com/" + name, "filename": name, "order": 0}
		if status := attachmentCall(t, http.MethodPost, "/items/1/attachments/link", addLinkAttachment("collection"), body); status != http.StatusCreated {
			t.Fatalf("adding link %s: status %d", name, status)
		}
	}
	if got := fmt.Sprint(attachmentNames(t, 1)); got != "[a b c d e]" {
		t.Fatalf("after adding: %s", got)
	}

	// The order arranged by dragging; what is not named keeps its order behind.
	if status := attachmentCall(t, http.MethodPut, "/items/1/attachments/order", reorderAttachments("collection"), map[string]interface{}{"ids": []int64{c, a}}); status != http.StatusOK {
		t.Fatalf("reorder: status %d", status)
	}
	if got := fmt.Sprint(attachmentNames(t, 1)); got != "[c a b d e]" {
		t.Fatalf("after reordering: %s", got)
	}
	for name, ids := range map[string][]int64{"another item's attachment": {a, other}, "the same one twice": {a, a}, "nothing": {}} {
		if status := attachmentCall(t, http.MethodPut, "/items/1/attachments/order", reorderAttachments("collection"), map[string]interface{}{"ids": ids}); status != http.StatusBadRequest {
			t.Errorf("reorder with %s: status %d, want 400", name, status)
		}
	}

	// One position set directly, as the iOS app and older web clients do.
	for _, step := range []struct {
		id       int64
		position int
		want     string
	}{
		{b, 0, "[b c a d e]"},
		{b, 3, "[c a d b e]"},
		{c, 99, "[a d b e c]"},
		{c, -1, "[c a d b e]"},
	} {
		if status := attachmentCall(t, http.MethodPut, fmt.Sprintf("/attachments/%d", step.id), updateAttachment("collection"), map[string]interface{}{"order": step.position}); status != http.StatusOK {
			t.Fatalf("move to %d: status %d", step.position, status)
		}
		if got := fmt.Sprint(attachmentNames(t, 1)); got != step.want {
			t.Fatalf("after moving to %d: got %s, want %s", step.position, got, step.want)
		}
	}
	if status := attachmentCall(t, http.MethodPut, "/attachments/9999", updateAttachment("collection"), map[string]interface{}{"order": 0}); status != http.StatusNotFound {
		t.Fatalf("moving an unknown attachment: status %d, want 404", status)
	}
	if got := fmt.Sprint(attachmentNames(t, 2)); got != "[other]" {
		t.Fatalf("the other item changed: %s", got)
	}
}
