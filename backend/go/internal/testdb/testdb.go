// Package testdb gives tests a fresh, fully migrated database.
//
// By default that is a SQLite file in the test's temp directory. Set
// ITEMPLUS_TEST_DATABASE_URL to a MySQL/MariaDB server, for example
//
//	ITEMPLUS_TEST_DATABASE_URL=mysql+aiomysql://user:password@127.0.0.1:3306 go test ./...
//
// to run the same tests there. Every test then gets its own database named
// itemplus_test_<random>, which is dropped afterwards; the account needs the
// right to create and drop databases with that prefix.
package testdb

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	_ "github.com/go-sql-driver/mysql"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
)

const envServerURL = "ITEMPLUS_TEST_DATABASE_URL"

// Use points config.C.DatabaseURL and database.DB at a new empty database
// for the duration of the test.
func Use(t *testing.T) {
	t.Helper()
	databaseURL := "sqlite+aiosqlite:///" + filepath.Join(t.TempDir(), "itemplus.db")
	if server := strings.TrimRight(strings.TrimSpace(os.Getenv(envServerURL)), "/"); server != "" {
		databaseURL = server + "/" + createMySQLDatabase(t, server)
	}

	previousURL, previousDB := config.C.DatabaseURL, database.DB
	config.C.DatabaseURL = databaseURL
	db, err := database.OpenPrepared(databaseURL)
	if err != nil {
		config.C.DatabaseURL = previousURL
		t.Fatalf("open test database: %v", err)
	}
	database.DB = db
	t.Cleanup(func() {
		// A test may have reconnected (a restore does); close whatever is
		// current as well as the handle opened here.
		if database.DB != nil && database.DB != db {
			_ = database.DB.Close()
		}
		_ = db.Close()
		config.C.DatabaseURL, database.DB = previousURL, previousDB
	})
}

func createMySQLDatabase(t *testing.T, server string) string {
	t.Helper()
	parsed, err := url.Parse(server)
	if err != nil || parsed.Host == "" || parsed.User == nil {
		t.Fatalf("%s must look like mysql+aiomysql://user:password@host:port", envServerURL)
	}
	password, _ := parsed.User.Password()
	admin, err := sql.Open("mysql", parsed.User.Username()+":"+password+"@tcp("+parsed.Host+")/")
	if err != nil {
		t.Fatalf("connect to test server: %v", err)
	}

	suffix := make([]byte, 6)
	if _, err := rand.Read(suffix); err != nil {
		t.Fatal(err)
	}
	name := "itemplus_test_" + hex.EncodeToString(suffix)
	if _, err := admin.Exec("CREATE DATABASE `" + name + "` CHARACTER SET utf8mb4"); err != nil {
		_ = admin.Close()
		t.Fatalf("create test database: %v", err)
	}
	// Registered before the caller's cleanup, so it runs after the connection
	// to the database has been closed.
	t.Cleanup(func() {
		_, _ = admin.Exec("DROP DATABASE IF EXISTS `" + name + "`")
		_ = admin.Close()
	})
	return name
}
