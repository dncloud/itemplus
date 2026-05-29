package database

import (
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

	if err := addColumnIfMissing(db, "ALTER TABLE label_templates ADD COLUMN dpi INTEGER NOT NULL DEFAULT 600"); err != nil {
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

func isMissingColumnReferenceError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "no such column") || strings.Contains(message, "unknown column")
}
