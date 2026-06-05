package bootstrap

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"

	huh "charm.land/huh/v2"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/jmoiron/sqlx"
)

type setupDraft struct {
	AppDomain        string
	MagicLinkBaseURL string
	AutoActivated    bool
	CORSOrigins      string
	TrustedProxies   string
	DatabaseURL      string
	UploadDir        string
	LogDir           string
	PrinterHost      string
	PrinterPort      string
	SMTPHost         string
	SMTPPort         string
	SMTPUser         string
	SMTPPassword     string
	SMTPFromEmail    string
	SMTPFromName     string
	SMTPUseTLS       bool
	Host             string
	Port             string
}

func trim(value string) string {
	return strings.TrimSpace(value)
}

func normalizeEmail(value string) string {
	return strings.ToLower(trim(value))
}

func RunInitialSetup() error {
	if !isInteractiveTerminal() {
		return fmt.Errorf("item+ needs an interactive terminal for the first start setup. Run it locally in a terminal once, or prepare itemplus.conf before starting")
	}

	current := config.CurrentSetupValues()
	draft := setupDraft{
		AppDomain:        current.AppDomain,
		MagicLinkBaseURL: current.MagicLinkBaseURL,
		AutoActivated:    current.AutoActivated,
		CORSOrigins:      current.CORSOrigins,
		TrustedProxies:   current.TrustedProxies,
		DatabaseURL:      current.DatabaseURL,
		UploadDir:        current.UploadDir,
		LogDir:           current.LogDir,
		PrinterHost:      current.PrinterHost,
		PrinterPort:      strconv.Itoa(defaultInt(current.PrinterPort, 9100)),
		SMTPHost:         current.SMTPHost,
		SMTPPort:         strconv.Itoa(defaultInt(current.SMTPPort, 465)),
		SMTPUser:         current.SMTPUser,
		SMTPPassword:     current.SMTPPassword,
		SMTPFromEmail:    current.SMTPFromEmail,
		SMTPFromName:     defaultString(current.SMTPFromName, "item+"),
		SMTPUseTLS:       current.SMTPUseTLS,
		Host:             defaultString(current.Host, "0.0.0.0"),
		Port:             strconv.Itoa(defaultInt(current.Port, config.DefaultPort)),
	}
	if strings.TrimSpace(draft.CORSOrigins) == "" {
		draft.CORSOrigins = `["*"]`
	}

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewNote().
				Title("Welcome to item+").
				Description("This is the initial setup for your item+ server.\n\nWe'll go through the most important basics once, save them directly into your configuration, and create the first admin account if the selected database is still empty.\n\nIf you do not use the iOS app, regular sign-in usually happens via e-mail magic links. SMTP is therefore strongly recommended, but after this setup item+ will also show you one direct sign-in link in the console so you can get started right away.\n\nAfter that, item+ will continue starting normally."),
		),
		huh.NewGroup(
			huh.NewInput().
				Title("App domain").
				Description("Used for links in the web app. Enter only the domain, without http:// or https://. Leave empty if you only start locally for now.").
				Value(&draft.AppDomain),
			huh.NewInput().
				Title("Magic link base URL").
				Description("Must include http:// or https://, for example https://itemplus.example.com. Leave empty to derive it automatically from the app domain.").
				Value(&draft.MagicLinkBaseURL),
			huh.NewConfirm().
				Title("Automatically activate new users?").
				Description("When enabled, new Apple and magic-link users can sign in immediately. Permissions still decide what they may actually do.").
				Value(&draft.AutoActivated),
			huh.NewInput().
				Title("CORS origins").
				Description(`JSON array, for example ["https://itemplus.example.com"] or ["*"] for local development.`).
				Value(&draft.CORSOrigins).
				Validate(validateJSONList),
			huh.NewInput().
				Title("Trusted proxies").
				Description("Optional comma-separated list for nginx, Caddy, Traefik, or other reverse proxies you control. Examples: 127.0.0.1,::1 or 10.0.0.0/8,192.168.0.0/16").
				Value(&draft.TrustedProxies),
			huh.NewInput().
				Title("Bind host").
				Description("Default is 0.0.0.0 so item+ can listen on all interfaces.").
				Value(&draft.Host).
				Validate(validateRequired),
			huh.NewInput().
				Title("Port").
				Description(fmt.Sprintf("Default is %d.", config.DefaultPort)).
				Value(&draft.Port).
				Validate(validatePort),
		),
		huh.NewGroup(
			huh.NewInput().
				Title("Database URL").
				Description("SQLite works well as the default for single-machine installs.").
				Value(&draft.DatabaseURL).
				Validate(validateRequired),
			huh.NewInput().
				Title("Upload directory").
				Description("Attachments are stored here.").
				Value(&draft.UploadDir).
				Validate(validateRequired),
			huh.NewInput().
				Title("Log directory").
				Description("Log files are written here.").
				Value(&draft.LogDir).
				Validate(validateRequired),
		),
		huh.NewGroup(
			huh.NewInput().
				Title("Printer host").
				Description("Optional. The printer should usually be in the same network as the server.").
				Value(&draft.PrinterHost),
			huh.NewInput().
				Title("Printer port").
				Description("Optional. TSC printers usually use 9100.").
				Value(&draft.PrinterPort).
				Validate(validateOptionalPort),
		),
		huh.NewGroup(
			huh.NewInput().
				Title("SMTP host").
				Description("Recommended for regular magic-link e-mails, especially if you do not use the iOS app.").
				Value(&draft.SMTPHost),
			huh.NewInput().
				Title("SMTP port").
				Description("Optional. Common values are 465 or 587.").
				Value(&draft.SMTPPort).
				Validate(validateOptionalPort),
			huh.NewInput().
				Title("SMTP user").
				Value(&draft.SMTPUser),
			huh.NewInput().
				Title("SMTP password").
				Value(&draft.SMTPPassword),
			huh.NewInput().
				Title("SMTP from e-mail").
				Description("Required for sending magic-link sign-in e-mails.").
				Value(&draft.SMTPFromEmail),
			huh.NewInput().
				Title("SMTP from name").
				Value(&draft.SMTPFromName),
			huh.NewConfirm().
				Title("Use TLS instead of SSL?").
				Value(&draft.SMTPUseTLS),
		),
	).WithShowHelp(false).WithTheme(huh.ThemeFunc(huh.ThemeCharm))

	if err := form.Run(); err != nil {
		return err
	}

	values, err := draft.toSetupValues()
	if err != nil {
		return err
	}

	db, firstUserRequired, err := openSetupDatabase(values)
	if err != nil {
		return err
	}
	defer db.Close()

	adminName := ""
	adminEmail := ""
	if firstUserRequired {
		adminName, adminEmail, err = promptSetupAdmin()
		if err != nil {
			return err
		}
		values.AdminDisplayName = adminName
		values.AdminEmail = adminEmail
	}

	if err := config.SaveSetupValues(values, false); err != nil {
		return fmt.Errorf("could not save the configuration: %w", err)
	}

	if firstUserRequired {
		if err := createSetupAdmin(db, values.DatabaseURL, adminName, adminEmail); err != nil {
			return fmt.Errorf("configuration was saved, but the first admin could not be created: %w", err)
		}
	}

	if err := config.SaveSetupValues(values, true); err != nil {
		return fmt.Errorf("configuration was saved, but setup could not be finalized: %w", err)
	}

	printSetupCompletion(values, db, firstUserRequired, adminName, adminEmail)

	return nil
}

