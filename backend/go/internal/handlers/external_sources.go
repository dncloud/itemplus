package handlers

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
	"github.com/itemplus/backend/internal/storage"
	"golang.org/x/crypto/ssh"
)

type externalSource struct {
	ID           int     `db:"id"`
	Name         string  `db:"name"`
	Description  *string `db:"description"`
	SourceType   string  `db:"source_type"`
	Host         string  `db:"host"`
	Port         int     `db:"port"`
	Username     string  `db:"username"`
	AuthType     string  `db:"auth_type"`
	Password     *string `db:"password"`
	PrivateKey   *string `db:"private_key"`
	KnownHostKey string  `db:"known_host_key"`
	BasePath     string  `db:"base_path"`
	IsActive     bool    `db:"is_active"`
	CreatedAt    *string `db:"created_at"`
	UpdatedAt    *string `db:"updated_at"`
}

type externalSourcePayload struct {
	Name         *string `json:"name"`
	Description  *string `json:"description"`
	SourceType   *string `json:"source_type"`
	Host         *string `json:"host"`
	Port         *int    `json:"port"`
	Username     *string `json:"username"`
	AuthType     *string `json:"auth_type"`
	Password     *string `json:"password"`
	PrivateKey   *string `json:"private_key"`
	KnownHostKey *string `json:"known_host_key"`
	BasePath     *string `json:"base_path"`
	IsActive     *bool   `json:"is_active"`
}

func registerExternalSourceRoutes(g *gin.RouterGroup) {
	g.GET("/external-sources", listExternalSources)
	g.GET("/external-sources/:id", getExternalSource)
	g.POST("/external-sources/fetch-host-key", fetchExternalSourceHostKey)
	g.POST("/external-sources/test", testExternalSourceConnection)
	g.POST("/external-sources", createExternalSource)
	g.PUT("/external-sources/:id", updateExternalSource)
	g.DELETE("/external-sources/:id", deleteExternalSource)
}

func respondExternalSources(c *gin.Context, sources []externalSource) {
	resp := make([]gin.H, 0, len(sources))
	for _, src := range sources {
		resp = append(resp, externalSourceResponse(src))
	}
	if resp == nil {
		resp = []gin.H{}
	}
	c.JSON(http.StatusOK, resp)
}

func requireExternalSourceFields(c *gin.Context, body externalSourcePayload, requireName bool) bool {
	if requireName && body.Name == nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Missing required fields"})
		return false
	}
	if body.Host == nil || body.Username == nil || body.AuthType == nil || body.KnownHostKey == nil || body.BasePath == nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Missing required fields"})
		return false
	}
	return true
}

