package database

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
)

func runMigrations(db *sqlx.DB, driver string) error {
	if driver == "mysql" {
		if err := ensureMySQLUTF8MB4(db); err != nil {
			return err
		}
	}

	if err := migrateUserSettingsKeyColumn(db, driver); err != nil {
		return err
	}

	if _, err := db.Exec(inventorySessionsTableMigrationSQL(driver)); err != nil {
		return err
	}
	if _, err := db.Exec(inventorySessionsRealmStatusIndexSQL(driver)); err != nil && !isDuplicateIndexError(err) {
		return err
	}
	if _, err := db.Exec(inventorySessionEntriesTableMigrationSQL(driver)); err != nil {
		return err
	}
	if _, err := db.Exec(inventorySessionEntriesSessionIndexSQL(driver)); err != nil && !isDuplicateIndexError(err) {
		return err
	}
	if _, err := db.Exec(inventorySessionEntriesItemIndexSQL(driver)); err != nil && !isDuplicateIndexError(err) {
		return err
	}
	if err := addColumnIfMissing(db, "ALTER TABLE inventory_session_entries ADD COLUMN active_checkout_count INTEGER NOT NULL DEFAULT 0"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "ALTER TABLE inventory_session_entries ADD COLUMN checkout_user_name TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "ALTER TABLE inventory_session_entries ADD COLUMN checkout_due_date TEXT"); err != nil {
		return err
	}

	if err := addColumnIfMissing(db, "ALTER TABLE label_templates ADD COLUMN dpi INTEGER NOT NULL DEFAULT 600"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "ALTER TABLE users ADD COLUMN locale TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "ALTER TABLE users ADD COLUMN avatar_path TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "ALTER TABLE magic_link_tokens ADD COLUMN locale TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "ALTER TABLE checkout_requests ADD COLUMN component_item_ids TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "ALTER TABLE device_sessions ADD COLUMN current_path TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "ALTER TABLE device_sessions ADD COLUMN current_label TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "ALTER TABLE device_sessions ADD COLUMN current_realm TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "ALTER TABLE device_sessions ADD COLUMN printer_bridge_configured BOOLEAN DEFAULT 0"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "ALTER TABLE device_sessions ADD COLUMN printer_bridge_reachable BOOLEAN DEFAULT 0"); err != nil {
		return err
	}

	for _, realm := range []string{"archive", "collection"} {
		itemsTable := realm + "_items"
		attachmentsTable := realm + "_attachments"
		checkoutsTable := realm + "_checkouts"
		manufacturersTable := realm + "_manufacturers"
		suppliersTable := realm + "_suppliers"
		vendorsTable := realm + "_vendors"
		itemStatusColumn := "TEXT NOT NULL DEFAULT 'active'"
		priceColumn := "REAL"
		if driver == "mysql" {
			itemStatusColumn = "VARCHAR(32) NOT NULL DEFAULT 'active'"
			priceColumn = "DOUBLE"
		}

		if err := addColumnIfMissing(db, "ALTER TABLE "+itemsTable+" ADD COLUMN item_status "+itemStatusColumn); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+itemsTable+" ADD COLUMN is_bundle BOOLEAN NOT NULL DEFAULT 0"); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+itemsTable+" ADD COLUMN sales_platform TEXT"); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+itemsTable+" ADD COLUMN sales_platform_id INTEGER"); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+itemsTable+" ADD COLUMN asking_price "+priceColumn); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+itemsTable+" ADD COLUMN sold_price "+priceColumn); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+itemsTable+" ADD COLUMN sold_at TEXT"); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+attachmentsTable+" ADD COLUMN storage_backend TEXT NOT NULL DEFAULT 'local'"); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+attachmentsTable+" ADD COLUMN external_source_id INTEGER"); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+attachmentsTable+" ADD COLUMN external_path TEXT"); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+checkoutsTable+" ADD COLUMN bundle_parent_item_id INTEGER"); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+checkoutsTable+" ADD COLUMN last_reminder_sent_at TEXT"); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+manufacturersTable+" ADD COLUMN external_logo_url TEXT"); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+manufacturersTable+" ADD COLUMN logo_background TEXT"); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+suppliersTable+" ADD COLUMN external_logo_url TEXT"); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+suppliersTable+" ADD COLUMN logo_background TEXT"); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+vendorsTable+" ADD COLUMN external_logo_url TEXT"); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+vendorsTable+" ADD COLUMN logo_background TEXT"); err != nil {
			return err
		}
		if _, err := db.Exec("UPDATE " + attachmentsTable + " SET storage_backend = 'external_url' WHERE COALESCE(url, '') <> '' AND storage_backend = 'local'"); err != nil {
			return err
		}
		if _, err := db.Exec(componentTableMigrationSQL(realm, driver)); err != nil {
			return err
		}
		if _, err := db.Exec("UPDATE " + itemsTable + " SET sales_platform = sale_channel WHERE COALESCE(sales_platform, '') = '' AND COALESCE(sale_channel, '') <> ''"); err != nil && !isMissingColumnReferenceError(err) {
			return err
		}
		if _, err := db.Exec("UPDATE " + itemsTable + " SET asking_price = sale_price WHERE asking_price IS NULL AND sale_price IS NOT NULL"); err != nil && !isMissingColumnReferenceError(err) {
			return err
		}
		if err := backfillSalesPlatformIDs(db, itemsTable); err != nil {
			return err
		}
		if _, err := db.Exec("UPDATE " + itemsTable + " SET is_bundle = 1 WHERE id IN (SELECT DISTINCT parent_item_id FROM " + realm + "_item_components)"); err != nil {
			return err
		}
		if _, err := db.Exec(inventoryMovementsTableMigrationSQL(realm, driver)); err != nil {
			return err
		}
		if _, err := db.Exec(inventoryMovementsItemIndexSQL(realm, driver)); err != nil && !isDuplicateIndexError(err) {
			return err
		}
		if _, err := db.Exec(inventoryMovementsTypeIndexSQL(realm, driver)); err != nil && !isDuplicateIndexError(err) {
			return err
		}
		if _, err := db.Exec(maintenanceReminderTableMigrationSQL(realm, driver)); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+realm+"_maintenance_reminders ADD COLUMN custom_type_label TEXT"); err != nil {
			return err
		}
		if driver == "mysql" {
			if err := normalizeMaintenanceReminderMySQLColumns(db, realm); err != nil {
				return err
			}
		}
		if _, err := db.Exec(maintenanceReminderDueIndexSQL(realm, driver)); err != nil && !isDuplicateIndexError(err) {
			return err
		}
		if _, err := db.Exec(maintenanceReminderItemIndexSQL(realm, driver)); err != nil && !isDuplicateIndexError(err) {
			return err
		}
		if _, err := db.Exec(maintenanceHistoryTableMigrationSQL(realm, driver)); err != nil {
			return err
		}
		if err := addColumnIfMissing(db, "ALTER TABLE "+realm+"_maintenance_history ADD COLUMN custom_type_label TEXT"); err != nil {
			return err
		}
		if driver == "mysql" {
			if err := normalizeMaintenanceHistoryMySQLColumns(db, realm); err != nil {
				return err
			}
		}
		if _, err := db.Exec(maintenanceHistoryItemIndexSQL(realm, driver)); err != nil && !isDuplicateIndexError(err) {
			return err
		}
		if _, err := db.Exec(maintenanceHistoryReminderIndexSQL(realm, driver)); err != nil && !isDuplicateIndexError(err) {
			return err
		}
	}

	if err := addColumnIfMissing(db, "ALTER TABLE generic_sales_platforms ADD COLUMN external_logo_url TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "ALTER TABLE generic_sales_platforms ADD COLUMN logo_background TEXT"); err != nil {
		return err
	}

	return nil
}

