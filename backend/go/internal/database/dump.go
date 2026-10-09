package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

// Complete database dumps for backup and restore.
//
// A dump never works from a list of tables kept in the code: it asks the
// database which tables exist and takes all of them, so a table added later
// cannot be forgotten. Each engine is dumped in the form that reproduces it
// most faithfully:
//
//   - SQLite: a consistent copy of the database file (VACUUM INTO).
//   - MySQL/MariaDB: every table with its CREATE TABLE statement and all rows.
//
// A dump can only be restored into the engine it was taken from.

// MySQLDump is the content of a MySQL/MariaDB database.
type MySQLDump struct {
	Tables []MySQLTableDump `json:"tables"`
}

// MySQLTableDump is one table: its definition and its rows, with the values
// of each row in the order of Columns.
type MySQLTableDump struct {
	Name      string          `json:"name"`
	CreateSQL string          `json:"create_sql"`
	Columns   []string        `json:"columns"`
	Rows      [][]interface{} `json:"rows"`
}

const (
	mysqlStagePrefix = "_itp_restore_"
	mysqlOldPrefix   = "_itp_old_"
)

var dumpTableNamePattern = regexp.MustCompile(`^[A-Za-z0-9_]{1,48}$`)

// ── SQLite ──

// SnapshotSQLite writes a consistent copy of the open SQLite database to
// targetPath, which must not exist yet.
func SnapshotSQLite(db *sqlx.DB, targetPath string) error {
	_, err := db.Exec("VACUUM INTO ?", targetPath)
	return err
}

// VerifySQLiteSnapshot checks that the file is an intact SQLite database
// that contains item+ data.
func VerifySQLiteSnapshot(path string) error {
	db, err := OpenRawSQLite(path)
	if err != nil {
		return fmt.Errorf("not a SQLite database")
	}
	defer db.Close()

	var result string
	if err := db.Get(&result, "PRAGMA integrity_check"); err != nil || result != "ok" {
		return fmt.Errorf("database file is damaged")
	}
	var tables int
	if err := db.Get(&tables, "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'app_settings')"); err != nil || tables != 2 {
		return fmt.Errorf("database file does not contain item+ data")
	}
	return nil
}

// RemoveSQLiteSidecars deletes the write-ahead log and shared-memory files
// that belong to a database file. They must never be left next to a database
// file that was swapped in from elsewhere.
func RemoveSQLiteSidecars(dbPath string) {
	_ = os.Remove(dbPath + "-wal")
	_ = os.Remove(dbPath + "-shm")
}

// ── MySQL / MariaDB ──

func mysqlBaseTables(q sqlx.Queryer) ([]string, error) {
	var tables []string
	err := sqlx.Select(q, &tables, "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name")
	return tables, err
}

