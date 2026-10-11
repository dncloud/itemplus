package items

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
	"github.com/itemplus/backend/internal/testdb"
)

func mustExec(t *testing.T, query string, args ...interface{}) {
	t.Helper()
	if _, err := database.DB.Exec(query, args...); err != nil {
		t.Fatalf("%s: %v", query, err)
	}
}

func countRows(t *testing.T, query string, args ...interface{}) int {
	t.Helper()
	var n int
	if err := database.DB.Get(&n, query, args...); err != nil {
		t.Fatalf("%s: %v", query, err)
	}
	return n
}

// request sends a JSON request through a router that has the item routes'
// id check in front of the handler, as the real routes do.
func request(t *testing.T, method, id string, handler gin.HandlerFunc, body interface{}) (int, map[string]interface{}) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(middleware.NumericParams("id"))
	router.Handle(method, "/items", handler)
	router.Handle(method, "/items/:id", handler)

	payload, _ := json.Marshal(body)
	target := "/items"
	if id != "" {
		target += "/" + id
	}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(method, target, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")

	done := make(chan struct{})
	go func() { defer close(done); router.ServeHTTP(rec, req) }()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatalf("%s %s did not return: it waits for the database connection it is holding itself", method, target)
	}

	response := map[string]interface{}{}
	_ = json.Unmarshal(rec.Body.Bytes(), &response)
	return rec.Code, response
}

func TestItemUpdateOfUnknownItemIsNotFound(t *testing.T) {
	testdb.Use(t)
	if status, response := request(t, http.MethodPut, "999", updateItem("archive"), map[string]interface{}{"name": "x"}); status != http.StatusNotFound {
		t.Fatalf("status %d, response %v; want 404", status, response)
	}
	// An id that is not a number never reaches the database or a folder name.
	for _, id := range []string{"5abc", "..", "1%20OR%201=1"} {
		if status, _ := request(t, http.MethodPut, id, updateItem("archive"), map[string]interface{}{"name": "x"}); status != http.StatusNotFound {
			t.Errorf("id %q: status %d, want 404", id, status)
		}
	}
}

func TestQuantitiesMustBeWholeAndNotNegative(t *testing.T) {
	testdb.Use(t)
	now := database.TimestampNow()
	mustExec(t, "INSERT INTO archive_categories (name, created_at, updated_at) VALUES ('Kleinteile', ?, ?)", now, now)
	if status, response := request(t, http.MethodPost, "", createItem("archive"), map[string]interface{}{"name": "Schrauben", "category_id": 1, "quantity": -5}); status != http.StatusBadRequest {
		t.Fatalf("create with negative quantity: status %d, response %v", status, response)
	}
	status, created := request(t, http.MethodPost, "", createItem("archive"), map[string]interface{}{"name": "Schrauben", "category_id": 1, "quantity": 10})
	if status != http.StatusCreated {
		t.Fatalf("create: status %d, response %v", status, created)
	}

	for name, body := range map[string]map[string]interface{}{
		"negative quantity":         {"quantity": -1},
		"fractional quantity":       {"quantity": 2.5},
		"quantity as text":          {"quantity": "viele"},
		"quantity removed":          {"quantity": nil},
		"negative minimum quantity": {"minimum_quantity": -3},
	} {
		if status, response := request(t, http.MethodPut, "1", updateItem("archive"), body); status != http.StatusBadRequest {
			t.Errorf("%s: status %d, response %v; want 400", name, status, response)
		}
	}
	var quantity int
	if err := database.DB.Get(&quantity, "SELECT quantity FROM archive_items WHERE id = 1"); err != nil || quantity != 10 {
		t.Fatalf("quantity after refused updates: %d (err %v), want 10", quantity, err)
	}

	// Valid changes still work, including zero and clearing the minimum.
	if status, response := request(t, http.MethodPut, "1", updateItem("archive"), map[string]interface{}{"quantity": 0, "minimum_quantity": nil}); status != http.StatusOK {
		t.Fatalf("valid update: status %d, response %v", status, response)
	}
}

