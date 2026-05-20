package config

import (
	"crypto/rand"
	"encoding/base64"
	"log"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	AppName       string
	AppVersion    string
	AppDomain     string // e.g. "itemplus.example.ltd"
	EnvPath       string
	DataDir       string
	Debug         bool
	DebugHTTP     bool
	SetupRequired bool

	DatabaseURL string

	JWTSecret     string
	JWTAlgorithm  string
	JWTExpiryDays int

	AppleBundleID string // Required for aud validation on Apple Sign-In tokens

	CORSOrigins    []string
	TrustedProxies []string

	UploadDir     string
	LogDir        string
	MaxUploadSize int64

	PrinterHost string
	PrinterPort int

	SMTPHost               string
	SMTPPort               int
	SMTPUser               string
	SMTPPassword           string
	SMTPFromEmail          string
	SMTPFromName           string
	SMTPUseTLS             bool
	MagicLinkExpiryMinutes int
	MagicLinkBaseURL       string

	Host string
	Port int
}

const DefaultPort = 17117

var C Config
var defaultAppVersion = "1.2"
var defaultAppBuild = "dev"
var cliConfigPath string

const sqlitePrefix = "sqlite+aiosqlite:///"

var managedConfigEnvKeys = []string{
	"APP_NAME",
	"APP_VERSION",
	"APP_DOMAIN",
	"DEBUG",
	"DEBUG_HTTP",
	"DATABASE_URL",
	"JWT_SECRET",
	"JWT_ALGORITHM",
	"JWT_EXPIRY_DAYS",
	"CORS_ORIGINS",
	"TRUSTED_PROXIES",
	"UPLOAD_DIR",
	"LOG_DIR",
	"MAX_UPLOAD_SIZE",
	"PRINTER_HOST",
	"PRINTER_PORT",
	"SMTP_HOST",
	"SMTP_PORT",
	"SMTP_USER",
	"SMTP_PASSWORD",
	"SMTP_FROM_EMAIL",
	"SMTP_FROM_NAME",
	"SMTP_USE_TLS",
	"MAGIC_LINK_EXPIRY_MINUTES",
	"MAGIC_LINK_BASE_URL",
	"HOST",
	"PORT",
	"ITEMPLUS_SETUP_REQUIRED",
}

func SetConfigPath(path string) {
	cliConfigPath = trimSpace(path)
}

func configBaseDir() string {
	if trimSpace(C.EnvPath) != "" {
		return filepath.Dir(C.EnvPath)
	}
	return executableDir()
}

func SetUploadDir(path string) error {
	path = trimSpace(path)
	if path == "" {
		return nil
	}
	C.UploadDir = resolveAbsolutePath(path, configBaseDir())
	_ = os.MkdirAll(C.UploadDir, 0755)
	return nil
}

func SetDatabaseURL(rawURL string) error {
	rawURL = trimSpace(rawURL)
	if rawURL == "" {
		return nil
	}
	C.DatabaseURL = ResolvedDatabaseURL(rawURL)
	return nil
}

func ResolvedDatabaseURL(rawURL string) string {
	rawURL = trimSpace(rawURL)
	if rawURL == "" {
		return C.DatabaseURL
	}
	return normalizeDatabaseURL(rawURL, configBaseDir())
}

func SetLogDir(path string) error {
	path = trimSpace(path)
	if path == "" {
		return nil
	}
	C.LogDir = resolveAbsolutePath(path, configBaseDir())
	_ = os.MkdirAll(C.LogDir, 0755)
	return nil
}

