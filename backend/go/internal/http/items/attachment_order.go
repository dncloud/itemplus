package items

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

// No two attachments of an item share a position. Everything that adds or
// moves one goes through this file and holds attachmentOrderMu while it
// reads the positions and writes the new ones, so two uploads arriving at
// the same moment cannot both take the same place.
var attachmentOrderMu sync.Mutex

// nextAttachmentOrder is the position after the last attachment of the item,
// 0 for an item without any.
func nextAttachmentOrder(table, itemID string) int {
	var last sql.NullInt64
	if err := database.DB.Get(&last, fmt.Sprintf("SELECT MAX(`order`) FROM %s WHERE item_id = ?", table), itemID); err != nil || !last.Valid {
		return 0
	}
	return int(last.Int64) + 1
}

// insertAttachmentAtEnd runs an INSERT with the position after the item's
// last attachment. A position sent by the client is not used: the client
// cannot know what was added in the meantime.
func insertAttachmentAtEnd(table, itemID string, insert func(order int) (sql.Result, error)) (sql.Result, error) {
	attachmentOrderMu.Lock()
	defer attachmentOrderMu.Unlock()
	return insert(nextAttachmentOrder(table, itemID))
}

func loadAttachmentPositions(table string, itemID interface{}) ([]database.AttachmentPosition, error) {
	var rows []database.AttachmentPosition
	err := database.DB.Select(&rows, fmt.Sprintf("SELECT id, `order` FROM %s WHERE item_id = ? ORDER BY `order`, id", table), itemID)
	return rows, err
}

// moveAttachment puts one attachment at a position among the attachments of
// its item (0 is the first; anything below is the first, anything beyond
// the end is the last) and moves the others up or down by one. It reports
// false when there is no such attachment.
func moveAttachment(table string, attachmentID interface{}, position int) (bool, error) {
	attachmentOrderMu.Lock()
	defer attachmentOrderMu.Unlock()

	var itemID, moved int64
	if err := database.DB.QueryRowx(fmt.Sprintf("SELECT item_id, id FROM %s WHERE id = ?", table), attachmentID).Scan(&itemID, &moved); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	rows, err := loadAttachmentPositions(table, itemID)
	if err != nil {
		return false, err
	}
	sequence := make([]database.AttachmentPosition, 0, len(rows))
	var entry database.AttachmentPosition
	for _, row := range rows {
		if row.ID == moved {
			entry = row
		} else {
			sequence = append(sequence, row)
		}
	}
	position = min(max(position, 0), len(sequence))
	sequence = append(sequence[:position], append([]database.AttachmentPosition{entry}, sequence[position:]...)...)
	return true, database.WriteAttachmentSequence(database.DB, table, sequence)
}

// reorderAttachments stores the order the user arranged: the attachments
// named in the request, in that order, and behind them any the request did
// not name, in the order they had.
func reorderAttachments(realm string) gin.HandlerFunc {
	table := realm + "_attachments"
	return func(c *gin.Context) {
		itemID := c.Param("id")
		var body struct {
			IDs []int64 `json:"ids"`
		}
		if c.ShouldBindJSON(&body) != nil || len(body.IDs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "ids is required"})
			return
		}

		attachmentOrderMu.Lock()
		defer attachmentOrderMu.Unlock()

		current, err := loadAttachmentPositions(table, itemID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		byID := make(map[int64]database.AttachmentPosition, len(current))
		for _, entry := range current {
			byID[entry.ID] = entry
		}
		sequence := make([]database.AttachmentPosition, 0, len(current))
		named := make(map[int64]bool, len(body.IDs))
		for _, id := range body.IDs {
			entry, ok := byID[id]
			if !ok || named[id] {
				c.JSON(http.StatusBadRequest, gin.H{"detail": "ids must name attachments of this item, each once"})
				return
			}
			named[id] = true
			sequence = append(sequence, entry)
		}
		for _, entry := range current {
			if !named[entry.ID] {
				sequence = append(sequence, entry)
			}
		}
		if err := database.WriteAttachmentSequence(database.DB, table, sequence); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}

		user := middleware.GetUser(c)
		middleware.Audit(user.ID, "attachment.reorder", fmt.Sprintf("realm=%s item=%s count=%d", realm, itemID, len(sequence)))
		ids := make([]int64, 0, len(sequence))
		for _, entry := range sequence {
			ids = append(ids, entry.ID)
		}
		c.JSON(http.StatusOK, gin.H{"ids": ids})
	}
}
