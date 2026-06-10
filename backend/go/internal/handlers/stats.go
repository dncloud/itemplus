package handlers

import (
	"fmt"
	"math"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
)

func RegisterStatsRoutes(api *gin.RouterGroup) {
	stats := api.Group("/stats", middleware.Auth())
	stats.GET("/overview", statsOverview)
	stats.GET("/inventory", statsInventory)
	stats.GET("/locations", statsLocations)
	stats.GET("/ai-usage", middleware.RequireAdmin(), statsAIUsage)
}

type aiUsageStatsBucket struct {
	Bucket             string `db:"bucket" json:"bucket"`
	Provider           string `db:"provider" json:"provider"`
	Requests           int64  `db:"requests" json:"requests"`
	SuccessfulRequests int64  `db:"successful_requests" json:"successful_requests"`
	FailedRequests     int64  `db:"failed_requests" json:"failed_requests"`
	InputTokens        int64  `db:"input_tokens" json:"input_tokens"`
	OutputTokens       int64  `db:"output_tokens" json:"output_tokens"`
	TotalTokens        int64  `db:"total_tokens" json:"total_tokens"`
	ReasoningTokens    int64  `db:"reasoning_tokens" json:"reasoning_tokens"`
	WebSearchRequests  int64  `db:"web_search_requests" json:"web_search_requests"`
	WebFetchRequests   int64  `db:"web_fetch_requests" json:"web_fetch_requests"`
}

type aiUsageStatsPeriod struct {
	Label   string               `json:"label"`
	Since   string               `json:"since"`
	Buckets []aiUsageStatsBucket `json:"buckets"`
}