func migrateUserSettingsKeyColumn(db *sqlx.DB, driver string) error {
	if driver != "sqlite" {
		return nil
	}

	type tableColumn struct {
		CID        int            `db:"cid"`
		Name       string         `db:"name"`
		Type       string         `db:"type"`
		NotNull    int            `db:"notnull"`
		Default    sql.NullString `db:"dflt_value"`
		PrimaryKey int            `db:"pk"`
	}
	var columns []tableColumn
	if err := db.Select(&columns, "PRAGMA table_info(user_settings)"); err != nil {
		return err
	}
	hasOldKey := false
	hasSettingKey := false
	for _, column := range columns {
		switch column.Name {
		case "key":
			hasOldKey = true
		case "setting_key":
			hasSettingKey = true
		}
	}
	if !hasOldKey || hasSettingKey {
		return nil
	}

	tx, err := db.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec("ALTER TABLE user_settings RENAME TO user_settings_old"); err != nil {
		return err
	}
	if _, err := tx.Exec(`CREATE TABLE user_settings (
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		setting_key TEXT NOT NULL,
		value TEXT,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (user_id, setting_key)
	)`); err != nil {
		return err
	}
	if _, err := tx.Exec("INSERT INTO user_settings (user_id, setting_key, value, updated_at) SELECT user_id, `key`, value, updated_at FROM user_settings_old"); err != nil {
		return err
	}
	if _, err := tx.Exec("DROP TABLE user_settings_old"); err != nil {
		return err
	}
	return tx.Commit()
}

