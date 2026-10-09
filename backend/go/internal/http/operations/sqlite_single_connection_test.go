package operations

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
	maintenancecore "github.com/itemplus/backend/internal/core/maintenance"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
	"github.com/itemplus/backend/internal/testdb"
)

// SQLite runs on a single connection. A handler that queries the database
// while a result set or a transaction of its own is still open waits for that
// connection forever and takes every later request down with it. These tests
// run the affected handlers against SQLite and fail if one does not return.

func useSQLite(t *testing.T) *middleware.User {
	t.Helper()
	testdb.Use(t)

	now := database.TimestampNow()
	mustExec(t, "INSERT INTO users (apple_sub, email, display_name, is_admin, is_active, permissions, created_at, updated_at) VALUES ('magic_a@example.de', 'a@example.de', 'Admin', 1, 1, '[]', ?, ?)", now, now)
	mustExec(t, "INSERT INTO archive_items (name, quantity, created_at, updated_at) VALUES ('Bohrmaschine', 2, ?, ?)", now, now)
	var user middleware.User
	if err := database.DB.Get(&user, "SELECT * FROM users WHERE id = 1"); err != nil {
		t.Fatalf("load user: %v", err)
	}
	return &user
}

func mustExec(t *testing.T, query string, args ...interface{}) {
	t.Helper()
	if _, err := database.DB.Exec(query, args...); err != nil {
		t.Fatalf("%s: %v", query, err)
	}
}

// within fails the test when work does not finish in time.
func within(t *testing.T, what string, work func()) {
	t.Helper()
	done := make(chan struct{})
	go func() {
		defer close(done)
		work()
	}()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatalf("%s did not return: it waits for the database connection it is holding itself", what)
	}
}

func serve(handler gin.HandlerFunc, user *middleware.User, params gin.Params, body interface{}) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	payload, _ := json.Marshal(body)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = params
	c.Set("user", user)
	handler(c)
	return rec
}

func TestCheckoutRequestListReturnsOnSQLite(t *testing.T) {
	user := useSQLite(t)
	now := database.TimestampNow()
	for _, status := range []string{"pending", "approved"} {
		mustExec(t, "INSERT INTO checkout_requests (realm, item_id, user_id, status, component_item_ids, created_at, updated_at) VALUES ('archive', 1, 1, ?, '[]', ?, ?)", status, now, now)
	}

	var rec *httptest.ResponseRecorder
	within(t, "listing checkout requests", func() { rec = serve(listCheckoutRequests, user, nil, nil) })

	var rows []map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &rows); err != nil || rec.Code != http.StatusOK || len(rows) != 2 {
		t.Fatalf("status %d, %d rows, err %v: %s", rec.Code, len(rows), err, rec.Body.String())
	}
	if rows[0]["item_name"] != "Bohrmaschine" || rows[0]["user_name"] != "Admin" {
		t.Fatalf("rows are not enriched: %v", rows[0])
	}
}

func TestDirectCheckoutAndReturnOnSQLite(t *testing.T) {
	user := useSQLite(t)
	params := gin.Params{{Key: "realm", Value: "archive"}, {Key: "item_id", Value: "1"}}

	var rec *httptest.ResponseRecorder
	within(t, "checking an item out", func() { rec = serve(checkoutItem, user, params, map[string]interface{}{}) })
	if rec.Code != http.StatusCreated {
		t.Fatalf("checkout: status %d: %s", rec.Code, rec.Body.String())
	}

	within(t, "returning an item", func() { rec = serve(checkinItem, user, params, map[string]interface{}{}) })
	if rec.Code != http.StatusOK {
		t.Fatalf("checkin: status %d: %s", rec.Code, rec.Body.String())
	}

	var movements []string
	if err := database.DB.Select(&movements, "SELECT movement_type FROM archive_inventory_movements ORDER BY id"); err != nil {
		t.Fatal(err)
	}
	if len(movements) != 2 || movements[0] != "checked_out" || movements[1] != "returned" {
		t.Fatalf("movements = %v, want [checked_out returned]", movements)
	}
}

func TestOpenReminderListsReturnOnSQLite(t *testing.T) {
	user := useSQLite(t)
	now := database.TimestampNow()
	mustExec(t, "INSERT INTO archive_maintenance_reminders (item_id, title, reminder_type, due_date, status, created_by, created_at, updated_at) VALUES (1, 'Pruefen', 'maintenance', '2026-01-01', 'open', 1, ?, ?)", now, now)

	var reminders []map[string]interface{}
	within(t, "loading an item's reminders", func() { reminders = maintenancecore.LoadItemReminders("archive", "1", false) })
	if len(reminders) != 1 || reminders[0]["is_overdue"] != true {
		t.Fatalf("reminders = %v, want one overdue reminder", reminders)
	}

	var rec *httptest.ResponseRecorder
	within(t, "loading maintenance statistics", func() { rec = serve(statsMaintenance, user, nil, nil) })
	if rec.Code != http.StatusOK {
		t.Fatalf("stats: status %d: %s", rec.Code, rec.Body.String())
	}
}

