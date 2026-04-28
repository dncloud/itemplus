//go:build !seedtool

package main

import (
	"compress/gzip"
	"context"
	"embed"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/bootstrap"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/handlers"
	_ "github.com/itemplus/backend/internal/middleware"
	"github.com/itemplus/backend/internal/storage"
)

//go:embed all:build/webapp
var webappFS embed.FS

const banner = `▄▄ ▄▄▄▄▄▄ ▄▄▄▄▄ ▄▄   ▄▄   ▄   
██   ██   ██▄▄  ██▀▄▀██ ▄▄█▄▄ 
██   ██   ██▄▄▄ ██   ██   █ 
  
`

func main() {
	// CLI flags
	bindFlag := flag.String("bind", "", "Bind address (e.g. 0.0.0.0, 172.20.20.2)")
	portFlag := flag.Int("port", 0, "API port (default: from .env or 8000)")
	noWebapp := flag.Bool("no-webapp", false, "API-only mode (don't start embedded WebApp)")
	flag.Parse()

	config.Load()

	if config.C.SetupRequired {
		log.Println("Default configuration detected.")
		log.Printf("Before starting item+, please review %s", config.C.EnvPath)
		log.Println("When you are happy with the settings, remove the ITEMPLUS_SETUP_REQUIRED line and start the server again.")
		log.Println("The generated defaults are fine for orientation, but they may not match your real domain, SMTP, upload, or printer setup.")
		os.Exit(1)
	}

	// Setup logging
	logFile := setupLogging()
	if logFile != nil {
		defer logFile.Close()
	}

	// Banner
	fmt.Print(banner)
	log.Printf("Version %s", config.C.AppVersion)
	if config.C.AppDomain != "" {
		log.Printf("Domain: %s", config.C.AppDomain)
	}
	log.Println()

	database.Connect()
	log.Println("Database connected")

	bootstrap.EnsureInitialAdmin()

	// CLI flags override config
	if *bindFlag != "" {
		config.C.Host = *bindFlag
	}
	if *portFlag > 0 {
		config.C.Port = *portFlag
	}

	if !config.C.Debug {
		gin.SetMode(gin.ReleaseMode)
	}

	_ = os.MkdirAll(config.C.UploadDir, 0755)

	// Check port
	apiAddr := fmt.Sprintf("%s:%d", config.C.Host, config.C.Port)
	if !portAvailable(config.C.Host, config.C.Port) {
		log.Fatalf("Port %d is already in use", config.C.Port)
	}

	// Start embedded WebApp
	webappPort := 0
	var webappCmd *exec.Cmd
	webappURL := os.Getenv("WEBAPP_URL")

	var webappTmpDir string
	if *noWebapp {
		log.Println("API-only mode (--no-webapp)")
	} else if webappURL == "" {
		webappPort = config.C.Port + 1
		if envPort := os.Getenv("WEBAPP_PORT"); envPort != "" {
			fmt.Sscanf(envPort, "%d", &webappPort)
		}
		webappCmd, webappTmpDir = startEmbeddedWebApp(webappPort)
		if webappCmd != nil {
			webappURL = fmt.Sprintf("http://127.0.0.1:%d", webappPort)
			defer func() {
				webappCmd.Process.Signal(syscall.SIGTERM)
				webappCmd.Wait()
				if webappTmpDir != "" {
					os.RemoveAll(webappTmpDir)
				}
			}()
		}
	}

	r := gin.New()
	r.Use(gin.Recovery())

	// Access log (skip Next.js RSC prefetch noise)
	r.Use(func(c *gin.Context) {
		start := time.Now()
		c.Next()

		// Skip RSC prefetch requests from logs
		if c.Request.URL.Query().Has("_rsc") {
			return
		}

		latency := time.Since(start)
		status := c.Writer.Status()
		method := c.Request.Method
		path := c.Request.URL.Path
		if c.Request.URL.RawQuery != "" {
			path += "?" + c.Request.URL.RawQuery
		}
		ip := c.ClientIP()
		log.Printf("%s %3d %12s  %s %s", ip, status, latency.Round(time.Microsecond), method, path)
	})

	// CORS
	r.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" {
			origin = "*"
		}
		allowed := false
		for _, o := range config.C.CORSOrigins {
			if o == "*" || o == origin {
				allowed = true
				break
			}
		}
		if allowed {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Origin, Authorization, Accept, Content-Type")
			// Only allow credentials when a specific origin matches (not wildcard)
			if origin != "*" {
				c.Header("Access-Control-Allow-Credentials", "true")
			}
		}
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Serve uploads with security headers
	r.GET("/uploads/*filepath", func(c *gin.Context) {
		cleanRelPath, fullPath, err := storage.ResolveUploadPath(config.C.UploadDir, c.Param("filepath"))
		if err != nil {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}

		ext := strings.ToLower(filepath.Ext(cleanRelPath))
		filename := filepath.Base(cleanRelPath)

		// Determine Content-Disposition based on file type
		inlineTypes := map[string]bool{
			// Images
			".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true, ".svg": true, ".bmp": true, ".heic": true,
			// Video
			".mp4": true, ".mov": true, ".avi": true, ".mkv": true, ".webm": true,
			// Audio
			".mp3": true, ".wav": true, ".flac": true, ".ogg": true, ".m4a": true, ".aac": true,
			// PDF
			".pdf": true,
		}

		if inlineTypes[ext] {
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
		} else {
			c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
		}
		c.Header("X-Content-Type-Options", "nosniff")

		c.File(fullPath)
	})

	if webappURL == "" {
		r.GET("/", handlers.Root)
	}

	handlers.RegisterWebSocketRoute(r)

	api := r.Group("/api")
	{
		api.GET("/health", handlers.Health)
		api.GET("/branding", handlers.GetBranding)

		for _, realm := range []string{"archive", "collection"} {
			rg := api.Group("/" + realm)
			handlers.RegisterCRUD(rg.Group("/categories"), realm+"_categories", "categories.read", "categories.write", "categories.delete")
			handlers.RegisterCRUD(rg.Group("/locations"), realm+"_locations", "locations.read", "locations.write", "locations.delete")
			handlers.RegisterCRUD(rg.Group("/manufacturers"), realm+"_manufacturers", "vendors.read", "vendors.write", "vendors.delete")
			handlers.RegisterCRUD(rg.Group("/suppliers"), realm+"_suppliers", "vendors.read", "vendors.write", "vendors.delete")
			handlers.RegisterCRUD(rg.Group("/vendors"), realm+"_vendors", "vendors.read", "vendors.write", "vendors.delete")
			handlers.RegisterItemRoutes(rg.Group("/items"), realm)
			handlers.RegisterAttachmentRoutes(rg.Group("/attachments"), realm)
			handlers.RegisterPropertyRoutes(rg.Group("/properties"), realm)
		}

		handlers.RegisterAuthRoutes(api.Group("/auth"))
		handlers.RegisterUserRoutes(api)
		handlers.RegisterDeviceRoutes(api.Group("/devices"))
		handlers.RegisterCheckoutRoutes(api)
		handlers.RegisterQRLoginRoutes(api.Group("/login"))
		handlers.RegisterPrinterRoutes(api.Group("/print"))
		handlers.RegisterStatsRoutes(api)
		handlers.RegisterAdminRoutes(api.Group("/admin"))
	}

	if webappURL != "" {
		target, err := url.Parse(webappURL)
		if err != nil {
			log.Fatalf("Invalid WEBAPP_URL: %v", err)
		}
		proxy := httputil.NewSingleHostReverseProxy(target)
		r.NoRoute(func(c *gin.Context) {
			path := c.Request.URL.Path
			if strings.HasPrefix(path, "/api/") || strings.HasPrefix(path, "/uploads/") || strings.HasPrefix(path, "/ws") {
				c.Status(404)
				return
			}
			proxy.ServeHTTP(c.Writer, c.Request)
		})
	}

	routes := r.Routes()
	log.Printf("Registered %d routes", len(routes))
	log.Printf("Listening on %s", apiAddr)
	if webappURL != "" {
		log.Printf("Embedded WebApp running internally on %s", webappURL)
		log.Printf("Open item+ at: http://%s:%d", displayHost(config.C.Host), config.C.Port)
	}
	log.Println()

	httpServer := &http.Server{
		Addr:    apiAddr,
		Handler: r,
	}

	errCh := make(chan error, 1)
	go func() {
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
		close(errCh)
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-sigCh:
		log.Printf("Shutting down after %s...", sig.String())

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(ctx); err != nil {
			log.Printf("HTTP shutdown did not finish cleanly: %v", err)
			_ = httpServer.Close()
		}

		stopEmbeddedWebApp(webappCmd, 3*time.Second)
		if webappTmpDir != "" {
			_ = os.RemoveAll(webappTmpDir)
		}
	case err := <-errCh:
		if err != nil {
			log.Fatal(err)
		}
	}
}

