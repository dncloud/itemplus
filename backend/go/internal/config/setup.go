package config

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
)

type SetupValues struct {
	AppDomain        string `json:"app_domain"`
	MagicLinkBaseURL string `json:"magic_link_base_url"`
	AutoActivated    bool   `json:"auto_activated"`
	CORSOrigins      string `json:"cors_origins"`
	TrustedProxies   string `json:"trusted_proxies"`
	DatabaseURL      string `json:"database_url"`
	UploadDir        string `json:"upload_dir"`
	LogDir           string `json:"log_dir"`
	AdminDisplayName string `json:"admin_display_name"`
	AdminEmail       string `json:"admin_email"`
	PrinterHost      string `json:"printer_host"`
	PrinterPort      int    `json:"printer_port"`
	SMTPHost         string `json:"smtp_host"`
	SMTPPort         int    `json:"smtp_port"`
	SMTPUser         string `json:"smtp_user"`
	SMTPPassword     string `json:"smtp_password"`
	SMTPFromEmail    string `json:"smtp_from_email"`
	SMTPFromName     string `json:"smtp_from_name"`
	SMTPUseTLS       bool   `json:"smtp_use_tls"`
	Host             string `json:"host"`
	Port             int    `json:"port"`
}

func CurrentSetupValues() SetupValues {
	corsJSON, _ := json.Marshal(C.CORSOrigins)
	return SetupValues{
		AppDomain:        C.AppDomain,
		MagicLinkBaseURL: C.MagicLinkBaseURL,
		AutoActivated:    C.AutoActivated,
		CORSOrigins:      string(corsJSON),
		TrustedProxies:   strings.Join(C.TrustedProxies, ","),
		DatabaseURL:      C.DatabaseURL,
		UploadDir:        C.UploadDir,
		LogDir:           C.LogDir,
		PrinterHost:      C.PrinterHost,
		PrinterPort:      C.PrinterPort,
		SMTPHost:         C.SMTPHost,
		SMTPPort:         C.SMTPPort,
		SMTPUser:         C.SMTPUser,
		SMTPPassword:     C.SMTPPassword,
		SMTPFromEmail:    C.SMTPFromEmail,
		SMTPFromName:     C.SMTPFromName,
		SMTPUseTLS:       C.SMTPUseTLS,
		Host:             C.Host,
		Port:             C.Port,
	}
}

func SaveSetupValues(values SetupValues, complete bool) error {
	updates := map[string]string{
		"APP_DOMAIN":                strings.TrimSpace(values.AppDomain),
		"MAGIC_LINK_BASE_URL":       strings.TrimSpace(values.MagicLinkBaseURL),
		"AUTO_ACTIVATED":            strconv.FormatBool(values.AutoActivated),
		"CORS_ORIGINS":              strings.TrimSpace(values.CORSOrigins),
		"TRUSTED_PROXIES":           strings.TrimSpace(values.TrustedProxies),
		"DATABASE_URL":              strings.TrimSpace(values.DatabaseURL),
		"UPLOAD_DIR":                strings.TrimSpace(values.UploadDir),
		"LOG_DIR":                   strings.TrimSpace(values.LogDir),
		"PRINTER_HOST":              strings.TrimSpace(values.PrinterHost),
		"PRINTER_PORT":              strconv.Itoa(values.PrinterPort),
		"SMTP_HOST":                 strings.TrimSpace(values.SMTPHost),
		"SMTP_PORT":                 strconv.Itoa(values.SMTPPort),
		"SMTP_USER":                 strings.TrimSpace(values.SMTPUser),
		"SMTP_PASSWORD":             values.SMTPPassword,
		"SMTP_FROM_EMAIL":           strings.TrimSpace(values.SMTPFromEmail),
		"SMTP_FROM_NAME":            strings.TrimSpace(values.SMTPFromName),
		"SMTP_USE_TLS":              strconv.FormatBool(values.SMTPUseTLS),
		"HOST":                      strings.TrimSpace(values.Host),
		"PORT":                      strconv.Itoa(values.Port),
		"MAGIC_LINK_EXPIRY_MINUTES": strconv.Itoa(C.MagicLinkExpiryMinutes),
	}

	if updates["CORS_ORIGINS"] == "" {
		updates["CORS_ORIGINS"] = `["*"]`
	}
	if updates["PRINTER_PORT"] == "0" {
		updates["PRINTER_PORT"] = "9100"
	}
	if updates["SMTP_PORT"] == "0" {
		updates["SMTP_PORT"] = "465"
	}
	if updates["HOST"] == "" {
		updates["HOST"] = "0.0.0.0"
	}
	if updates["PORT"] == "0" {
		updates["PORT"] = strconv.Itoa(DefaultPort)
	}

	removeKeys := []string{}
	if complete {
		removeKeys = append(removeKeys, "ITEMPLUS_SETUP_REQUIRED")
	}

	if err := updateConfigFile(C.EnvPath, updates, removeKeys); err != nil {
		return err
	}
	if complete {
		_ = os.Unsetenv("ITEMPLUS_SETUP_REQUIRED")
	}
	return nil
}

func updateConfigFile(path string, updates map[string]string, removeKeys []string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	removeSet := map[string]bool{}
	for _, key := range removeKeys {
		removeSet[key] = true
	}

	lines := strings.Split(string(data), "\n")
	seen := map[string]bool{}
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		key, _, ok := strings.Cut(trimmed, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		if removeSet[key] {
			lines[i] = ""
			seen[key] = true
			continue
		}
		value, hasUpdate := updates[key]
		if hasUpdate {
			lines[i] = fmt.Sprintf("%s=%s", key, value)
			seen[key] = true
		}
	}

	appendOrder := []string{
		"APP_DOMAIN",
		"MAGIC_LINK_BASE_URL",
		"AUTO_ACTIVATED",
		"CORS_ORIGINS",
		"TRUSTED_PROXIES",
		"DATABASE_URL",
		"UPLOAD_DIR",
		"LOG_DIR",
		"PRINTER_HOST",
		"PRINTER_PORT",
		"SMTP_HOST",
		"SMTP_PORT",
		"SMTP_USER",
		"SMTP_PASSWORD",
		"SMTP_FROM_EMAIL",
		"SMTP_FROM_NAME",
		"SMTP_USE_TLS",
		"HOST",
		"PORT",
	}
	for _, key := range appendOrder {
		if seen[key] {
			continue
		}
		if value, ok := updates[key]; ok {
			lines = append(lines, fmt.Sprintf("%s=%s", key, value))
		}
	}

	content := strings.Join(lines, "\n")
	content = strings.ReplaceAll(content, "\n\n\n", "\n\n")
	return os.WriteFile(path, []byte(content), 0644)
}
