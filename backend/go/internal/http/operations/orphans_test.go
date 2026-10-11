package operations

import (
	"errors"
	"testing"

	itemscore "github.com/itemplus/backend/internal/core/items"
	"github.com/itemplus/backend/internal/database"
	"github.com/jmoiron/sqlx"
)

// seedOrphans writes rows that point to things that do not exist. SQLite
// would refuse them, so its foreign keys are off while they are written; on
// MySQL this is how the data of older versions really looked.
func seedOrphans(t *testing.T, statements [][]interface{}) {
	t.Helper()
	err := database.WithoutCascades(func(tx *sqlx.Tx) error {
		for _, statement := range statements {
			if _, err := tx.Exec(statement[0].(string), statement[1:]...); err != nil {
				t.Fatalf("%s: %v", statement[0], err)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

// What deleted items, categories and locations left behind is removed at
// startup, with one exception: an item that points to a deleted category
// keeps that category's property definitions and values, so the category can
// be given back to it. Checkouts and uploaded files of deleted items stay.
func TestRemoveOrphanedRows(t *testing.T) {
	useSQLite(t) // item 1 "Bohrmaschine", user 1
	now := database.TimestampNow()
	mustExec(t, "INSERT INTO archive_categories (name, created_at, updated_at) VALUES ('Werkzeug', ?, ?)", now, now)                                            // category 1
	mustExec(t, "INSERT INTO archive_properties (category_id, name, property_type, created_at, updated_at) VALUES (1, 'Seriennummer', 'text', ?, ?)", now, now) // property 1
	mustExec(t, "INSERT INTO archive_item_properties (item_id, property_id, value) VALUES (1, 1, '\"SN-1\"')")
	mustExec(t, "UPDATE archive_items SET category_id = 1 WHERE id = 1")
	mustExec(t, "INSERT INTO archive_locations (name, created_at, updated_at) VALUES ('Regal', ?, ?)", now, now) // location 1

	seedOrphans(t, [][]interface{}{
		// Item 2 points to category 50, which is gone but still has a property with a value.
		{"INSERT INTO archive_items (name, quantity, category_id, location_id, created_at, updated_at) VALUES ('Verwaist', 1, 50, 60, ?, ?)", now, now},
		{"INSERT INTO archive_properties (id, category_id, name, property_type, created_at, updated_at) VALUES (20, 50, 'Genre', 'text', ?, ?)", now, now},
		{"INSERT INTO archive_item_properties (item_id, property_id, value) VALUES (2, 20, '\"Adventure\"')"},
		// Category 70 is gone and no item points to it.
		{"INSERT INTO archive_properties (id, category_id, name, property_type, created_at, updated_at) VALUES (30, 70, 'Farbe', 'text', ?, ?)", now, now},
		{"INSERT INTO archive_item_properties (item_id, property_id, value) VALUES (1, 30, '\"rot\"')"},
		// Rows of item 99, which is gone.
		{"INSERT INTO archive_item_properties (item_id, property_id, value) VALUES (99, 1, '\"SN-99\"')"},
		{"INSERT INTO archive_item_components (parent_item_id, child_item_id) VALUES (1, 99)"},
		{"INSERT INTO archive_inventory_movements (item_id, movement_type, quantity_delta, quantity_before, quantity_after, source, created_at) VALUES (99, 'created', 1, 0, 1, 'item', ?)", now},
		{"INSERT INTO archive_maintenance_reminders (item_id, title, reminder_type, due_date, status, created_by, created_at, updated_at) VALUES (99, 'Pruefen', 'maintenance', '2026-01-01', 'open', 1, ?, ?)", now, now},
		{"INSERT INTO archive_checkouts (item_id, user_id, status, created_at, updated_at) VALUES (99, 1, 'returned', ?, ?)", now, now},
		{"INSERT INTO archive_attachments (item_id, filename, file_path, storage_backend, attachment_type, created_at, updated_at) VALUES (99, 'foto.jpg', 'archive/99/foto.jpg', 'local', 'image', ?, ?)", now, now},
		// A location whose parent is gone.
		{"INSERT INTO archive_locations (name, parent_id, created_at, updated_at) VALUES ('Fach', 80, ?, ?)", now, now},
	})
	// Rows of the item that exists, which must survive.
	mustExec(t, "INSERT INTO archive_inventory_movements (item_id, movement_type, quantity_delta, quantity_before, quantity_after, source, created_at) VALUES (1, 'created', 2, 0, 2, 'item', ?)", now)

	touched, err := database.RemoveOrphanedRows(database.DB)
	if err != nil {
		t.Fatal(err)
	}

	for query, want := range map[string]int{
		// Gone: what belonged to the deleted item and to the unreachable category.
		"SELECT COUNT(*) FROM archive_item_properties WHERE item_id = 99":       0,
		"SELECT COUNT(*) FROM archive_item_components":                          0,
		"SELECT COUNT(*) FROM archive_inventory_movements WHERE item_id = 99":   0,
		"SELECT COUNT(*) FROM archive_maintenance_reminders WHERE item_id = 99": 0,
		"SELECT COUNT(*) FROM archive_properties WHERE id = 30":                 0,
		"SELECT COUNT(*) FROM archive_item_properties WHERE property_id = 30":   0,
		// A top-level location now.
		"SELECT COUNT(*) FROM archive_locations WHERE name = 'Fach' AND parent_id IS NULL": 1,
		// Kept: the orphaned item with everything needed to restore its category.
		"SELECT COUNT(*) FROM archive_items WHERE id = 2 AND category_id = 50 AND location_id = 60": 1,
		"SELECT COUNT(*) FROM archive_properties WHERE id = 20":                                     1,
		"SELECT COUNT(*) FROM archive_item_properties WHERE item_id = 2 AND property_id = 20":       1,
		// Kept on purpose: loans and files of deleted items.
		"SELECT COUNT(*) FROM archive_checkouts WHERE item_id = 99":   1,
		"SELECT COUNT(*) FROM archive_attachments WHERE item_id = 99": 1,
		// Untouched: everything that is in order.
		"SELECT COUNT(*) FROM archive_item_properties WHERE item_id = 1 AND property_id = 1": 1,
		"SELECT COUNT(*) FROM archive_inventory_movements WHERE item_id = 1":                 1,
		"SELECT COUNT(*) FROM archive_properties WHERE id = 1":                               1,
	} {
		if got := count(t, query); got != want {
			t.Errorf("%s = %d, want %d", query, got, want)
		}
	}
	if len(touched) == 0 {
		t.Error("the cleanup reported nothing although it removed rows")
	}

	again, err := database.RemoveOrphanedRows(database.DB)
	if err != nil || len(again) != 0 {
		t.Errorf("second run: touched %v, err %v; want nothing left to do", again, err)
	}
}

// seedOrphanedGames builds what an older version left on MySQL: three games
// whose category 50 was deleted (its two property definitions and the values
// are still there), one item without any category and one at a deleted
// location. Category 1 "PC" exists and has one of the two properties.
func seedOrphanedGames(t *testing.T) {
	t.Helper()
	now := database.TimestampNow()
	mustExec(t, "INSERT INTO collection_categories (name, created_at, updated_at) VALUES ('PC', ?, ?)", now, now)
	mustExec(t, "INSERT INTO collection_locations (name, created_at, updated_at) VALUES ('Regal', ?, ?)", now, now)
	mustExec(t, `INSERT INTO collection_properties (category_id, name, property_type, options, created_at, updated_at) VALUES (1, 'Genres', 'text', '{"game_catalog":{"profile_key":"pc-games","property_key":"genres"}}', ?, ?)`, now, now) // property 1
	seedOrphans(t, [][]interface{}{
		{`INSERT INTO collection_properties (id, category_id, name, property_type, options, created_at, updated_at) VALUES (20, 50, 'Genre (alt)', 'text', '{"game_catalog":{"profile_key":"pc-games","property_key":"genres"}}', ?, ?)`, now, now},
		{"INSERT INTO collection_properties (id, category_id, name, property_type, options, created_at, updated_at) VALUES (21, 50, 'Kopierschutz', 'text', '{}', ?, ?)", now, now},
		{"INSERT INTO collection_items (id, name, quantity, category_id, created_at, updated_at) VALUES (10, 'Far Cry', 1, 50, ?, ?)", now, now},
		{"INSERT INTO collection_items (id, name, quantity, category_id, created_at, updated_at) VALUES (11, 'SiN', 1, 50, ?, ?)", now, now},
		{"INSERT INTO collection_items (id, name, quantity, category_id, location_id, created_at, updated_at) VALUES (12, 'FlatOut', 1, 50, 60, ?, ?)", now, now},
		{"INSERT INTO collection_items (id, name, quantity, created_at, updated_at) VALUES (13, 'Ohne', 1, ?, ?)", now, now},
		{"INSERT INTO collection_item_properties (item_id, property_id, value) VALUES (10, 20, '\"Shooter\"')"},
		{"INSERT INTO collection_item_properties (item_id, property_id, value) VALUES (11, 20, '\"Shooter\"')"},
		{"INSERT INTO collection_item_properties (item_id, property_id, value) VALUES (10, 21, '\"SafeDisc\"')"},
	})
}

func orphanGroup(t *testing.T, kind string) *itemscore.OrphanGroup {
	t.Helper()
	groups, err := itemscore.ListOrphanedItems()
	if err != nil {
		t.Fatal(err)
	}
	for i := range groups {
		if groups[i].Realm == "collection" && groups[i].Kind == kind {
			return &groups[i]
		}
	}
	return nil
}

func TestOrphanedItemsAreListedByWhatIsWrong(t *testing.T) {
	useSQLite(t)
	seedOrphanedGames(t)

	deleted := orphanGroup(t, itemscore.OrphanCategoryDeleted)
	if deleted == nil || deleted.RefID == nil || *deleted.RefID != 50 || deleted.ItemCount != 3 || deleted.Properties != 2 || deleted.ProfileKey != "pc-games" {
		t.Fatalf("deleted category group = %+v, want category 50 with 3 items, 2 properties, profile pc-games", deleted)
	}
	if missing := orphanGroup(t, itemscore.OrphanCategoryMissing); missing == nil || missing.RefID != nil || missing.ItemCount != 1 || missing.Items[0].Name != "Ohne" {
		t.Errorf("missing category group = %+v, want the one item without a category", missing)
	}
	if location := orphanGroup(t, itemscore.OrphanLocationDeleted); location == nil || *location.RefID != 60 || location.ItemCount != 1 {
		t.Errorf("deleted location group = %+v, want location 60 with 1 item", location)
	}
}

// Restoring puts the category back under its old id: the items, the property
// definitions and the values were never touched, so everything fits again.
func TestRestoringADeletedCategoryBringsEverythingBack(t *testing.T) {
	useSQLite(t)
	seedOrphanedGames(t)

	if err := itemscore.RestoreOrphanTarget("collection", itemscore.OrphanCategoryDeleted, 1, "x"); !errors.Is(err, itemscore.ErrOrphanNotDeleted) {
		t.Errorf("restoring a category that exists: %v, want ErrOrphanNotDeleted", err)
	}
	if err := itemscore.RestoreOrphanTarget("collection", itemscore.OrphanCategoryDeleted, 77, "x"); !errors.Is(err, itemscore.ErrOrphanTargetNotFound) {
		t.Errorf("restoring a category nothing points to: %v, want ErrOrphanTargetNotFound", err)
	}
	if err := itemscore.RestoreOrphanTarget("collection", itemscore.OrphanCategoryDeleted, 50, "PC-Spiele (alt)"); err != nil {
		t.Fatal(err)
	}
	if orphanGroup(t, itemscore.OrphanCategoryDeleted) != nil {
		t.Error("the items are still listed as orphaned")
	}
	for query, want := range map[string]int{
		"SELECT COUNT(*) FROM collection_categories WHERE id = 50 AND name = 'PC-Spiele (alt)'": 1,
		"SELECT COUNT(*) FROM collection_items WHERE category_id = 50":                          3,
		"SELECT COUNT(*) FROM collection_properties WHERE category_id = 50":                     2,
		"SELECT COUNT(*) FROM collection_item_properties WHERE property_id IN (20, 21)":         3,
	} {
		if got := count(t, query); got != want {
			t.Errorf("%s = %d, want %d", query, got, want)
		}
	}

	if err := itemscore.RestoreOrphanTarget("collection", itemscore.OrphanLocationDeleted, 60, "Altes Regal"); err != nil {
		t.Fatal(err)
	}
	if n := count(t, "SELECT COUNT(*) FROM collection_locations WHERE id = 60 AND name = 'Altes Regal'"); n != 1 {
		t.Error("the location was not restored")
	}
}

// Assigning moves the items to an existing category. Values go along where
// the new category has the same property; a dry run says beforehand what is
// lost, and changes nothing.
func TestAssigningOrphansMovesValuesAndSaysWhatIsLost(t *testing.T) {
	useSQLite(t)
	seedOrphanedGames(t)
	from := 50

	preview, err := itemscore.AssignOrphans("collection", itemscore.OrphanCategoryDeleted, &from, 1, true)
	if err != nil {
		t.Fatal(err)
	}
	if preview.Items != 3 || preview.ValuesMoved != 2 || preview.ValuesDropped != 1 || len(preview.DroppedProperties) != 1 || preview.DroppedProperties[0] != "Kopierschutz" {
		t.Fatalf("dry run = %+v, want 3 items, 2 values moved, 1 dropped (Kopierschutz)", preview)
	}
	if n := count(t, "SELECT COUNT(*) FROM collection_items WHERE category_id = 50"); n != 3 {
		t.Fatal("the dry run moved items")
	}
	if n := count(t, "SELECT COUNT(*) FROM collection_item_properties WHERE property_id IN (20, 21)"); n != 3 {
		t.Fatal("the dry run changed values")
	}

	if _, err := itemscore.AssignOrphans("collection", itemscore.OrphanCategoryDeleted, &from, 99, false); !errors.Is(err, itemscore.ErrOrphanTargetNotFound) {
		t.Errorf("assigning to a category that does not exist: %v, want ErrOrphanTargetNotFound", err)
	}

	done, err := itemscore.AssignOrphans("collection", itemscore.OrphanCategoryDeleted, &from, 1, false)
	if err != nil || done.Items != 3 || done.ValuesMoved != 2 || done.ValuesDropped != 1 {
		t.Fatalf("assign = %+v, err %v", done, err)
	}
	for query, want := range map[string]int{
		"SELECT COUNT(*) FROM collection_items WHERE category_id = 1":            3,
		"SELECT COUNT(*) FROM collection_item_properties WHERE property_id = 1":  2, // the genres, under the new category's property
		"SELECT COUNT(*) FROM collection_item_properties WHERE property_id = 21": 0,
		"SELECT COUNT(*) FROM collection_properties WHERE category_id = 50":      0,
	} {
		if got := count(t, query); got != want {
			t.Errorf("%s = %d, want %d", query, got, want)
		}
	}

	// The item without any category, and the one at the deleted location.
	if result, err := itemscore.AssignOrphans("collection", itemscore.OrphanCategoryMissing, nil, 1, false); err != nil || result.Items != 1 {
		t.Fatalf("assigning the item without a category: %+v, err %v", result, err)
	}
	location := 60
	if result, err := itemscore.AssignOrphans("collection", itemscore.OrphanLocationDeleted, &location, 1, false); err != nil || result.Items != 1 {
		t.Fatalf("assigning the item at the deleted location: %+v, err %v", result, err)
	}
	for _, kind := range []string{itemscore.OrphanCategoryDeleted, itemscore.OrphanCategoryMissing, itemscore.OrphanLocationDeleted} {
		if group := orphanGroup(t, kind); group != nil {
			t.Errorf("still orphaned: %+v", group)
		}
	}
}