func RequestCameThroughTrustedProxy(remoteAddr string) bool {
	if len(C.TrustedProxies) == 0 {
		return false
	}
	host := trimSpace(remoteAddr)
	if h, _, err := net.SplitHostPort(remoteAddr); err == nil {
		host = h
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	for _, candidate := range C.TrustedProxies {
		candidate = trimSpace(candidate)
		if candidate == "" {
			continue
		}
		if ip2 := net.ParseIP(candidate); ip2 != nil && ip.Equal(ip2) {
			return true
		}
		if _, cidr, err := net.ParseCIDR(candidate); err == nil && cidr.Contains(ip) {
			return true
		}
	}
	return false
}

func Load() {
	envPath, envBaseDir := loadEnv()
	dataDir := defaultDataDir(envBaseDir)
	versionDisplay := sharedVersionDisplay(envBaseDir)

	C = Config{
		AppName:       envStr("APP_NAME", "item+"),
		AppVersion:    envStr("APP_VERSION", versionDisplay),
		AppDomain:     envStr("APP_DOMAIN", ""),
		EnvPath:       envPath,
		DataDir:       dataDir,
		Debug:         envBool("DEBUG"),
		DebugHTTP:     envBool("DEBUG_HTTP"),
		SetupRequired: envStr("ITEMPLUS_SETUP_REQUIRED", "") != "",

		DatabaseURL: normalizeDatabaseURL(envStr("DATABASE_URL", "sqlite+aiosqlite:///"+filepath.Join(dataDir, "itemplus.db")), envBaseDir),

		JWTSecret:     envStr("JWT_SECRET", ""),
		JWTAlgorithm:  envStr("JWT_ALGORITHM", "HS256"),
		JWTExpiryDays: envInt("JWT_EXPIRY_DAYS", 30),

		AppleBundleID: "de.devicenull.itemplus",

		CORSOrigins:    envList("CORS_ORIGINS", []string{"*"}),
		TrustedProxies: envList("TRUSTED_PROXIES", nil),

		UploadDir:     resolveAbsolutePath(envStr("UPLOAD_DIR", filepath.Join(dataDir, "uploads")), envBaseDir),
		LogDir:        resolveAbsolutePath(envStr("LOG_DIR", filepath.Join(dataDir, "..", "logs")), envBaseDir),
		MaxUploadSize: envInt64("MAX_UPLOAD_SIZE", 200*1024*1024), // 200 MB default

		PrinterHost: envStr("PRINTER_HOST", ""),
		PrinterPort: envInt("PRINTER_PORT", 9100),

		SMTPHost:               envStr("SMTP_HOST", ""),
		SMTPPort:               envInt("SMTP_PORT", 465),
		SMTPUser:               envStr("SMTP_USER", ""),
		SMTPPassword:           envStr("SMTP_PASSWORD", ""),
		SMTPFromEmail:          envStr("SMTP_FROM_EMAIL", ""),
		SMTPFromName:           envStr("SMTP_FROM_NAME", "item+"),
		SMTPUseTLS:             envBool("SMTP_USE_TLS"),
		MagicLinkExpiryMinutes: envInt("MAGIC_LINK_EXPIRY_MINUTES", 15),
		MagicLinkBaseURL:       envStr("MAGIC_LINK_BASE_URL", ""),

		Host: envStr("HOST", "0.0.0.0"),
		Port: envInt("PORT", DefaultPort),
	}

	// Derive defaults from APP_DOMAIN (strip protocol if provided)
	C.AppDomain = strings.TrimPrefix(strings.TrimPrefix(C.AppDomain, "https://"), "http://")
	C.AppDomain = strings.TrimRight(C.AppDomain, "/")
	if C.AppDomain != "" {
		baseURL := "https://" + C.AppDomain
		if C.MagicLinkBaseURL == "" {
			C.MagicLinkBaseURL = baseURL
		}
		// Auto-add domain to CORS origins
		hasOrigin := false
		for _, o := range C.CORSOrigins {
			if o == "*" || o == baseURL {
				hasOrigin = true
				break
			}
		}
		if !hasOrigin {
			C.CORSOrigins = append(C.CORSOrigins, baseURL)
		}
	}

	if C.MagicLinkBaseURL == "" && !C.SetupRequired && C.SMTPHost != "" && C.SMTPFromEmail != "" {
		log.Println("Warning: MAGIC_LINK_BASE_URL not set and no APP_DOMAIN configured")
	}

	if C.JWTSecret == "" {
		C.JWTSecret = ensureJWTSecretInConfig(C.EnvPath)
	}

	ensureRuntimePaths()
}

func loadEnv() (string, string) {
	execDir := executableDir()
	cwd, _ := os.Getwd()

	// Reload managed flags from the config file instead of keeping stale process
	// environment values across setup completion or self-restarts.
	_ = os.Unsetenv("ITEMPLUS_SETUP_REQUIRED")

	candidates := []string{
		cliConfigPath,
		filepath.Join(cwd, "itemplus.conf"),
		filepath.Join(execDir, "itemplus.conf"),
	}

	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if _, err := os.Stat(candidate); err == nil {
			clearManagedConfigEnv()
			_ = godotenv.Load(candidate)
			return candidate, filepath.Dir(candidate)
		}
	}

	envPath := cliConfigPath
	if envPath == "" {
		envPath = filepath.Join(execDir, "itemplus.conf")
	}
	templatePath := findDefaultConfigTemplate(execDir, cwd)

	if err := ensureEnvFileFromTemplate(envPath, templatePath); err != nil {
		log.Fatalf("Failed to create %s: %v", envPath, err)
	}

	clearManagedConfigEnv()
	_ = godotenv.Load(envPath)
	return envPath, filepath.Dir(envPath)
}

