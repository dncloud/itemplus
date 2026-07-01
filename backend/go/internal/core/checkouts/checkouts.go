package checkouts

import (
	"math"
	"strings"
	"time"
)

func EnrichCheckoutRow(row map[string]interface{}, realm string) {
	row["realm"] = realm
	now := time.Now().In(time.Local)

	var start time.Time
	if v, ok := row["created_at"]; ok && v != nil {
		start = ParseCheckoutTime(v)
	}

	var returned time.Time
	var hasReturned bool
	if v, ok := row["returned_at"]; ok && v != nil {
		returned = ParseCheckoutTime(v)
		hasReturned = !returned.IsZero()
	}

	if !start.IsZero() {
		end := now
		if hasReturned {
			end = returned
		}
		durationDays := end.Sub(start).Seconds() / 86400
		row["duration_days"] = math.Round(durationDays*10) / 10
	}

	if v, ok := row["due_date"]; ok && v != nil {
		due := ParseCheckoutTime(v)
		if !due.IsZero() {
			statusVal, _ := row["status"].(string)
			if statusVal == "" {
				if b, ok := row["status"].([]byte); ok {
					statusVal = string(b)
				}
			}
			if statusVal == "active" {
				isOverdue := IsCheckoutOverdue(now, due)
				row["is_overdue"] = isOverdue
				row["overdue_days"] = CalculateOverdueDays(now, due)
			} else if hasReturned {
				wasOverdue := IsCheckoutOverdue(returned, due)
				row["was_overdue"] = wasOverdue
				row["overdue_days"] = CalculateOverdueDays(returned, due)
			}
		}
	}
}

func NormalizeCheckoutDate(value time.Time, loc *time.Location) time.Time {
	local := value.In(loc)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, loc)
}

func IsCheckoutOverdue(reference, due time.Time) bool {
	loc := time.Local
	return NormalizeCheckoutDate(reference, loc).After(NormalizeCheckoutDate(due, loc))
}

func CalculateOverdueDays(reference, due time.Time) float64 {
	loc := time.Local
	referenceDate := NormalizeCheckoutDate(reference, loc)
	dueDate := NormalizeCheckoutDate(due, loc)
	overdueDays := referenceDate.Sub(dueDate).Seconds() / 86400
	if overdueDays < 0 {
		overdueDays = 0
	}
	return math.Round(overdueDays*10) / 10
}

func ParseCheckoutTime(v interface{}) time.Time {
	switch val := v.(type) {
	case time.Time:
		return val.UTC()
	case string:
		return ParseCheckoutTimeString(val)
	case []byte:
		return ParseCheckoutTimeString(string(val))
	}
	return time.Time{}
}

func ParseCheckoutTimeString(s string) time.Time {
	if len(s) == len("2006-01-02") {
		if t, err := time.ParseInLocation("2006-01-02", s, time.Local); err == nil {
			return t
		}
	}
	for _, layout := range []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05Z",
		"2006-01-02 15:04:05Z",
	} {
		if t, err := time.Parse(layout, s); err == nil {
			return t.UTC()
		}
	}
	return time.Time{}
}

func NormalizeNullableDBValue(v interface{}) interface{} {
	if v == nil {
		return nil
	}
	switch value := v.(type) {
	case string:
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return nil
		}
		return trimmed
	case []byte:
		trimmed := strings.TrimSpace(string(value))
		if trimmed == "" {
			return nil
		}
		return trimmed
	default:
		return v
	}
}
