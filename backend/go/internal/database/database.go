package database

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	_ "github.com/glebarez/go-sqlite"
	"github.com/itemplus/backend/internal/config"
	printtemplates "github.com/itemplus/backend/internal/printing/templates"
	"github.com/jmoiron/sqlx"
)

var DB *sqlx.DB

type driverAdapter interface {
	driverName() string
	dsn(rawURL string) string
	connectionSummary(rawURL string) string
	caseInsensitiveOrder(column string) string
	upsertAppSetting(key, value, updatedAt string) error
	upsertUserSetting(userID int, key, value, updatedAt string) error
	schemaStatements() []string
	shouldIgnoreSchemaError(err error) bool
}

func Connect() {
	db, err := OpenPrepared(config.C.DatabaseURL)
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	DB = db
}

func Close() error {
	if DB == nil {
		return nil
	}
	err := DB.Close()
	DB = nil
	return err
}

func ReconnectConfigured() error {
	_ = Close()
	db, err := OpenPrepared(config.C.DatabaseURL)
	if err != nil {
		return err
	}
	DB = db
	return nil
}

func MarkAllDeviceSessionsOffline() error {
	if DB == nil {
		return nil
	}
	_, err := DB.Exec("UPDATE device_sessions SET is_online = 0")
	return err
}

func CurrentDriver() string {
	return adapterForURL(config.C.DatabaseURL).driverName()
}

func CurrentConnectionSummary() string {
	return adapterForURL(config.C.DatabaseURL).connectionSummary(config.C.DatabaseURL)
}

func CaseInsensitiveOrder(column string) string {
	return adapterForURL(config.C.DatabaseURL).caseInsensitiveOrder(column)
}

func UpsertAppSetting(key, value, updatedAt string) error {
	return adapterForURL(config.C.DatabaseURL).upsertAppSetting(key, value, updatedAt)
}

func UpsertUserSetting(userID int, key, value, updatedAt string) error {
	return adapterForURL(config.C.DatabaseURL).upsertUserSetting(userID, key, value, updatedAt)
}

func OpenPrepared(url string) (*sqlx.DB, error) {
	adapter := adapterForURL(url)
	driver := adapter.driverName()
	dsn := adapter.dsn(url)

	db, err := sqlx.Connect(driver, dsn)
	if err != nil {
		return nil, err
	}
	configureConnectionPool(db, driver)

	if err := createTables(db, driver); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}

func configureConnectionPool(db *sqlx.DB, driver string) {
	if driver != "sqlite" {
		return
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	_, _ = db.Exec("PRAGMA journal_mode=WAL")
	_, _ = db.Exec("PRAGMA synchronous=NORMAL")
	_, _ = db.Exec("PRAGMA busy_timeout=10000")
	_, _ = db.Exec("PRAGMA foreign_keys=ON")
}

const mysqlDateTimeLayout = "2006-01-02 15:04:05"
const mysqlDateTimeMicroLayout = "2006-01-02 15:04:05.999999"

func TimestampNow() string {
	return TimestampForURL(config.C.DatabaseURL, time.Now().UTC())
}

func TimestampAt(t time.Time) string {
	return TimestampForURL(config.C.DatabaseURL, t)
}

func TimestampForURL(rawURL string, t time.Time) string {
	return formatTimestampForDriver(adapterForURL(rawURL).driverName(), t)
}

func ParseTimestamp(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, fmt.Errorf("empty timestamp")
	}
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339, mysqlDateTimeMicroLayout, mysqlDateTimeLayout} {
		if ts, err := time.Parse(layout, value); err == nil {
			return ts, nil
		}
	}
	return time.Time{}, fmt.Errorf("unsupported timestamp format: %s", value)
}

func driverNameForURL(rawURL string) string {
	if strings.HasPrefix(rawURL, "mysql") {
		return "mysql"
	}
	return "sqlite"
}

func SchemaStatements(driver string) []string {
	return adapterForDriver(driver).schemaStatements()
}

func CreateSchemaOnly(db *sqlx.DB, driver string) error {
	adapter := adapterForDriver(driver)
	for _, stmt := range adapter.schemaStatements() {
		if _, err := db.Exec(stmt); err != nil {
			if adapter.shouldIgnoreSchemaError(err) {
				continue
			}
			return err
		}
	}
	return nil
}