// ── Logging ──

// rotatingWriter writes to a log file and rotates it when it exceeds maxSize.
type rotatingWriter struct {
	mu      sync.Mutex
	file    *os.File
	dir     string
	path    string
	size    int64
	maxSize int64
	maxKeep int
}

func newRotatingWriter(dir, filename string, maxSizeKB int64, maxKeep int) *rotatingWriter {
	_ = os.MkdirAll(dir, 0755)
	path := filepath.Join(dir, filename)

	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		log.Printf("Cannot open log file: %v", err)
		return nil
	}

	info, _ := f.Stat()
	size := int64(0)
	if info != nil {
		size = info.Size()
	}

	return &rotatingWriter{
		file:    f,
		dir:     dir,
		path:    path,
		size:    size,
		maxSize: maxSizeKB * 1024,
		maxKeep: maxKeep,
	}
}

func (w *rotatingWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	// Check if rotation needed
	if w.size+int64(len(p)) > w.maxSize {
		w.rotate()
	}

	n, err := w.file.Write(p)
	w.size += int64(n)
	return n, err
}

func (w *rotatingWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.file.Close()
}

func (w *rotatingWriter) rotate() {
	w.file.Close()

	// Shift .gz files: .9→.10, .8→.9, etc.
	for i := w.maxKeep - 1; i >= 1; i-- {
		old := filepath.Join(w.dir, fmt.Sprintf("itemplus.log.%d.gz", i))
		next := filepath.Join(w.dir, fmt.Sprintf("itemplus.log.%d.gz", i+1))
		os.Rename(old, next)
	}
	// Delete oldest
	os.Remove(filepath.Join(w.dir, fmt.Sprintf("itemplus.log.%d.gz", w.maxKeep+1)))

	// Compress current → .1.gz
	if src, err := os.Open(w.path); err == nil {
		gzPath := filepath.Join(w.dir, "itemplus.log.1.gz")
		if dst, err := os.Create(gzPath); err == nil {
			gz := gzip.NewWriter(dst)
			gz.Name = "itemplus.log"
			io.Copy(gz, src)
			gz.Close()
			dst.Close()
		}
		src.Close()
	}

	// Truncate and reopen
	f, err := os.OpenFile(w.path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		// Fallback — keep writing to old handle
		f, _ = os.OpenFile(w.path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	}
	w.file = f
	w.size = 0
}

func setupLogging() *os.File {
	logDir := filepath.Join(config.C.DataDir, "..", "logs")
	rw := newRotatingWriter(logDir, "itemplus.log", 5120, 10) // 5 MB (5120 KB), keep 10
	if rw == nil {
		return nil
	}

	multi := io.MultiWriter(os.Stdout, rw)
	log.SetOutput(multi)
	log.SetFlags(log.Ldate | log.Ltime)

	return rw.file
}

// ── Embedded WebApp ──

func startEmbeddedWebApp(port int) (*exec.Cmd, string) {
	entries, err := fs.ReadDir(webappFS, "build/webapp")
	if err != nil || len(entries) == 0 {
		log.Println("No embedded WebApp found — API-only mode")
		return nil, ""
	}

	nodePath, err := exec.LookPath("node")
	if err != nil {
		log.Println("Node.js not found — WebApp disabled (install Node.js to enable)")
		return nil, ""
	}

	if !portAvailable("127.0.0.1", port) {
		log.Printf("WebApp port %d is in use — WebApp disabled", port)
		return nil, ""
	}

	// Clean up leftover temp dirs from previous runs
	if matches, _ := filepath.Glob(filepath.Join(os.TempDir(), "itemplus-webapp-*")); len(matches) > 0 {
		for _, m := range matches {
			os.RemoveAll(m)
		}
		log.Printf("Cleaned up %d old temp dirs", len(matches))
	}

	tmpDir, err := os.MkdirTemp("", "itemplus-webapp-*")
	if err != nil {
		log.Printf("Failed to create temp dir: %v", err)
		return nil, ""
	}

	log.Println("Extracting WebApp...")
	if err := extractFS(webappFS, "build/webapp", tmpDir); err != nil {
		log.Printf("Failed to extract WebApp: %v", err)
		os.RemoveAll(tmpDir)
		return nil, ""
	}

	serverJS := filepath.Join(tmpDir, "server.js")
	if _, err := os.Stat(serverJS); err != nil {
		log.Println("WebApp server.js not found — disabled")
		os.RemoveAll(tmpDir)
		return nil, ""
	}

	cmd := exec.Command(nodePath, serverJS)
	env := append(os.Environ(),
		fmt.Sprintf("PORT=%d", port),
		"HOSTNAME=127.0.0.1",
	)
	if config.C.AppDomain != "" {
		env = append(env, "NEXT_PUBLIC_APP_DOMAIN="+config.C.AppDomain)
	}
	cmd.Env = env
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard

	if err := cmd.Start(); err != nil {
		log.Printf("Failed to start WebApp: %v", err)
		os.RemoveAll(tmpDir)
		return nil, ""
	}

	// Wait for ready
	ready := false
	for i := 0; i < 30; i++ {
		time.Sleep(200 * time.Millisecond)
		conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), 100*time.Millisecond)
		if err == nil {
			conn.Close()
			ready = true
			break
		}
	}
	if !ready {
		log.Println("WebApp failed to start within 6 seconds")
		cmd.Process.Kill()
		os.RemoveAll(tmpDir)
		return nil, ""
	}

	log.Printf("WebApp ready (port %d)", port)
	return cmd, tmpDir
}