// ExportMySQLDump reads every table of the current database inside one
// read-only transaction, so the dump is a consistent snapshot even while the
// application keeps writing.
func ExportMySQLDump(db *sqlx.DB) (*MySQLDump, error) {
	tx, err := db.BeginTxx(context.Background(), &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	tables, err := mysqlBaseTables(tx)
	if err != nil {
		return nil, err
	}

	dump := &MySQLDump{}
	for _, table := range tables {
		if strings.HasPrefix(table, mysqlStagePrefix) || strings.HasPrefix(table, mysqlOldPrefix) {
			continue // leftovers of an interrupted restore
		}
		if !dumpTableNamePattern.MatchString(table) {
			return nil, fmt.Errorf("unexpected table name %q", table)
		}
		var name, createSQL string
		if err := tx.QueryRow("SHOW CREATE TABLE `"+table+"`").Scan(&name, &createSQL); err != nil {
			return nil, fmt.Errorf("%s: %w", table, err)
		}

		rows, err := tx.Queryx("SELECT * FROM `" + table + "`")
		if err != nil {
			return nil, fmt.Errorf("%s: %w", table, err)
		}
		columns, err := rows.Columns()
		if err != nil {
			rows.Close()
			return nil, err
		}
		tableDump := MySQLTableDump{Name: table, CreateSQL: createSQL, Columns: columns, Rows: [][]interface{}{}}
		for rows.Next() {
			values, err := rows.SliceScan()
			if err != nil {
				rows.Close()
				return nil, fmt.Errorf("%s: %w", table, err)
			}
			for i, value := range values {
				values[i] = dumpValue(value)
			}
			tableDump.Rows = append(tableDump.Rows, values)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, fmt.Errorf("%s: %w", table, err)
		}
		rows.Close()
		dump.Tables = append(dump.Tables, tableDump)
	}
	return dump, tx.Commit()
}

// dumpValue turns a scanned value into one that survives JSON and can be
// inserted again unchanged.
func dumpValue(value interface{}) interface{} {
	switch v := value.(type) {
	case []byte:
		return string(v)
	case time.Time:
		return v.UTC().Format(mysqlDateTimeMicroLayout)
	default:
		return v
	}
}

// DecodeMySQLDump reads a dump written by ExportMySQLDump. Numbers keep
// their exact value.
func DecodeMySQLDump(path string) (*MySQLDump, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	decoder.UseNumber()
	var dump MySQLDump
	if err := decoder.Decode(&dump); err != nil {
		return nil, err
	}
	for _, table := range dump.Tables {
		for _, row := range table.Rows {
			for i, value := range row {
				if number, ok := value.(json.Number); ok {
					row[i] = number.String() // MySQL converts the text exactly
				}
			}
		}
	}
	return &dump, nil
}

// validateMySQLDump refuses dumps whose table definitions are anything but a
// single CREATE TABLE statement for the named table. The definitions are
// executed during a restore, so they must not be able to carry other SQL.
func validateMySQLDump(dump *MySQLDump) error {
	if dump == nil || len(dump.Tables) == 0 {
		return fmt.Errorf("dump contains no tables")
	}
	seen := map[string]bool{}
	hasUsers := false
	for _, table := range dump.Tables {
		if !dumpTableNamePattern.MatchString(table.Name) || seen[table.Name] {
			return fmt.Errorf("invalid table name %q", table.Name)
		}
		seen[table.Name] = true
		hasUsers = hasUsers || table.Name == "users"
		if !strings.HasPrefix(table.CreateSQL, "CREATE TABLE `"+table.Name+"` (") || strings.Contains(table.CreateSQL, ";") {
			return fmt.Errorf("invalid definition of table %q", table.Name)
		}
		for _, column := range table.Columns {
			if strings.ContainsAny(column, "`;") || column == "" {
				return fmt.Errorf("invalid column name in table %q", table.Name)
			}
		}
		for _, row := range table.Rows {
			if len(row) != len(table.Columns) {
				return fmt.Errorf("table %q has a row with the wrong number of values", table.Name)
			}
		}
	}
	if !hasUsers {
		return fmt.Errorf("dump does not contain item+ data")
	}
	return nil
}

// StageMySQLDump loads the dump into tables with temporary names next to the
// live ones. Nothing the application uses is touched; if it fails, the
// staged tables are removed again.
func StageMySQLDump(db *sqlx.DB, dump *MySQLDump) error {
	if err := validateMySQLDump(dump); err != nil {
		return err
	}
	if err := DropStagedMySQLTables(db); err != nil {
		return err
	}
	if err := stageMySQLDump(db, dump); err != nil {
		_ = DropStagedMySQLTables(db)
		return err
	}
	return nil
}

func stageMySQLDump(db *sqlx.DB, dump *MySQLDump) error {
	for _, table := range dump.Tables {
		staged := mysqlStagePrefix + table.Name
		createSQL := "CREATE TABLE `" + staged + "` (" + strings.TrimPrefix(table.CreateSQL, "CREATE TABLE `"+table.Name+"` (")
		if _, err := db.Exec(createSQL); err != nil {
			return fmt.Errorf("%s: %w", table.Name, err)
		}
		if len(table.Rows) == 0 {
			continue
		}

		quoted := make([]string, len(table.Columns))
		for i, column := range table.Columns {
			quoted[i] = "`" + column + "`"
		}
		insert := fmt.Sprintf("INSERT INTO `%s` (%s) VALUES (%s)", staged, strings.Join(quoted, ", "),
			strings.TrimSuffix(strings.Repeat("?, ", len(table.Columns)), ", "))

		tx, err := db.Begin()
		if err != nil {
			return err
		}
		stmt, err := tx.Prepare(insert)
		if err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("%s: %w", table.Name, err)
		}
		for _, row := range table.Rows {
			if _, err := stmt.Exec(row...); err != nil {
				_ = stmt.Close()
				_ = tx.Rollback()
				return fmt.Errorf("%s: %w", table.Name, err)
			}
		}
		_ = stmt.Close()
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("%s: %w", table.Name, err)
		}
	}
	return nil
}