func formatTimestampForDriver(driver string, t time.Time) string {
	t = t.UTC()
	if driver == "mysql" {
		return t.Format(mysqlDateTimeLayout)
	}
	return t.Format(time.RFC3339)
}

func createTables(db *sqlx.DB, driver string) error {
	adapter := adapterForDriver(driver)
	for _, stmt := range adapter.schemaStatements() {
		if _, err := db.Exec(stmt); err != nil {
			if adapter.shouldIgnoreSchemaError(err) {
				continue
			}
			return err
		}
	}

	if err := runMigrations(db, driver); err != nil {
		return err
	}

	if err := ensureDefaultLabelTemplates(db, driver); err != nil {
		return err
	}
	return nil
}

func schemaStatementsBase() []string {
	tables := []string{
		// App Settings
		`CREATE TABLE IF NOT EXISTS app_settings (
			key TEXT PRIMARY KEY,
			value TEXT,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS user_settings (
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			setting_key TEXT NOT NULL,
			value TEXT,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (user_id, setting_key)
		)`,

		`CREATE TABLE IF NOT EXISTS inventory_sessions (
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
		)`,
		`CREATE INDEX IF NOT EXISTS idx_inventory_sessions_realm_status ON inventory_sessions(realm, status, created_at)`,

		`CREATE TABLE IF NOT EXISTS inventory_session_entries (
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
		)`,
		`CREATE INDEX IF NOT EXISTS idx_inventory_session_entries_session ON inventory_session_entries(session_id, status, expected_in_scope)`,
		`CREATE INDEX IF NOT EXISTS idx_inventory_session_entries_item ON inventory_session_entries(item_id)`,

		// Users
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			apple_sub TEXT UNIQUE NOT NULL,
			email TEXT,
			display_name TEXT,
			avatar_path TEXT,
			is_admin BOOLEAN DEFAULT 0,
			is_active BOOLEAN DEFAULT 0,
			permissions TEXT DEFAULT '[]',
			last_login DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_users_apple_sub ON users(apple_sub)`,
		`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,

		// Label templates
		`CREATE TABLE IF NOT EXISTS label_templates (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			system_key TEXT UNIQUE,
			name TEXT NOT NULL,
			description TEXT,
			target TEXT NOT NULL,
			dpi INTEGER NOT NULL DEFAULT 600,
			width_mm INTEGER NOT NULL,
			height_mm INTEGER NOT NULL,
			gap_mm REAL NOT NULL DEFAULT 3,
			speed INTEGER NOT NULL DEFAULT 4,
			density INTEGER NOT NULL DEFAULT 8,
			direction INTEGER NOT NULL DEFAULT 1,
			reference_x INTEGER NOT NULL DEFAULT 0,
			reference_y INTEGER NOT NULL DEFAULT 0,
			shift_x INTEGER NOT NULL DEFAULT 0,
			shift_y INTEGER NOT NULL DEFAULT 0,
			copies_default INTEGER NOT NULL DEFAULT 1,
			is_default BOOLEAN DEFAULT 0,
			is_system BOOLEAN DEFAULT 0,
			is_active BOOLEAN DEFAULT 1,
			tspl_template TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_label_templates_target ON label_templates(target)`,
		`CREATE INDEX IF NOT EXISTS idx_label_templates_active ON label_templates(is_active)`,

		// External storage sources
		`CREATE TABLE IF NOT EXISTS external_sources (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			description TEXT,
			source_type TEXT NOT NULL DEFAULT 'sftp',
			host TEXT NOT NULL,
			port INTEGER NOT NULL DEFAULT 22,
			username TEXT NOT NULL,
			auth_type TEXT NOT NULL DEFAULT 'password',
			password TEXT,
			private_key TEXT,
			known_host_key TEXT NOT NULL,
			base_path TEXT NOT NULL DEFAULT '.',
			is_active BOOLEAN DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_external_sources_active ON external_sources(is_active)`,

		// Device Sessions
		`CREATE TABLE IF NOT EXISTS device_sessions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			device_type TEXT NOT NULL,
			device_name TEXT,
			ip_address TEXT,
			is_online BOOLEAN DEFAULT 0,
			printer_bridge_configured BOOLEAN DEFAULT 0,
			printer_bridge_reachable BOOLEAN DEFAULT 0,
			current_path TEXT,
			current_label TEXT,
			current_realm TEXT,
			last_seen DATETIME,
			user_agent TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// QR Login Tokens
		`CREATE TABLE IF NOT EXISTS qr_login_tokens (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			token TEXT UNIQUE NOT NULL,
			expires_at DATETIME NOT NULL,
			used BOOLEAN DEFAULT 0,
			confirmed_by_user_id INTEGER
		)`,

		// Magic Link Tokens
		`CREATE TABLE IF NOT EXISTS magic_link_tokens (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT NOT NULL,
			token TEXT UNIQUE NOT NULL,
			expires_at DATETIME NOT NULL,
			used BOOLEAN DEFAULT 0
		)`,

		// Checkout Requests (cross-realm)
		`CREATE TABLE IF NOT EXISTS checkout_requests (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			realm TEXT NOT NULL,
			item_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			status TEXT DEFAULT 'pending',
			requested_duration_days INTEGER,
			component_item_ids TEXT,
			approved_by INTEGER,
			notes TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// AI usage events
		`CREATE TABLE IF NOT EXISTS ai_usage_events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER,
			profile_id TEXT,
			profile_name TEXT,
			provider TEXT,
			model TEXT,
			feature TEXT NOT NULL,
			transport TEXT,
			success BOOLEAN DEFAULT 1,
			error TEXT,
			input_tokens INTEGER DEFAULT 0,
			output_tokens INTEGER DEFAULT 0,
			total_tokens INTEGER DEFAULT 0,
			reasoning_tokens INTEGER DEFAULT 0,
			web_search_requests INTEGER DEFAULT 0,
			web_fetch_requests INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_usage_events_created_at ON ai_usage_events(created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_usage_events_feature ON ai_usage_events(feature)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_usage_events_provider_model ON ai_usage_events(provider, model)`,
	}

	// Per-realm tables
	for _, prefix := range []string{"archive", "collection"} {
		tables = append(tables, realmTables(prefix)...)
	}
	return tables
}

func adapterForURL(rawURL string) driverAdapter {
	return adapterForDriver(driverNameForURL(rawURL))
}

func adapterForDriver(driver string) driverAdapter {
	switch driver {
	case "mysql":
		return mysqlAdapter{}
	default:
		return sqliteAdapter{}
	}
}

func LogicalTableNames() []string {
	tables := []string{
		"app_settings",
		"users",
		"label_templates",
		"external_sources",
		"device_sessions",
		"qr_login_tokens",
		"magic_link_tokens",
		"checkout_requests",
		"ai_usage_events",
	}
	for _, realm := range []string{"archive", "collection"} {
		tables = append(tables,
			realm+"_categories",
			realm+"_properties",
			realm+"_locations",
			realm+"_manufacturers",
			realm+"_suppliers",
			realm+"_vendors",
			realm+"_items",
			realm+"_item_properties",
			realm+"_attachments",
			realm+"_checkouts",
		)
	}
	return tables
}

func BackupTableNames() []string {
	tables := []string{
		"app_settings",
		"users",
		"label_templates",
		"external_sources",
		"checkout_requests",
		"ai_usage_events",
	}
	for _, realm := range []string{"archive", "collection"} {
		tables = append(tables,
			realm+"_categories",
			realm+"_properties",
			realm+"_locations",
			realm+"_manufacturers",
			realm+"_suppliers",
			realm+"_vendors",
			realm+"_items",
			realm+"_item_properties",
			realm+"_attachments",
			realm+"_checkouts",
		)
	}
	return tables
}

func ensureDefaultLabelTemplates(db *sqlx.DB, driver string) error {
	now := formatTimestampForDriver(driver, time.Now().UTC())
	defaults := printtemplates.DefaultLabelTemplates()

	if _, err := db.Exec(
		`UPDATE label_templates
		 SET tspl_template = REPLACE(tspl_template, 'PRINT {{copies}}', 'PRINT 1'),
		     updated_at = ?
		 WHERE is_system = 1 AND tspl_template LIKE '%PRINT {{copies}}%'`,
		now,
	); err != nil {
		return err
	}

	allowedKeys := make([]string, 0, len(defaults))
	for _, def := range defaults {
		allowedKeys = append(allowedKeys, def.SystemKey)
	}

	if len(allowedKeys) > 0 {
		placeholders := strings.TrimSuffix(strings.Repeat("?,", len(allowedKeys)), ",")
		args := make([]interface{}, 0, len(allowedKeys))
		for _, key := range allowedKeys {
			args = append(args, key)
		}
		query := fmt.Sprintf("DELETE FROM label_templates WHERE is_system = 1 AND system_key NOT IN (%s)", placeholders)
		if _, err := db.Exec(query, args...); err != nil {
			return err
		}
	}

	for _, def := range defaults {
		var existingID int
		err := db.Get(&existingID, "SELECT id FROM label_templates WHERE system_key = ?", def.SystemKey)
		if err == nil {
			continue
		}
		if err != sql.ErrNoRows {
			return err
		}

		_, err = db.Exec(
			`INSERT INTO label_templates (
				system_key, name, description, target, dpi, width_mm, height_mm, gap_mm, speed, density, direction,
				reference_x, reference_y, shift_x, shift_y, copies_default, is_default, is_system, is_active,
				tspl_template, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)`,
			def.SystemKey, def.Name, def.Description, def.Target, def.DPI, def.WidthMM, def.HeightMM, def.GapMM, def.Speed, def.Density,
			def.Direction, def.ReferenceX, def.ReferenceY, def.ShiftX, def.ShiftY, def.CopiesDefault, def.IsDefault,
			def.TSPLTemplate, now, now,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func realmTables(p string) []string {
	return []string{
		// Categories
		`CREATE TABLE IF NOT EXISTS ` + p + `_categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			description TEXT,
			color TEXT,
			position INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Properties
		`CREATE TABLE IF NOT EXISTS ` + p + `_properties (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			category_id INTEGER NOT NULL REFERENCES ` + p + `_categories(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			property_type TEXT NOT NULL,
			unit TEXT,
			options TEXT DEFAULT '{}',
			required BOOLEAN DEFAULT 0,
			show_in_list BOOLEAN DEFAULT 0,
			display_width TEXT DEFAULT 'third',
			position INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Locations
		`CREATE TABLE IF NOT EXISTS ` + p + `_locations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			description TEXT,
			color TEXT,
			parent_id INTEGER REFERENCES ` + p + `_locations(id),
			manager_id INTEGER,
			image TEXT,
			capacity INTEGER,
			position INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Items
		`CREATE TABLE IF NOT EXISTS ` + p + `_items (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			description TEXT,
			category_id INTEGER REFERENCES ` + p + `_categories(id),
			location_id INTEGER REFERENCES ` + p + `_locations(id),
			item_status TEXT NOT NULL DEFAULT 'active',
			is_bundle BOOLEAN NOT NULL DEFAULT 0,
			quantity INTEGER DEFAULT 1,
			is_consumable BOOLEAN DEFAULT 0,
			minimum_quantity INTEGER,
			manufacturer_id INTEGER,
			supplier_id INTEGER,
			vendor_id INTEGER,
			purchase_date TEXT,
			purchase_price REAL,
			purchase_currency TEXT DEFAULT 'EUR',
			sales_platform TEXT,
			sales_platform_id INTEGER,
			asking_price REAL,
			sold_price REAL,
			sold_at TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Item Components / Bundles
		`CREATE TABLE IF NOT EXISTS ` + p + `_item_components (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			parent_item_id INTEGER NOT NULL REFERENCES ` + p + `_items(id) ON DELETE CASCADE,
			child_item_id INTEGER NOT NULL UNIQUE REFERENCES ` + p + `_items(id) ON DELETE CASCADE,
			position INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Item Properties (EAV)
		`CREATE TABLE IF NOT EXISTS ` + p + `_item_properties (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			item_id INTEGER NOT NULL REFERENCES ` + p + `_items(id) ON DELETE CASCADE,
			property_id INTEGER NOT NULL REFERENCES ` + p + `_properties(id) ON DELETE CASCADE,
			value TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Attachments
		`CREATE TABLE IF NOT EXISTS ` + p + `_attachments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			item_id INTEGER NOT NULL REFERENCES ` + p + `_items(id) ON DELETE CASCADE,
			filename TEXT NOT NULL,
			file_path TEXT,
			storage_backend TEXT NOT NULL DEFAULT 'local',
			external_source_id INTEGER REFERENCES external_sources(id) ON DELETE SET NULL,
			external_path TEXT,
			attachment_type TEXT DEFAULT 'image',
			url TEXT,
			description TEXT,
			gallery BOOLEAN DEFAULT 0,
			size INTEGER,
			"order" INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Checkouts
		`CREATE TABLE IF NOT EXISTS ` + p + `_checkouts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			item_id INTEGER NOT NULL REFERENCES ` + p + `_items(id) ON DELETE CASCADE,
			bundle_parent_item_id INTEGER,
			user_id INTEGER NOT NULL,
			status TEXT DEFAULT 'active',
			due_date TEXT,
			returned_at TEXT,
			notes TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Inventory movements
		`CREATE TABLE IF NOT EXISTS ` + p + `_inventory_movements (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			item_id INTEGER NOT NULL REFERENCES ` + p + `_items(id) ON DELETE CASCADE,
			movement_type TEXT NOT NULL,
			quantity_delta INTEGER NOT NULL DEFAULT 0,
			quantity_before INTEGER NOT NULL DEFAULT 0,
			quantity_after INTEGER NOT NULL DEFAULT 0,
			checkout_id INTEGER,
			source TEXT NOT NULL DEFAULT 'manual',
			notes TEXT,
			created_by INTEGER,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_` + p + `_inventory_movements_item ON ` + p + `_inventory_movements(item_id, created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_` + p + `_inventory_movements_type ON ` + p + `_inventory_movements(movement_type, created_at)`,

		// Maintenance reminders
		`CREATE TABLE IF NOT EXISTS ` + p + `_maintenance_reminders (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			item_id INTEGER NOT NULL REFERENCES ` + p + `_items(id) ON DELETE CASCADE,
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
		)`,
		`CREATE INDEX IF NOT EXISTS idx_` + p + `_maintenance_reminders_due ON ` + p + `_maintenance_reminders(status, due_date)`,
		`CREATE INDEX IF NOT EXISTS idx_` + p + `_maintenance_reminders_item ON ` + p + `_maintenance_reminders(item_id)`,

		`CREATE TABLE IF NOT EXISTS ` + p + `_maintenance_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			reminder_id INTEGER NOT NULL,
			item_id INTEGER NOT NULL REFERENCES ` + p + `_items(id) ON DELETE CASCADE,
			action TEXT NOT NULL,
			title TEXT NOT NULL,
			reminder_type TEXT NOT NULL DEFAULT 'maintenance',
			custom_type_label TEXT,
			due_date TEXT NOT NULL,
			notes TEXT,
			performed_by INTEGER,
			performed_at TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_` + p + `_maintenance_history_item ON ` + p + `_maintenance_history(item_id, performed_at)`,
		`CREATE INDEX IF NOT EXISTS idx_` + p + `_maintenance_history_reminder ON ` + p + `_maintenance_history(reminder_id, performed_at)`,

		// Manufacturers
		`CREATE TABLE IF NOT EXISTS ` + p + `_manufacturers (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			logo TEXT,
			logo_background TEXT,
			external_logo_url TEXT,
			website TEXT,
			email TEXT,
			phone TEXT,
			address TEXT,
			support_email TEXT,
			support_phone TEXT,
			support_url TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		// Suppliers
		`CREATE TABLE IF NOT EXISTS ` + p + `_suppliers (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			logo TEXT,
			logo_background TEXT,
			external_logo_url TEXT,
			website TEXT,
			email TEXT,
			phone TEXT,
			address TEXT,
			contact_person TEXT,
			account_manager TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		// Vendors
		`CREATE TABLE IF NOT EXISTS ` + p + `_vendors (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			logo TEXT,
			logo_background TEXT,
			external_logo_url TEXT,
			website TEXT,
			email TEXT,
			phone TEXT,
			address TEXT,
			contact_person TEXT,
			customer_number TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Global sales platforms
		`CREATE TABLE IF NOT EXISTS generic_sales_platforms (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			logo TEXT,
			logo_background TEXT,
			external_logo_url TEXT,
			website TEXT,
			email TEXT,
			phone TEXT,
			address TEXT,
			contact_person TEXT,
			customer_number TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
	}
}