func promptSetupAdmin() (string, string, error) {
	name := ""
	email := ""

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewNote().
				Title("First admin account").
				Description("No users were found in the selected database yet.\n\nLet's create the first admin account now."),
			huh.NewInput().
				Title("Display name").
				Description("This is shown throughout the app.").
				Value(&name).
				Validate(validateRequired),
			huh.NewInput().
				Title("E-mail address").
				Description("Used for magic-link login and the initial admin identity.").
				Value(&email).
				Validate(validateEmail),
		),
	).WithShowHelp(false).WithTheme(huh.ThemeFunc(huh.ThemeCharm))

	if err := form.Run(); err != nil {
		return "", "", err
	}

	return trim(name), normalizeEmail(email), nil
}

func (d setupDraft) toSetupValues() (config.SetupValues, error) {
	printerPort, err := parseOptionalInt(d.PrinterPort, 9100)
	if err != nil {
		return config.SetupValues{}, fmt.Errorf("invalid printer port")
	}
	smtpPort, err := parseOptionalInt(d.SMTPPort, 465)
	if err != nil {
		return config.SetupValues{}, fmt.Errorf("invalid SMTP port")
	}
	port, err := parseRequiredInt(d.Port)
	if err != nil {
		return config.SetupValues{}, fmt.Errorf("invalid server port")
	}
	if !json.Valid([]byte(strings.TrimSpace(d.CORSOrigins))) {
		return config.SetupValues{}, fmt.Errorf("CORS origins must be valid JSON, for example [\"https://example.com\"]")
	}

	return config.SetupValues{
		AppDomain:        trim(d.AppDomain),
		MagicLinkBaseURL: trim(d.MagicLinkBaseURL),
		AutoActivated:    d.AutoActivated,
		CORSOrigins:      trim(d.CORSOrigins),
		TrustedProxies:   trim(d.TrustedProxies),
		DatabaseURL:      trim(d.DatabaseURL),
		UploadDir:        trim(d.UploadDir),
		LogDir:           trim(d.LogDir),
		PrinterHost:      trim(d.PrinterHost),
		PrinterPort:      printerPort,
		SMTPHost:         trim(d.SMTPHost),
		SMTPPort:         smtpPort,
		SMTPUser:         trim(d.SMTPUser),
		SMTPPassword:     d.SMTPPassword,
		SMTPFromEmail:    trim(d.SMTPFromEmail),
		SMTPFromName:     trim(d.SMTPFromName),
		SMTPUseTLS:       d.SMTPUseTLS,
		Host:             trim(d.Host),
		Port:             port,
	}, nil
}

