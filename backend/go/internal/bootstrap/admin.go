package bootstrap

import (
	"fmt"
	"log"
	"os"
	"strings"

	huh "charm.land/huh/v2"
	"github.com/itemplus/backend/internal/database"
)

func EnsureInitialAdmin() {
	var count int
	if err := database.DB.Get(&count, "SELECT COUNT(*) FROM users"); err != nil {
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

func promptInitialAdmin() (string, string) {
	name := ""
	email := ""

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewNote().
				Title("Welcome to item+").
				Description("No users were found in this database yet.\n\nLet's create the first admin account for this server."),
			huh.NewInput().
				Title("Admin display name").
				Description("Shown in the app and used as the first admin account name.").
				Value(&name).
				Validate(validateRequired),
			huh.NewInput().
				Title("Admin email").
				Description("Used for magic-link login and as the initial admin identity.").
				Value(&email).
				Validate(validateEmail),
		),
	).WithShowHelp(false).WithTheme(huh.ThemeFunc(huh.ThemeBase16))

	if err := form.Run(); err != nil {
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
