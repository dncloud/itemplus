package operations

import (
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	itemscore "github.com/itemplus/backend/internal/core/items"
	"github.com/itemplus/backend/internal/http/middleware"
)

// adminListOrphanedItems returns the items without a category and the items
// whose category or location was deleted.
func adminListOrphanedItems(c *gin.Context) {
	groups, err := itemscore.ListOrphanedItems()
	if err != nil {
		log.Printf("Orphaned items scan failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"groups": groups})
}

func orphanError(c *gin.Context, action string, err error) {
	switch {
	case errors.Is(err, itemscore.ErrOrphanTargetNotFound):
		c.JSON(http.StatusNotFound, gin.H{"detail": "The category or location does not exist, or nothing points to it", "code": "orphan_target_not_found"})
	case errors.Is(err, itemscore.ErrOrphanNotDeleted):
		c.JSON(http.StatusConflict, gin.H{"detail": "This category or location exists; there is nothing to repair", "code": "orphan_not_deleted"})
	default:
		log.Printf("Orphaned items %s failed: %v", action, err)
		c.JSON(http.StatusBadRequest, gin.H{"detail": "The request could not be carried out", "code": "orphan_invalid"})
	}
}

// adminRestoreOrphanTarget gives a deleted category or location back under
// its old id.
func adminRestoreOrphanTarget(c *gin.Context) {
	var body struct {
		Realm string `json:"realm"`
		Kind  string `json:"kind"`
		RefID int    `json:"ref_id"`
		Name  string `json:"name"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}
	if err := itemscore.RestoreOrphanTarget(body.Realm, body.Kind, body.RefID, body.Name); err != nil {
		orphanError(c, "restore", err)
		return
	}
	user := middleware.GetUser(c)
	middleware.Audit(user.ID, "orphans.restore", fmt.Sprintf("realm=%s kind=%s id=%d", body.Realm, body.Kind, body.RefID))
	c.JSON(http.StatusOK, gin.H{"detail": "restored"})
}

// adminAssignOrphans moves the items of one group to an existing category or
// location. With dry_run it only reports what would happen.
func adminAssignOrphans(c *gin.Context) {
	var body struct {
		Realm    string `json:"realm"`
		Kind     string `json:"kind"`
		RefID    *int   `json:"ref_id"`
		TargetID int    `json:"target_id"`
		DryRun   bool   `json:"dry_run"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}
	result, err := itemscore.AssignOrphans(body.Realm, body.Kind, body.RefID, body.TargetID, body.DryRun)
	if err != nil {
		orphanError(c, "assign", err)
		return
	}
	if !body.DryRun {
		user := middleware.GetUser(c)
		middleware.Audit(user.ID, "orphans.assign", fmt.Sprintf("realm=%s kind=%s target=%d items=%d values_moved=%d values_dropped=%d",
			body.Realm, body.Kind, body.TargetID, result.Items, result.ValuesMoved, result.ValuesDropped))
	}
	c.JSON(http.StatusOK, result)
}