func clearManagedConfigEnv() {
	for _, key := range managedConfigEnvKeys {
		_ = os.Unsetenv(key)
	}
}

func findDefaultConfigTemplate(execDir, cwd string) string {
	for _, candidate := range sharedConfigCandidates("config", "itemplus.conf", cwd, execDir) {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}

	return ""
}

func ensureEnvFileFromTemplate(envPath, templatePath string) error {
	if _, err := os.Stat(envPath); err == nil {
		return nil
	}

	var data []byte
	if templatePath != "" {
		if readData, err := os.ReadFile(templatePath); err == nil {
			data = readData
		}
	}
	if len(data) == 0 {
		if strings.TrimSpace(embeddedDefaultConfig) == "" {
			return os.ErrNotExist
		}
		data = []byte(embeddedDefaultConfig)
	}
	if err := os.MkdirAll(filepath.Dir(envPath), 0755); err != nil {
		return err
	}
	if err := os.WriteFile(envPath, data, 0644); err != nil {
		return err
	}
	log.Printf("Created %s from the shared default configuration", envPath)
	return nil
}

func envStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func trimSpace(value string) string {
	return strings.TrimSpace(value)
}

func envStrTrimmed(key, fallback string) string {
	if v := trimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func envBool(key string) bool {
	v := strings.ToLower(envStrTrimmed(key, ""))
	return v == "true" || v == "1"
}

func envInt(key string, fallback int) int {
	if v := envStrTrimmed(key, ""); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func envInt64(key string, fallback int64) int64 {
	if v := envStrTrimmed(key, ""); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
	}
	return fallback
}

func envFloat(key string, fallback float64) float64 {
	if v := envStrTrimmed(key, ""); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return fallback
}

func envList(key string, fallback []string) []string {
	v := envStrTrimmed(key, "")
	if v == "" {
		return fallback
	}
	v = strings.Trim(v, "[]")
	var items []string
	for _, s := range strings.Split(v, ",") {
		s = strings.Trim(trimSpace(s), `"'`)
		if s != "" {
			items = append(items, s)
		}
	}
	return items
}

func getOrCreateSecret(path string) string {
	_ = os.MkdirAll(filepath.Dir(path), 0755)
	if data, err := os.ReadFile(path); err == nil {
		return trimSpace(string(data))
	}
	secret := generateSecret()
	_ = os.WriteFile(path, []byte(secret), 0600)
	return secret
}

func generateSecret() string {
	b := make([]byte, 48)
	if _, err := rand.Read(b); err != nil {
		log.Fatal("Failed to generate JWT secret")
	}
	return base64.URLEncoding.EncodeToString(b)
}

func ensureJWTSecretInConfig(configPath string) string {
	secret := generateSecret()
	if err := persistJWTSecret(configPath, secret); err != nil {
		log.Printf("Warning: failed to persist JWT_SECRET into %s: %v", configPath, err)
	}
	return secret
}

func persistJWTSecret(configPath, secret string) error {
	return persistConfigValue(configPath, "JWT_SECRET", secret)
}

func persistConfigValue(configPath, key, value string) error {
	if trimSpace(configPath) == "" || trimSpace(key) == "" || trimSpace(value) == "" {
		return nil
	}
	info, statErr := os.Stat(configPath)
	if statErr != nil {
		return statErr
	}
	data, err := os.ReadFile(configPath)
	if err != nil {
		return err
	}
	lines := strings.Split(string(data), "\n")
	updated := false
	for i, line := range lines {
		trimmed := trimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		existingKey, existingValue, ok := strings.Cut(trimmed, "=")
		if ok && trimSpace(existingKey) == key {
			if trimSpace(existingValue) != "" {
				return nil
			}
			lines[i] = key + "=" + value
			updated = true
			break
		}
	}

	var content string
	if updated {
		content = strings.Join(lines, "\n")
	} else {
		content = strings.TrimRight(string(data), "\n")
		if content != "" {
			content += "\n"
		}
		content += key + "=" + value + "\n"
	}
	return os.WriteFile(configPath, []byte(content), info.Mode().Perm())
}

func executableDir() string {
	exePath, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(exePath)
}

func defaultDataDir(baseDir string) string {
	if v := envStrTrimmed("ITEMPLUS_DATA_DIR", ""); v != "" {
		if filepath.IsAbs(v) {
			return filepath.Clean(v)
		}
		return filepath.Clean(filepath.Join(baseDir, v))
	}
	if filepath.Base(baseDir) == "data" {
		return filepath.Clean(baseDir)
	}
	return filepath.Join(baseDir, "data")
}

func resolveAbsolutePath(pathValue, baseDir string) string {
	if pathValue == "" {
		return ""
	}
	if filepath.IsAbs(pathValue) {
		return filepath.Clean(pathValue)
	}
	return filepath.Clean(filepath.Join(baseDir, pathValue))
}

func normalizeDatabaseURL(rawURL, baseDir string) string {
	if !strings.HasPrefix(rawURL, sqlitePrefix) {
		return rawURL
	}
	pathPart := strings.TrimPrefix(rawURL, sqlitePrefix)
	if pathPart == "" {
		return rawURL
	}
	if filepath.IsAbs(pathPart) {
		return sqlitePrefix + filepath.Clean(pathPart)
	}
	return sqlitePrefix + filepath.Clean(filepath.Join(baseDir, pathPart))
}

func ensureRuntimePaths() {
	_ = os.MkdirAll(C.UploadDir, 0755)
	_ = os.MkdirAll(C.LogDir, 0755)
	if strings.HasPrefix(C.DatabaseURL, sqlitePrefix) {
		dbPath := strings.TrimPrefix(C.DatabaseURL, sqlitePrefix)
		if dbPath != "" {
			_ = os.MkdirAll(filepath.Dir(dbPath), 0755)
		}
	}
}

func sharedVersionDisplay(baseDir string) string {
	appVersion := defaultAppVersion
	appBuild := defaultAppBuild

	for _, candidate := range versionFileCandidates(baseDir) {
		data, err := os.ReadFile(candidate)
		if err != nil {
			continue
		}
		for _, line := range strings.Split(string(data), "\n") {
			line = trimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			key, value, ok := strings.Cut(line, "=")
			if !ok {
				continue
			}
			key = trimSpace(key)
			value = trimSpace(value)
			switch key {
			case "APP_VERSION":
				if value != "" {
					appVersion = value
				}
			case "APP_BUILD":
				if value != "" {
					appBuild = value
				}
			}
		}
		break
	}

	if appBuild == "dev" {
		if gitBuild := gitShortCommit(baseDir); gitBuild != "" {
			appBuild = gitBuild
		}
	}

	return appVersion + " build " + appBuild
}

func versionFileCandidates(baseDir string) []string {
	cwd, _ := os.Getwd()
	execDir := executableDir()

	return sharedFileCandidates("VERSION", cwd, execDir, baseDir)
}

func sharedConfigCandidates(parts ...string) []string {
	cwd, _ := os.Getwd()
	execDir := executableDir()
	return sharedFileCandidates(filepath.Join(parts...), cwd, execDir)
}

func sharedFileCandidates(relativePath string, starts ...string) []string {
	candidates := []string{}
	seen := map[string]bool{}
	add := func(path string) {
		if path == "" || seen[path] {
			return
		}
		seen[path] = true
		candidates = append(candidates, path)
	}

	for _, start := range starts {
		dir := filepath.Clean(start)
		for {
			add(filepath.Join(dir, relativePath))
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
			dir = parent
		}
	}

	return candidates
}

func gitShortCommit(baseDir string) string {
	for _, candidate := range versionFileCandidates(baseDir) {
		repoRoot := filepath.Dir(candidate)
		headPath := filepath.Join(repoRoot, ".git", "HEAD")
		if _, err := os.Stat(headPath); err != nil {
			continue
		}

		head, err := os.ReadFile(headPath)
		if err != nil {
			continue
		}
		ref := trimSpace(string(head))
		if strings.HasPrefix(ref, "ref: ") {
			refPath := filepath.Join(repoRoot, ".git", strings.TrimPrefix(ref, "ref: "))
			refData, err := os.ReadFile(refPath)
			if err != nil {
				continue
			}
			hash := trimSpace(string(refData))
			if len(hash) >= 7 {
				return hash[:7]
			}
			return hash
		}
		if len(ref) >= 7 {
			return ref[:7]
		}
		return ref
	}

	return ""
}
