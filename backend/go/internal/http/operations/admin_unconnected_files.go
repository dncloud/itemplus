package operations

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	itemscore "github.com/itemplus/backend/internal/core/items"
	"github.com/itemplus/backend/internal/http/middleware"
)

// adminListUnconnectedFiles returns the uploaded files that no existing item
// uses, for review by an administrator.
func adminListUnconnectedFiles(c *gin.Context) {
	files, err := itemscore.ListUnconnectedFiles()
	if err != nil {
		log.Printf("Unconnected files scan failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	var totalSize int64
	for _, file := range files {
		totalSize += file.Size
	}
	c.JSON(http.StatusOK, gin.H{"files": files, "total_size": totalSize})
}

// adminDeleteUnconnectedFiles permanently removes the selected files. Paths
// that are in use or not part of the current list are skipped, not deleted.
func adminDeleteUnconnectedFiles(c *gin.Context) {
	var body struct {
		Paths []string `json:"paths"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.Paths) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "paths required"})
		return
	}
	deleted, skipped, err := itemscore.DeleteUnconnectedFiles(body.Paths)
	if err != nil {
		log.Printf("Unconnected files delete failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	user := middleware.GetUser(c)
	for _, path := range deleted {
		middleware.Audit(user.ID, "files.unconnected_delete", "path="+path)
	}
	log.Printf("Unconnected files: %d deleted, %d skipped", len(deleted), len(skipped))
	c.JSON(http.StatusOK, gin.H{"deleted": deleted, "skipped": skipped, "detail": fmt.Sprintf("%d deleted", len(deleted))})
}
