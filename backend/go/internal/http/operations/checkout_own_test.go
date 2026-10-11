package operations

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

// addBorrower adds an ordinary user without any permission and returns it.
func addBorrower(t *testing.T, email string) *middleware.User {
	t.Helper()
	now := database.TimestampNow()
	mustExec(t, "INSERT INTO users (apple_sub, email, display_name, is_admin, is_active, permissions, created_at, updated_at) VALUES (?, ?, ?, 0, 1, '[]', ?, ?)", "magic_"+email, email, email, now, now)
	var user middleware.User
	if err := database.DB.Get(&user, "SELECT * FROM users WHERE email = ?", email); err != nil {
		t.Fatalf("load user: %v", err)
	}
	return &user
}

func lend(t *testing.T, itemID, userID int) int64 {
	t.Helper()
	now := database.TimestampNow()
	result, err := database.DB.Exec("INSERT INTO archive_checkouts (item_id, user_id, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)", itemID, userID, now, now)
	if err != nil {
		t.Fatal(err)
	}
	id, _ := result.LastInsertId()
	return id
}

// A borrower cannot close a loan. They report their own loan as returned;
// it stays open until a manager confirms, and a manager can also say no.
func TestBorrowerReportsReturnAndManagerConfirms(t *testing.T) {
	admin := useSQLite(t)
	now := database.TimestampNow()
	mustExec(t, "INSERT INTO archive_items (name, quantity, created_at, updated_at) VALUES ('Leiter', 1, ?, ?)", now, now) // item 2
	anna := addBorrower(t, "anna@example.de")
	ben := addBorrower(t, "ben@example.de")
	annasLoan := lend(t, 1, anna.ID)
	bensLoan := lend(t, 2, ben.ID)

	loan := func(id int64) gin.Params {
		return gin.Params{{Key: "realm", Value: "archive"}, {Key: "id", Value: fmt.Sprint(id)}}
	}
	reported := func(id int64) int {
		return count(t, "SELECT COUNT(*) FROM archive_checkouts WHERE id = ? AND status = 'active' AND return_requested_at IS NOT NULL", id)
	}

	// Someone else's loan cannot be reported.
	if rec := serve(requestCheckoutReturn, anna, loan(bensLoan), nil); rec.Code != http.StatusForbidden {
		t.Fatalf("reporting a foreign loan: status %d: %s", rec.Code, rec.Body.String())
	}
	if reported(bensLoan) != 0 {
		t.Fatal("the foreign loan was marked although the report was refused")
	}

	// Her own: the loan stays active, the item stays lent, nothing is booked.
	if rec := serve(requestCheckoutReturn, anna, loan(annasLoan), nil); rec.Code != http.StatusOK {
		t.Fatalf("reporting the own loan: status %d: %s", rec.Code, rec.Body.String())
	}
	if reported(annasLoan) != 1 {
		t.Fatal("the report was not recorded, or the loan was closed by it")
	}
	if n := count(t, "SELECT COUNT(*) FROM archive_inventory_movements WHERE movement_type = 'returned'"); n != 0 {
		t.Fatalf("a report booked %d return movements; only the confirmation may", n)
	}

	// The manager sees the report waiting.
	rec := serve(listCheckoutReturnRequests, admin, nil, nil)
	var waiting []map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &waiting); err != nil || len(waiting) != 1 || waiting[0]["item_name"] != "Bohrmaschine" || waiting[0]["realm"] != "archive" {
		t.Fatalf("waiting reports = %s (err %v), want the one for Bohrmaschine", rec.Body.String(), err)
	}

	// "It is not back": the report goes, the loan goes on.
	if rec := serve(dismissCheckoutReturnRequest, admin, loan(annasLoan), nil); rec.Code != http.StatusOK {
		t.Fatalf("dismissing the report: status %d: %s", rec.Code, rec.Body.String())
	}
	if reported(annasLoan) != 0 || count(t, "SELECT COUNT(*) FROM archive_checkouts WHERE id = ? AND status = 'active'", annasLoan) != 1 {
		t.Fatal("after dismissing, the loan must be active without a report")
	}

	// Reported again and confirmed: now it is returned and booked.
	serve(requestCheckoutReturn, anna, loan(annasLoan), nil)
	item := gin.Params{{Key: "realm", Value: "archive"}, {Key: "item_id", Value: "1"}}
	if rec := serve(checkinItem, admin, item, map[string]interface{}{"checkout_id": annasLoan}); rec.Code != http.StatusOK {
		t.Fatalf("confirming the return: status %d: %s", rec.Code, rec.Body.String())
	}
	if n := count(t, "SELECT COUNT(*) FROM archive_checkouts WHERE id = ? AND status = 'returned'", annasLoan); n != 1 {
		t.Fatal("the confirmed loan is still open")
	}
	if n := count(t, "SELECT COUNT(*) FROM archive_inventory_movements WHERE item_id = 1 AND movement_type = 'returned'"); n != 1 {
		t.Fatalf("return movements = %d, want 1", n)
	}

	// A closed loan can no longer be reported.
	if rec := serve(requestCheckoutReturn, anna, loan(annasLoan), nil); rec.Code != http.StatusNotFound {
		t.Fatalf("reporting a returned loan: status %d: %s", rec.Code, rec.Body.String())
	}
}