func openSetupDatabase(values config.SetupValues) (*sqlx.DB, bool, error) {
	dbURL := strings.TrimSpace(values.DatabaseURL)
	if dbURL == "" {
		dbURL = config.C.DatabaseURL
	}
	dbURL = config.ResolvedDatabaseURL(dbURL)

	db, err := database.OpenPrepared(dbURL)
	if err != nil {
		return nil, false, fmt.Errorf("could not open the configured database: %w", err)
	}

	var count int
	if err := db.Get(&count, "SELECT COUNT(*) FROM users"); err != nil {
		_ = db.Close()
		return nil, false, fmt.Errorf("could not inspect the configured database: %w", err)
	}

	return db, count == 0, nil
}

func createSetupAdmin(db *sqlx.DB, dbURL, name, email string) error {
	now := database.TimestampForURL(dbURL, time.Now().UTC())
	appleSub := "bootstrap_" + strings.ToLower(strings.TrimSpace(email))

	_, err := db.Exec(
		`INSERT INTO users (apple_sub, email, display_name, is_admin, is_active, permissions, created_at, updated_at)
		 VALUES (?, ?, ?, 1, 1, '[]', ?, ?)`,
		appleSub, email, name, now, now,
	)
	return err
}

func validateJSONList(value string) error {
	value = strings.TrimSpace(value)
	if value == "" {
		return fmt.Errorf("please enter a JSON array")
	}
	if !json.Valid([]byte(value)) {
		return fmt.Errorf("please enter valid JSON, for example [\"https://example.com\"]")
	}
	return nil
}

func validatePort(value string) error {
	_, err := parseRequiredInt(value)
	if err != nil {
		return fmt.Errorf("please enter a port between 1 and 65535")
	}
	return nil
}

func validateOptionalPort(value string) error {
	_, err := parseOptionalInt(value, 0)
	if err != nil {
		return fmt.Errorf("please enter a port between 1 and 65535")
	}
	return nil
}

func parseRequiredInt(value string) (int, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0, fmt.Errorf("missing value")
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 1 || parsed > 65535 {
		return 0, fmt.Errorf("invalid value")
	}
	return parsed, nil
}

