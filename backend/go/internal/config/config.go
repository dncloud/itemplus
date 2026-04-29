package config

import (
	"crypto/rand"
	"encoding/base64"
	"log"
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

	CORSOrigins []string

	UploadDir     string
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

var C Config
var defaultAppVersion = "1.0"
var defaultAppBuild = "dev"

func Load() {
	envBaseDir := loadEnv()
	dataDir := defaultDataDir(envBaseDir)
	versionDisplay := sharedVersionDisplay(envBaseDir)

	C = Config{
		AppName:       envStr("APP_NAME", "item+"),
		AppVersion:    envStr("APP_VERSION", versionDisplay),
		AppDomain:     envStr("APP_DOMAIN", ""),
		EnvPath:       filepath.Join(envBaseDir, ".env"),
		DataDir:       dataDir,
		Debug:         envBool("DEBUG"),
		DebugHTTP:     envBool("DEBUG_HTTP"),
		SetupRequired: strings.TrimSpace(os.Getenv("ITEMPLUS_SETUP_REQUIRED")) != "",

		DatabaseURL: normalizeDatabaseURL(envStr("DATABASE_URL", "sqlite+aiosqlite:///"+filepath.Join(dataDir, "itemplus.db")), envBaseDir),

		JWTSecret:     envStr("JWT_SECRET", ""),
		JWTAlgorithm:  envStr("JWT_ALGORITHM", "HS256"),
		JWTExpiryDays: envInt("JWT_EXPIRY_DAYS", 30),

		AppleBundleID: envStr("APPLE_BUNDLE_ID", ""),

		CORSOrigins: envList("CORS_ORIGINS", []string{"*"}),

		UploadDir:     resolveAbsolutePath(envStr("UPLOAD_DIR", filepath.Join(dataDir, "uploads")), envBaseDir),
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
		Port: envInt("PORT", 8000),
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

	if C.MagicLinkBaseURL == "" {
		log.Println("Warning: MAGIC_LINK_BASE_URL not set and no APP_DOMAIN configured")
	}

	if !filepath.IsAbs(C.UploadDir) {
		log.Fatal("UPLOAD_DIR must be an absolute path outside the application directory")
	}

	if C.JWTSecret == "" {
		C.JWTSecret = getOrCreateSecret(filepath.Join(dataDir, ".jwt_secret"))
	}

	ensureRuntimePaths()
}

func loadEnv() string {
	execDir := executableDir()
	cwd, _ := os.Getwd()

	candidates := []string{
		filepath.Join(cwd, "data", ".env"),
		filepath.Join(cwd, ".env"),
		filepath.Join(execDir, "data", ".env"),
		filepath.Join(execDir, ".env"),
	}

	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if _, err := os.Stat(candidate); err == nil {
			_ = godotenv.Load(candidate)
			return filepath.Dir(candidate)
		}
	}

	dataDir := defaultDataDir(execDir)
	envPath := filepath.Join(dataDir, ".env")
	templatePath := findDefaultEnvTemplate(execDir, cwd)

	if err := ensureEnvFileFromTemplate(envPath, templatePath); err != nil {
		log.Fatalf("Failed to create %s: %v", envPath, err)
	}

	_ = godotenv.Load(envPath)
	return filepath.Dir(envPath)
}

func findDefaultEnvTemplate(execDir, cwd string) string {
	for _, candidate := range sharedConfigCandidates("config", "default.env", cwd, execDir) {
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
		if strings.TrimSpace(embeddedDefaultEnv) == "" {
			return os.ErrNotExist
		}
		data = []byte(embeddedDefaultEnv)
	}
	if err := os.MkdirAll(filepath.Dir(envPath), 0755); err != nil {
		return err
	}
	if err := os.WriteFile(envPath, data, 0644); err != nil {
		return err
	}
	log.Printf("Created %s from the shared default configuration", envPath)
	log.Printf("Using the default configuration for now. Edit %s if you want to change domain, SMTP, printer, or storage settings.", envPath)
	return nil
}

func envStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envBool(key string) bool {
	v := strings.ToLower(os.Getenv(key))
	return v == "true" || v == "1"
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func envInt64(key string, fallback int64) int64 {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
	}
	return fallback
}

func envFloat(key string, fallback float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return fallback
}

func envList(key string, fallback []string) []string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	v = strings.Trim(v, "[]")
	var items []string
	for _, s := range strings.Split(v, ",") {
		s = strings.Trim(strings.TrimSpace(s), `"'`)
		if s != "" {
			items = append(items, s)
		}
	}
	return items
}

func getOrCreateSecret(path string) string {
	_ = os.MkdirAll(filepath.Dir(path), 0755)
	if data, err := os.ReadFile(path); err == nil {
		return strings.TrimSpace(string(data))
	}
	b := make([]byte, 48)
	if _, err := rand.Read(b); err != nil {
		log.Fatal("Failed to generate JWT secret")
	}
	secret := base64.URLEncoding.EncodeToString(b)
	_ = os.WriteFile(path, []byte(secret), 0600)
	return secret
}

func executableDir() string {
	exePath, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(exePath)
}

func defaultDataDir(baseDir string) string {
	if v := strings.TrimSpace(os.Getenv("ITEMPLUS_DATA_DIR")); v != "" {
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
	const sqlitePrefix = "sqlite+aiosqlite:///"
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
	const sqlitePrefix = "sqlite+aiosqlite:///"
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
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			key, value, ok := strings.Cut(line, "=")
			if !ok {
				continue
			}
			key = strings.TrimSpace(key)
			value = strings.TrimSpace(value)
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
		ref := strings.TrimSpace(string(head))
		if strings.HasPrefix(ref, "ref: ") {
			refPath := filepath.Join(repoRoot, ".git", strings.TrimPrefix(ref, "ref: "))
			refData, err := os.ReadFile(refPath)
			if err != nil {
				continue
			}
			hash := strings.TrimSpace(string(refData))
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