// Closing a loan is routed to managers only; the route must say so.
func TestCheckinRouteNeedsManageRight(t *testing.T) {
	useSQLite(t)
	anna := addBorrower(t, "anna@example.de")
	lend(t, 1, anna.ID)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set("user", anna) })
	router.POST("/checkin/:realm/:item_id", middleware.RequirePermission("checkout.manage"), checkinItem)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/checkin/archive/1", nil))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("a borrower closing the loan: status %d: %s", rec.Code, rec.Body.String())
	}
	if n := count(t, "SELECT COUNT(*) FROM archive_checkouts WHERE status = 'active'"); n != 1 {
		t.Fatal("the loan was closed by its borrower")
	}
}

// The loan lists show a borrower their own rows and a manager all of them.
func TestCheckoutListsShowOnlyOwnRowsWithoutManageRight(t *testing.T) {
	admin := useSQLite(t)
	now := database.TimestampNow()
	anna := addBorrower(t, "anna@example.de")
	ben := addBorrower(t, "ben@example.de")
	lend(t, 1, anna.ID)
	lend(t, 1, ben.ID)
	mustExec(t, "INSERT INTO archive_checkouts (item_id, user_id, status, returned_at, created_at, updated_at) VALUES (1, ?, 'returned', ?, ?, ?)", ben.ID, now, now, now)
	for _, userID := range []int{anna.ID, ben.ID} {
		mustExec(t, "INSERT INTO checkout_requests (realm, item_id, user_id, status, component_item_ids, created_at, updated_at) VALUES ('archive', 1, ?, 'pending', '[]', ?, ?)", userID, now, now)
	}
	params := gin.Params{{Key: "realm", Value: "archive"}}

	rows := func(handler gin.HandlerFunc, user *middleware.User) []map[string]interface{} {
		t.Helper()
		rec := serve(handler, user, params, nil)
		var result []map[string]interface{}
		if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil || rec.Code != http.StatusOK {
			t.Fatalf("status %d, err %v: %s", rec.Code, err, rec.Body.String())
		}
		return result
	}

	for name, check := range map[string]struct {
		handler      gin.HandlerFunc
		anna, admins int
	}{
		"active":   {listActiveCheckouts, 1, 2},
		"history":  {listCheckoutHistory, 0, 1},
		"requests": {listCheckoutRequests, 1, 2},
	} {
		own := rows(check.handler, anna)
		if len(own) != check.anna {
			t.Fatalf("%s: borrower sees %d rows, want %d", name, len(own), check.anna)
		}
		for _, row := range own {
			if middleware.AsInt(row["user_id"]) != anna.ID {
				t.Fatalf("%s: borrower sees a row of user %v", name, row["user_id"])
			}
		}
		if all := rows(check.handler, admin); len(all) != check.admins {
			t.Fatalf("%s: manager sees %d rows, want %d", name, len(all), check.admins)
		}
	}

	// The right to manage checkouts is enough; being an admin is not needed.
	mustExec(t, `UPDATE users SET permissions = '["checkout.manage"]' WHERE id = ?`, ben.ID)
	var manager middleware.User
	if err := database.DB.Get(&manager, "SELECT * FROM users WHERE id = ?", ben.ID); err != nil {
		t.Fatal(err)
	}
	if all := rows(listCheckoutRequests, &manager); len(all) != 2 {
		t.Fatalf("a checkout manager sees %d requests, want 2", len(all))
	}
}
