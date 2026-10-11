package items

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/testdb"
)

func useGameCatalog(t *testing.T, url string) {
	t.Helper()
	previous := config.C.GameCatalogURL
	config.C.GameCatalogURL = url
	gameCatalogStatsCache.Lock()
	gameCatalogStatsCache.loaded = time.Time{}
	gameCatalogStatsCache.Unlock()
	t.Cleanup(func() { config.C.GameCatalogURL = previous })
}

func progressResponse(t *testing.T) (available bool, reason string, profiles []collectionProgressEntry) {
	t.Helper()
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/collection/items/game-catalog/progress", nil)
	getGameCatalogProgress(context)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status %d: %s", recorder.Code, recorder.Body.String())
	}
	var body struct {
		Available bool                      `json:"available"`
		Reason    string                    `json:"reason"`
		Profiles  []collectionProgressEntry `json:"profiles"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	return body.Available, body.Reason, body.Profiles
}

// Progress is only reported when a catalog is configured and offers the
// figures; otherwise the answer says why there is nothing to show.
func TestGameCatalogProgressNeedsCatalogWithFigures(t *testing.T) {
	testdb.Use(t)

	useGameCatalog(t, "")
	if available, reason, _ := progressResponse(t); available || reason != "no_catalog" {
		t.Errorf("no catalog: available=%v reason=%q", available, reason)
	}

	withoutFigures := httptest.NewServer(http.NotFoundHandler())
	defer withoutFigures.Close()
	useGameCatalog(t, withoutFigures.URL)
	if available, reason, _ := progressResponse(t); available || reason != "no_figures" {
		t.Errorf("catalog without figures: available=%v reason=%q", available, reason)
	}

	broken := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer broken.Close()
	useGameCatalog(t, broken.URL)
	if available, reason, _ := progressResponse(t); available || reason != "catalog_unreachable" {
		t.Errorf("broken catalog: available=%v reason=%q", available, reason)
	}
}

func TestGameCatalogProgressCountsItemsPerProfile(t *testing.T) {
	testdb.Use(t)
	requests := 0
	catalog := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/itemplus/stats" {
			http.NotFound(w, r)
			return
		}
		requests++
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"profiles":[
			{"key":"pc-games","name":"PC","game_count":1000},
			{"key":"nintendo-64-games","name":"Nintendo 64","game_count":10},
			{"key":"snes-games","name":"SNES","game_count":700}
		]}`))
	}))
	defer catalog.Close()
	useGameCatalog(t, catalog.URL)

	now := database.TimestampNow()
	exec := func(query string, args ...interface{}) {
		t.Helper()
		if _, err := database.DB.Exec(query, args...); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}
	// Categories 1 and 2 were set up from pc-games, 3 from nintendo-64-games,
	// 4 from snes-games (but holds nothing), 5 has nothing to do with the catalog.
	for _, name := range []string{"DOS", "Windows", "N64", "SNES", "Books"} {
		exec("INSERT INTO collection_categories (name, created_at, updated_at) VALUES (?, ?, ?)", name, now, now)
	}
	marker := func(profile string) string {
		return `{"game_catalog":{"profile_key":"` + profile + `","property_key":"genres","source":"catalog"}}`
	}
	for category, profile := range map[int]string{1: "pc-games", 2: "pc-games", 3: "nintendo-64-games", 4: "snes-games"} {
		exec("INSERT INTO collection_properties (category_id, name, property_type, options, created_at, updated_at) VALUES (?, 'Genres', 'multiselect', ?, ?, ?)", category, marker(profile), now, now)
	}
	exec("INSERT INTO collection_properties (category_id, name, property_type, options, created_at, updated_at) VALUES (5, 'ISBN', 'text', '{}', ?, ?)", now, now)
	for _, category := range []interface{}{1, 1, 2, 3, 3, 3, 3, 5, nil} {
		exec("INSERT INTO collection_items (name, quantity, category_id, created_at, updated_at) VALUES ('Item', 1, ?, ?, ?)", category, now, now)
	}

	available, _, profiles := progressResponse(t)
	if !available || len(profiles) != 2 {
		t.Fatalf("available=%v profiles=%+v, want the two profiles that have items", available, profiles)
	}
	n64, pc := profiles[0], profiles[1]
	if n64.Key != "nintendo-64-games" || n64.Name != "Nintendo 64" || n64.Owned != 4 || n64.Total != 10 {
		t.Errorf("first (most complete) = %+v, want Nintendo 64 with 4 of 10", n64)
	}
	if pc.Key != "pc-games" || pc.Owned != 3 || pc.Total != 1000 || len(pc.CategoryIDs) != 2 {
		t.Errorf("second = %+v, want PC with 3 of 1000 from two categories", pc)
	}

	progressResponse(t)
	if requests != 1 {
		t.Errorf("the catalog was asked %d times for two dashboards, want 1 (cached)", requests)
	}
}