type aiUsageEventRow struct {
	Provider          string `db:"provider"`
	Success           int    `db:"success"`
	InputTokens       int64  `db:"input_tokens"`
	OutputTokens      int64  `db:"output_tokens"`
	TotalTokens       int64  `db:"total_tokens"`
	ReasoningTokens   int64  `db:"reasoning_tokens"`
	WebSearchRequests int64  `db:"web_search_requests"`
	WebFetchRequests  int64  `db:"web_fetch_requests"`
	CreatedAt         string `db:"created_at"`
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func realmStats(realm string) gin.H {
	var items, categories, locations, properties, totalQty int
	var totalValue, avgPrice float64

	database.DB.Get(&items, fmt.Sprintf("SELECT COUNT(*) FROM %s_items", realm))
	database.DB.Get(&categories, fmt.Sprintf("SELECT COUNT(*) FROM %s_categories", realm))
	database.DB.Get(&locations, fmt.Sprintf("SELECT COUNT(*) FROM %s_locations", realm))
	database.DB.Get(&properties, fmt.Sprintf("SELECT COUNT(*) FROM %s_properties", realm))
	database.DB.Get(&totalValue, fmt.Sprintf("SELECT COALESCE(SUM(purchase_price * quantity), 0) FROM %s_items WHERE purchase_price IS NOT NULL", realm))
	database.DB.Get(&totalQty, fmt.Sprintf("SELECT COALESCE(SUM(quantity), 0) FROM %s_items", realm))
	database.DB.Get(&avgPrice, fmt.Sprintf("SELECT COALESCE(AVG(purchase_price), 0) FROM %s_items WHERE purchase_price IS NOT NULL", realm))

	// Recently active (added or updated)
	recentQuery := fmt.Sprintf(
		`SELECT i.id, i.name, i.created_at, i.updated_at,
			c.name AS category_name, c.color AS category_color,
			l.name AS location_name, l.color AS location_color
		FROM %s_items i
		LEFT JOIN %s_categories c ON i.category_id = c.id
		LEFT JOIN %s_locations l ON i.location_id = l.id
		ORDER BY i.updated_at DESC LIMIT 8`, realm, realm, realm)
	recentRows, _ := database.DB.Queryx(recentQuery)
	var recentlyAdded []gin.H
	if recentRows != nil {
		defer recentRows.Close()
		for recentRows.Next() {
			row := map[string]interface{}{}
			if recentRows.MapScan(row) == nil {
				cleanRow(row)
				recentlyAdded = append(recentlyAdded, gin.H(row))
			}
		}
	}
	if recentlyAdded == nil {
		recentlyAdded = []gin.H{}
	}

	// Top by value
	topValQuery := fmt.Sprintf(
		`SELECT i.id, i.name, (i.purchase_price * i.quantity) AS value,
			c.name AS category_name, c.color AS category_color,
			l.name AS location_name, l.color AS location_color
		FROM %s_items i
		LEFT JOIN %s_categories c ON i.category_id = c.id
		LEFT JOIN %s_locations l ON i.location_id = l.id
		WHERE i.purchase_price IS NOT NULL
		ORDER BY (i.purchase_price * i.quantity) DESC LIMIT 5`, realm, realm, realm)
	topValRows, _ := database.DB.Queryx(topValQuery)
	var topByValue []gin.H
	if topValRows != nil {
		defer topValRows.Close()
		for topValRows.Next() {
			row := map[string]interface{}{}
			if topValRows.MapScan(row) == nil {
				cleanRow(row)
				if value, ok := row["value"].(float64); ok {
					row["value"] = round2(value)
				}
				topByValue = append(topByValue, gin.H(row))
			}
		}
	}
	if topByValue == nil {
		topByValue = []gin.H{}
	}

	// Top by quantity
	topQtyQuery := fmt.Sprintf(
		`SELECT i.id, i.name, i.quantity,
			c.name AS category_name, c.color AS category_color,
			l.name AS location_name, l.color AS location_color
		FROM %s_items i
		LEFT JOIN %s_categories c ON i.category_id = c.id
		LEFT JOIN %s_locations l ON i.location_id = l.id
		ORDER BY i.quantity DESC LIMIT 5`, realm, realm, realm)
	topQtyRows, _ := database.DB.Queryx(topQtyQuery)
	var topByQuantity []gin.H
	if topQtyRows != nil {
		defer topQtyRows.Close()
		for topQtyRows.Next() {
			row := map[string]interface{}{}
			if topQtyRows.MapScan(row) == nil {
				cleanRow(row)
				topByQuantity = append(topByQuantity, gin.H(row))
			}
		}
	}
	if topByQuantity == nil {
		topByQuantity = []gin.H{}
	}

	// By category
	catRows, _ := database.DB.Queryx(fmt.Sprintf(
		`SELECT c.id, c.name, COUNT(i.id) AS items, COALESCE(SUM(i.purchase_price * i.quantity), 0) AS value
		FROM %s_categories c LEFT JOIN %s_items i ON i.category_id = c.id
		GROUP BY c.id, c.name ORDER BY c.name`, realm, realm))
	var byCategory []gin.H
	if catRows != nil {
		defer catRows.Close()
		for catRows.Next() {
			var id, itemCount int
			var name string
			var value float64
			catRows.Scan(&id, &name, &itemCount, &value)
			byCategory = append(byCategory, gin.H{"id": id, "name": name, "items": itemCount, "value": round2(value)})
		}
	}
	if byCategory == nil {
		byCategory = []gin.H{}
	}
	totalValue = round2(totalValue)
	avgPrice = round2(avgPrice)

	return gin.H{
		"items":           items,
		"categories":      categories,
		"locations":       locations,
		"properties":      properties,
		"total_value":     totalValue,
		"total_quantity":  totalQty,
		"avg_price":       avgPrice,
		"recently_added":  recentlyAdded,
		"top_by_value":    topByValue,
		"top_by_quantity": topByQuantity,
		"by_category":     byCategory,
	}
}

func statsOverview(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"archive":    realmStats("archive"),
		"collection": realmStats("collection"),
	})
}

func statsInventory(c *gin.Context) {
	var warnings []gin.H

	for _, realm := range []string{"archive", "collection"} {
		rows, err := database.DB.Queryx(fmt.Sprintf(
			`SELECT id, name, quantity, minimum_quantity FROM %s_items
			WHERE is_consumable = 1 AND minimum_quantity IS NOT NULL AND quantity <= minimum_quantity`, realm))
		if err != nil {
			continue
		}
		defer rows.Close()
		for rows.Next() {
			var id, qty int
			var minQty *int
			var name string
			rows.Scan(&id, &name, &qty, &minQty)
			level := "low_stock"
			if qty == 0 {
				level = "out_of_stock"
			}
			w := gin.H{"realm": realm, "item_id": id, "name": name, "level": level, "quantity": qty}
			if level == "low_stock" && minQty != nil {
				w["minimum"] = *minQty
			}
			warnings = append(warnings, w)
		}
	}
	if warnings == nil {
		warnings = []gin.H{}
	}

	c.JSON(http.StatusOK, gin.H{"warnings": warnings})
}

