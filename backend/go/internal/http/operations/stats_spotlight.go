package operations

import (
	"fmt"
	"hash/fnv"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

// A week of finds should not repeat: only when at least this many items have
// a picture is the choice limited to them.
const spotlightMinPictured = 7

// realmSpotlight picks the realm's "find of the day": one item, the same for
// everyone and for the whole (UTC) day, a different one tomorrow. Items with a
// picture are preferred, because the dashboard shows it large, as long as
// there are enough of them. It returns nil for an empty realm.
func realmSpotlight(realm string, now time.Time) gin.H {
	day := now.UTC().Format("2006-01-02")

	var withPicture []int64
	type attachment struct {
		ItemID   int64  `db:"item_id"`
		Filename string `db:"filename"`
	}
	var attachments []attachment
	if err := database.DB.Select(&attachments, fmt.Sprintf(
		"SELECT item_id, filename FROM %s_attachments WHERE gallery = 1 ORDER BY item_id", realm)); err == nil {
		for _, a := range attachments {
			if !previewImageExtensions[strings.ToLower(filepath.Ext(a.Filename))] {
				continue
			}
			if n := len(withPicture); n == 0 || withPicture[n-1] != a.ItemID {
				withPicture = append(withPicture, a.ItemID)
			}
		}
	}

	candidates := withPicture
	if len(candidates) < spotlightMinPictured {
		candidates = nil
		if err := database.DB.Select(&candidates, fmt.Sprintf("SELECT id FROM %s_items ORDER BY id", realm)); err != nil {
			return nil
		}
	}
	if len(candidates) == 0 {
		return nil
	}

	hash := fnv.New32a()
	hash.Write([]byte(realm + "|" + day))
	itemID := candidates[int(hash.Sum32()%uint32(len(candidates)))]

	rows, err := database.DB.Queryx(fmt.Sprintf(
		`SELECT i.id, i.name, i.quantity, i.created_at, i.updated_at,
			(i.purchase_price * i.quantity) AS value,
			c.name AS category_name, c.color AS category_color,
			l.name AS location_name, l.color AS location_color
		FROM %s_items i
		LEFT JOIN %s_categories c ON i.category_id = c.id
		LEFT JOIN %s_locations l ON i.location_id = l.id
		WHERE i.id = ?`, realm, realm, realm), itemID)
	if err != nil {
		return nil
	}
	var spotlight gin.H
	for rows.Next() {
		row := map[string]interface{}{}
		if rows.MapScan(row) == nil {
			middleware.CleanRow(row)
			if value, ok := row["value"].(float64); ok {
				row["value"] = round2(value)
			}
			spotlight = gin.H(row)
		}
	}
	rows.Close()
	if spotlight == nil {
		return nil
	}

	addPreviewImages(realm, []gin.H{spotlight})
	spotlight["date"] = day
	return spotlight
}
