package bootstrap

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"charm.land/lipgloss/v2"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/jmoiron/sqlx"
)

// What the user chose in the setup. Technical values such as the CORS list
// or the address to listen on are derived from these choices; only the
// advanced page shows them directly.
type setupDraft struct {
	Language string // "de" or "en"
	Usage    string // usageLocal, usageLAN or usageDomain

	AppDomain string

	Database    string // dbSQLite, dbMySQL or dbKeep
	MySQLHost   string
	MySQLPort   string
	MySQLName   string
	MySQLUser   string
	MySQLPass   string
	currentDB   string
	sqliteURL   string
	DatabaseURL string

	Mail          string // mailNow, mailLater or mailKeep
	SMTPHost      string
	SMTPSecurity  string // smtpSSL or smtpStartTLS
	SMTPUser      string
	SMTPPassword  string
	SMTPFromEmail string
	SMTPFromName  string
	currentSMTP   config.SetupValues

	AutoActivated bool
	HasPrinter    bool
	PrinterHost   string
	PrinterPort   string
	UpdateCheck   string

	Advanced             bool
	Host                 string
	Port                 string
	UploadDir            string
	LogDir               string
	TrustedProxies       string
	CORSOrigins          string
	IOSReviewPermissions bool

	MagicLinkBaseURL string

	AdminName  string
	AdminEmail string
}

const (
	usageLocal  = "local"
	usageLAN    = "lan"
	usageDomain = "domain"

	dbSQLite = "sqlite"
	dbMySQL  = "mysql"
	dbKeep   = "keep"

	mailNow   = "now"
	mailLater = "later"
	mailKeep  = "keep"

	smtpSSL      = "ssl"
	smtpStartTLS = "starttls"

	defaultSQLiteURL = "sqlite+aiosqlite:///./data/itemplus.db"
)

var (
	errSetupCancelled = errors.New("setup cancelled")
	errSetupRestart   = errors.New("setup restarted")
)

func trim(value string) string {
	return strings.TrimSpace(value)
}

func normalizeEmail(value string) string {
	return strings.ToLower(trim(value))
}

// cleanDomain reduces what someone typed as a domain to the bare host name.
func cleanDomain(value string) string {
	value = trim(value)
	value = strings.TrimPrefix(strings.TrimPrefix(value, "https://"), "http://")
	if cut := strings.IndexAny(value, "/?#"); cut >= 0 {
		value = value[:cut]
	}
	return strings.ToLower(strings.TrimSuffix(value, "."))
}

