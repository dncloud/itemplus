package bootstrap

import (
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/itemplus/backend/internal/config"
)

// Every setup text exists in both languages and takes the same values.
func TestSetupTextsAreCompleteInBothLanguages(t *testing.T) {
	verbs := regexp.MustCompile(`%[sdvq]`)
	for key, entry := range setupTexts {
		if strings.TrimSpace(entry[langEN]) == "" || strings.TrimSpace(entry[langDE]) == "" {
			t.Errorf("%s: a language is missing", key)
		}
		if en, de := verbs.FindAllString(entry[langEN], -1), verbs.FindAllString(entry[langDE], -1); strings.Join(en, "") != strings.Join(de, "") {
			t.Errorf("%s: English takes %v, German takes %v", key, en, de)
		}
	}
	if langDE.tx("no.such.key") != "no.such.key" {
		t.Error("an unknown key should come back as it is, so a typo is visible")
	}
}

// The answer to "how do you want to reach item+" decides the technical
// settings nobody should have to type.
func TestSetupUsageDecidesTheTechnicalSettings(t *testing.T) {
	fresh := config.SetupValues{Host: "0.0.0.0", Port: 17117, CORSOrigins: `["*"]`, DatabaseURL: defaultSQLiteURL}

	local := newSetupDraft(fresh)
	local.Usage = usageLocal
	local.applyUsage()
	if local.Host != "127.0.0.1" || local.AppDomain != "" || local.MagicLinkBaseURL != "" {
		t.Fatalf("local: host %q, domain %q, link base %q", local.Host, local.AppDomain, local.MagicLinkBaseURL)
	}

	lan := newSetupDraft(config.SetupValues{Host: "127.0.0.1", Port: 17117})
	lan.Usage = usageLAN
	lan.applyUsage()
	if lan.Host != "0.0.0.0" {
		t.Fatalf("network use still listens on %q only", lan.Host)
	}

	domain := newSetupDraft(fresh)
	domain.Usage = usageDomain
	domain.AppDomain = " https://Items.Example.com/app?x=1 "
	domain.applyUsage()
	if domain.AppDomain != "items.example.com" || domain.MagicLinkBaseURL != "https://items.example.com" || domain.CORSOrigins != `["https://items.example.com"]` || domain.TrustedProxies != "127.0.0.1,::1" {
		t.Fatalf("domain: %q, %q, %q, %q", domain.AppDomain, domain.MagicLinkBaseURL, domain.CORSOrigins, domain.TrustedProxies)
	}

	// Running the setup again starts from what is configured.
	again := newSetupDraft(config.SetupValues{AppDomain: "items.example.com", Host: "0.0.0.0", DatabaseURL: "mysql+aiomysql://u:p@db:3306/itemplus", SMTPHost: "smtp.example.com", SMTPFromEmail: "a@example.com", UpdateCheck: "build"})
	if again.Usage != usageDomain || again.Database != dbKeep || again.Mail != mailKeep || again.UpdateCheck != config.UpdateCheckBuild {
		t.Fatalf("second run forgets the configuration: usage %q, db %q, mail %q, update %q", again.Usage, again.Database, again.Mail, again.UpdateCheck)
	}
}

// A MySQL address is built from separate fields; a password with special
// characters has to survive that, and it never shows up in the summary.
func TestSetupDatabaseAddressAndSummary(t *testing.T) {
	d := newSetupDraft(config.SetupValues{Host: "0.0.0.0", Port: 17117})
	d.Language = "de"
	d.Usage = usageLAN
	d.Database = dbMySQL
	d.MySQLHost, d.MySQLPort, d.MySQLName, d.MySQLUser, d.MySQLPass = "db.example.com", "3307", "itemplus", "item user", "p@ss:w/rd#1"
	d.resolveDatabaseURL()

	parsed, err := url.Parse(d.DatabaseURL)
	if err != nil {
		t.Fatal(err)
	}
	password, _ := parsed.User.Password()
	if parsed.Scheme != "mysql+aiomysql" || parsed.Host != "db.example.com:3307" || parsed.Path != "/itemplus" || parsed.User.Username() != "item user" || password != "p@ss:w/rd#1" {
		t.Fatalf("address %q does not read back as entered", d.DatabaseURL)
	}

	d.Mail = mailNow
	d.SMTPHost, d.SMTPSecurity, d.SMTPUser, d.SMTPPassword, d.SMTPFromEmail = "smtp.example.com", smtpStartTLS, "mailer", "smtp-secret", "items@example.com"
	d.UpdateCheck = config.UpdateCheckRelease
	d.UploadDir, d.LogDir = "./uploads", "./logs"
	values, err := d.toSetupValues()
	if err != nil {
		t.Fatal(err)
	}
	if !values.SMTPUseTLS || values.SMTPPort != 587 || values.EmailLocale != "de" || values.UpdateCheck != config.UpdateCheckRelease || values.PrinterHost != "" {
		t.Fatalf("values = %+v", values)
	}

	summary := setupSummary(langDE, d, values, "Anna", "anna@example.com")
	for _, secret := range []string{"p@ss", "smtp-secret", "item%20user"} {
		if strings.Contains(summary, secret) {
			t.Fatalf("the summary shows a secret (%q):\n%s", secret, summary)
		}
	}
	for _, want := range []string{"db.example.com:3307/itemplus", "smtp.example.com", "anna@example.com", "api.github.com"} {
		if !strings.Contains(summary, want) {
			t.Fatalf("the summary lacks %q:\n%s", want, summary)
		}
	}

	// "Later" for e-mail leaves no half-filled mail account behind.
	d.Mail = mailLater
	if later, _ := d.toSetupValues(); later.SMTPHost != "" || later.SMTPPassword != "" || later.SMTPFromEmail != "" {
		t.Fatalf("mail was skipped but saved: %+v", later)
	}
}

// What the setup decided ends up in itemplus.conf, the update check included,
// and off stays off.
func TestSetupWritesTheUpdateCheckToTheConfigFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "itemplus.conf")
	if err := os.WriteFile(path, []byte("ITEMPLUS_SETUP_REQUIRED=true\nUPDATE_CHECK=\nHOST=0.0.0.0\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	previous := config.C.ConfigPath
	config.C.ConfigPath = path
	t.Cleanup(func() { config.C.ConfigPath = previous })

	read := func() string {
		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		return string(data)
	}

	if err := config.SaveSetupValues(config.SetupValues{UpdateCheck: "release", Host: "127.0.0.1", Port: 17117}, true); err != nil {
		t.Fatal(err)
	}
	if content := read(); !strings.Contains(content, "UPDATE_CHECK=release\n") || !strings.Contains(content, "HOST=127.0.0.1\n") || strings.Contains(content, "ITEMPLUS_SETUP_REQUIRED") {
		t.Fatalf("config after setup:\n%s", content)
	}

	if err := config.SaveSetupValues(config.SetupValues{UpdateCheck: "true", Host: "127.0.0.1", Port: 17117}, true); err != nil {
		t.Fatal(err)
	}
	if content := read(); !strings.Contains(content, "UPDATE_CHECK=\n") {
		t.Fatalf("an unknown mode switched the check on:\n%s", content)
	}
}