func stopEmbeddedWebApp(cmd *exec.Cmd, timeout time.Duration) {
	if cmd == nil || cmd.Process == nil {
		return
	}

	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()

	_ = cmd.Process.Signal(syscall.SIGTERM)

	select {
	case <-time.After(timeout):
		log.Println("WebApp did not stop in time, forcing shutdown...")
		_ = cmd.Process.Kill()
		<-done
	case <-done:
	}
}

func displayHost(host string) string {
	switch strings.TrimSpace(host) {
	case "", "0.0.0.0", "::":
		return "localhost"
	default:
		return host
	}
}

// ── Helpers ──

func extractFS(fsys embed.FS, root, dest string) error {
	var mu sync.Mutex
	var count int

	err := fs.WalkDir(fsys, root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		relPath := strings.TrimPrefix(path, root+"/")
		if relPath == "" || relPath == root {
			return nil
		}
		target := filepath.Join(dest, relPath)

		if d.IsDir() {
			return os.MkdirAll(target, 0755)
		}

		data, err := fsys.ReadFile(path)
		if err != nil {
			return err
		}
		mu.Lock()
		count++
		mu.Unlock()
		return os.WriteFile(target, data, 0644)
	})
	if err == nil {
		log.Printf("Extracted %d files", count)
	}
	return err
}

func portAvailable(host string, port int) bool {
	ln, err := net.Listen("tcp", fmt.Sprintf("%s:%d", host, port))
	if err != nil {
		return false
	}
	ln.Close()
	return true
}

func init() {
	if _, err := os.Stat(".env"); err != nil {
		exe, _ := os.Executable()
		dir := filepath.Dir(exe)
		_ = os.Chdir(dir)
	}
}
