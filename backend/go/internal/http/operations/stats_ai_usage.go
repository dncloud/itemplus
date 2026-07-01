package operations

import (
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
)

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
