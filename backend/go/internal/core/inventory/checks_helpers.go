package inventory

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/itemplus/backend/internal/database"
)

func sessionTable() string {
	return "inventory_sessions"
}

func sessionEntryTable() string {
	return "inventory_session_entries"
}

func itemsTable(realm string) string {
	return realm + "_items"
}

func categoriesTable(realm string) string {
	return realm + "_categories"
}

func locationsTable(realm string) string {
	return realm + "_locations"
}

func checkoutsTable(realm string) string {
	return realm + "_checkouts"
}

func validRealm(realm string) bool {
	return realm == "archive" || realm == "collection"
}

func normalizeFoundVia(value string) string {
	value = strings.TrimSpace(value)
	switch value {
	case "manual", "scan":
		return value
	default:
		return "scan"
	}
}

func nullableString(value string) interface{} {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}

func parseScannedItemID(code string) (int, bool) {
	code = strings.TrimSpace(code)
	if code == "" {
		return 0, false
	}
	if strings.HasPrefix(code, "itp://") {
		parts := strings.Split(strings.TrimPrefix(code, "itp://"), "/")
		if len(parts) >= 3 && parts[1] == "i" {
			id, err := strconv.Atoi(parts[2])
			return id, err == nil && id > 0
		}
	}
	if strings.HasPrefix(code, "itemplus://item/") {
		id, err := strconv.Atoi(strings.TrimPrefix(code, "itemplus://item/"))
		return id, err == nil && id > 0
	}
	return 0, false
}

func loadLocationName(realm string, locationID int) (*string, error) {
	var name string
	err := database.DB.Get(&name, fmt.Sprintf("SELECT name FROM %s WHERE id = ?", locationsTable(realm)), locationID)
	if err != nil {
		return nil, err
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, nil
	}
	return &name, nil
}

func loadSession(id int) (*Session, error) {
	var session Session
	err := database.DB.Get(&session, "SELECT * FROM "+sessionTable()+" WHERE id = ?", id)
	if err != nil {
		return nil, err
	}
	return &session, nil
}

func loadActiveSession(realm string) (*Session, error) {
	var session Session
	err := database.DB.Get(&session,
		"SELECT * FROM "+sessionTable()+" WHERE realm = ? AND status = 'active' ORDER BY created_at DESC, id DESC LIMIT 1",
		realm,
	)
	if err != nil {
		return nil, err
	}
	return &session, nil
}

func sessionEntrySelectQuery(realm string) string {
	return fmt.Sprintf(`SELECT e.*,
			i.location_id AS current_location_id,
			l.name AS current_location_name,
			l.color AS current_location_color
		FROM %s e
		LEFT JOIN %s i ON e.item_id = i.id
		LEFT JOIN %s l ON i.location_id = l.id`,
		sessionEntryTable(),
		itemsTable(realm),
		locationsTable(realm),
	)
}

func loadSessionEntry(realm string, id int) (*SessionEntry, error) {
	var entry SessionEntry
	err := database.DB.Get(&entry, sessionEntrySelectQuery(realm)+" WHERE e.id = ?", id)
	if err != nil {
		return nil, err
	}
	return &entry, nil
}

func loadSessionEntryByItem(realm string, sessionID, itemID int) (*SessionEntry, error) {
	var entry SessionEntry
	err := database.DB.Get(&entry,
		sessionEntrySelectQuery(realm)+" WHERE e.session_id = ? AND e.item_id = ? ORDER BY e.id ASC LIMIT 1",
		sessionID, itemID,
	)
	if err != nil {
		return nil, err
	}
	return &entry, nil
}

func loadSessionEntries(realm string, sessionID int) ([]SessionEntry, error) {
	var entries []SessionEntry
	err := database.DB.Select(&entries,
		sessionEntrySelectQuery(realm)+" WHERE e.session_id = ? ORDER BY e.expected_in_scope DESC, e.status ASC, e.item_name ASC, e.id ASC",
		sessionID,
	)
	if err != nil {
		return nil, err
	}
	return entries, nil
}

func calculateCounts(entries []SessionEntry) SessionCounts {
	counts := SessionCounts{}
	for _, entry := range entries {
		if entry.LocationCorrected {
			counts.Corrected++
		}
		if entry.ExpectedInScope {
			counts.Expected++
			switch entry.Status {
			case "found":
				counts.Found++
			case "checked_out":
				counts.CheckedOut++
			case "missing":
				counts.Missing++
			case "location_mismatch":
				counts.LocationMismatch++
			default:
				counts.Pending++
			}
			continue
		}
		counts.Unexpected++
	}
	return counts
}

