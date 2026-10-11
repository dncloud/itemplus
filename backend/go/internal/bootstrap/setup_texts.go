package bootstrap

import (
	"fmt"
	"os"
	"strings"
)

// The setup speaks German or English. Every text it shows is in this table,
// so the two languages stay next to each other and nothing is forgotten in
// one of them.
type setupLang int

const (
	langEN setupLang = iota
	langDE
)

// defaultSetupLang guesses from the terminal's locale which language to
// offer first; the user chooses on the first screen either way.
func defaultSetupLang() string {
	for _, key := range []string{"LC_ALL", "LC_MESSAGES", "LANG"} {
		if value := strings.ToLower(os.Getenv(key)); value != "" {
			if strings.HasPrefix(value, "de") {
				return "de"
			}
			return "en"
		}
	}
	return "en"
}

var setupTexts = map[string][2]string{
	"step":            {"Step %d of %d", "Schritt %d von %d"},
	"keys.select":     {"↑/↓ choose · Enter confirm", "↑/↓ auswählen · Enter bestätigen"},
	"keys.confirm":    {"←/→ switch · Enter confirm", "←/→ wechseln · Enter bestätigen"},
	"sec.reach":       {"Access", "Erreichbarkeit"},
	"sec.data":        {"Data", "Daten"},
	"sec.signin":      {"Signing in", "Anmeldung"},
	"extras.text":     {"You can skip all of this and add it later.", "Das alles kannst du überspringen und später nachtragen."},
	"db.check":        {"Checking the database …", "Datenbank wird geprüft …"},
	"db.ok":           {"The database is reachable.", "Die Datenbank ist erreichbar."},
	"summary.restart": {"Start over and change answers", "Von vorn beginnen und Antworten ändern"},
	"yes":             {"Yes", "Ja"},
	"no":              {"No", "Nein"},
	"abort":           {"Setup was cancelled. Nothing was changed; start item+ again to set it up.", "Die Einrichtung wurde abgebrochen. Es wurde nichts geändert; starte item+ erneut, um es einzurichten."},
	"needed":          {"please enter a value", "bitte einen Wert eingeben"},
	"email":           {"please enter a valid e-mail address", "bitte eine gültige E-Mail-Adresse eingeben"},
	"port":            {"please enter a port between 1 and 65535", "bitte einen Port zwischen 1 und 65535 eingeben"},
	"json":            {`please enter a JSON list, for example ["https://example.com"]`, `bitte eine JSON-Liste eingeben, zum Beispiel ["https://example.com"]`},
	"domain":          {"only the name, without http:// and without a path, for example items.example.com", "nur den Namen, ohne http:// und ohne Pfad, zum Beispiel items.example.com"},

	"welcome.title": {"Welcome to item+", "Willkommen bei item+"},
	"welcome.text": {
		"This sets up your item+ server. It takes about two minutes.\n\nYou will be asked\n  1. how you want to reach item+\n  2. where the data is stored\n  3. how people sign in\n  4. about a few extras you can skip\n\nNothing is saved before you have seen a summary and confirmed it. Everything can be changed later in the file itemplus.conf.",
		"Hier richtest du deinen item+-Server ein. Das dauert etwa zwei Minuten.\n\nGefragt wird\n  1. wie du item+ erreichen möchtest\n  2. wo die Daten liegen\n  3. wie man sich anmeldet\n  4. nach ein paar Extras, die du überspringen kannst\n\nGespeichert wird erst, wenn du eine Zusammenfassung gesehen und bestätigt hast. Alles lässt sich später in der Datei itemplus.conf ändern.",
	},

	"usage.title":  {"How do you want to reach item+?", "Wie möchtest du item+ erreichen?"},
	"usage.text":   {"This decides who can open the app. You can change it later.", "Das legt fest, wer die App öffnen kann. Du kannst es später ändern."},
	"usage.local":  {"Only on this computer – to try it out", "Nur auf diesem Rechner – zum Ausprobieren"},
	"usage.lan":    {"From my home or office network", "Aus meinem Heim- oder Firmennetz"},
	"usage.domain": {"Under my own domain, behind a reverse proxy", "Unter einer eigenen Domain, hinter einem Reverse Proxy"},

	"domain.title": {"Your domain", "Deine Domain"},
	"domain.text":  {"The name under which item+ will be reachable. Sign-in links in e-mails point there. HTTPS is assumed; your reverse proxy (nginx, Caddy, Traefik) takes care of the certificate.", "Der Name, unter dem item+ erreichbar sein wird. Anmeldelinks in E-Mails zeigen dorthin. Es wird HTTPS angenommen; um das Zertifikat kümmert sich dein Reverse Proxy (nginx, Caddy, Traefik)."},

	"db.title":       {"Where should the data be stored?", "Wo sollen die Daten liegen?"},
	"db.text":        {"item+ keeps items, categories and everything else in a database.", "item+ legt Items, Kategorien und alles Weitere in einer Datenbank ab."},
	"db.sqlite":      {"In a file on this computer (SQLite) – recommended, nothing to install", "In einer Datei auf diesem Rechner (SQLite) – empfohlen, nichts zu installieren"},
	"db.mysql":       {"On a MySQL or MariaDB server that already exists", "Auf einem vorhandenen MySQL- oder MariaDB-Server"},
	"db.keep":        {"Keep the database from itemplus.conf", "Die Datenbank aus der itemplus.conf beibehalten"},
	"db.mysql.title": {"MySQL / MariaDB", "MySQL / MariaDB"},
	"db.mysql.text":  {"The database and the user have to exist already; item+ creates its tables itself.", "Datenbank und Benutzer müssen schon existieren; seine Tabellen legt item+ selbst an."},
	"db.host":        {"Server", "Server"},
	"db.port":        {"Port", "Port"},
	"db.name":        {"Database name", "Name der Datenbank"},
	"db.user":        {"User", "Benutzer"},
	"db.password":    {"Password", "Passwort"},
	"db.fail.title":  {"The database could not be opened", "Die Datenbank ließ sich nicht öffnen"},
	"db.fail.text":   {"item+ tried to connect and got this answer:\n\n%s\n\nCheck server, name, user and password.", "item+ hat versucht, sich zu verbinden, und diese Antwort bekommen:\n\n%s\n\nPrüfe Server, Name, Benutzer und Passwort."},
	"db.fail.retry":  {"Enter the details again?", "Angaben noch einmal eingeben?"},

	"mail.title": {"How do people sign in?", "Wie meldet man sich an?"},
	"mail.text":  {"item+ has no passwords. To sign in you enter your e-mail address and get a link by e-mail. For that item+ needs a mail account it may send from (SMTP).\n\nWithout it you can still start: a sign-in link for you is printed here in the terminal.", "item+ kennt keine Passwörter. Zum Anmelden gibt man seine E-Mail-Adresse ein und bekommt einen Link per E-Mail. Dafür braucht item+ ein Postfach, über das es senden darf (SMTP).\n\nOhne das kannst du trotzdem loslegen: Ein Anmeldelink für dich wird hier im Terminal ausgegeben."},
	"mail.now":   {"Set up e-mail now", "E-Mail jetzt einrichten"},
	"mail.later": {"Later – I use the link from the terminal for now", "Später – ich nehme erst einmal den Link aus dem Terminal"},
	"mail.keep":  {"Keep the e-mail settings from itemplus.conf", "Die E-Mail-Einstellungen aus der itemplus.conf beibehalten"},

	"smtp.title":     {"Mail account for sending", "Postfach zum Senden"},
	"smtp.text":      {"You find these details with your mail provider, usually under \"SMTP\" or \"outgoing mail server\".", "Die Angaben findest du bei deinem Mail-Anbieter, meist unter „SMTP“ oder „Postausgangsserver“."},
	"smtp.host":      {"Outgoing mail server", "Postausgangsserver"},
	"smtp.host.hint": {"for example smtp.example.com", "zum Beispiel smtp.example.com"},
	"smtp.security":  {"Encryption", "Verschlüsselung"},
	"smtp.ssl":       {"SSL/TLS, port 465 – the usual choice", "SSL/TLS, Port 465 – der übliche Fall"},
	"smtp.starttls":  {"STARTTLS, port 587", "STARTTLS, Port 587"},
	"smtp.user":      {"User name", "Benutzername"},
	"smtp.user.hint": {"often the full e-mail address", "oft die vollständige E-Mail-Adresse"},
	"smtp.password":  {"Password", "Passwort"},
	"smtp.from":      {"Sender address", "Absenderadresse"},
	"smtp.from.hint": {"the address the sign-in mails come from", "die Adresse, von der die Anmelde-Mails kommen"},
	"smtp.fromname":  {"Sender name", "Absendername"},

	"people.title": {"New people", "Neue Personen"},
	"people.auto":  {"May anyone who signs in use item+ right away?", "Darf jeder, der sich anmeldet, item+ sofort benutzen?"},
	"people.auto.text": {
		"Yes: new people are active at once. What they may do is still decided by the rights you give them.\nNo: an admin has to activate each new person first. Recommended when item+ is reachable from the internet.",
		"Ja: Neue Personen sind sofort aktiv. Was sie dürfen, bestimmen weiterhin die Rechte, die du ihnen gibst.\nNein: Ein Admin muss jede neue Person erst freischalten. Empfohlen, wenn item+ aus dem Internet erreichbar ist.",
	},

	"extras.title":      {"Extras", "Extras"},
	"printer.ask":       {"Do you have a label printer in the network?", "Hast du einen Etikettendrucker im Netzwerk?"},
	"printer.ask.text":  {"item+ prints QR labels on TSC label printers. You can also add this later under Settings > Label Printer.", "item+ druckt QR-Etiketten auf TSC-Etikettendruckern. Das lässt sich auch später unter Einstellungen > Label Printer nachtragen."},
	"printer.title":     {"Label printer", "Etikettendrucker"},
	"printer.host":      {"Address of the printer", "Adresse des Druckers"},
	"printer.host.hint": {"its name or IP address in your network, for example 192.168.1.50", "sein Name oder seine IP-Adresse in deinem Netz, zum Beispiel 192.168.1.50"},
	"printer.port":      {"Port", "Port"},
	"printer.port.hint": {"TSC printers usually use 9100", "TSC-Drucker nutzen meist 9100"},

	"update.title": {"Should item+ tell you about new versions?", "Soll item+ dich auf neue Versionen hinweisen?"},
	"update.text": {
		"item+ never contacts another server on its own. If you want a notice in the app, the server asks api.github.com once a day. Nothing is downloaded or installed, and nothing about your installation is sent.",
		"item+ nimmt von sich aus nie Kontakt zu anderen Servern auf. Wenn du einen Hinweis in der App möchtest, fragt der Server einmal am Tag bei api.github.com nach. Es wird nichts heruntergeladen oder installiert und nichts über deine Installation gesendet.",
	},
	"update.off":     {"No – item+ contacts nobody", "Nein – item+ fragt niemanden"},
	"update.release": {"Yes, when a new release is published", "Ja, wenn ein neues Release veröffentlicht ist"},
	"update.build":   {"Yes, also for builds that are not released yet", "Ja, auch bei Builds, die noch nicht veröffentlicht sind"},

	"advanced.ask":      {"Do you want to adjust advanced settings?", "Möchtest du erweiterte Einstellungen anpassen?"},
	"advanced.ask.text": {"Port, folders for uploads and logs, reverse proxy details. The defaults fit most installations.", "Port, Ordner für Uploads und Logs, Angaben zum Reverse Proxy. Die Vorgaben passen für die meisten Installationen."},
	"advanced.title":    {"Advanced settings", "Erweiterte Einstellungen"},
	"adv.host":          {"Address item+ listens on", "Adresse, auf der item+ lauscht"},
	"adv.host.hint":     {"127.0.0.1 = only this computer, 0.0.0.0 = every network interface", "127.0.0.1 = nur dieser Rechner, 0.0.0.0 = alle Netzwerkschnittstellen"},
	"adv.port":          {"Port", "Port"},
	"adv.upload":        {"Folder for uploads", "Ordner für Uploads"},
	"adv.upload.hint":   {"pictures and other attachments are stored here", "hier liegen Bilder und andere Anhänge"},
	"adv.logs":          {"Folder for log files", "Ordner für Log-Dateien"},
	"adv.proxies":       {"Trusted reverse proxies", "Vertrauenswürdige Reverse Proxys"},
	"adv.proxies.hint":  {"only proxies you run yourself, separated by commas, for example 127.0.0.1,::1. Empty if there is none.", "nur Proxys, die du selbst betreibst, durch Komma getrennt, zum Beispiel 127.0.0.1,::1. Leer, wenn es keinen gibt."},
	"adv.cors":          {"Allowed origins (CORS)", "Erlaubte Ursprünge (CORS)"},
	"adv.cors.hint":     {`a JSON list of the addresses the web app is opened from, for example ["https://items.example.com"]`, `eine JSON-Liste der Adressen, unter denen die Web-App geöffnet wird, zum Beispiel ["https://items.example.com"]`},
	"adv.review":        {"Give every new person all rights?", "Jeder neuen Person alle Rechte geben?"},
	"adv.review.hint":   {"Only for development and app review. Leave it at No for normal use.", "Nur für Entwicklung und App-Review. Im normalen Betrieb bei Nein lassen."},

	"admin.title":      {"Your account", "Dein Konto"},
	"admin.text":       {"There is nobody in this database yet. You become the first administrator.", "In dieser Datenbank gibt es noch niemanden. Du wirst die erste Administratorin oder der erste Administrator."},
	"admin.name":       {"Your name", "Dein Name"},
	"admin.name.hint":  {"shown in the app, for example on loans", "wird in der App angezeigt, zum Beispiel bei Ausleihen"},
	"admin.email":      {"Your e-mail address", "Deine E-Mail-Adresse"},
	"admin.email.hint": {"you sign in with it; it cannot be changed later", "damit meldest du dich an; sie lässt sich später nicht ändern"},

	"summary.title":      {"Summary", "Zusammenfassung"},
	"summary.save":       {"Save this and start item+?", "So speichern und item+ starten?"},
	"summary.save.yes":   {"Save and start", "Speichern und starten"},
	"summary.save.no":    {"Cancel, change nothing", "Abbrechen, nichts ändern"},
	"sum.reach":          {"Reachable", "Erreichbar"},
	"sum.reach.local":    {"only on this computer, %s", "nur auf diesem Rechner, %s"},
	"sum.reach.lan":      {"in your network, port %d", "in deinem Netz, Port %d"},
	"sum.db":             {"Database", "Datenbank"},
	"sum.db.sqlite":      {"file (SQLite)", "Datei (SQLite)"},
	"sum.db.mysql":       {"MySQL/MariaDB, %s", "MySQL/MariaDB, %s"},
	"sum.mail":           {"Sign-in mails", "Anmelde-Mails"},
	"sum.mail.on":        {"via %s as %s", "über %s als %s"},
	"sum.mail.off":       {"not set up – link in the terminal", "nicht eingerichtet – Link im Terminal"},
	"sum.people":         {"New people", "Neue Personen"},
	"sum.people.auto":    {"active at once", "sofort aktiv"},
	"sum.people.manual":  {"activated by an admin", "werden von einem Admin freigeschaltet"},
	"sum.printer":        {"Label printer", "Etikettendrucker"},
	"sum.none":           {"none", "keiner"},
	"sum.update":         {"Update notice", "Update-Hinweis"},
	"sum.update.off":     {"off – item+ contacts nobody", "aus – item+ fragt niemanden"},
	"sum.update.release": {"new releases (asks api.github.com daily)", "neue Releases (fragt täglich api.github.com)"},
	"sum.update.build":   {"releases and builds (asks api.github.com daily)", "Releases und Builds (fragt täglich api.github.com)"},
	"sum.admin":          {"Administrator", "Administrator"},
	"sum.file":           {"Saved to", "Gespeichert in"},

	"done.title":    {"item+ is set up.", "item+ ist eingerichtet."},
	"done.config":   {"Configuration: %s", "Konfiguration: %s"},
	"done.link":     {"Open this link in your browser to sign in (valid for %d minutes, usable once):", "Öffne diesen Link im Browser, um dich anzumelden (gültig für %d Minuten, einmal verwendbar):"},
	"done.open":     {"Open this address in your browser once item+ has started:", "Öffne diese Adresse im Browser, sobald item+ gestartet ist:"},
	"done.nolink":   {"A sign-in link could not be created (%v). Use \"sign in by e-mail\" on that page.", "Ein Anmeldelink ließ sich nicht erzeugen (%v). Nutze auf der Seite „Per E-Mail anmelden“."},
	"done.nomail":   {"Remember: without a mail account nobody else can sign in yet. Add the SMTP settings to itemplus.conf when you are ready.", "Denk daran: Ohne Postfach kann sich sonst noch niemand anmelden. Trage die SMTP-Angaben in die itemplus.conf ein, wenn du so weit bist."},
	"done.next":     {"Next: create a category, then your first item.", "Als Nächstes: eine Kategorie anlegen, dann dein erstes Item."},
	"done.starting": {"Starting item+ …", "item+ startet …"},
}

// tx returns a setup text in the chosen language, with fmt verbs filled in.
func (l setupLang) tx(key string, args ...any) string {
	entry, ok := setupTexts[key]
	if !ok {
		return key
	}
	text := entry[l]
	if len(args) > 0 {
		return fmt.Sprintf(text, args...)
	}
	return text
}