func insertPendingRequest(t *testing.T, componentIDs string) string {
	t.Helper()
	now := database.TimestampNow()
	result, err := database.DB.Exec(
		"INSERT INTO checkout_requests (realm, item_id, user_id, status, requested_duration_days, component_item_ids, notes, created_at, updated_at) VALUES ('archive', 1, 1, 'pending', 7, ?, 'Bitte bis Freitag', ?, ?)",
		componentIDs, now, now,
	)
	if err != nil {
		t.Fatalf("insert request: %v", err)
	}
	id, _ := result.LastInsertId()
	return fmt.Sprintf("%d", id)
}

type movementRow struct {
	ItemID     int    `db:"item_id"`
	Type       string `db:"movement_type"`
	CheckoutID *int   `db:"checkout_id"`
	Source     string `db:"source"`
}

// Approving a request must leave the same trail as a direct checkout: the
// request is approved, the checkouts exist and each has its stock movement.
func TestApprovingRequestRecordsCheckoutsAndMovements(t *testing.T) {
	user := useSQLite(t)
	now := database.TimestampNow()
	// Item 1 becomes a bundle with item 2 as its component.
	mustExec(t, "UPDATE archive_items SET is_bundle = 1 WHERE id = 1")
	mustExec(t, "INSERT INTO archive_items (name, quantity, created_at, updated_at) VALUES ('Akku', 1, ?, ?)", now, now)
	mustExec(t, "INSERT INTO archive_item_components (parent_item_id, child_item_id) VALUES (1, 2)")
	requestID := insertPendingRequest(t, "[2]")
	params := gin.Params{{Key: "id", Value: requestID}}

	var rec *httptest.ResponseRecorder
	within(t, "approving a checkout request", func() { rec = serve(approveCheckoutRequest, user, params, nil) })
	if rec.Code != http.StatusOK {
		t.Fatalf("approve: status %d: %s", rec.Code, rec.Body.String())
	}

	var status string
	if err := database.DB.Get(&status, "SELECT status FROM checkout_requests WHERE id = ?", requestID); err != nil || status != "approved" {
		t.Fatalf("request status %q (err %v), want approved", status, err)
	}

	var checkouts []struct {
		ID       int     `db:"id"`
		ItemID   int     `db:"item_id"`
		ParentID *int    `db:"bundle_parent_item_id"`
		DueDate  *string `db:"due_date"`
		Notes    *string `db:"notes"`
	}
	if err := database.DB.Select(&checkouts, "SELECT id, item_id, bundle_parent_item_id, due_date, notes FROM archive_checkouts WHERE status = 'active' ORDER BY id"); err != nil {
		t.Fatal(err)
	}
	if len(checkouts) != 2 || checkouts[0].ItemID != 1 || checkouts[0].ParentID != nil || checkouts[1].ItemID != 2 || checkouts[1].ParentID == nil || *checkouts[1].ParentID != 1 {
		t.Fatalf("checkouts = %+v, want the bundle and its component", checkouts)
	}
	if checkouts[0].DueDate == nil || checkouts[0].Notes == nil || *checkouts[0].Notes != "Bitte bis Freitag" {
		t.Fatalf("checkout lost due date or notes: %+v", checkouts[0])
	}

	var movements []movementRow
	if err := database.DB.Select(&movements, "SELECT item_id, movement_type, checkout_id, source FROM archive_inventory_movements ORDER BY id"); err != nil {
		t.Fatal(err)
	}
	if len(movements) != 2 {
		t.Fatalf("movements = %+v, want one per checkout", movements)
	}
	for i, movement := range movements {
		if movement.Type != "checked_out" || movement.Source != "checkout" || movement.ItemID != checkouts[i].ItemID || movement.CheckoutID == nil || *movement.CheckoutID != checkouts[i].ID {
			t.Fatalf("movement %d = %+v, want checked_out for checkout %+v", i, movement, checkouts[i])
		}
	}
}

func TestRequestCanBeApprovedOnlyOnce(t *testing.T) {
	user := useSQLite(t)
	params := gin.Params{{Key: "id", Value: insertPendingRequest(t, "[]")}}

	// Two admins press "approve" at the same moment.
	codes := make([]int, 2)
	var wg sync.WaitGroup
	for i := range codes {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			codes[i] = serve(approveCheckoutRequest, user, params, nil).Code
		}(i)
	}
	within(t, "two simultaneous approvals", wg.Wait)

	approved := 0
	for _, code := range codes {
		if code == http.StatusOK {
			approved++
		}
	}
	var checkouts, movements int
	_ = database.DB.Get(&checkouts, "SELECT COUNT(*) FROM archive_checkouts")
	_ = database.DB.Get(&movements, "SELECT COUNT(*) FROM archive_inventory_movements")
	if approved != 1 || checkouts != 1 || movements != 1 {
		t.Fatalf("status codes %v, %d checkouts, %d movements; want one approval with one checkout and one movement", codes, checkouts, movements)
	}
}