func loadSessionDetail(id int) (*SessionDetail, error) {
	session, err := loadSession(id)
	if err != nil {
		return nil, err
	}
	entries, err := loadSessionEntries(session.Realm, id)
	if err != nil {
		return nil, err
	}
	return &SessionDetail{
		Session: *session,
		Counts:  calculateCounts(entries),
		Entries: entries,
	}, nil
}

func loadRecentSessions(realm string, limit int) ([]SessionSummary, error) {
	if limit <= 0 {
		limit = 10
	}
	var sessions []Session
	err := database.DB.Select(&sessions,
		"SELECT * FROM "+sessionTable()+" WHERE realm = ? AND status = 'completed' ORDER BY completed_at DESC, id DESC LIMIT ?",
		realm, limit,
	)
	if err != nil {
		return nil, err
	}
	result := make([]SessionSummary, 0, len(sessions))
	for _, session := range sessions {
		entries, err := loadSessionEntries(session.Realm, session.ID)
		if err != nil {
			return nil, err
		}
		result = append(result, SessionSummary{
			Session: session,
			Counts:  calculateCounts(entries),
		})
	}
	return result, nil
}

type itemSnapshot struct {
	ID                  int            `db:"id"`
	Name                string         `db:"name"`
	CategoryID          sql.NullInt64  `db:"category_id"`
	CategoryName        sql.NullString `db:"category_name"`
	CategoryColor       sql.NullString `db:"category_color"`
	LocationID          sql.NullInt64  `db:"location_id"`
	LocationName        sql.NullString `db:"location_name"`
	LocationColor       sql.NullString `db:"location_color"`
	ActiveCheckoutCount sql.NullInt64  `db:"active_checkout_count"`
	CheckoutUserName    sql.NullString `db:"checkout_user_name"`
	CheckoutDueDate     sql.NullString `db:"checkout_due_date"`
}

func loadSessionScopeItems(realm string, locationID *int) ([]itemSnapshot, error) {
	conditions := []string{}
	args := []interface{}{}
	if locationID != nil && *locationID > 0 {
		conditions = append(conditions, "i.location_id = ?")
		args = append(args, *locationID)
	}
	if len(conditions) == 0 {
		conditions = append(conditions, "1=1")
	}
	query := fmt.Sprintf(`SELECT i.id, i.name, i.category_id,
			c.name AS category_name, c.color AS category_color,
			i.location_id, l.name AS location_name, l.color AS location_color,
			COALESCE(aco.active_checkout_count, 0) AS active_checkout_count,
			aco.checkout_user_name AS checkout_user_name,
			aco.checkout_due_date AS checkout_due_date
		FROM %s i
		LEFT JOIN %s c ON i.category_id = c.id
		LEFT JOIN %s l ON i.location_id = l.id
		LEFT JOIN (
			SELECT
				co.item_id,
				COUNT(*) AS active_checkout_count,
				CASE WHEN COUNT(*) = 1 THEN MAX(COALESCE(u.display_name, u.email)) ELSE NULL END AS checkout_user_name,
				CASE WHEN COUNT(*) = 1 THEN MAX(co.due_date) ELSE NULL END AS checkout_due_date
			FROM %s co
			LEFT JOIN users u ON co.user_id = u.id
			WHERE co.status = 'active' AND co.bundle_parent_item_id IS NULL
			GROUP BY co.item_id
		) aco ON aco.item_id = i.id
		WHERE %s
		ORDER BY COALESCE(l.name, ''), COALESCE(c.name, ''), i.name, i.id`,
		itemsTable(realm), categoriesTable(realm), locationsTable(realm), checkoutsTable(realm), strings.Join(conditions, " AND "))
	var items []itemSnapshot
	if err := database.DB.Select(&items, query, args...); err != nil {
		return nil, err
	}
	return items, nil
}