func inventoryMovementsTableMigrationSQL(realm, driver string) string {
	stmt := `CREATE TABLE IF NOT EXISTS ` + realm + `_inventory_movements (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		item_id INTEGER NOT NULL REFERENCES ` + realm + `_items(id) ON DELETE CASCADE,
		movement_type TEXT NOT NULL,
		quantity_delta INTEGER NOT NULL DEFAULT 0,
		quantity_before INTEGER NOT NULL DEFAULT 0,
		quantity_after INTEGER NOT NULL DEFAULT 0,
		checkout_id INTEGER,
		source TEXT NOT NULL DEFAULT 'manual',
		notes TEXT,
		created_by INTEGER,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`
	if driver == "mysql" {
		stmt = strings.ReplaceAll(stmt, "id INTEGER PRIMARY KEY AUTOINCREMENT", "id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY")
		stmt = strings.ReplaceAll(stmt, "movement_type TEXT NOT NULL", "movement_type VARCHAR(64) NOT NULL")
		stmt = strings.ReplaceAll(stmt, "source TEXT NOT NULL DEFAULT 'manual'", "source VARCHAR(64) NOT NULL DEFAULT 'manual'")
		stmt = mysqlReferencePattern.ReplaceAllString(stmt, "")
	}
	return stmt
}

func inventorySessionsTableMigrationSQL(driver string) string {
	stmt := `CREATE TABLE IF NOT EXISTS inventory_sessions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		realm TEXT NOT NULL,
		scope_type TEXT NOT NULL DEFAULT 'realm',
		location_id INTEGER,
		location_name TEXT,
		title TEXT,
		status TEXT DEFAULT 'active',
		started_by INTEGER,
		completed_at TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`
	if driver == "mysql" {
		stmt = strings.ReplaceAll(stmt, "id INTEGER PRIMARY KEY AUTOINCREMENT", "id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY")
		stmt = strings.ReplaceAll(stmt, "realm TEXT NOT NULL", "realm VARCHAR(32) NOT NULL")
		stmt = strings.ReplaceAll(stmt, "scope_type TEXT NOT NULL DEFAULT 'realm'", "scope_type VARCHAR(32) NOT NULL DEFAULT 'realm'")
		stmt = strings.ReplaceAll(stmt, "status TEXT DEFAULT 'active'", "status VARCHAR(32) DEFAULT 'active'")
	}
	return stmt
}

func inventorySessionsRealmStatusIndexSQL(driver string) string {
	stmt := "CREATE INDEX IF NOT EXISTS idx_inventory_sessions_realm_status ON inventory_sessions(realm, status, created_at)"
	if driver == "mysql" {
		stmt = strings.ReplaceAll(stmt, "CREATE INDEX IF NOT EXISTS ", "CREATE INDEX ")
	}
	return stmt
}

func inventorySessionEntriesTableMigrationSQL(driver string) string {
	stmt := `CREATE TABLE IF NOT EXISTS inventory_session_entries (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id INTEGER NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
		item_id INTEGER,
		item_name TEXT NOT NULL,
		category_id INTEGER,
		category_name TEXT,
		category_color TEXT,
		location_id INTEGER,
		location_name TEXT,
		location_color TEXT,
		active_checkout_count INTEGER NOT NULL DEFAULT 0,
		checkout_user_name TEXT,
		checkout_due_date TEXT,
		expected_in_scope BOOLEAN NOT NULL DEFAULT 1,
		status TEXT DEFAULT 'pending',
		found_via TEXT,
		found_code TEXT,
		location_corrected BOOLEAN NOT NULL DEFAULT 0,
		corrected_location_id INTEGER,
		corrected_location_name TEXT,
		notes TEXT,
		found_at TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`
	if driver == "mysql" {
		stmt = strings.ReplaceAll(stmt, "id INTEGER PRIMARY KEY AUTOINCREMENT", "id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY")
		stmt = strings.ReplaceAll(stmt, "status TEXT DEFAULT 'pending'", "status VARCHAR(32) DEFAULT 'pending'")
		stmt = mysqlReferencePattern.ReplaceAllString(stmt, "")
	}
	return stmt
}

func inventorySessionEntriesSessionIndexSQL(driver string) string {
	stmt := "CREATE INDEX IF NOT EXISTS idx_inventory_session_entries_session ON inventory_session_entries(session_id, status, expected_in_scope)"
	if driver == "mysql" {
		stmt = strings.ReplaceAll(stmt, "CREATE INDEX IF NOT EXISTS ", "CREATE INDEX ")
	}
	return stmt
}