func isLoopbackHost(host string) bool {
	host = trim(host)
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// newSetupDraft starts from what itemplus.conf says now, so running the
// setup again offers the current state instead of forgetting it.
func newSetupDraft(current config.SetupValues) *setupDraft {
	draft := &setupDraft{
		Language:             defaultSetupLang(),
		AppDomain:            cleanDomain(current.AppDomain),
		MySQLHost:            "localhost",
		MySQLPort:            "3306",
		MySQLName:            "itemplus",
		currentDB:            trim(current.DatabaseURL),
		sqliteURL:            defaultSQLiteURL,
		Database:             dbSQLite,
		Mail:                 mailLater,
		SMTPSecurity:         smtpSSL,
		SMTPFromName:         defaultString(current.SMTPFromName, "item+"),
		currentSMTP:          current,
		AutoActivated:        current.AutoActivated,
		PrinterHost:          current.PrinterHost,
		PrinterPort:          strconv.Itoa(defaultInt(current.PrinterPort, 9100)),
		HasPrinter:           trim(current.PrinterHost) != "",
		UpdateCheck:          config.ParseUpdateCheck(current.UpdateCheck),
		Host:                 defaultString(current.Host, "0.0.0.0"),
		Port:                 strconv.Itoa(defaultInt(current.Port, config.DefaultPort)),
		UploadDir:            current.UploadDir,
		LogDir:               current.LogDir,
		TrustedProxies:       current.TrustedProxies,
		CORSOrigins:          defaultString(trim(current.CORSOrigins), `["*"]`),
		IOSReviewPermissions: current.IOSReviewPermissions,
	}
	switch {
	case draft.AppDomain != "":
		draft.Usage = usageDomain
	case isLoopbackHost(draft.Host):
		draft.Usage = usageLocal
	default:
		draft.Usage = usageLAN
	}
	if strings.HasPrefix(draft.currentDB, "sqlite") {
		draft.sqliteURL = draft.currentDB
	} else if draft.currentDB != "" {
		draft.Database = dbKeep
	}
	if trim(current.SMTPHost) != "" && trim(current.SMTPFromEmail) != "" {
		draft.Mail = mailKeep
	}
	return draft
}

func (d *setupDraft) lang() setupLang {
	if d.Language == "de" {
		return langDE
	}
	return langEN
}

// applyUsage turns the answer "how do you want to reach item+" into the
// technical settings that follow from it.
func (d *setupDraft) applyUsage() {
	switch d.Usage {
	case usageLocal:
		d.AppDomain = ""
		d.MagicLinkBaseURL = ""
		d.Host = "127.0.0.1"
	case usageLAN:
		d.AppDomain = ""
		d.MagicLinkBaseURL = ""
		if isLoopbackHost(d.Host) {
			d.Host = "0.0.0.0"
		}
	case usageDomain:
		d.AppDomain = cleanDomain(d.AppDomain)
		d.MagicLinkBaseURL = "https://" + d.AppDomain
		// The proxy runs on this machine in the usual set-up and passes requests on.
		d.CORSOrigins = fmt.Sprintf(`["https://%s"]`, d.AppDomain)
		if trim(d.TrustedProxies) == "" {
			d.TrustedProxies = "127.0.0.1,::1"
		}
	}
}

func (d *setupDraft) mysqlURL() string {
	address := url.URL{
		Scheme: "mysql+aiomysql",
		User:   url.UserPassword(trim(d.MySQLUser), d.MySQLPass),
		Host:   net.JoinHostPort(trim(d.MySQLHost), defaultString(trim(d.MySQLPort), "3306")),
		Path:   "/" + trim(d.MySQLName),
	}
	return address.String()
}

func (d *setupDraft) resolveDatabaseURL() {
	switch d.Database {
	case dbMySQL:
		d.DatabaseURL = d.mysqlURL()
	case dbKeep:
		d.DatabaseURL = d.currentDB
	default:
		d.DatabaseURL = d.sqliteURL
	}
}

func (d *setupDraft) toSetupValues() (config.SetupValues, error) {
	printerPort, err := parseOptionalInt(d.PrinterPort, 9100)
	if err != nil {
		return config.SetupValues{}, fmt.Errorf("invalid printer port")
	}
	port, err := parseRequiredInt(d.Port)
	if err != nil {
		return config.SetupValues{}, fmt.Errorf("invalid server port")
	}
	if !json.Valid([]byte(trim(d.CORSOrigins))) {
		return config.SetupValues{}, fmt.Errorf("CORS origins must be valid JSON, for example [\"https://example.com\"]")
	}

	values := config.SetupValues{
		AppDomain:            trim(d.AppDomain),
		MagicLinkBaseURL:     trim(d.MagicLinkBaseURL),
		AutoActivated:        d.AutoActivated,
		IOSReviewPermissions: d.IOSReviewPermissions,
		CORSOrigins:          trim(d.CORSOrigins),
		TrustedProxies:       trim(d.TrustedProxies),
		DatabaseURL:          trim(d.DatabaseURL),
		UploadDir:            trim(d.UploadDir),
		LogDir:               trim(d.LogDir),
		PrinterPort:          printerPort,
		UpdateCheck:          config.ParseUpdateCheck(d.UpdateCheck),
		EmailLocale:          d.Language,
		Host:                 trim(d.Host),
		Port:                 port,
	}
	if d.HasPrinter {
		values.PrinterHost = trim(d.PrinterHost)
	}

	switch d.Mail {
	case mailNow:
		values.SMTPHost = trim(d.SMTPHost)
		values.SMTPUser = trim(d.SMTPUser)
		values.SMTPPassword = d.SMTPPassword
		values.SMTPFromEmail = trim(d.SMTPFromEmail)
		values.SMTPFromName = defaultString(trim(d.SMTPFromName), "item+")
		// SMTP_USE_TLS means STARTTLS on port 587; without it item+ speaks SSL/TLS on 465.
		values.SMTPUseTLS = d.SMTPSecurity == smtpStartTLS
		values.SMTPPort = 465
		if values.SMTPUseTLS {
			values.SMTPPort = 587
		}
	case mailKeep:
		values.SMTPHost = d.currentSMTP.SMTPHost
		values.SMTPPort = d.currentSMTP.SMTPPort
		values.SMTPUser = d.currentSMTP.SMTPUser
		values.SMTPPassword = d.currentSMTP.SMTPPassword
		values.SMTPFromEmail = d.currentSMTP.SMTPFromEmail
		values.SMTPFromName = d.currentSMTP.SMTPFromName
		values.SMTPUseTLS = d.currentSMTP.SMTPUseTLS
	default:
		values.SMTPPort = 465
		values.SMTPFromName = "item+"
	}
	return values, nil
}

// RunInitialSetup leads through the first start: a few questions in plain
// words, a summary, and only then the configuration is written. It asks what
// someone wants to do (use it at home, put it under a domain) and works out
// the technical settings from that; those are only shown on request.
func RunInitialSetup() error {
	if !isInteractiveTerminal() {
		return fmt.Errorf("item+ needs an interactive terminal for the first start setup. Run it locally in a terminal once, or prepare itemplus.conf before starting")
	}

	draft := newSetupDraft(config.CurrentSetupValues())
	values, db, firstUserRequired, adminName, adminEmail, err := askSetupQuestions(draft)
	if errors.Is(err, errSetupCancelled) {
		return errors.New(draft.lang().tx("abort"))
	}
	if err != nil {
		return err
	}
	defer db.Close()

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

	printSetupCompletion(draft.lang(), values, db, firstUserRequired, adminName, adminEmail)
	return nil
}

func askSetupQuestions(d *setupDraft) (config.SetupValues, *sqlx.DB, bool, string, string, error) {
	// The language comes first and on its own, so everything after it can be in it.
	a := &asker{}
	if err := a.selectOne("Sprache / Language", "", &d.Language, choice{"Deutsch", "de"}, choice{"English", "en"}); err != nil {
		return config.SetupValues{}, nil, false, "", "", err
	}
	a.l, a.languageKnown = d.lang(), true
	printHeading("", a.l.tx("welcome.title"), a.l.tx("welcome.text"))

	// Starting over keeps the answers given so far as the suggestions.
	derived := [3]string{d.Host, d.CORSOrigins, d.TrustedProxies}
	for {
		d.Host, d.CORSOrigins, d.TrustedProxies = derived[0], derived[1], derived[2]
		values, db, firstUserRequired, err := askSetupRound(a, d)
		if errors.Is(err, errSetupRestart) {
			continue
		}
		if err != nil {
			return config.SetupValues{}, nil, false, "", "", err
		}
		return values, db, firstUserRequired, d.AdminName, d.AdminEmail, nil
	}
}

// askSetupRound asks everything once, from how item+ is reached to the
// summary. It returns errSetupRestart when the user wants to change answers.
func askSetupRound(a *asker, d *setupDraft) (config.SetupValues, *sqlx.DB, bool, error) {
	l := a.l
	fail := func(err error) (config.SetupValues, *sqlx.DB, bool, error) {
		return config.SetupValues{}, nil, false, err
	}
	required := func(value string) error {
		if trim(value) == "" {
			return errors.New(l.tx("needed"))
		}
		return nil
	}
	email := func(value string) error {
		if validateEmail(value) != nil {
			return errors.New(l.tx("email"))
		}
		return nil
	}
	port := func(value string) error {
		if validatePort(value) != nil {
			return errors.New(l.tx("port"))
		}
		return nil
	}
	domain := func(value string) error {
		name := cleanDomain(value)
		if name == "" || strings.ContainsAny(name, " @") || !strings.Contains(name, ".") {
			return errors.New(l.tx("domain"))
		}
		return nil
	}
	jsonList := func(value string) error {
		if validateJSONList(value) != nil {
			return errors.New(l.tx("json"))
		}
		return nil
	}
	step := func(number int) string { return l.tx("step", number, 4) }

	// 1. How item+ is reached.
	printHeading(step(1), l.tx("sec.reach"), "")
	if err := a.selectOne(l.tx("usage.title"), l.tx("usage.text"), &d.Usage,
		choice{l.tx("usage.local"), usageLocal},
		choice{l.tx("usage.lan"), usageLAN},
		choice{l.tx("usage.domain"), usageDomain},
	); err != nil {
		return fail(err)
	}
	if d.Usage == usageDomain {
		if err := a.text(l.tx("domain.title"), l.tx("domain.text"), "items.example.com", &d.AppDomain, domain); err != nil {
			return fail(err)
		}
	}
	d.applyUsage()

	// 2. The database, tried at once: a wrong password is found here, not at the first start.
	printHeading(step(2), l.tx("sec.data"), l.tx("db.text"))
	dbOptions := []choice{{l.tx("db.sqlite"), dbSQLite}, {l.tx("db.mysql"), dbMySQL}}
	if d.currentDB != "" && !strings.HasPrefix(d.currentDB, "sqlite") {
		dbOptions = append([]choice{{l.tx("db.keep"), dbKeep}}, dbOptions...)
	}
	var db *sqlx.DB
	firstUserRequired := false
	for db == nil {
		if err := a.selectOne(l.tx("db.title"), "", &d.Database, dbOptions...); err != nil {
			return fail(err)
		}
		if d.Database == dbMySQL {
			if err := a.text(l.tx("db.host"), l.tx("db.mysql.text"), "", &d.MySQLHost, required); err != nil {
				return fail(err)
			}
			if err := a.text(l.tx("db.port"), "", "", &d.MySQLPort, port); err != nil {
				return fail(err)
			}
			if err := a.text(l.tx("db.name"), "", "", &d.MySQLName, required); err != nil {
				return fail(err)
			}
			if err := a.text(l.tx("db.user"), "", "", &d.MySQLUser, required); err != nil {
				return fail(err)
			}
			if err := a.password(l.tx("db.password"), "", &d.MySQLPass); err != nil {
				return fail(err)
			}
		}
		d.resolveDatabaseURL()

		var opened *sqlx.DB
		openErr := withSpinner(l.tx("db.check"), func() error {
			var err error
			opened, firstUserRequired, err = openSetupDatabase(config.SetupValues{DatabaseURL: d.DatabaseURL})
			return err
		})
		if errors.Is(openErr, errSetupCancelled) {
			return fail(openErr)
		}
		if openErr == nil {
			db = opened
			printLine("✔", ui().ok, l.tx("db.ok"))
			lipgloss.Println()
			break
		}
		printBox(l.tx("db.fail.title"), l.tx("db.fail.text", openErr.Error()), ui().bad, ui().bad)
		retry := true
		if err := a.confirm(l.tx("db.fail.retry"), "", &retry); err != nil {
			return fail(err)
		}
		if !retry {
			return fail(errSetupCancelled)
		}
	}
	cancel := func(err error) (config.SetupValues, *sqlx.DB, bool, error) {
		_ = db.Close()
		return fail(err)
	}

	// 3. Signing in.
	printHeading(step(3), l.tx("sec.signin"), l.tx("mail.text"))
	mailOptions := []choice{{l.tx("mail.now"), mailNow}, {l.tx("mail.later"), mailLater}}
	if trim(d.currentSMTP.SMTPHost) != "" && trim(d.currentSMTP.SMTPFromEmail) != "" {
		mailOptions = append([]choice{{l.tx("mail.keep"), mailKeep}}, mailOptions...)
	}
	if err := a.selectOne(l.tx("mail.title"), "", &d.Mail, mailOptions...); err != nil {
		return cancel(err)
	}
	if d.Mail == mailNow {
		if err := a.text(l.tx("smtp.host"), l.tx("smtp.text")+" "+l.tx("smtp.host.hint"), "smtp.example.com", &d.SMTPHost, required); err != nil {
			return cancel(err)
		}
		if err := a.selectOne(l.tx("smtp.security"), "", &d.SMTPSecurity, choice{l.tx("smtp.ssl"), smtpSSL}, choice{l.tx("smtp.starttls"), smtpStartTLS}); err != nil {
			return cancel(err)
		}
		if err := a.text(l.tx("smtp.user"), l.tx("smtp.user.hint"), "", &d.SMTPUser, nil); err != nil {
			return cancel(err)
		}
		if err := a.password(l.tx("smtp.password"), "", &d.SMTPPassword); err != nil {
			return cancel(err)
		}
		if err := a.text(l.tx("smtp.from"), l.tx("smtp.from.hint"), "", &d.SMTPFromEmail, email); err != nil {
			return cancel(err)
		}
		if err := a.text(l.tx("smtp.fromname"), "", "", &d.SMTPFromName, nil); err != nil {
			return cancel(err)
		}
	}
	if err := a.confirm(l.tx("people.auto"), l.tx("people.auto.text"), &d.AutoActivated); err != nil {
		return cancel(err)
	}

	// 4. Extras, and the advanced settings for those who ask for them.
	printHeading(step(4), l.tx("extras.title"), l.tx("extras.text"))
	if err := a.confirm(l.tx("printer.ask"), l.tx("printer.ask.text"), &d.HasPrinter); err != nil {
		return cancel(err)
	}
	if d.HasPrinter {
		if err := a.text(l.tx("printer.host"), l.tx("printer.host.hint"), "192.168.1.50", &d.PrinterHost, required); err != nil {
			return cancel(err)
		}
		if err := a.text(l.tx("printer.port"), l.tx("printer.port.hint"), "", &d.PrinterPort, port); err != nil {
			return cancel(err)
		}
	}
	if err := a.selectOne(l.tx("update.title"), l.tx("update.text"), &d.UpdateCheck,
		choice{l.tx("update.off"), ""},
		choice{l.tx("update.release"), config.UpdateCheckRelease},
		choice{l.tx("update.build"), config.UpdateCheckBuild},
	); err != nil {
		return cancel(err)
	}
	if err := a.confirm(l.tx("advanced.ask"), l.tx("advanced.ask.text"), &d.Advanced); err != nil {
		return cancel(err)
	}
	if d.Advanced {
		type field struct {
			title, hint string
			value       *string
			validate    func(string) error
		}
		for _, entry := range []field{
			{l.tx("adv.host"), l.tx("adv.host.hint"), &d.Host, required},
			{l.tx("adv.port"), "", &d.Port, port},
			{l.tx("adv.upload"), l.tx("adv.upload.hint"), &d.UploadDir, required},
			{l.tx("adv.logs"), "", &d.LogDir, required},
			{l.tx("adv.proxies"), l.tx("adv.proxies.hint"), &d.TrustedProxies, nil},
			{l.tx("adv.cors"), l.tx("adv.cors.hint"), &d.CORSOrigins, jsonList},
		} {
			if err := a.text(entry.title, entry.hint, "", entry.value, entry.validate); err != nil {
				return cancel(err)
			}
		}
		if err := a.confirm(l.tx("adv.review"), l.tx("adv.review.hint"), &d.IOSReviewPermissions); err != nil {
			return cancel(err)
		}
	}

	// The first account, when the database has nobody in it yet.
	if firstUserRequired {
		printHeading("", l.tx("admin.title"), l.tx("admin.text"))
		if err := a.text(l.tx("admin.name"), l.tx("admin.name.hint"), "", &d.AdminName, required); err != nil {
			return cancel(err)
		}
		if err := a.text(l.tx("admin.email"), l.tx("admin.email.hint"), "", &d.AdminEmail, email); err != nil {
			return cancel(err)
		}
		d.AdminEmail = normalizeEmail(d.AdminEmail)
	} else {
		d.AdminName, d.AdminEmail = "", ""
	}

	values, err := d.toSetupValues()
	if err != nil {
		return cancel(err)
	}
	values.AdminDisplayName = d.AdminName
	values.AdminEmail = d.AdminEmail

	// What will be saved, in the user's words, before anything is written.
	lipgloss.Println(renderBox(l.tx("summary.title"), layoutRows(setupSummaryRows(l, d, values, d.AdminName, d.AdminEmail), innerWidth(), ui().dim), ui().dim, ui().accent.Bold(true)))
	lipgloss.Println()
	next := "save"
	if err := a.selectOne(l.tx("summary.save"), "", &next,
		choice{l.tx("summary.save.yes"), "save"},
		choice{l.tx("summary.restart"), "restart"},
		choice{l.tx("summary.save.no"), "cancel"},
	); err != nil {
		return cancel(err)
	}
	switch next {
	case "restart":
		return cancel(errSetupRestart)
	case "cancel":
		return cancel(errSetupCancelled)
	}
	return values, db, firstUserRequired, nil
}

// setupSummary lists what was chosen. Passwords are never shown.
func setupSummary(l setupLang, d *setupDraft, values config.SetupValues, adminName, adminEmail string) string {
	return strings.Join(layoutRows(setupSummaryRows(l, d, values, adminName, adminEmail), 0, lipgloss.NewStyle()), "\n")
}

type summaryRow struct{ label, value string }

// layoutRows lines the values up, whatever the longest label is in this
// language. With a width, a long value continues under its own beginning.
func layoutRows(rows []summaryRow, width int, labelStyle lipgloss.Style) []string {
	labels := 0
	for _, entry := range rows {
		labels = max(labels, utf8.RuneCountInString(entry.label))
	}
	lines := []string{}
	for _, entry := range rows {
		values := []string{entry.value}
		if width > 0 {
			values = wrapText(entry.value, max(width-labels-1, 10))
		}
		for i, value := range values {
			label := ""
			if i == 0 {
				label = entry.label
			}
			lines = append(lines, labelStyle.Render(label)+strings.Repeat(" ", labels-utf8.RuneCountInString(label)+1)+value)
		}
	}
	return lines
}

func setupSummaryRows(l setupLang, d *setupDraft, values config.SetupValues, adminName, adminEmail string) []summaryRow {
	rows := []summaryRow{}
	add := func(label, value string) {
		rows = append(rows, summaryRow{label + ":", value})
	}

	switch d.Usage {
	case usageDomain:
		add(l.tx("sum.reach"), "https://"+values.AppDomain)
	case usageLocal:
		add(l.tx("sum.reach"), l.tx("sum.reach.local", setupBaseURL(values)))
	default:
		add(l.tx("sum.reach"), l.tx("sum.reach.lan", values.Port))
	}

	if strings.HasPrefix(values.DatabaseURL, "sqlite") {
		add(l.tx("sum.db"), l.tx("sum.db.sqlite"))
	} else if parsed, err := url.Parse(values.DatabaseURL); err == nil {
		add(l.tx("sum.db"), l.tx("sum.db.mysql", parsed.Host+parsed.Path))
	}

	if trim(values.SMTPHost) != "" && trim(values.SMTPFromEmail) != "" {
		add(l.tx("sum.mail"), l.tx("sum.mail.on", values.SMTPHost, values.SMTPFromEmail))
	} else {
		add(l.tx("sum.mail"), l.tx("sum.mail.off"))
	}

	if values.AutoActivated {
		add(l.tx("sum.people"), l.tx("sum.people.auto"))
	} else {
		add(l.tx("sum.people"), l.tx("sum.people.manual"))
	}

	if trim(values.PrinterHost) != "" {
		add(l.tx("sum.printer"), fmt.Sprintf("%s:%d", values.PrinterHost, values.PrinterPort))
	} else {
		add(l.tx("sum.printer"), l.tx("sum.none"))
	}

	switch values.UpdateCheck {
	case config.UpdateCheckRelease:
		add(l.tx("sum.update"), l.tx("sum.update.release"))
	case config.UpdateCheckBuild:
		add(l.tx("sum.update"), l.tx("sum.update.build"))
	default:
		add(l.tx("sum.update"), l.tx("sum.update.off"))
	}

	if adminEmail != "" {
		add(l.tx("sum.admin"), fmt.Sprintf("%s <%s>", adminName, adminEmail))
	}
	add(l.tx("sum.file"), config.C.ConfigPath)

	return rows
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
	if err := db.Get(&count, "SELECT COUNT(*) FROM users WHERE apple_sub NOT LIKE 'deleted_user_%'"); err != nil {
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

// printSetupCompletion says what to do now: the link to sign in with, and
// what is still missing.
func printSetupCompletion(l setupLang, values config.SetupValues, db *sqlx.DB, firstUserRequired bool, adminName, adminEmail string) {
	s := ui()
	printLine("✔", s.ok, s.bold.Render(l.tx("done.title")))
	lipgloss.Println("    " + s.dim.Render(l.tx("done.config", config.C.ConfigPath)))
	lipgloss.Println()

	signInEmail := trim(adminEmail)
	if !firstUserRequired && signInEmail == "" {
		signInEmail = existingAdminEmail(db, values)
	}

	expiryMinutes := config.C.MagicLinkExpiryMinutes
	if expiryMinutes <= 0 {
		expiryMinutes = 30
	}
	// The address stands on a line of its own and is never wrapped or
	// framed, so it can be copied in one piece.
	address, addressText, problem := setupLoginURL(values), l.tx("done.open"), ""
	if signInEmail != "" {
		if magicLinkURL, err := createConsoleMagicLink(db, signInEmail, values); err == nil {
			address, addressText = magicLinkURL, l.tx("done.link", expiryMinutes)
		} else {
			problem = l.tx("done.nolink", err)
		}
	}
	printLine("→", s.accent, addressText)
	lipgloss.Println()
	lipgloss.Println("    " + s.accent.Render(address))
	lipgloss.Println()
	if problem != "" {
		printLine("!", s.warn, problem)
	}
	if trim(values.SMTPHost) == "" || trim(values.SMTPFromEmail) == "" {
		printLine("!", s.warn, l.tx("done.nomail"))
	}
	printLine("·", s.dim, l.tx("done.next"))
	lipgloss.Println()
	lipgloss.Println("  " + s.dim.Render(l.tx("done.starting")))
	lipgloss.Println()
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