func listAttachmentExternalSources(c *gin.Context) {
	query := "SELECT * FROM external_sources WHERE is_active = 1 ORDER BY " + database.CaseInsensitiveOrder("name")
	var sources []externalSource
	if err := database.DB.Select(&sources, query); err != nil {
		log.Printf("DB query error in listAttachmentExternalSources: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	respondExternalSources(c, sources)
}

func browseAttachmentExternalSource(c *gin.Context) {
	id, ok := parseExternalSourceID(c)
	if !ok {
		return
	}
	src, err := loadExternalSource(id)
	if err != nil || !src.IsActive {
		c.JSON(http.StatusNotFound, gin.H{"detail": "External source not found"})
		return
	}

	requestedPath := strings.TrimSpace(c.Query("path"))
	entries, err := storage.ListSFTPDirectory(context.Background(), storage.SFTPSourceConfig{
		Host:         src.Host,
		Port:         src.Port,
		Username:     src.Username,
		AuthType:     src.AuthType,
		Password:     stringValue(src.Password),
		PrivateKey:   stringValue(src.PrivateKey),
		KnownHostKey: src.KnownHostKey,
		BasePath:     src.BasePath,
	}, requestedPath)
	if err != nil {
		c.JSON(mapSFTPBrowseStatus(err), gin.H{"detail": describeSFTPBrowseError(err)})
		return
	}

	sort.SliceStable(entries, func(i, j int) bool {
		if entries[i].IsDir != entries[j].IsDir {
			return entries[i].IsDir
		}
		return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
	})

	currentPath := strings.Trim(strings.ReplaceAll(requestedPath, "\\", "/"), "/")
	parentPath := ""
	if currentPath != "" {
		parentPath = path.Dir(currentPath)
		if parentPath == "." || parentPath == "/" {
			parentPath = ""
		}
	}

	resp := make([]gin.H, 0, len(entries))
	for _, entry := range entries {
		resp = append(resp, gin.H{
			"name":        entry.Name,
			"path":        entry.Path,
			"is_dir":      entry.IsDir,
			"size":        entry.Size,
			"modified_at": entry.ModifiedAt.Format(time.RFC3339),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"source_id":    src.ID,
		"current_path": currentPath,
		"parent_path":  parentPath,
		"entries":      resp,
	})
}

func listExternalSources(c *gin.Context) {
	includeInactive := c.Query("include_inactive") == "1"
	query := "SELECT * FROM external_sources"
	if !includeInactive {
		query += " WHERE is_active = 1"
	}
	query += " ORDER BY " + database.CaseInsensitiveOrder("name")

	var sources []externalSource
	if err := database.DB.Select(&sources, query); err != nil {
		log.Printf("DB query error in listExternalSources: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	respondExternalSources(c, sources)
}

func getExternalSource(c *gin.Context) {
	id, ok := parseExternalSourceID(c)
	if !ok {
		return
	}
	src, err := loadExternalSource(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "External source not found"})
		return
	}
	c.JSON(http.StatusOK, externalSourceResponse(*src))
}

func createExternalSource(c *gin.Context) {
	var body externalSourcePayload
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}
	if !requireExternalSourceFields(c, body, true) {
		return
	}

	values, err := normalizeExternalSourceInput(body, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	now := database.TimestampNow()
	result, err := database.DB.Exec(
		`INSERT INTO external_sources (
			name, description, source_type, host, port, username, auth_type, password, private_key,
			known_host_key, base_path, is_active, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		values.Name, values.Description, values.SourceType, values.Host, values.Port, values.Username, values.AuthType,
		values.Password, values.PrivateKey, values.KnownHostKey, values.BasePath, values.IsActive, now, now,
	)
	if err != nil {
		log.Printf("DB insert error in createExternalSource: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "External source could not be created"})
		return
	}

	id64, _ := result.LastInsertId()
	src, err := loadExternalSource(int(id64))
	if err != nil {
		c.JSON(http.StatusCreated, gin.H{"id": id64})
		return
	}

	user := middleware.GetUser(c)
	audit(user.ID, "external_source.create", "source_id="+strconv.Itoa(src.ID))
	c.JSON(http.StatusCreated, externalSourceResponse(*src))
}

func updateExternalSource(c *gin.Context) {
	id, ok := parseExternalSourceID(c)
	if !ok {
		return
	}
	current, err := loadExternalSource(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "External source not found"})
		return
	}

	var body externalSourcePayload
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	values, err := normalizeExternalSourceInput(body, current)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	now := database.TimestampNow()
	if _, err := database.DB.Exec(
		`UPDATE external_sources
		 SET name = ?, description = ?, source_type = ?, host = ?, port = ?, username = ?, auth_type = ?,
		     password = ?, private_key = ?, known_host_key = ?, base_path = ?, is_active = ?, updated_at = ?
		 WHERE id = ?`,
		values.Name, values.Description, values.SourceType, values.Host, values.Port, values.Username, values.AuthType,
		values.Password, values.PrivateKey, values.KnownHostKey, values.BasePath, values.IsActive, now, id,
	); err != nil {
		log.Printf("DB update error in updateExternalSource: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "External source could not be updated"})
		return
	}

	src, _ := loadExternalSource(id)
	user := middleware.GetUser(c)
	audit(user.ID, "external_source.update", "source_id="+strconv.Itoa(id))
	c.JSON(http.StatusOK, externalSourceResponse(*src))
}

func deleteExternalSource(c *gin.Context) {
	id, ok := parseExternalSourceID(c)
	if !ok {
		return
	}

	var inUse int
	for _, realm := range []string{"archive", "collection"} {
		table := realm + "_attachments"
		if err := database.DB.Get(&inUse, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE external_source_id = ?", table), id); err != nil {
			log.Printf("DB query error in deleteExternalSource: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		if inUse > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "External source is still referenced by attachments"})
			return
		}
	}

	result, err := database.DB.Exec("DELETE FROM external_sources WHERE id = ?", id)
	if err != nil {
		log.Printf("DB delete error in deleteExternalSource: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "External source could not be deleted"})
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "External source not found"})
		return
	}

	user := middleware.GetUser(c)
	audit(user.ID, "external_source.delete", "source_id="+strconv.Itoa(id))
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func fetchExternalSourceHostKey(c *gin.Context) {
	var body struct {
		Host string `json:"host"`
		Port int    `json:"port"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}
	port := body.Port
	if port == 0 {
		port = 22
	}
	info, err := storage.FetchSFTPHostKey(context.Background(), strings.TrimSpace(body.Host), port)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"algorithm":          info.Algorithm,
		"fingerprint_sha256": info.FingerprintSHA256,
		"authorized_key":     info.AuthorizedKey,
	})
}

func testExternalSourceConnection(c *gin.Context) {
	var body externalSourcePayload
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}
	if body.Name == nil {
		tmp := "Connection test"
		body.Name = &tmp
	}
	if !requireExternalSourceFields(c, body, false) {
		return
	}
	values, err := normalizeExternalSourceInput(body, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	err = storage.TestSFTPConnection(context.Background(), storage.SFTPSourceConfig{
		Host:         values.Host,
		Port:         values.Port,
		Username:     values.Username,
		AuthType:     values.AuthType,
		Password:     stringValue(values.Password),
		PrivateKey:   stringValue(values.PrivateKey),
		KnownHostKey: values.KnownHostKey,
		BasePath:     values.BasePath,
	})
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func mapSFTPBrowseStatus(err error) int {
	msg := strings.ToLower(err.Error())
	switch {
	case strings.Contains(msg, "invalid sftp directory path"),
		strings.Contains(msg, "escapes base path"),
		strings.Contains(msg, "missing sftp base path"):
		return http.StatusBadRequest
	case strings.Contains(msg, "file does not exist"),
		strings.Contains(msg, "no such file"),
		strings.Contains(msg, "not found"):
		return http.StatusNotFound
	case strings.Contains(msg, "permission denied"),
		strings.Contains(msg, "failed to authenticate"),
		strings.Contains(msg, "unable to authenticate"):
		return http.StatusForbidden
	default:
		return http.StatusBadGateway
	}
}

func describeSFTPBrowseError(err error) string {
	msg := strings.ToLower(err.Error())
	switch {
	case strings.Contains(msg, "invalid sftp directory path"),
		strings.Contains(msg, "escapes base path"),
		strings.Contains(msg, "missing sftp base path"):
		return "Invalid SFTP path"
	case strings.Contains(msg, "file does not exist"),
		strings.Contains(msg, "no such file"),
		strings.Contains(msg, "not found"):
		return "SFTP folder not found"
	case strings.Contains(msg, "host key mismatch"):
		return "SFTP host key mismatch"
	case strings.Contains(msg, "failed to authenticate"),
		strings.Contains(msg, "unable to authenticate"):
		return "SFTP authentication failed"
	case strings.Contains(msg, "dial sftp source"):
		return "SFTP server not reachable"
	case strings.Contains(msg, "handshake sftp source"):
		return "SFTP handshake failed"
	case strings.Contains(msg, "permission denied"):
		return "SFTP permission denied"
	default:
		return "Could not browse SFTP source"
	}
}

func parseExternalSourceID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid external source id"})
		return 0, false
	}
	return id, true
}

