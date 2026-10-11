package operations

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
)

const (
	growthMonths = 12
	activityDays = 30
)

// dayOf returns the calendar day (YYYY-MM-DD, UTC) of a timestamp column.
// Depending on the database engine and driver the value arrives as a time, a
// string or bytes; grouping by day or month is done here instead of in SQL so
// SQLite and MySQL give the same result.
func dayOf(value interface{}) string {
	switch v := value.(type) {
	case time.Time:
		return v.UTC().Format("2006-01-02")
	case string:
		if len(v) >= 10 {
			return v[:10]
		}
	case []byte:
		if len(v) >= 10 {
			return string(v[:10])
		}
	}
	return ""
}

// realmChartStats returns what the dashboard charts are drawn from: how the
// realm has grown month by month, how the items spread over the locations,
// how many are lent out and how much has happened each day.
func realmChartStats(realm string, now time.Time) gin.H {
	now = now.UTC()

	// Growth: number and value of the items that existed at the end of each of
	// the last twelve months, going by when an item was created.
	months := make([]string, growthMonths)
	firstOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	for i := range months {
		months[i] = firstOfMonth.AddDate(0, i-(growthMonths-1), 0).Format("2006-01")
	}
	addedItems := map[string]int{}
	addedValue := map[string]float64{}
	itemsBefore := 0
	valueBefore := 0.0

	itemRows, err := database.DB.Queryx(fmt.Sprintf(
		"SELECT created_at, COALESCE(purchase_price * quantity, 0) AS value FROM %s_items", realm))
	if err == nil {
		for itemRows.Next() {
			var created interface{}
			var value float64
			if itemRows.Scan(&created, &value) != nil {
				continue
			}
			day := dayOf(created)
			if len(day) < 7 || day[:7] < months[0] {
				itemsBefore++
				valueBefore += value
				continue
			}
			addedItems[day[:7]]++
			addedValue[day[:7]] += value
		}
		itemRows.Close()
	}

	growth := make([]gin.H, 0, growthMonths)
	runningItems, runningValue := itemsBefore, valueBefore
	for _, month := range months {
		runningItems += addedItems[month]
		runningValue += addedValue[month]
		growth = append(growth, gin.H{
			"month": month,
			"added": addedItems[month],
			"items": runningItems,
			"value": round2(runningValue),
		})
	}

	// Activity: stock movements per day, by kind. Creating, buying, using,
	// lending and returning all leave a movement, so this is the pulse of the
	// realm.
	days := make([]string, activityDays)
	for i := range days {
		days[i] = now.AddDate(0, 0, i-(activityDays-1)).Format("2006-01-02")
	}
	perDay := map[string]int{}
	perDayByType := map[string]map[string]int{}
	movementRows, err := database.DB.Queryx(fmt.Sprintf(
		"SELECT created_at, movement_type FROM %s_inventory_movements ORDER BY id DESC LIMIT 5000", realm))
	if err == nil {
		for movementRows.Next() {
			var created interface{}
			var movementType string
			if movementRows.Scan(&created, &movementType) != nil {
				continue
			}
			day := dayOf(created)
			if day < days[0] {
				break
			}
			perDay[day]++
			if perDayByType[day] == nil {
				perDayByType[day] = map[string]int{}
			}
			perDayByType[day][movementType]++
		}
		movementRows.Close()
	}
	activity := make([]gin.H, 0, activityDays)
	for _, day := range days {
		types := perDayByType[day]
		if types == nil {
			types = map[string]int{}
		}
		activity = append(activity, gin.H{"date": day, "count": perDay[day], "types": types})
	}

	byLocation := []gin.H{}
	locationRows, err := database.DB.Queryx(fmt.Sprintf(
		`SELECT l.id, l.name, l.color, COUNT(i.id) AS items
		FROM %s_locations l LEFT JOIN %s_items i ON i.location_id = l.id
		GROUP BY l.id, l.name, l.color ORDER BY l.name`, realm, realm))
	if err == nil {
		for locationRows.Next() {
			var id, itemCount int
			var name string
			var color *string
			if locationRows.Scan(&id, &name, &color, &itemCount) != nil {
				continue
			}
			byLocation = append(byLocation, gin.H{"id": id, "name": name, "color": color, "items": itemCount})
		}
		locationRows.Close()
	}

	var checkedOut int
	database.DB.Get(&checkedOut, fmt.Sprintf("SELECT COUNT(*) FROM %s_checkouts WHERE status = 'active'", realm))

	return gin.H{
		"growth":      growth,
		"activity":    activity,
		"by_location": byLocation,
		"checked_out": checkedOut,
	}
}
