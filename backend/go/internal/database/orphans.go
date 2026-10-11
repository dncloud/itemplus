package database

import (
	"fmt"
	"log"
	"sort"
	"strings"

	"github.com/jmoiron/sqlx"
)

// The MySQL schema is created without foreign keys, so nothing there removes
// the rows that hung off a deleted row. Older versions also allowed deleting
// things that were still in use. RemoveOrphanedRows clears what is left over
// from that and can mean nothing to anyone any more:
//
//   - property values, bundle links, stock movements and maintenance entries
//     of items that no longer exist,
//   - property definitions of categories that no longer exist and that no
//     item points to, with their values,
//   - audit entries of inventory sessions that no longer exist,
//
// and it makes a location whose parent is gone a top-level location.
//
// It deliberately leaves alone everything that someone may still want:
//
//   - items that point to a deleted category or location, together with that
//     category's property definitions and values. They can be given their
//     category back (see the list of orphaned items for administrators);
//   - checkouts and uploaded files of deleted items, which are kept on
//     purpose.
//
// On SQLite the foreign keys have already done all of this, so it finds
// nothing there. It returns how many rows each step touched.
func RemoveOrphanedRows(db *sqlx.DB) (map[string]int64, error) {
	touched := map[string]int64{}
	run := func(label, query string) error {
		result, err := db.Exec(query)
		if err != nil {
			return fmt.Errorf("%s: %w", label, err)
		}
		if n, _ := result.RowsAffected(); n > 0 {
			touched[label] += n
		}
		return nil
	}

	for _, realm := range []string{"archive", "collection"} {
		items := "(SELECT id FROM " + realm + "_items)"
		steps := [][2]string{
			// First the definitions nobody can reach, so their values go with
			// the next step.
			{realm + "_properties", `DELETE FROM ` + realm + `_properties
				WHERE category_id NOT IN (SELECT id FROM ` + realm + `_categories)
				  AND category_id NOT IN (SELECT category_id FROM ` + realm + `_items WHERE category_id IS NOT NULL)`},
			{realm + "_item_properties", `DELETE FROM ` + realm + `_item_properties
				WHERE item_id NOT IN ` + items + ` OR property_id NOT IN (SELECT id FROM ` + realm + `_properties)`},
			{realm + "_item_components", `DELETE FROM ` + realm + `_item_components
				WHERE parent_item_id NOT IN ` + items + ` OR child_item_id NOT IN ` + items},
			{realm + "_inventory_movements", `DELETE FROM ` + realm + `_inventory_movements WHERE item_id NOT IN ` + items},
			{realm + "_maintenance_reminders", `DELETE FROM ` + realm + `_maintenance_reminders WHERE item_id NOT IN ` + items},
			{realm + "_maintenance_history", `DELETE FROM ` + realm + `_maintenance_history WHERE item_id NOT IN ` + items},
			// MySQL does not let an UPDATE read the table it changes, hence
			// the detour through a derived table.
			{realm + "_locations.parent_id", `UPDATE ` + realm + `_locations SET parent_id = NULL
				WHERE parent_id IS NOT NULL
				  AND parent_id NOT IN (SELECT id FROM (SELECT id FROM ` + realm + `_locations) AS existing_locations)`},
		}
		for _, step := range steps {
			if err := run(step[0], step[1]); err != nil {
				return touched, err
			}
		}
	}
	if err := run("inventory_session_entries",
		`DELETE FROM inventory_session_entries WHERE session_id NOT IN (SELECT id FROM inventory_sessions)`); err != nil {
		return touched, err
	}

	if len(touched) > 0 {
		parts := make([]string, 0, len(touched))
		for label, n := range touched {
			parts = append(parts, fmt.Sprintf("%s: %d", label, n))
		}
		sort.Strings(parts)
		log.Printf("Removed rows left behind by deleted items, categories and locations (%s)", strings.Join(parts, ", "))
	}
	return touched, nil
}
