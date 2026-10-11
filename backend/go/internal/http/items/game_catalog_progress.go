package items

import (
	"encoding/json"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
)

// How complete the collection is, per catalog profile ("12 of 296 Nintendo 64
// games"). The catalog knows how many games a platform has; item+ knows how
// many of them are in the collection.
//
// This needs a catalog that answers GET /v1/itemplus/stats with the number of
// games per profile. That part of the contract is optional: without a
// configured catalog, or with one that does not offer the figures, item+
// reports that there is no progress to show and the dashboard leaves it out.

type gameCatalogStats struct {
	Profiles []struct {
		Key       string `json:"key"`
		Name      string `json:"name,omitempty"`
		GameCount int    `json:"game_count"`
	} `json:"profiles"`
}

const (
	gameCatalogStatsLifetime      = 10 * time.Minute
	gameCatalogStatsRetryInterval = time.Minute
)

var gameCatalogStatsCache struct {
	sync.Mutex
	url     string
	loaded  time.Time
	stats   gameCatalogStats
	failure error
}

// loadGameCatalogStats asks the catalog for its figures, at most once every
// few minutes: they change rarely, and the dashboard is opened often.
func loadGameCatalogStats() (gameCatalogStats, error) {
	cache := &gameCatalogStatsCache
	cache.Lock()
	defer cache.Unlock()

	lifetime := gameCatalogStatsLifetime
	if cache.failure != nil {
		lifetime = gameCatalogStatsRetryInterval
	}
	if cache.url == config.C.GameCatalogURL && !cache.loaded.IsZero() && time.Since(cache.loaded) < lifetime {
		return cache.stats, cache.failure
	}

	var stats gameCatalogStats
	err := gameCatalogGet("/v1/itemplus/stats", nil, &stats)
	cache.url, cache.loaded, cache.stats, cache.failure = config.C.GameCatalogURL, time.Now(), stats, err
	return stats, err
}

type collectionProgressEntry struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	Owned       int    `json:"owned"`
	Total       int    `json:"total"`
	CategoryIDs []int  `json:"category_ids"`
}

func getGameCatalogProgress(c *gin.Context) {
	unavailable := func(reason string) {
		c.JSON(http.StatusOK, gin.H{"available": false, "reason": reason, "profiles": []collectionProgressEntry{}})
	}
	if _, err := gameCatalogBaseURL(); err != nil {
		unavailable("no_catalog")
		return
	}
	stats, err := loadGameCatalogStats()
	if err != nil {
		if err == errGameCatalogNotFound {
			unavailable("no_figures")
		} else {
			unavailable("catalog_unreachable")
		}
		return
	}

	entries, err := collectionProgress(stats)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not load collection progress"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"available": true, "profiles": entries})
}

// collectionProgress counts, for every catalog profile, the items in the
// categories that were set up from it. A category belongs to a profile when
// one of its properties carries the catalog marker; several categories may
// share a profile. Profiles without items are left out.
func collectionProgress(stats gameCatalogStats) ([]collectionProgressEntry, error) {
	var properties []struct {
		CategoryID int     `db:"category_id"`
		Options    *string `db:"options"`
	}
	if err := database.DB.Select(&properties,
		"SELECT category_id, options FROM collection_properties WHERE options LIKE '%game_catalog%'"); err != nil {
		return nil, err
	}
	profileOfCategory := map[int]string{}
	for _, property := range properties {
		if property.Options == nil {
			continue
		}
		var options struct {
			GameCatalog struct {
				ProfileKey string `json:"profile_key"`
			} `json:"game_catalog"`
		}
		if json.Unmarshal([]byte(*property.Options), &options) == nil && options.GameCatalog.ProfileKey != "" {
			profileOfCategory[property.CategoryID] = options.GameCatalog.ProfileKey
		}
	}

	var counts []struct {
		CategoryID *int `db:"category_id"`
		Items      int  `db:"items"`
	}
	if err := database.DB.Select(&counts,
		"SELECT category_id, COUNT(*) AS items FROM collection_items GROUP BY category_id"); err != nil {
		return nil, err
	}
	owned := map[string]int{}
	categories := map[string][]int{}
	for _, count := range counts {
		if count.CategoryID == nil {
			continue
		}
		if profile := profileOfCategory[*count.CategoryID]; profile != "" && count.Items > 0 {
			owned[profile] += count.Items
			categories[profile] = append(categories[profile], *count.CategoryID)
		}
	}

	entries := []collectionProgressEntry{}
	for _, profile := range stats.Profiles {
		if owned[profile.Key] == 0 || profile.GameCount <= 0 {
			continue
		}
		name := profile.Name
		if name == "" {
			name = profile.Key
		}
		sort.Ints(categories[profile.Key])
		entries = append(entries, collectionProgressEntry{
			Key: profile.Key, Name: name, Owned: owned[profile.Key], Total: profile.GameCount, CategoryIDs: categories[profile.Key],
		})
	}
	// The most complete platform first.
	sort.SliceStable(entries, func(i, j int) bool {
		return entries[i].Owned*entries[j].Total > entries[j].Owned*entries[i].Total
	})
	return entries, nil
}
