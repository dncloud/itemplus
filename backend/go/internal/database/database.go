package database

import (
	"log"
	"strings"

	_ "github.com/glebarez/go-sqlite"
	"github.com/itemplus/backend/internal/config"
	"github.com/jmoiron/sqlx"
)

var DB *sqlx.DB

func Connect() {
	url := config.C.DatabaseURL

	// Convert SQLAlchemy URL to Go driver format
	driver := "sqlite"
	dsn := url
	if strings.HasPrefix(url, "sqlite+aiosqlite:///") {
		dsn = strings.TrimPrefix(url, "sqlite+aiosqlite:///")
	} else if strings.HasPrefix(url, "postgresql") {
		driver = "postgres"
		dsn = strings.Replace(url, "postgresql+asyncpg://", "postgres://", 1)
	} else if strings.HasPrefix(url, "mysql") {
		driver = "mysql"
		dsn = strings.Replace(url, "mysql+aiomysql://", "", 1)
	}

	var err error
	DB, err = sqlx.Connect(driver, dsn)
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}

	createTables()
}

func createTables() {
	tables := []string{
		// App Settings
		`CREATE TABLE IF NOT EXISTS app_settings (
			key TEXT PRIMARY KEY,
			value TEXT,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Users
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			apple_sub TEXT UNIQUE NOT NULL,
			email TEXT,
			display_name TEXT,
			is_admin BOOLEAN DEFAULT 0,
			is_active BOOLEAN DEFAULT 0,
			permissions TEXT DEFAULT '[]',
			last_login DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_users_apple_sub ON users(apple_sub)`,
		`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,

		// Device Sessions
		`CREATE TABLE IF NOT EXISTS device_sessions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			device_type TEXT NOT NULL,
			device_name TEXT,
			ip_address TEXT,
			is_online BOOLEAN DEFAULT 0,
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
			approved_by INTEGER,
			notes TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
	}

	// Per-realm tables
	for _, prefix := range []string{"archive", "collection"} {
		tables = append(tables, realmTables(prefix)...)
	}

	for _, sql := range tables {
		DB.MustExec(sql)
	}

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
			quantity INTEGER DEFAULT 1,
			is_consumable BOOLEAN DEFAULT 0,
			minimum_quantity INTEGER,
			manufacturer_id INTEGER,
			supplier_id INTEGER,
			vendor_id INTEGER,
			purchase_date TEXT,
			purchase_price REAL,
			purchase_currency TEXT DEFAULT 'EUR',
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
			user_id INTEGER NOT NULL,
			status TEXT DEFAULT 'active',
			due_date TEXT,
			returned_at TEXT,
			notes TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Manufacturers
		`CREATE TABLE IF NOT EXISTS ` + p + `_manufacturers (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			logo TEXT,
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
