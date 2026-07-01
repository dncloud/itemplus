package inventory

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/itemplus/backend/internal/database"
)

func StartSession(input StartSessionInput) (*SessionDetail, error) {
	if !validRealm(input.Realm) {
		return nil, fmt.Errorf("invalid realm")
	}
	if active, err := loadActiveSession(input.Realm); err == nil {
		return loadSessionDetail(active.ID)
	} else if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	var locationName *string
	if input.LocationID != nil && *input.LocationID > 0 {
		name, err := loadLocationName(input.Realm, *input.LocationID)
		if err != nil {
			return nil, fmt.Errorf("location not found")
		}
		locationName = name
	}

	title := strings.TrimSpace(input.Title)
	if title == "" {
		if locationName != nil && strings.TrimSpace(*locationName) != "" {
			title = fmt.Sprintf("%s - %s", todayTitlePrefix(), strings.TrimSpace(*locationName))
		} else {
			title = todayTitlePrefix()
		}
	}

	now := database.TimestampNow()
	res, err := database.DB.Exec(
		`INSERT INTO `+sessionTable()+`
			(realm, scope_type, location_id, location_name, title, status, started_by, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
		input.Realm,
		scopeTypeForLocation(input.LocationID),
		input.LocationID,
		locationName,
		nullableString(title),
		input.StartedBy,
		now,
		now,
	)
	if err != nil {
		return nil, err
	}
	sessionID64, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	sessionID := int(sessionID64)

	items, err := loadSessionScopeItems(input.Realm, input.LocationID)
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		entry := buildSessionEntryFromSnapshot(sessionID, item, true)
		if _, err := insertSessionEntry(entry, "", ""); err != nil {
			return nil, err
		}
	}
	return loadSessionDetail(sessionID)
}

func GetActiveSession(realm string) (*SessionDetail, error) {
	if !validRealm(realm) {
		return nil, fmt.Errorf("invalid realm")
	}
	session, err := loadActiveSession(realm)
	if err != nil {
		return nil, err
	}
	return loadSessionDetail(session.ID)
}

func GetSession(id int) (*SessionDetail, error) {
	return loadSessionDetail(id)
}

func ListRecentSessions(realm string, limit int) ([]SessionSummary, error) {
	if !validRealm(realm) {
		return nil, fmt.Errorf("invalid realm")
	}
	return loadRecentSessions(realm, limit)
}

func ApproveEntry(sessionID, entryID, userID int, foundVia string) (*SessionEntry, error) {
	session, err := loadSession(sessionID)
	if err != nil {
		return nil, err
	}
	if session.Status != "active" {
		return nil, fmt.Errorf("session is already completed")
	}
	entry, err := loadSessionEntry(session.Realm, entryID)
	if err != nil {
		return nil, err
	}
	if entry.SessionID != sessionID {
		return nil, fmt.Errorf("entry does not belong to session")
	}
	if !entry.ExpectedInScope {
		return nil, fmt.Errorf("only expected items can be approved manually")
	}
	if entry.Status == "found" {
		return entry, nil
	}

	now := database.TimestampNow()
	nextStatus := scanStatusForEntry(entry)
	_, err = database.DB.Exec(
		`UPDATE `+sessionEntryTable()+`
		 SET status = ?, found_via = ?, found_at = ?, updated_at = ?, notes = COALESCE(notes, ?)
		 WHERE id = ?`,
		nextStatus,
		normalizeFoundVia(foundVia),
		now,
		now,
		fmt.Sprintf("approved by user %d", userID),
		entryID,
	)
	if err != nil {
		return nil, err
	}
	return loadSessionEntry(session.Realm, entryID)
}

func ScanSession(sessionID int, input ScanInput) (*ScanResult, error) {
	session, err := loadSession(sessionID)
	if err != nil {
		return nil, err
	}
	if session.Status != "active" {
		return nil, fmt.Errorf("session is already completed")
	}

	itemID := 0
	if input.ItemID != nil && *input.ItemID > 0 {
		itemID = *input.ItemID
	} else if parsedID, ok := parseScannedItemID(input.Code); ok {
		itemID = parsedID
	}
	if itemID <= 0 {
		return nil, fmt.Errorf("scanned code does not match a known item QR")
	}

	entry, err := loadSessionEntryByItem(session.Realm, sessionID, itemID)
	if err == nil {
		if entry.Status == "found" || entry.Status == "unexpected" || entry.Status == "location_mismatch" {
			return &ScanResult{Entry: *entry, Duplicate: true}, nil
		}
		now := database.TimestampNow()
		nextStatus := scanStatusForEntry(entry)
		_, err = database.DB.Exec(
			`UPDATE `+sessionEntryTable()+`
			 SET status = ?, found_via = ?, found_code = ?, found_at = ?, updated_at = ?
			 WHERE id = ?`,
			nextStatus,
			normalizeFoundVia(input.FoundVia),
			nullableString(input.Code),
			now,
			now,
			entry.ID,
		)
		if err != nil {
			return nil, err
		}
		updated, err := loadSessionEntry(session.Realm, entry.ID)
		if err != nil {
			return nil, err
		}
		return &ScanResult{Entry: *updated}, nil
	}
	if err != sql.ErrNoRows {
		return nil, err
	}

	item, err := loadItemSnapshotByID(session.Realm, itemID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("item not found in this realm")
		}
		return nil, err
	}

	newEntry := buildSessionEntryFromSnapshot(sessionID, *item, false)
	newID, err := insertSessionEntry(newEntry, normalizeFoundVia(input.FoundVia), input.Code)
	if err != nil {
		return nil, err
	}
	created, err := loadSessionEntry(session.Realm, int(newID))
	if err != nil {
		return nil, err
	}
	return &ScanResult{Entry: *created}, nil
}

func CorrectEntryLocation(sessionID, entryID int) (*SessionEntry, error) {
	session, err := loadSession(sessionID)
	if err != nil {
		return nil, err
	}
	entry, err := loadSessionEntry(session.Realm, entryID)
	if err != nil {
		return nil, err
	}
	if entry.SessionID != sessionID {
		return nil, fmt.Errorf("entry does not belong to session")
	}
	if entry.ItemID == nil || *entry.ItemID <= 0 {
		return nil, fmt.Errorf("entry has no item")
	}
	targetLocationID, targetLocationName := correctionTarget(session, entry)
	if targetLocationID == nil || *targetLocationID <= 0 {
		return nil, fmt.Errorf("entry has no adoptable target location")
	}

	now := database.TimestampNow()
	if _, err := database.DB.Exec(
		fmt.Sprintf("UPDATE %s SET location_id = ?, updated_at = ? WHERE id = ?", itemsTable(session.Realm)),
		*targetLocationID, now, *entry.ItemID,
	); err != nil {
		return nil, err
	}
	nextStatus := entry.Status
	if entry.ExpectedInScope {
		nextStatus = "found"
	}
	if _, err := database.DB.Exec(
		`UPDATE `+sessionEntryTable()+`
		 SET status = ?, location_corrected = 1, corrected_location_id = ?, corrected_location_name = ?, updated_at = ?
		 WHERE id = ?`,
		nextStatus,
		*targetLocationID,
		targetLocationName,
		now,
		entryID,
	); err != nil {
		return nil, err
	}
	return loadSessionEntry(session.Realm, entryID)
}

func FinishSession(sessionID int) (*SessionDetail, error) {
	session, err := loadSession(sessionID)
	if err != nil {
		return nil, err
	}
	if session.Status == "completed" {
		return loadSessionDetail(sessionID)
	}

	now := database.TimestampNow()
	if _, err := database.DB.Exec(
		`UPDATE `+sessionEntryTable()+`
		 SET status = 'missing', updated_at = ?
		 WHERE session_id = ? AND expected_in_scope = 1 AND status = 'pending'`,
		now,
		sessionID,
	); err != nil {
		return nil, err
	}
	if _, err := database.DB.Exec(
		`UPDATE `+sessionTable()+`
		 SET status = 'completed', completed_at = ?, updated_at = ?
		 WHERE id = ?`,
		now,
		now,
		sessionID,
	); err != nil {
		return nil, err
	}
	return loadSessionDetail(sessionID)
}

func scopeTypeForLocation(locationID *int) string {
	if locationID != nil && *locationID > 0 {
		return "location"
	}
	return "realm"
}
