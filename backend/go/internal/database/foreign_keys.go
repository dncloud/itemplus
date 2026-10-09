package database

import (
	"context"

	"github.com/jmoiron/sqlx"
)

// WithoutCascades runs fn in a transaction in which deleting a row does not
// delete the rows that reference it.
//
// The SQLite schema declares ON DELETE CASCADE for everything that hangs off
// an item, while the MySQL schema has no foreign keys at all. Code that needs
// the same result on both (for example: an item goes, its checkouts stay) has
// to decide row by row itself; this switches SQLite's automatic part off for
// the duration. On MySQL it is a plain transaction.
func WithoutCascades(fn func(tx *sqlx.Tx) error) error {
	ctx := context.Background()
	// One dedicated connection: the pragma is per connection and cannot be
	// changed inside a transaction.
	conn, err := DB.Connx(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	if CurrentDriver() == "sqlite" {
		if _, err := conn.ExecContext(ctx, "PRAGMA foreign_keys = OFF"); err != nil {
			return err
		}
		defer conn.ExecContext(ctx, "PRAGMA foreign_keys = ON")
	}

	tx, err := conn.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}