func statsLocations(c *gin.Context) {
	var warnings []gin.H

	for _, realm := range []string{"archive", "collection"} {
		rows, err := database.DB.Queryx(fmt.Sprintf(
			`SELECT l.id, l.name, l.capacity, COALESCE(SUM(i.quantity), 0) AS used
			FROM %s_locations l
			LEFT JOIN %s_items i ON i.location_id = l.id
			WHERE l.capacity IS NOT NULL AND l.capacity > 0
			GROUP BY l.id, l.name, l.capacity`, realm, realm))
		if err != nil {
			continue
		}
		defer rows.Close()
		for rows.Next() {
			var id, capacity, used int
			var name string
			rows.Scan(&id, &name, &capacity, &used)
			if capacity == 0 {
				continue
			}
			pct := float64(used) / float64(capacity)
			if pct < 0.75 {
				continue
			}
			level := "warning"
			if pct >= 1.0 {
				level = "full"
			} else if pct >= 0.9 {
				level = "almost_full"
			}
			warnings = append(warnings, gin.H{
				"realm":       realm,
				"location_id": id,
				"name":        name,
				"level":       level,
				"used":        used,
				"capacity":    capacity,
			})
		}
	}
	if warnings == nil {
		warnings = []gin.H{}
	}

	c.JSON(http.StatusOK, gin.H{"warnings": warnings})
}

func statsAIUsage(c *gin.Context) {
	now := time.Now()
	c.JSON(http.StatusOK, gin.H{
		"hour":  loadAIUsageStatsPeriod("hour", startOfHour(now), now),
		"day":   loadAIUsageStatsPeriod("day", startOfDay(now), now),
		"week":  loadAIUsageStatsPeriod("week", startOfWeek(now), now),
		"month": loadAIUsageStatsPeriod("month", startOfMonth(now), now),
		"total": loadAIUsageStatsTotal(now),
	})
}

func loadAIUsageStatsPeriod(label string, since time.Time, until time.Time) aiUsageStatsPeriod {
	eventRows := []aiUsageEventRow{}
	query := `
		SELECT
			COALESCE(provider, '') AS provider,
			CASE WHEN success = 1 THEN 1 ELSE 0 END AS success,
			COALESCE(input_tokens, 0) AS input_tokens,
			COALESCE(output_tokens, 0) AS output_tokens,
			COALESCE(total_tokens, 0) AS total_tokens,
			COALESCE(reasoning_tokens, 0) AS reasoning_tokens,
			COALESCE(web_search_requests, 0) AS web_search_requests,
			COALESCE(web_fetch_requests, 0) AS web_fetch_requests,
			created_at
		FROM ai_usage_events
		WHERE created_at >= ?
		ORDER BY created_at`
	if err := database.DB.Select(&eventRows, query, database.TimestampAt(since.UTC())); err != nil {
		eventRows = []aiUsageEventRow{}
	}

	return aiUsageStatsPeriod{
		Label:   label,
		Since:   since.Format(time.RFC3339),
		Buckets: buildAIUsageBuckets(label, since, until, eventRows),
	}
}

func loadAIUsageStatsTotal(now time.Time) aiUsageStatsPeriod {
	eventRows := []aiUsageEventRow{}
	query := `
		SELECT
			COALESCE(provider, '') AS provider,
			CASE WHEN success = 1 THEN 1 ELSE 0 END AS success,
			COALESCE(input_tokens, 0) AS input_tokens,
			COALESCE(output_tokens, 0) AS output_tokens,
			COALESCE(total_tokens, 0) AS total_tokens,
			COALESCE(reasoning_tokens, 0) AS reasoning_tokens,
			COALESCE(web_search_requests, 0) AS web_search_requests,
			COALESCE(web_fetch_requests, 0) AS web_fetch_requests,
			created_at
		FROM ai_usage_events
		ORDER BY created_at`
	if err := database.DB.Select(&eventRows, query); err != nil {
		eventRows = []aiUsageEventRow{}
	}

	since := startOfMonth(now)
	for _, row := range eventRows {
		createdAt, err := database.ParseTimestamp(row.CreatedAt)
		if err != nil {
			continue
		}
		candidate := startOfMonth(createdAt.In(now.Location()))
		if candidate.Before(since) {
			since = candidate
		}
	}

	return aiUsageStatsPeriod{
		Label:   "total",
		Since:   since.Format(time.RFC3339),
		Buckets: buildAIUsageBuckets("total", since, now, eventRows),
	}
}

