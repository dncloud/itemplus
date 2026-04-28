//go:build seedtool

package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"runtime"
	"strings"

	huh "charm.land/huh/v2"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/seed"
)

func main() {
	reset := flag.Bool("reset", false, "Delete existing item+, user, and checkout data before seeding")
	baseURL := flag.String("base-url", "", "Base URL used when printing demo magic links (default: MAGIC_LINK_BASE_URL or http://127.0.0.1:3000)")
	lang := flag.String("lang", "", "Seed language: en or de")
	flag.Parse()

	config.Load()
	database.Connect()

	locale := resolveLang(*lang)
	adminName, adminEmail := promptAdminIdentity(locale)

	fmt.Printf("Database: %s\n", config.C.DatabaseURL)
	fmt.Printf("Uploads:  %s\n", config.C.UploadDir)
	fmt.Println()

	opts := seed.Options{
		Reset:      *reset,
		BaseURL:    *baseURL,
		Stdout:     os.Stdout,
		AdminName:  adminName,
		AdminEmail: adminEmail,
		Lang:       locale,
		Preset:     "curated",
	}

	if err := seed.Run(opts); err != nil {
		log.Fatal(err)
	}

	fmt.Println()
	if locale == "de" {
		fmt.Println("Demo-Seed erfolgreich abgeschlossen.")
	} else {
		fmt.Println("Demo seed finished successfully.")
	}
}

func promptAdminIdentity(lang string) (string, string) {
	name := ""
	email := ""

	clearTerminal()
	fmt.Println()
	fmt.Println()

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewNote().
				Title(seedText(lang, "welcomeTitle")).
				Description(seedText(lang, "welcomeDescription")),
			huh.NewInput().
				Title(seedText(lang, "adminNameTitle")).
				Description(seedText(lang, "adminNameDescription")).
				Value(&name),
			huh.NewInput().
				Title(seedText(lang, "adminEmailTitle")).
				Description(seedText(lang, "adminEmailDescription")).
				Value(&email).
				Validate(func(value string) error { return validateEmail(lang, value) }),
		),
	).WithShowHelp(false).WithTheme(huh.ThemeFunc(huh.ThemeBase16))

	if err := form.Run(); err != nil {
		log.Fatal(err)
	}

	fmt.Println()
	if lang == "de" {
		fmt.Printf("Verwende Admin-Konto: %s <%s>\n", name, email)
	} else {
		fmt.Printf("Using admin account: %s <%s>\n", name, email)
	}
	fmt.Println()

	return name, email
}

func validateEmail(lang, value string) error {
	value = strings.TrimSpace(value)
	if strings.Contains(value, "@") && !strings.HasPrefix(value, "@") && !strings.HasSuffix(value, "@") {
		return nil
	}
	if lang == "de" {
		return fmt.Errorf("bitte gib eine gültige E-Mail-Adresse ein")
	}
	return fmt.Errorf("please enter a valid email address")
}

func normalizeLang(lang string) string {
	switch strings.ToLower(strings.TrimSpace(lang)) {
	case "de":
		return "de"
	default:
		return "en"
	}
}

func resolveLang(flagValue string) string {
	flagValue = strings.TrimSpace(flagValue)
	if flagValue != "" {
		return normalizeLang(flagValue)
	}

	lang := "en"

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewSelect[string]().
				Title("Demo language").
				Description("Choose the language for the setup flow and demo data.").
				Value(&lang).
				Options(
					huh.NewOption("English", "en"),
					huh.NewOption("Deutsch", "de"),
				),
		),
	).WithShowHelp(false).WithTheme(huh.ThemeFunc(huh.ThemeBase16))

	if err := form.Run(); err != nil {
		log.Fatal(err)
	}

	return normalizeLang(lang)
}

func seedText(lang, key string) string {
	texts := map[string]map[string]string{
		"en": {
			"welcomeTitle":          "Welcome to the item+ demo seed",
			"welcomeDescription":    "Let's create a realistic demo dataset and set up the first admin account.",
			"adminNameTitle":        "Admin display name",
			"adminNameDescription":  "This account becomes the first admin user.",
			"adminEmailTitle":       "Admin email",
			"adminEmailDescription": "Used for magic-link login in the demo environment.",
		},
		"de": {
			"welcomeTitle":          "Willkommen beim item+ Demo-Seed",
			"welcomeDescription":    "Wir richten jetzt realistische Demo-Daten ein und legen das erste Admin-Konto an.",
			"adminNameTitle":        "Admin-Anzeigename",
			"adminNameDescription":  "Dieses Konto wird der erste Admin-Benutzer.",
			"adminEmailTitle":       "Admin-E-Mail",
			"adminEmailDescription": "Wird für die Magic-Link-Anmeldung in der Demo verwendet.",
		},
	}
	if value, ok := texts[lang][key]; ok {
		return value
	}
	return texts["en"][key]
}

func clearTerminal() {
	if runtime.GOOS == "windows" {
		fmt.Print("\033[2J\033[H")
		return
	}
	fmt.Print("\033[2J\033[H")
}
