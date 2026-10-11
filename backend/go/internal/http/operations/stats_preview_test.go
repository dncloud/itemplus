package operations

import (
	"strconv"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/testdb"
)

// The dashboard lists show the same picture as the item list: the first
// gallery attachment that is an image.
func TestRealmStatsAddPreviewImages(t *testing.T) {
	testdb.Use(t)
	now := database.TimestampNow()
	mustExec(t, "INSERT INTO archive_items (name, quantity, purchase_price, created_at, updated_at) VALUES ('Mit Bild', 1, 10, ?, ?)", now, now)
	mustExec(t, "INSERT INTO archive_items (name, quantity, purchase_price, created_at, updated_at) VALUES ('Ohne Bild', 1, 5, ?, ?)", now, now)

	var withImage, withoutImage int64
	if err := database.DB.Get(&withImage, "SELECT id FROM archive_items WHERE name = 'Mit Bild'"); err != nil {
		t.Fatal(err)
	}
	if err := database.DB.Get(&withoutImage, "SELECT id FROM archive_items WHERE name = 'Ohne Bild'"); err != nil {
		t.Fatal(err)
	}

	insert := "INSERT INTO archive_attachments (item_id, filename, file_path, storage_backend, attachment_type, gallery, `order`, created_at, updated_at) VALUES (?, ?, ?, 'local', 'image', ?, ?, ?, ?)"
	mustExec(t, insert, withImage, "anleitung.pdf", "a.pdf", 1, 0, now, now)
	mustExec(t, insert, withImage, "privat.jpg", "p.jpg", 0, 1, now, now)
	mustExec(t, insert, withImage, "cover.PNG", "c.png", 1, 2, now, now)
	mustExec(t, insert, withImage, "rueckseite.jpg", "r.jpg", 1, 3, now, now)
	mustExec(t, insert, withoutImage, "anleitung.pdf", "b.pdf", 1, 0, now, now)

	var coverID int64
	if err := database.DB.Get(&coverID, "SELECT id FROM archive_attachments WHERE filename = 'cover.PNG'"); err != nil {
		t.Fatal(err)
	}

	stats := realmStats("archive")
	for _, list := range []string{"recently_added", "top_by_value", "top_by_quantity"} {
		rows, _ := stats[list].([]gin.H)
		found := 0
		for _, row := range rows {
			switch row["name"] {
			case "Mit Bild":
				found++
				want := "/api/archive/attachments/" + strconv.FormatInt(coverID, 10) + "/content"
				if row["image_url"] != want {
					t.Errorf("%s: image_url = %v, want %s", list, row["image_url"], want)
				}
			case "Ohne Bild":
				found++
				if _, has := row["image_url"]; has {
					t.Errorf("%s: item without a picture got image_url %v", list, row["image_url"])
				}
			}
		}
		if found != 2 {
			t.Errorf("%s: found %d of the 2 test items", list, found)
		}
	}
}

