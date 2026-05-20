package database

import (
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
)

type sqliteAdapter struct{}

func (sqliteAdapter) driverName() string { return "sqlite" }

func OpenRawSQLite(path string) (*sqlx.DB, error) {
	return sqlx.Connect("sqlite", path)
}

func (sqliteAdapter) dsn(rawURL string) string {
	return strings.TrimPrefix(rawURL, "sqlite+aiosqlite:///")
}

func (sqliteAdapter) connectionSummary(rawURL string) string {
	path := strings.TrimPrefix(strings.TrimSpace(rawURL), "sqlite+aiosqlite:///")
	if path == "" {
		return "sqlite"
	}
	return fmt.Sprintf("sqlite (%s)", path)
}

func (sqliteAdapter) caseInsensitiveOrder(column string) string {
	return fmt.Sprintf("%s COLLATE NOCASE ASC", column)
}

func (sqliteAdapter) upsertAppSetting(key, value, updatedAt string) error {
	_, err := DB.Exec(
		"INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
		key, value, updatedAt,
	)
	return err
}

func (sqliteAdapter) schemaStatements() []string {
	return schemaStatementsBase()
}

func (sqliteAdapter) shouldIgnoreSchemaError(err error) bool {
	return false
}
