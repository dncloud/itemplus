package database

import (
	"log"
	"strings"
	"sync"

	"github.com/jmoiron/sqlx"
)

// textColumns holds the names of all columns that are declared as text in
// every table that has them. Row maps are keyed by column name only, so this
// is what lets generic row handling tell a text value that merely looks like
// a number ("1942", "007") from a numeric column.
var (
	textColumnsMu sync.RWMutex
	textColumns   = map[string]bool{}
)

// IsTextColumn reports whether a column of this name is textual in the schema.
func IsTextColumn(name string) bool {
	textColumnsMu.RLock()
	defer textColumnsMu.RUnlock()
	return textColumns[name]
}

func isTextType(declared string) bool {
	declared = strings.ToUpper(declared)
	return strings.Contains(declared, "CHAR") || strings.Contains(declared, "TEXT") || strings.Contains(declared, "CLOB")
}

// loadTextColumns reads the column types of all tables. It runs once per
// connection setup, never per request: on SQLite a query issued while another
// result set is open would block.
func loadTextColumns(db *sqlx.DB, driver string) {
	query := "SELECT p.name, p.type FROM sqlite_master m, pragma_table_info(m.name) p WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%'"
	if driver == "mysql" {
		query = "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = DATABASE()"
	}
	rows, err := db.Query(query)
	if err != nil {
		log.Printf("Warning: could not read column types, text values that look like numbers may be returned as numbers: %v", err)
		return
	}
	defer rows.Close()

	text, other := map[string]bool{}, map[string]bool{}
	for rows.Next() {
		var name, declared string
		if err := rows.Scan(&name, &declared); err != nil {
			continue
		}
		if isTextType(declared) {
			text[name] = true
		} else {
			other[name] = true
		}
	}
	for name := range other {
		delete(text, name)
	}

	textColumnsMu.Lock()
	textColumns = text
	textColumnsMu.Unlock()
}
