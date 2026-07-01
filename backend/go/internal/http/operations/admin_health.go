package operations

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
)

func adminHealthLocations(c *gin.Context) {
	issues := []gin.H{}
	totalChecked := 0

	for _, realm := range []string{"archive", "collection"} {
		type loc struct {
			ID       int64  `db:"id"`
			Name     string `db:"name"`
			ParentID *int64 `db:"parent_id"`
		}

		var locations []loc
		err := database.DB.Select(&locations, fmt.Sprintf(
			"SELECT id, name, parent_id FROM %s_locations", realm))
		if err != nil {
			continue
		}
		totalChecked += len(locations)

		locMap := map[int64]*loc{}
		for i := range locations {
			locMap[locations[i].ID] = &locations[i]
		}

		for _, l := range locations {
			if l.ParentID == nil {
				continue
			}

			if *l.ParentID == l.ID {
				issues = append(issues, gin.H{
					"realm": realm,
					"id":    l.ID,
					"name":  l.Name,
					"type":  "self_parent",
				})
				continue
			}

			visited := map[int64]bool{}
			current := l.ParentID
			for current != nil {
				if *current == l.ID {
					issues = append(issues, gin.H{
						"realm": realm,
						"id":    l.ID,
						"name":  l.Name,
						"type":  "cycle",
					})
					break
				}
				if visited[*current] {
					break
				}
				visited[*current] = true
				parent, ok := locMap[*current]
				if !ok {
					break
				}
				current = parent.ParentID
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"issues":        issues,
		"total_checked": totalChecked,
	})
}

func adminFixLocations(c *gin.Context) {
	fixed := 0

	for _, realm := range []string{"archive", "collection"} {
		type loc struct {
			ID       int64  `db:"id"`
			ParentID *int64 `db:"parent_id"`
		}

		var locations []loc
		err := database.DB.Select(&locations, fmt.Sprintf(
			"SELECT id, parent_id FROM %s_locations", realm))
		if err != nil {
			continue
		}

		locMap := map[int64]*loc{}
		for i := range locations {
			locMap[locations[i].ID] = &locations[i]
		}

		var toFix []int64
		for _, l := range locations {
			if l.ParentID == nil {
				continue
			}

			shouldFix := false
			if *l.ParentID == l.ID {
				shouldFix = true
			} else {
				visited := map[int64]bool{}
				current := l.ParentID
				for current != nil {
					if *current == l.ID {
						shouldFix = true
						break
					}
					if visited[*current] {
						break
					}
					visited[*current] = true
					parent, ok := locMap[*current]
					if !ok {
						break
					}
					current = parent.ParentID
				}
			}

			if shouldFix {
				toFix = append(toFix, l.ID)
			}
		}

		for _, id := range toFix {
			result, err := database.DB.Exec(fmt.Sprintf(
				"UPDATE %s_locations SET parent_id = NULL WHERE id = ?", realm), id)
			if err == nil {
				affected, _ := result.RowsAffected()
				fixed += int(affected)
			}
			if entry, ok := locMap[id]; ok {
				entry.ParentID = nil
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"fixed": fixed})
}