func loadItemSnapshotByID(realm string, itemID int) (*itemSnapshot, error) {
	var item itemSnapshot
	query := fmt.Sprintf(`SELECT i.id, i.name, i.category_id,
			c.name AS category_name, c.color AS category_color,
			i.location_id, l.name AS location_name, l.color AS location_color,
			COALESCE(aco.active_checkout_count, 0) AS active_checkout_count,
			aco.checkout_user_name AS checkout_user_name,
			aco.checkout_due_date AS checkout_due_date
		FROM %s i
		LEFT JOIN %s c ON i.category_id = c.id
		LEFT JOIN %s l ON i.location_id = l.id
		LEFT JOIN (
			SELECT
				co.item_id,
				COUNT(*) AS active_checkout_count,
				CASE WHEN COUNT(*) = 1 THEN MAX(COALESCE(u.display_name, u.email)) ELSE NULL END AS checkout_user_name,
				CASE WHEN COUNT(*) = 1 THEN MAX(co.due_date) ELSE NULL END AS checkout_due_date
			FROM %s co
			LEFT JOIN users u ON co.user_id = u.id
			WHERE co.status = 'active' AND co.bundle_parent_item_id IS NULL
			GROUP BY co.item_id
		) aco ON aco.item_id = i.id
		WHERE i.id = ?`,
		itemsTable(realm), categoriesTable(realm), locationsTable(realm), checkoutsTable(realm))
	if err := database.DB.Get(&item, query, itemID); err != nil {
		return nil, err
	}
	return &item, nil
}

func intPtrFromNullInt64(value sql.NullInt64) *int {
	if !value.Valid {
		return nil
	}
	v := int(value.Int64)
	return &v
}

func stringPtrFromNullString(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	text := strings.TrimSpace(value.String)
	if text == "" {
		return nil
	}
	return &text
}

func buildSessionEntryFromSnapshot(sessionID int, item itemSnapshot, expected bool) SessionEntry {
	status := "pending"
	if !expected {
		status = "unexpected"
	} else if item.ActiveCheckoutCount.Valid && item.ActiveCheckoutCount.Int64 > 0 {
		status = "checked_out"
	}
	return SessionEntry{
		SessionID:       sessionID,
		ItemID:          intPtrFromNullInt64(sql.NullInt64{Int64: int64(item.ID), Valid: true}),
		ItemName:        item.Name,
		CategoryID:      intPtrFromNullInt64(item.CategoryID),
		CategoryName:    stringPtrFromNullString(item.CategoryName),
		CategoryColor:   stringPtrFromNullString(item.CategoryColor),
		LocationID:      intPtrFromNullInt64(item.LocationID),
		LocationName:    stringPtrFromNullString(item.LocationName),
		LocationColor:   stringPtrFromNullString(item.LocationColor),
		ActiveCheckoutCount: int(item.ActiveCheckoutCount.Int64),
		CheckoutUserName:    stringPtrFromNullString(item.CheckoutUserName),
		CheckoutDueDate:     stringPtrFromNullString(item.CheckoutDueDate),
		ExpectedInScope: expected,
		Status:          status,
	}
}

func sameOptionalInt(a, b *int) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func scanStatusForEntry(entry *SessionEntry) string {
	if entry == nil {
		return "found"
	}
	if !entry.ExpectedInScope {
		return "unexpected"
	}
	if !sameOptionalInt(entry.LocationID, entry.CurrentLocationID) {
		return "location_mismatch"
	}
	return "found"
}

func correctionTarget(session *Session, entry *SessionEntry) (*int, *string) {
	if entry == nil {
		return nil, nil
	}
	if entry.ExpectedInScope && entry.LocationID != nil && *entry.LocationID > 0 {
		return entry.LocationID, entry.LocationName
	}
	if session != nil && session.LocationID != nil && *session.LocationID > 0 {
		return session.LocationID, session.LocationName
	}
	return nil, nil
}

func insertSessionEntry(entry SessionEntry, foundVia string, foundCode string) (int64, error) {
	now := database.TimestampNow()
	var foundAt interface{}
	if entry.Status == "found" || entry.Status == "unexpected" {
		foundAt = now
	}
	res, err := database.DB.Exec(
		`INSERT INTO `+sessionEntryTable()+`
			(session_id, item_id, item_name, category_id, category_name, category_color,
			 location_id, location_name, location_color, active_checkout_count, checkout_user_name,
			 checkout_due_date, expected_in_scope, status, found_via,
			 found_code, location_corrected, corrected_location_id, corrected_location_name,
			 notes, found_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		entry.SessionID,
		entry.ItemID,
		entry.ItemName,
		entry.CategoryID,
		entry.CategoryName,
		entry.CategoryColor,
		entry.LocationID,
		entry.LocationName,
		entry.LocationColor,
		entry.ActiveCheckoutCount,
		entry.CheckoutUserName,
		entry.CheckoutDueDate,
		entry.ExpectedInScope,
		entry.Status,
		nullableString(foundVia),
		nullableString(foundCode),
		entry.LocationCorrected,
		entry.CorrectedLocationID,
		entry.CorrectedLocationName,
		entry.Notes,
		foundAt,
		now,
		now,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func todayTitlePrefix() string {
	return time.Now().Format("2006-01-02")
}