// SwapStagedMySQLTables replaces the live tables with the staged ones in a
// single RENAME TABLE statement, which MySQL and MariaDB execute atomically:
// either every table is exchanged or none is. Tables that exist only in the
// live database are moved aside as well, so the result is exactly the dump.
//
// The previous tables are kept under a temporary name until
// DropStagedMySQLTables is called, so RevertMySQLSwap can still bring them
// back.
func SwapStagedMySQLTables(db *sqlx.DB, dump *MySQLDump) error {
	existing, err := mysqlBaseTables(db)
	if err != nil {
		return err
	}
	var renames []string
	for _, table := range existing {
		if strings.HasPrefix(table, mysqlStagePrefix) || strings.HasPrefix(table, mysqlOldPrefix) {
			continue
		}
		if !dumpTableNamePattern.MatchString(table) {
			return fmt.Errorf("unexpected table name %q", table)
		}
		renames = append(renames, fmt.Sprintf("`%s` TO `%s%s`", table, mysqlOldPrefix, table))
	}
	for _, table := range dump.Tables {
		renames = append(renames, fmt.Sprintf("`%s%s` TO `%s`", mysqlStagePrefix, table.Name, table.Name))
	}
	_, err = db.Exec("RENAME TABLE " + strings.Join(renames, ", "))
	return err
}

// RevertMySQLSwap undoes SwapStagedMySQLTables: the restored tables are
// dropped and the previous ones get their names back, again in one atomic
// rename.
func RevertMySQLSwap(db *sqlx.DB) error {
	tables, err := mysqlBaseTables(db)
	if err != nil {
		return err
	}
	var previous []string
	for _, table := range tables {
		if strings.HasPrefix(table, mysqlOldPrefix) {
			previous = append(previous, strings.TrimPrefix(table, mysqlOldPrefix))
		}
	}
	if len(previous) == 0 {
		return fmt.Errorf("no previous tables to return to")
	}
	for _, table := range tables {
		if strings.HasPrefix(table, mysqlStagePrefix) || strings.HasPrefix(table, mysqlOldPrefix) || !dumpTableNamePattern.MatchString(table) {
			continue
		}
		if _, err := db.Exec("DROP TABLE IF EXISTS `" + table + "`"); err != nil {
			return err
		}
	}
	renames := make([]string, 0, len(previous))
	for _, table := range previous {
		renames = append(renames, fmt.Sprintf("`%s%s` TO `%s`", mysqlOldPrefix, table, table))
	}
	_, err = db.Exec("RENAME TABLE " + strings.Join(renames, ", "))
	return err
}

// DropStagedMySQLTables removes what an unfinished restore left behind.
func DropStagedMySQLTables(db *sqlx.DB) error {
	if err := dropMySQLTablesWithPrefix(db, mysqlStagePrefix); err != nil {
		return err
	}
	return dropMySQLTablesWithPrefix(db, mysqlOldPrefix)
}

func dropMySQLTablesWithPrefix(db *sqlx.DB, prefix string) error {
	tables, err := mysqlBaseTables(db)
	if err != nil {
		return err
	}
	for _, table := range tables {
		if strings.HasPrefix(table, prefix) && dumpTableNamePattern.MatchString(table) {
			if _, err := db.Exec("DROP TABLE IF EXISTS `" + table + "`"); err != nil {
				return err
			}
		}
	}
	return nil
}

// DropAllMySQLTables empties the current database. It is used only when an
// old-format backup, which carries no table definitions, is restored.
func DropAllMySQLTables(db *sqlx.DB) error {
	tables, err := mysqlBaseTables(db)
	if err != nil {
		return err
	}
	for _, table := range tables {
		if !dumpTableNamePattern.MatchString(table) {
			return fmt.Errorf("unexpected table name %q", table)
		}
		if _, err := db.Exec("DROP TABLE IF EXISTS `" + table + "`"); err != nil {
			return err
		}
	}
	return nil
}
