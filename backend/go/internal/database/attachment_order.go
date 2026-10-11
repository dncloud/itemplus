package database

import (
	"fmt"
	"sort"

	"github.com/jmoiron/sqlx"
)

// AttachmentPosition is one attachment of an item and where it stands.
type AttachmentPosition struct {
	ID    int64 `db:"id"`
	Order int   `db:"order"`
}

// WriteAttachmentSequence gives the attachments the positions 0, 1, 2 … in
// the order they are passed in, touching only the rows that change.
func WriteAttachmentSequence(db *sqlx.DB, table string, sequence []AttachmentPosition) error {
	for index, entry := range sequence {
		if entry.Order == index {
			continue
		}
		if _, err := db.Exec(fmt.Sprintf("UPDATE %s SET `order` = ? WHERE id = ?", table), index, entry.ID); err != nil {
			return err
		}
	}
	return nil
}

// RepairAttachmentOrder gives every attachment of an item its own position.
// Earlier versions could store the same position twice: the game catalog
// numbered every 25 images from 0 again, and several files uploaded at once
// all got the same number. For such an item the order of adding is the
// order that was meant, so it is restored; an image that was made the main
// picture by hand (a position below 0) stays in front. Items whose
// positions are already distinct are left alone. It returns how many items
// were repaired.
func RepairAttachmentOrder(db *sqlx.DB) (int, error) {
	repaired := 0
	for _, realm := range []string{"archive", "collection"} {
		table := realm + "_attachments"
		var itemIDs []int64
		if err := db.Select(&itemIDs, fmt.Sprintf("SELECT DISTINCT item_id FROM %s GROUP BY item_id, `order` HAVING COUNT(*) > 1", table)); err != nil {
			return repaired, fmt.Errorf("%s: %w", table, err)
		}
		for _, itemID := range itemIDs {
			var rows []AttachmentPosition
			if err := db.Select(&rows, fmt.Sprintf("SELECT id, `order` FROM %s WHERE item_id = ? ORDER BY id", table), itemID); err != nil {
				return repaired, fmt.Errorf("%s: %w", table, err)
			}
			var front, rest []AttachmentPosition
			for _, entry := range rows {
				if entry.Order < 0 {
					front = append(front, entry)
				} else {
					rest = append(rest, entry)
				}
			}
			sort.SliceStable(front, func(i, j int) bool { return front[i].Order < front[j].Order })
			rows = append(front, rest...)
			if err := WriteAttachmentSequence(db, table, rows); err != nil {
				return repaired, fmt.Errorf("%s: %w", table, err)
			}
			repaired++
		}
	}
	return repaired, nil
}