func parseOptionalInt(value string, fallback int) (int, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 1 || parsed > 65535 {
		return 0, fmt.Errorf("invalid value")
	}
	return parsed, nil
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func defaultInt(value, fallback int) int {
	if value == 0 {
		return fallback
	}
	return value
}

func printSetupCompletion(values config.SetupValues, db *sqlx.DB, firstUserRequired bool, adminName, adminEmail string) {
	fmt.Println()
	fmt.Println("item+ setup finished successfully.")
	fmt.Printf("Configuration file: %s\n", config.C.EnvPath)

	loginURL := setupLoginURL(values)
	signInEmail := trim(adminEmail)
	if firstUserRequired {
		fmt.Printf("First admin: %s <%s>\n", adminName, adminEmail)
	} else if signInEmail == "" {
		signInEmail = existingAdminEmail(db, values)
	}

	if signInEmail != "" {
		if magicLinkURL, err := createConsoleMagicLink(db, signInEmail, values); err == nil {
			fmt.Printf("Sign in with this magic link: %s\n", magicLinkURL)
		} else {
			fmt.Printf("Open this in your browser after startup: %s\n", loginURL)
			fmt.Printf("Could not create the initial magic link automatically for %s: %v\n", signInEmail, err)
		}
	} else {
		fmt.Printf("Open this in your browser after startup: %s\n", loginURL)
		fmt.Println("No admin e-mail could be determined automatically, so no direct magic link was created.")
	}

	if trim(values.SMTPHost) == "" || trim(values.SMTPFromEmail) == "" {
		fmt.Println("SMTP is still recommended so item+ can send regular magic-link e-mails later on.")
	}
	fmt.Println("Continuing with the normal server start...")
	fmt.Println()
}

func setupLoginURL(values config.SetupValues) string {
	if base := trim(values.MagicLinkBaseURL); base != "" {
		return strings.TrimRight(base, "/") + "/auth"
	}
	if domain := trim(values.AppDomain); domain != "" {
		domain = strings.TrimPrefix(strings.TrimPrefix(domain, "https://"), "http://")
		domain = strings.TrimRight(domain, "/")
		if domain != "" {
			return "https://" + domain + "/auth"
		}
	}
	host := trim(values.Host)
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "127.0.0.1"
	} else if parsed := net.ParseIP(host); parsed != nil && parsed.IsUnspecified() {
		host = "127.0.0.1"
	}
	port := values.Port
	if port == 0 {
		port = config.DefaultPort
	}
	return fmt.Sprintf("http://%s:%d/auth", host, port)
}

func setupBaseURL(values config.SetupValues) string {
	return strings.TrimSuffix(setupLoginURL(values), "/auth")
}

func existingAdminEmail(db *sqlx.DB, values config.SetupValues) string {
	candidates := []string{
		trim(values.AdminEmail),
	}
	for _, candidate := range candidates {
		if candidate != "" {
			return normalizeEmail(candidate)
		}
	}

	var email string
	if err := db.Get(&email, "SELECT email FROM users WHERE is_admin = 1 AND email IS NOT NULL AND email != '' ORDER BY id ASC LIMIT 1"); err == nil {
		return normalizeEmail(email)
	}
	if err := db.Get(&email, "SELECT email FROM users WHERE email IS NOT NULL AND email != '' ORDER BY id ASC LIMIT 1"); err == nil {
		return normalizeEmail(email)
	}
	return ""
}

func createConsoleMagicLink(db *sqlx.DB, email string, values config.SetupValues) (string, error) {
	email = normalizeEmail(email)
	if email == "" {
		return "", fmt.Errorf("missing e-mail address")
	}

	b := make([]byte, 36)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}
	token := base64.URLEncoding.EncodeToString(b)

	expiryMinutes := config.C.MagicLinkExpiryMinutes
	if expiryMinutes <= 0 {
		expiryMinutes = 30
	}
	expiresAt := database.TimestampForURL(values.DatabaseURL, time.Now().UTC().Add(time.Duration(expiryMinutes)*time.Minute))
	if _, err := db.Exec(
		"INSERT INTO magic_link_tokens (email, token, expires_at, used) VALUES (?, ?, ?, 0)",
		email, token, expiresAt,
	); err != nil {
		return "", fmt.Errorf("store token: %w", err)
	}

	return fmt.Sprintf("%s/auth/magic/%s", strings.TrimRight(setupBaseURL(values), "/"), token), nil
}
