package bootstrap

import (
	"errors"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/itemplus/backend/internal/database"
)

func EnsureInitialAdmin() {
	var count int
	if err := database.DB.Get(&count, "SELECT COUNT(*) FROM users WHERE apple_sub NOT LIKE 'deleted_user_%'"); err != nil {
		log.Fatalf("Failed to check user count: %v", err)
	}
	if count > 0 {
		return
	}

	if !isInteractiveTerminal() {
		log.Println("No users found in the database.")
		log.Println("Start item+ once in an interactive terminal to create the first admin user, or use the seed binary.")
		os.Exit(1)
	}

	name, email := promptInitialAdmin()
	if err := createInitialAdmin(name, email); err != nil {
		log.Fatalf("Failed to create initial admin user: %v", err)
	}

	log.Printf("Created initial admin user: %s <%s>", name, email)
	log.Println("You can now sign in with a magic link or Apple Sign-In using this account.")
}

func createInitialAdmin(name, email string) error {
	now := database.TimestampNow()
	appleSub := "bootstrap_" + strings.ToLower(strings.TrimSpace(email))

	_, err := database.DB.Exec(
		`INSERT INTO users (apple_sub, email, display_name, is_admin, is_active, permissions, created_at, updated_at)
		 VALUES (?, ?, ?, 1, 1, '[]', ?, ?)`,
		appleSub, email, name, now, now,
	)
	return err
}

// promptInitialAdmin asks for the first account when the setup has already
// run but the database is empty, for example after pointing item+ at a new one.
func promptInitialAdmin() (string, string) {
	a := &asker{languageKnown: true}
	if defaultSetupLang() == "de" {
		a.l = langDE
	}
	l := a.l
	name, email := "", ""

	printHeading("", l.tx("admin.title"), l.tx("admin.text"))
	err := a.text(l.tx("admin.name"), l.tx("admin.name.hint"), "", &name, func(value string) error {
		if validateRequired(value) != nil {
			return errors.New(l.tx("needed"))
		}
		return nil
	})
	if err == nil {
		err = a.text(l.tx("admin.email"), l.tx("admin.email.hint"), "", &email, func(value string) error {
			if validateEmail(value) != nil {
				return errors.New(l.tx("email"))
			}
			return nil
		})
	}
	if err != nil {
		log.Fatal(err)
	}

	return strings.TrimSpace(name), strings.TrimSpace(strings.ToLower(email))
}

func validateRequired(value string) error {
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("please enter a value")
	}
	return nil
}

func validateEmail(value string) error {
	value = strings.TrimSpace(value)
	if strings.Contains(value, "@") && !strings.HasPrefix(value, "@") && !strings.HasSuffix(value, "@") {
		return nil
	}
	return fmt.Errorf("please enter a valid email address")
}

func isInteractiveTerminal() bool {
	info, err := os.Stdin.Stat()
	if err != nil {
		return false
	}
	return (info.Mode() & os.ModeCharDevice) != 0
}