// An item is never without a category: creating one needs a category that
// exists, and an update may change the category but not remove it. Updates
// that do not mention the category work as before, also for items that an
// older version let through without one.
func TestItemNeedsACategory(t *testing.T) {
	testdb.Use(t)
	now := database.TimestampNow()
	mustExec(t, "INSERT INTO archive_categories (name, created_at, updated_at) VALUES ('Werkzeug', ?, ?)", now, now)
	mustExec(t, "INSERT INTO archive_categories (name, created_at, updated_at) VALUES ('Kabel', ?, ?)", now, now)

	for name, body := range map[string]map[string]interface{}{
		"no category":      {"name": "Hammer"},
		"category null":    {"name": "Hammer", "category_id": nil},
		"unknown category": {"name": "Hammer", "category_id": 99},
	} {
		status, response := request(t, http.MethodPost, "", createItem("archive"), body)
		if status != http.StatusBadRequest || response["code"] != "category_required" {
			t.Errorf("create with %s: status %d, response %v; want 400 category_required", name, status, response)
		}
	}
	if n := countRows(t, "SELECT COUNT(*) FROM archive_items"); n != 0 {
		t.Fatalf("%d items were created without a category", n)
	}

	if status, response := request(t, http.MethodPost, "", createItem("archive"), map[string]interface{}{"name": "Hammer", "category_id": 1}); status != http.StatusCreated {
		t.Fatalf("create with a category: status %d, response %v", status, response)
	}
	for name, body := range map[string]map[string]interface{}{
		"category removed":  {"category_id": nil},
		"unknown category":  {"category_id": 99},
		"category as text":  {"category_id": "Kabel"},
		"fractional number": {"category_id": 1.5},
	} {
		status, response := request(t, http.MethodPut, "1", updateItem("archive"), body)
		if status != http.StatusBadRequest || response["code"] != "category_required" {
			t.Errorf("update with %s: status %d, response %v; want 400 category_required", name, status, response)
		}
	}
	if status, response := request(t, http.MethodPut, "1", updateItem("archive"), map[string]interface{}{"category_id": 2}); status != http.StatusOK {
		t.Fatalf("moving the item to another category: status %d, response %v", status, response)
	}
	if n := countRows(t, "SELECT COUNT(*) FROM archive_items WHERE id = 1 AND category_id = 2"); n != 1 {
		t.Fatal("the item is not in its new category")
	}

	mustExec(t, "INSERT INTO archive_items (name, quantity, created_at, updated_at) VALUES ('Altlast', 1, ?, ?)", now, now) // item 2
	if status, response := request(t, http.MethodPut, "2", updateItem("archive"), map[string]interface{}{"quantity": 3}); status != http.StatusOK {
		t.Fatalf("partial update of an old item without category: status %d, response %v", status, response)
	}
}

// Clients may address properties by name instead of id. Looking the name up
// must happen inside the transaction that is saving the item.
func TestItemPropertiesCanBeSavedByName(t *testing.T) {
	testdb.Use(t)
	now := database.TimestampNow()
	mustExec(t, "INSERT INTO archive_categories (name, created_at, updated_at) VALUES ('Werkzeug', ?, ?)", now, now)
	mustExec(t, "INSERT INTO archive_properties (category_id, name, property_type, created_at, updated_at) VALUES (1, 'Seriennummer', 'text', ?, ?)", now, now)

	status, response := request(t, http.MethodPost, "", createItem("archive"), map[string]interface{}{
		"name": "Bohrmaschine", "category_id": 1, "properties": map[string]interface{}{"Seriennummer": "007"},
	})
	if status != http.StatusCreated {
		t.Fatalf("create: status %d, response %v", status, response)
	}
	if status, response := request(t, http.MethodPut, "1", updateItem("archive"), map[string]interface{}{
		"properties": map[string]interface{}{"Seriennummer": "0815", "Gibt es nicht": "x"},
	}); status != http.StatusOK {
		t.Fatalf("update: status %d, response %v", status, response)
	}

	var value string
	if err := database.DB.Get(&value, "SELECT value FROM archive_item_properties WHERE item_id = 1 AND property_id = 1"); err != nil || value != `"0815"` {
		t.Fatalf("stored value %q (err %v), want \"0815\"", value, err)
	}
}