func buildAIUsageBuckets(label string, since time.Time, until time.Time, eventRows []aiUsageEventRow) []aiUsageStatsBucket {
	location := since.Location()
	bucketsByKey := make(map[string]*aiUsageStatsBucket)
	knownProviders := []string{"openai", "ollama"}

	for cursor := aiUsageBucketStart(label, since); !cursor.After(until); cursor = aiUsageNextBucket(label, cursor) {
		bucketLabel := cursor.Format(time.RFC3339)
		for _, provider := range knownProviders {
			key := bucketLabel + "\x00" + provider
			bucketsByKey[key] = &aiUsageStatsBucket{
				Bucket:   bucketLabel,
				Provider: provider,
			}
		}
	}

	for _, row := range eventRows {
		createdAt, err := database.ParseTimestamp(row.CreatedAt)
		if err != nil {
			continue
		}
		localCreatedAt := createdAt.In(location)
		if localCreatedAt.Before(since) || localCreatedAt.After(until) {
			continue
		}
		bucketStart := aiUsageBucketStart(label, localCreatedAt)
		bucketLabel := bucketStart.Format(time.RFC3339)
		provider := strings.TrimSpace(row.Provider)
		if provider == "" {
			provider = "unknown"
		}
		key := bucketLabel + "\x00" + provider
		bucket := bucketsByKey[key]
		if bucket == nil {
			bucket = &aiUsageStatsBucket{
				Bucket:   bucketLabel,
				Provider: provider,
			}
			bucketsByKey[key] = bucket
		}
		bucket.Requests++
		if row.Success == 1 {
			bucket.SuccessfulRequests++
		} else {
			bucket.FailedRequests++
		}
		bucket.InputTokens += row.InputTokens
		bucket.OutputTokens += row.OutputTokens
		bucket.TotalTokens += row.TotalTokens
		bucket.ReasoningTokens += row.ReasoningTokens
		bucket.WebSearchRequests += row.WebSearchRequests
		bucket.WebFetchRequests += row.WebFetchRequests
	}

	rows := make([]aiUsageStatsBucket, 0, len(bucketsByKey))
	for _, bucket := range bucketsByKey {
		rows = append(rows, *bucket)
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Bucket == rows[j].Bucket {
			return rows[i].Provider < rows[j].Provider
		}
		return rows[i].Bucket < rows[j].Bucket
	})
	return rows
}

func startOfHour(t time.Time) time.Time {
	return t.Truncate(time.Hour)
}

func startOfMinute(t time.Time) time.Time {
	return t.Truncate(time.Minute)
}

func startOfDay(t time.Time) time.Time {
	year, month, day := t.Date()
	return time.Date(year, month, day, 0, 0, 0, 0, t.Location())
}

func startOfWeek(t time.Time) time.Time {
	start := startOfDay(t)
	weekday := int(start.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	return start.AddDate(0, 0, -(weekday - 1))
}

func startOfMonth(t time.Time) time.Time {
	year, month, _ := t.Date()
	return time.Date(year, month, 1, 0, 0, 0, 0, t.Location())
}

func aiUsageBucketStart(label string, t time.Time) time.Time {
	switch label {
	case "hour":
		return startOfMinute(t)
	case "day":
		return startOfHour(t)
	case "week":
		return startOfDay(t)
	case "month":
		return startOfDay(t)
	case "total":
		return startOfMonth(t)
	default:
		return startOfDay(t)
	}
}

func aiUsageNextBucket(label string, t time.Time) time.Time {
	switch label {
	case "hour":
		return t.Add(time.Minute)
	case "day":
		return t.Add(time.Hour)
	case "week", "month":
		return t.AddDate(0, 0, 1)
	case "total":
		return t.AddDate(0, 1, 0)
	default:
		return t.AddDate(0, 0, 1)
	}
}