// If the checkout cannot be written, the request must not stay "approved".
func TestFailedApprovalLeavesRequestPending(t *testing.T) {
	user := useSQLite(t)
	requestID := insertPendingRequest(t, "[]")
	// Make recording the stock movement fail inside the transaction.
	mustExec(t, "ALTER TABLE archive_inventory_movements RENAME TO archive_inventory_movements_gone")

	rec := serve(approveCheckoutRequest, user, gin.Params{{Key: "id", Value: requestID}}, nil)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status %d, want 500: %s", rec.Code, rec.Body.String())
	}

	var status string
	var checkouts int
	_ = database.DB.Get(&status, "SELECT status FROM checkout_requests WHERE id = ?", requestID)
	_ = database.DB.Get(&checkouts, "SELECT COUNT(*) FROM archive_checkouts")
	if status != "pending" || checkouts != 0 {
		t.Fatalf("after a failed approval: status %q, %d checkouts; want pending and none", status, checkouts)
	}
}

// Checkouts approved with a version up to 1.3.3 have no "checked_out" stock
// movement. Starting a newer version must add it, once.
func TestStartupAddsMissingCheckoutMovements(t *testing.T) {
	useSQLite(t)
	created := database.TimestampAt(time.Now().UTC().Add(-48 * time.Hour))
	now := database.TimestampNow()
	insertCheckout := func(status string) int64 {
		result, err := database.DB.Exec("INSERT INTO archive_checkouts (item_id, user_id, status, notes, created_at, updated_at) VALUES (1, 1, ?, 'Leihgabe', ?, ?)", status, created, now)
		if err != nil {
			t.Fatalf("insert checkout: %v", err)
		}
		id, _ := result.LastInsertId()
		return id
	}
	stillLent := insertCheckout("active")
	returnedWithTrace := insertCheckout("returned")
	mustExec(t, "INSERT INTO archive_inventory_movements (item_id, movement_type, quantity_delta, quantity_before, quantity_after, checkout_id, source, created_at) VALUES (1, 'returned', 0, 2, 2, ?, 'checkout', ?)", returnedWithTrace, now)
	longAgo := insertCheckout("returned") // from before the stock history existed
	complete := insertCheckout("active")
	mustExec(t, "INSERT INTO archive_inventory_movements (item_id, movement_type, quantity_delta, quantity_before, quantity_after, checkout_id, source, created_at) VALUES (1, 'checked_out', 0, 2, 2, ?, 'checkout', ?)", complete, now)

	checkedOutMovements := func() map[int64]int {
		var ids []int64
		if err := database.DB.Select(&ids, "SELECT checkout_id FROM archive_inventory_movements WHERE movement_type = 'checked_out'"); err != nil {
			t.Fatal(err)
		}
		counts := map[int64]int{}
		for _, id := range ids {
			counts[id]++
		}
		return counts
	}

	// Opening the database runs the migrations, as a server start does.
	for run := 1; run <= 2; run++ {
		db, err := database.OpenPrepared(config.C.DatabaseURL)
		if err != nil {
			t.Fatalf("run %d: %v", run, err)
		}
		_ = db.Close()

		got := checkedOutMovements()
		if got[stillLent] != 1 || got[returnedWithTrace] != 1 || got[complete] != 1 || got[longAgo] != 0 || len(got) != 3 {
			t.Fatalf("run %d: checked_out movements per checkout = %v; want one each for %d, %d and %d, none for %d",
				run, got, stillLent, returnedWithTrace, complete, longAgo)
		}
	}

	var movement struct {
		Delta     int     `db:"quantity_delta"`
		Before    int     `db:"quantity_before"`
		Notes     *string `db:"notes"`
		CreatedAt string  `db:"created_at"`
	}
	if err := database.DB.Get(&movement, "SELECT quantity_delta, quantity_before, notes, created_at FROM archive_inventory_movements WHERE checkout_id = ? AND movement_type = 'checked_out'", stillLent); err != nil {
		t.Fatal(err)
	}
	movedAt, _ := database.ParseTimestamp(movement.CreatedAt)
	if movement.Delta != 0 || movement.Before != 2 || movement.Notes == nil || *movement.Notes != "Leihgabe" || time.Since(movedAt) < 47*time.Hour {
		t.Fatalf("backfilled movement = %+v; want unchanged quantity 2, the checkout's notes and its original date", movement)
	}
}
