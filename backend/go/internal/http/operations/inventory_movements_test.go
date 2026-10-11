package operations

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

type movementList struct {
	Movements []struct {
		ItemName string `json:"item_name"`
		Type     string `json:"movement_type"`
	} `json:"movements"`
	Total  int            `json:"total"`
	Counts map[string]int `json:"counts"`
}

func listMovements(t *testing.T, user *middleware.User, query string) movementList {
	t.Helper()
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodGet, "/inventory-movements?"+query, nil)
	c.Set("user", user)
	listInventoryMovements(c)
	var result movementList
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil || rec.Code != http.StatusOK {
		t.Fatalf("%s: status %d, err %v: %s", query, rec.Code, err, rec.Body.String())
	}
	return result
}

// The stock page filters by type, item name and age, pages through the
// result, and shows counts per type that are true for the whole result, not
// only for the rows on the page.
func TestInventoryMovementsFilterCountAndPage(t *testing.T) {
	user := useSQLite(t)
	now := time.Now()
	at := func(daysAgo int) string { return database.TimestampAt(now.AddDate(0, 0, -daysAgo)) }
	mustExec(t, "INSERT INTO archive_items (name, quantity, created_at, updated_at) VALUES ('Akkuschrauber', 1, ?, ?)", at(0), at(0)) // item 2

	add := func(itemID int, movementType string, daysAgo int) {
		mustExec(t, "INSERT INTO archive_inventory_movements (item_id, movement_type, quantity_delta, quantity_before, quantity_after, source, created_at) VALUES (?, ?, 1, 0, 1, 'item', ?)", itemID, movementType, at(daysAgo))
	}
	for i := 0; i < 120; i++ {
		add(1, "bought", 2) // Bohrmaschine, more rows than one page holds
	}
	add(1, "consumed", 1)
	add(2, "created", 0)
	add(2, "bought", 60)

	all := listMovements(t, user, "realm=archive&limit=50")
	if all.Total != 123 || len(all.Movements) != 50 || all.Counts["bought"] != 121 || all.Counts["consumed"] != 1 || all.Counts["created"] != 1 {
		t.Fatalf("all: total %d, page %d, counts %v", all.Total, len(all.Movements), all.Counts)
	}
	if all.Movements[0].Type != "created" || all.Movements[1].Type != "consumed" {
		t.Fatalf("newest first: got %s, %s", all.Movements[0].Type, all.Movements[1].Type)
	}

	// The last page holds what is left, and the oldest row comes last.
	last := listMovements(t, user, "realm=archive&limit=50&offset=100")
	if len(last.Movements) != 23 || last.Movements[22].ItemName != "Akkuschrauber" {
		t.Fatalf("last page: %d rows, ends with %q", len(last.Movements), last.Movements[len(last.Movements)-1].ItemName)
	}

	// A type filter narrows rows and total, but the counts still offer every type.
	consumed := listMovements(t, user, "realm=archive&type=consumed")
	if consumed.Total != 1 || len(consumed.Movements) != 1 || consumed.Counts["bought"] != 121 {
		t.Fatalf("type filter: total %d, rows %d, counts %v", consumed.Total, len(consumed.Movements), consumed.Counts)
	}

	// Item name, in any case.
	named := listMovements(t, user, "realm=archive&q=AKKU")
	if named.Total != 2 || named.Counts["bought"] != 1 || named.Counts["created"] != 1 {
		t.Fatalf("name filter: total %d, counts %v", named.Total, named.Counts)
	}

	// Only the last 30 days: the purchase from two months ago is out.
	recent := listMovements(t, user, "realm=archive&q=akku&days=30")
	if recent.Total != 1 || recent.Movements[0].Type != "created" {
		t.Fatalf("days filter: total %d, rows %v", recent.Total, recent.Movements)
	}

	// A limit above the maximum is capped, not thrown back to the default.
	if capped := listMovements(t, user, "realm=archive&limit=1000"); len(capped.Movements) != 123 {
		t.Fatalf("limit 1000 gave %d rows, want all 123", len(capped.Movements))
	}
}