func loadExternalSource(id int) (*externalSource, error) {
	var src externalSource
	if err := database.DB.Get(&src, "SELECT * FROM external_sources WHERE id = ?", id); err != nil {
		return nil, err
	}
	return &src, nil
}

func externalSourceResponse(src externalSource) gin.H {
	return gin.H{
		"id":              src.ID,
		"name":            src.Name,
		"description":     src.Description,
		"source_type":     src.SourceType,
		"host":            src.Host,
		"port":            src.Port,
		"username":        src.Username,
		"auth_type":       src.AuthType,
		"known_host_key":  src.KnownHostKey,
		"base_path":       src.BasePath,
		"is_active":       src.IsActive,
		"has_password":    src.Password != nil && strings.TrimSpace(*src.Password) != "",
		"has_private_key": src.PrivateKey != nil && strings.TrimSpace(*src.PrivateKey) != "",
		"created_at":      src.CreatedAt,
		"updated_at":      src.UpdatedAt,
	}
}

type normalizedExternalSource struct {
	Name         string
	Description  *string
	SourceType   string
	Host         string
	Port         int
	Username     string
	AuthType     string
	Password     *string
	PrivateKey   *string
	KnownHostKey string
	BasePath     string
	IsActive     bool
}

func normalizeExternalSourceInput(body externalSourcePayload, current *externalSource) (*normalizedExternalSource, error) {
	getString := func(value *string, fallback string) string {
		if value == nil {
			return fallback
		}
		return strings.TrimSpace(*value)
	}
	getStringPtr := func(value *string, fallback *string) *string {
		if value == nil {
			return fallback
		}
		return nullableTrimmedString(value)
	}

	values := &normalizedExternalSource{
		Name:         getString(body.Name, currentString(current, func(src *externalSource) string { return src.Name })),
		Description:  getStringPtr(body.Description, currentStringPtr(current, func(src *externalSource) *string { return src.Description })),
		SourceType:   getString(body.SourceType, currentString(current, func(src *externalSource) string { return src.SourceType })),
		Host:         getString(body.Host, currentString(current, func(src *externalSource) string { return src.Host })),
		Port:         currentInt(body.Port, current, func(src *externalSource) int { return src.Port }, 22),
		Username:     getString(body.Username, currentString(current, func(src *externalSource) string { return src.Username })),
		AuthType:     getString(body.AuthType, currentString(current, func(src *externalSource) string { return src.AuthType })),
		Password:     getStringPtr(body.Password, currentStringPtr(current, func(src *externalSource) *string { return src.Password })),
		PrivateKey:   getStringPtr(body.PrivateKey, currentStringPtr(current, func(src *externalSource) *string { return src.PrivateKey })),
		KnownHostKey: getString(body.KnownHostKey, currentString(current, func(src *externalSource) string { return src.KnownHostKey })),
		BasePath:     getString(body.BasePath, currentString(current, func(src *externalSource) string { return src.BasePath })),
		IsActive:     currentBool(body.IsActive, current, func(src *externalSource) bool { return src.IsActive }, true),
	}

	if values.Name == "" {
		return nil, errors.New("Source name is required")
	}
	if values.SourceType == "" {
		values.SourceType = "sftp"
	}
	if values.SourceType != "sftp" {
		return nil, errors.New("Only sftp external sources are supported")
	}
	if values.Host == "" {
		return nil, errors.New("SFTP host is required")
	}
	if values.Port < 1 || values.Port > 65535 {
		return nil, errors.New("SFTP port must be between 1 and 65535")
	}
	if values.Username == "" {
		return nil, errors.New("SFTP username is required")
	}
	if values.AuthType != "password" && values.AuthType != "ssh_key" {
		return nil, errors.New("SFTP auth_type must be password or ssh_key")
	}

	hostKey, _, _, _, err := ssh.ParseAuthorizedKey([]byte(values.KnownHostKey))
	if err != nil || hostKey == nil {
		return nil, errors.New("known_host_key must be a valid SSH authorized key line")
	}

	values.BasePath = normalizeRemoteBasePath(values.BasePath)
	if values.BasePath == "" {
		return nil, errors.New("base_path is required")
	}

	switch values.AuthType {
	case "password":
		if values.Password == nil || strings.TrimSpace(*values.Password) == "" {
			return nil, errors.New("password is required for password auth")
		}
		values.PrivateKey = nil
	case "ssh_key":
		if values.PrivateKey == nil || strings.TrimSpace(*values.PrivateKey) == "" {
			return nil, errors.New("private_key is required for ssh_key auth")
		}
		if _, err := ssh.ParsePrivateKey([]byte(*values.PrivateKey)); err != nil {
			return nil, errors.New("private_key must be a valid unencrypted SSH private key")
		}
		values.Password = nil
	}

	return values, nil
}

func normalizeRemoteBasePath(raw string) string {
	raw = strings.TrimSpace(strings.ReplaceAll(raw, "\\", "/"))
	if raw == "" {
		return ""
	}
	if !strings.HasPrefix(raw, "/") {
		raw = "/" + raw
	}
	return path.Clean(raw)
}

func currentString(current *externalSource, getter func(*externalSource) string) string {
	if current == nil {
		return ""
	}
	return getter(current)
}

func currentStringPtr(current *externalSource, getter func(*externalSource) *string) *string {
	if current == nil {
		return nil
	}
	return getter(current)
}

func currentInt(value *int, current *externalSource, getter func(*externalSource) int, fallback int) int {
	if value != nil {
		return *value
	}
	if current != nil {
		return getter(current)
	}
	return fallback
}

func currentBool(value *bool, current *externalSource, getter func(*externalSource) bool, fallback bool) bool {
	if value != nil {
		return *value
	}
	if current != nil {
		return getter(current)
	}
	return fallback
}