// The chart figures are grouped in Go, so both database engines must agree:
// twelve months of growth ending with today's totals, thirty days of
// activity, and the items per location.
func TestRealmStatsChartFigures(t *testing.T) {
	testdb.Use(t)
	now := database.TimestampNow()
	old := database.TimestampAt(time.Now().UTC().AddDate(-2, 0, 0))
	mustExec(t, "INSERT INTO archive_locations (name, created_at, updated_at) VALUES ('Regal', ?, ?)", now, now)
	mustExec(t, "INSERT INTO archive_items (name, quantity, purchase_price, location_id, created_at, updated_at) VALUES ('Alt', 2, 10, 1, ?, ?)", old, old)
	mustExec(t, "INSERT INTO archive_items (name, quantity, purchase_price, created_at, updated_at) VALUES ('Neu', 1, 5, ?, ?)", now, now)
	mustExec(t, "INSERT INTO archive_inventory_movements (item_id, movement_type, quantity_delta, quantity_before, quantity_after, source, created_at) VALUES (1, 'created', 2, 0, 2, 'item', ?)", old)
	mustExec(t, "INSERT INTO archive_inventory_movements (item_id, movement_type, quantity_delta, quantity_before, quantity_after, source, created_at) VALUES (2, 'created', 1, 0, 1, 'item', ?)", now)
	mustExec(t, "INSERT INTO archive_checkouts (item_id, user_id, status, created_at, updated_at) VALUES (2, 1, 'active', ?, ?)", now, now)
	mustExec(t, "INSERT INTO archive_checkouts (item_id, user_id, status, created_at, updated_at) VALUES (1, 1, 'returned', ?, ?)", now, now)

	stats := realmStats("archive")

	growth, _ := stats["growth"].([]gin.H)
	if len(growth) != 12 {
		t.Fatalf("growth has %d months, want 12", len(growth))
	}
	first, last := growth[0], growth[11]
	if first["items"] != 1 || first["value"] != 20.0 {
		t.Errorf("first month = %v items worth %v, want the old item only (1, 20)", first["items"], first["value"])
	}
	if last["items"] != 2 || last["value"] != 25.0 || last["added"] != 1 {
		t.Errorf("last month = %v items worth %v, %v added; want 2, 25, 1", last["items"], last["value"], last["added"])
	}
	if last["month"] != time.Now().UTC().Format("2006-01") {
		t.Errorf("last month is %v, want the current month", last["month"])
	}

	activity, _ := stats["activity"].([]gin.H)
	if len(activity) != 30 {
		t.Fatalf("activity has %d days, want 30", len(activity))
	}
	total := 0
	for _, day := range activity {
		total += day["count"].(int)
	}
	if total != 1 || activity[29]["count"] != 1 {
		t.Errorf("activity counts %d movements, %v today; want only today's one", total, activity[29]["count"])
	}
	if types, _ := activity[29]["types"].(map[string]int); types["created"] != 1 || len(types) != 1 {
		t.Errorf("today's movements by kind = %v, want one created", activity[29]["types"])
	}

	locations, _ := stats["by_location"].([]gin.H)
	if len(locations) != 1 || locations[0]["name"] != "Regal" || locations[0]["items"] != 1 {
		t.Errorf("by_location = %v, want Regal with 1 item", locations)
	}
	if stats["checked_out"] != 1 {
		t.Errorf("checked_out = %v, want 1", stats["checked_out"])
	}
}

// The find of the day is the same for a whole day and prefers items that
// have a picture to show.
func TestRealmSpotlight(t *testing.T) {
	testdb.Use(t)
	day := time.Date(2026, 10, 9, 12, 0, 0, 0, time.UTC)
	if got := realmSpotlight("archive", day); got != nil {
		t.Fatalf("empty realm: spotlight = %v, want none", got)
	}

	now := database.TimestampNow()
	for i := 1; i <= 10; i++ {
		mustExec(t, "INSERT INTO archive_items (name, quantity, purchase_price, created_at, updated_at) VALUES (?, 2, 10, ?, ?)", "Item "+strconv.Itoa(i), now, now)
	}

	withoutPictures := realmSpotlight("archive", day)
	if withoutPictures == nil || withoutPictures["name"] == nil {
		t.Fatalf("no pictures: spotlight = %v, want one of the items", withoutPictures)
	}
	if _, has := withoutPictures["image_url"]; has {
		t.Errorf("no pictures: spotlight has image_url %v", withoutPictures["image_url"])
	}
	if withoutPictures["value"] != 20.0 || withoutPictures["date"] != "2026-10-09" {
		t.Errorf("value=%v date=%v, want 20 and 2026-10-09", withoutPictures["value"], withoutPictures["date"])
	}

	// Seven of the ten items get a picture: enough to choose among them only.
	var ids []int64
	if err := database.DB.Select(&ids, "SELECT id FROM archive_items ORDER BY id"); err != nil {
		t.Fatal(err)
	}
	for _, id := range ids[:7] {
		mustExec(t, "INSERT INTO archive_attachments (item_id, filename, file_path, storage_backend, attachment_type, gallery, `order`, created_at, updated_at) VALUES (?, 'cover.jpg', 'c.jpg', 'local', 'image', 1, 0, ?, ?)", id, now, now)
	}

	seen := map[interface{}]bool{}
	for offset := 0; offset < 30; offset++ {
		date := day.AddDate(0, 0, offset)
		morning := realmSpotlight("archive", date)
		evening := realmSpotlight("archive", date.Add(11*time.Hour))
		if morning == nil || morning["image_url"] == nil {
			t.Fatalf("day %d: spotlight = %v, want an item with a picture", offset, morning)
		}
		if morning["id"] != evening["id"] {
			t.Errorf("day %d: the find changed during the day (%v, then %v)", offset, morning["id"], evening["id"])
		}
		seen[morning["id"]] = true
	}
	if len(seen) < 3 {
		t.Errorf("30 days showed only %d different items", len(seen))
	}

	// The archive has items now, but only the collection gets a find.
	if got := realmStats("archive")["spotlight"]; got != nil && got.(gin.H) != nil {
		t.Errorf("archive statistics carry a spotlight: %v", got)
	}
}