func inventorySessionEntriesItemIndexSQL(driver string) string {
	stmt := "CREATE INDEX IF NOT EXISTS idx_inventory_session_entries_item ON inventory_session_entries(item_id)"
	if driver == "mysql" {
		stmt = strings.ReplaceAll(stmt, "CREATE INDEX IF NOT EXISTS ", "CREATE INDEX ")
	}
	return stmt
}

func inventoryMovementsItemIndexSQL(realm, driver string) string {
	stmt := `CREATE INDEX IF NOT EXISTS idx_` + realm + `_inventory_movements_item ON ` + realm + `_inventory_movements(item_id, created_at)`
	if driver == "mysql" {
		stmt = strings.Replace(stmt, "CREATE INDEX IF NOT EXISTS", "CREATE INDEX", 1)
	}
	return stmt
}

func inventoryMovementsTypeIndexSQL(realm, driver string) string {
	stmt := `CREATE INDEX IF NOT EXISTS idx_` + realm + `_inventory_movements_type ON ` + realm + `_inventory_movements(movement_type, created_at)`
	if driver == "mysql" {
		stmt = strings.Replace(stmt, "CREATE INDEX IF NOT EXISTS", "CREATE INDEX", 1)
	}
	return stmt
}

func maintenanceReminderTableMigrationSQL(realm, driver string) string {
	stmt := `CREATE TABLE IF NOT EXISTS ` + realm + `_maintenance_reminders (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		item_id INTEGER NOT NULL REFERENCES ` + realm + `_items(id) ON DELETE CASCADE,
		title TEXT NOT NULL,
		reminder_type TEXT NOT NULL DEFAULT 'maintenance',
		custom_type_label TEXT,
		due_date TEXT NOT NULL,
		repeat_interval INTEGER,
		repeat_unit TEXT,
		status TEXT NOT NULL DEFAULT 'open',
		notes TEXT,
		last_completed_at TEXT,
		completed_at TEXT,
		created_by INTEGER,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`
	if driver == "mysql" {
		return adaptMySQLSchemaSQL(stmt)
	}
	return stmt
}

func maintenanceReminderDueIndexSQL(realm, driver string) string {
	stmt := `CREATE INDEX IF NOT EXISTS idx_` + realm + `_maintenance_reminders_due ON ` + realm + `_maintenance_reminders(status, due_date)`
	if driver == "mysql" {
		return strings.Replace(stmt, "CREATE INDEX IF NOT EXISTS ", "CREATE INDEX ", 1)
	}
	return stmt
}

func maintenanceReminderItemIndexSQL(realm, driver string) string {
	stmt := `CREATE INDEX IF NOT EXISTS idx_` + realm + `_maintenance_reminders_item ON ` + realm + `_maintenance_reminders(item_id)`
	if driver == "mysql" {
		return strings.Replace(stmt, "CREATE INDEX IF NOT EXISTS ", "CREATE INDEX ", 1)
	}
	return stmt
}

func maintenanceHistoryTableMigrationSQL(realm, driver string) string {
	stmt := `CREATE TABLE IF NOT EXISTS ` + realm + `_maintenance_history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		reminder_id INTEGER NOT NULL,
		item_id INTEGER NOT NULL REFERENCES ` + realm + `_items(id) ON DELETE CASCADE,
		action TEXT NOT NULL,
		title TEXT NOT NULL,
		reminder_type TEXT NOT NULL DEFAULT 'maintenance',
		custom_type_label TEXT,
		due_date TEXT NOT NULL,
		notes TEXT,
		performed_by INTEGER,
		performed_at TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`
	if driver == "mysql" {
		return adaptMySQLSchemaSQL(stmt)
	}
	return stmt
}

func maintenanceHistoryItemIndexSQL(realm, driver string) string {
	stmt := `CREATE INDEX IF NOT EXISTS idx_` + realm + `_maintenance_history_item ON ` + realm + `_maintenance_history(item_id, performed_at)`
	if driver == "mysql" {
		return strings.Replace(stmt, "CREATE INDEX IF NOT EXISTS ", "CREATE INDEX ", 1)
	}
	return stmt
}

func maintenanceHistoryReminderIndexSQL(realm, driver string) string {
	stmt := `CREATE INDEX IF NOT EXISTS idx_` + realm + `_maintenance_history_reminder ON ` + realm + `_maintenance_history(reminder_id, performed_at)`
	if driver == "mysql" {
		return strings.Replace(stmt, "CREATE INDEX IF NOT EXISTS ", "CREATE INDEX ", 1)
	}
	return stmt
}

