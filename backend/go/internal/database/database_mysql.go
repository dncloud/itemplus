package database

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"

	mysqlDriver "github.com/go-sql-driver/mysql"
)

var mysqlReferencePattern = regexp.MustCompile(`\s+REFERENCES\s+[^\s,]+(?:\([^)]+\))?(?:\s+ON DELETE\s+[A-Z ]+)?`)

type mysqlAdapter struct{}

func (mysqlAdapter) driverName() string { return "mysql" }

func (mysqlAdapter) dsn(raw string) string {
	if strings.Contains(raw, "@tcp(") || strings.Contains(raw, "@unix(") {
		return strings.Replace(raw, "mysql+aiomysql://", "", 1)
	}

	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		return strings.Replace(raw, "mysql+aiomysql://", "", 1)
	}

	cfg := mysqlDriver.NewConfig()
	if parsed.User != nil {
		cfg.User = parsed.User.Username()
		if password, ok := parsed.User.Password(); ok {
			cfg.Passwd = password
		}
	}
	cfg.Net = "tcp"
	cfg.Addr = parsed.Host
	cfg.DBName = strings.TrimPrefix(parsed.Path, "/")
	cfg.ParseTime = true
	cfg.Params = map[string]string{
		"charset":   "utf8mb4",
		"collation": "utf8mb4_unicode_ci",
	}

	if query := parsed.Query(); len(query) > 0 {
		if charset := query.Get("charset"); charset != "" {
			cfg.Params["charset"] = charset
		}
		for key, values := range query {
			if len(values) == 0 || values[0] == "" {
				continue
			}
			switch key {
			case "charset":
				cfg.Params[key] = values[0]
			case "parseTime":
				cfg.ParseTime = strings.EqualFold(values[0], "true") || values[0] == "1"
			default:
				cfg.Params[key] = values[0]
			}
		}
	}

	return cfg.FormatDSN()
}

func (mysqlAdapter) connectionSummary(rawURL string) string {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return "mysql"
	}
	host := parsed.Host
	dbName := strings.TrimPrefix(parsed.Path, "/")
	if host != "" && dbName != "" {
		return fmt.Sprintf("mysql (%s/%s)", host, dbName)
	}
	if host != "" {
		return fmt.Sprintf("mysql (%s)", host)
	}
	return "mysql"
}

func (mysqlAdapter) caseInsensitiveOrder(column string) string {
	return fmt.Sprintf("LOWER(%s) ASC", column)
}

func (mysqlAdapter) upsertAppSetting(key, value, updatedAt string) error {
	_, err := DB.Exec(
		"INSERT INTO app_settings (`key`, value, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)",
		key, value, updatedAt,
	)
	return err
}

func (mysqlAdapter) schemaStatements() []string {
	base := schemaStatementsBase()
	out := make([]string, 0, len(base))
	for _, stmt := range base {
		out = append(out, adaptMySQLSchemaSQL(stmt))
	}
	return out
}

func adaptMySQLSchemaSQL(sql string) string {
	replacements := []struct {
		old string
		new string
	}{
		{`CREATE INDEX IF NOT EXISTS `, `CREATE INDEX `},
		{`id INTEGER PRIMARY KEY AUTOINCREMENT`, `id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY`},
		{`key TEXT PRIMARY KEY`, "`key` VARCHAR(191) PRIMARY KEY"},
		{`apple_sub TEXT UNIQUE NOT NULL`, `apple_sub VARCHAR(191) NOT NULL UNIQUE`},
		{`email TEXT,`, `email VARCHAR(191),`},
		{`system_key TEXT UNIQUE`, `system_key VARCHAR(191) UNIQUE`},
		{`target TEXT NOT NULL`, `target VARCHAR(191) NOT NULL`},
		{`permissions TEXT DEFAULT '[]'`, `permissions LONGTEXT`},
		{`source_type TEXT NOT NULL DEFAULT 'sftp'`, `source_type VARCHAR(64) NOT NULL DEFAULT 'sftp'`},
		{`auth_type TEXT NOT NULL DEFAULT 'password'`, `auth_type VARCHAR(64) NOT NULL DEFAULT 'password'`},
		{`base_path TEXT NOT NULL DEFAULT '.'`, `base_path VARCHAR(1024) NOT NULL DEFAULT '.'`},
		{`token TEXT UNIQUE NOT NULL`, `token VARCHAR(191) NOT NULL UNIQUE`},
		{`device_type TEXT NOT NULL`, `device_type VARCHAR(64) NOT NULL`},
		{`realm TEXT NOT NULL`, `realm VARCHAR(32) NOT NULL`},
		{`profile_id TEXT`, `profile_id VARCHAR(191)`},
		{`provider TEXT`, `provider VARCHAR(64)`},
		{`model TEXT`, `model VARCHAR(191)`},
		{`feature TEXT NOT NULL`, `feature VARCHAR(64) NOT NULL`},
		{`transport TEXT`, `transport VARCHAR(64)`},
		{`status TEXT DEFAULT 'pending'`, `status VARCHAR(32) DEFAULT 'pending'`},
		{`status TEXT DEFAULT 'active'`, `status VARCHAR(32) DEFAULT 'active'`},
		{`property_type TEXT NOT NULL`, `property_type VARCHAR(64) NOT NULL`},
		{`options TEXT DEFAULT '{}'`, `options LONGTEXT`},
		{`display_width TEXT DEFAULT 'third'`, `display_width VARCHAR(32) DEFAULT 'third'`},
		{`purchase_currency TEXT DEFAULT 'EUR'`, `purchase_currency VARCHAR(16) DEFAULT 'EUR'`},
		{`item_status TEXT NOT NULL DEFAULT 'active'`, `item_status VARCHAR(32) NOT NULL DEFAULT 'active'`},
		{`storage_backend TEXT NOT NULL DEFAULT 'local'`, `storage_backend VARCHAR(32) NOT NULL DEFAULT 'local'`},
		{`attachment_type TEXT DEFAULT 'image'`, `attachment_type VARCHAR(32) DEFAULT 'image'`},
		{`"order" INTEGER DEFAULT 0`, "`order` INTEGER DEFAULT 0"},
	}

	for _, replacement := range replacements {
		sql = strings.ReplaceAll(sql, replacement.old, replacement.new)
	}

	return mysqlReferencePattern.ReplaceAllString(sql, "")
}

func (mysqlAdapter) shouldIgnoreSchemaError(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(strings.ToLower(err.Error()), "duplicate key name")
}