func normalizeMaintenanceReminderMySQLColumns(db *sqlx.DB, realm string) error {
	table := realm + "_maintenance_reminders"
	statements := []string{
		"ALTER TABLE " + table + " MODIFY title VARCHAR(255) NOT NULL",
		"ALTER TABLE " + table + " MODIFY reminder_type VARCHAR(64) NOT NULL DEFAULT 'maintenance'",
		"ALTER TABLE " + table + " MODIFY custom_type_label VARCHAR(191)",
		"ALTER TABLE " + table + " MODIFY due_date VARCHAR(32) NOT NULL",
		"ALTER TABLE " + table + " MODIFY repeat_unit VARCHAR(32)",
		"ALTER TABLE " + table + " MODIFY status VARCHAR(32) NOT NULL DEFAULT 'open'",
		"ALTER TABLE " + table + " MODIFY last_completed_at VARCHAR(32)",
		"ALTER TABLE " + table + " MODIFY completed_at VARCHAR(32)",
	}
	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

func normalizeMaintenanceHistoryMySQLColumns(db *sqlx.DB, realm string) error {
	table := realm + "_maintenance_history"
	statements := []string{
		"ALTER TABLE " + table + " MODIFY action VARCHAR(32) NOT NULL",
		"ALTER TABLE " + table + " MODIFY title VARCHAR(255) NOT NULL",
		"ALTER TABLE " + table + " MODIFY reminder_type VARCHAR(64) NOT NULL DEFAULT 'maintenance'",
		"ALTER TABLE " + table + " MODIFY custom_type_label VARCHAR(191)",
		"ALTER TABLE " + table + " MODIFY due_date VARCHAR(32) NOT NULL",
		"ALTER TABLE " + table + " MODIFY performed_at VARCHAR(32) NOT NULL",
	}
	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

func ensureMySQLUTF8MB4(db *sqlx.DB) error {
	_, err := db.Exec("ALTER TABLE app_settings CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
	return err
}

func componentTableMigrationSQL(realm, driver string) string {
	stmt := `CREATE TABLE IF NOT EXISTS ` + realm + `_item_components (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		parent_item_id INTEGER NOT NULL REFERENCES ` + realm + `_items(id) ON DELETE CASCADE,
		child_item_id INTEGER NOT NULL UNIQUE REFERENCES ` + realm + `_items(id) ON DELETE CASCADE,
		position INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`
	if driver == "mysql" {
		return adaptMySQLSchemaSQL(stmt)
	}
	return stmt
}

func backfillSalesPlatformIDs(db *sqlx.DB, itemsTable string) error {
	rows, err := db.Queryx("SELECT DISTINCT sales_platform FROM " + itemsTable + " WHERE COALESCE(sales_platform, '') <> ''")
	if err != nil {
		if isMissingColumnReferenceError(err) {
			return nil
		}
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return err
		}
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		platformID, err := ensureGenericSalesPlatform(db, name)
		if err != nil {
			return err
		}
		if _, err := db.Exec(
			"UPDATE "+itemsTable+" SET sales_platform_id = ? WHERE COALESCE(sales_platform_id, 0) = 0 AND sales_platform = ?",
			platformID, name,
		); err != nil && !isMissingColumnReferenceError(err) {
			return err
		}
	}

	return rows.Err()
}

func ensureGenericSalesPlatform(db *sqlx.DB, name string) (int64, error) {
	var existingID int64
	err := db.Get(&existingID, "SELECT id FROM generic_sales_platforms WHERE name = ? LIMIT 1", name)
	if err == nil {
		return existingID, nil
	}

	now := TimestampNow()
	result, err := db.Exec(
		"INSERT INTO generic_sales_platforms (name, created_at, updated_at) VALUES (?, ?, ?)",
		name, now, now,
	)
	if err != nil {
		if err2 := db.Get(&existingID, "SELECT id FROM generic_sales_platforms WHERE name = ? LIMIT 1", name); err2 == nil {
			return existingID, nil
		}
		return 0, fmt.Errorf("create sales platform %q: %w", name, err)
	}
	newID, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	return newID, nil
}

func addColumnIfMissing(db *sqlx.DB, query string) error {
	_, err := db.Exec(query)
	if err == nil || isDuplicateColumnError(err) {
		return nil
	}
	return err
}

func isDuplicateColumnError(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(strings.ToLower(err.Error()), "duplicate column")
}

func isDuplicateIndexError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "duplicate key name") || strings.Contains(message, "already exists")
}

func isMissingColumnReferenceError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "no such column") || strings.Contains(message, "unknown column")
}
