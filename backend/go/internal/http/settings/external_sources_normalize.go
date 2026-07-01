package settings

import (
	"errors"
	"net/http"
	"path"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"golang.org/x/crypto/ssh"
)

func parseExternalSourceID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid external source id"})
		return 0, false
	}
	return id, true
}

func LoadExternalSource(id int) (*ExternalSource, error) {
	var src ExternalSource
	if err := database.DB.Get(&src, "SELECT * FROM external_sources WHERE id = ?", id); err != nil {
		return nil, err
	}
	return &src, nil
}

func externalSourceResponse(src ExternalSource) gin.H {
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

func normalizeExternalSourceInput(body externalSourcePayload, current *ExternalSource) (*normalizedExternalSource, error) {
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
		Name:         getString(body.Name, currentString(current, func(src *ExternalSource) string { return src.Name })),
		Description:  getStringPtr(body.Description, currentStringPtr(current, func(src *ExternalSource) *string { return src.Description })),
		SourceType:   getString(body.SourceType, currentString(current, func(src *ExternalSource) string { return src.SourceType })),
		Host:         getString(body.Host, currentString(current, func(src *ExternalSource) string { return src.Host })),
		Port:         currentInt(body.Port, current, func(src *ExternalSource) int { return src.Port }, 22),
		Username:     getString(body.Username, currentString(current, func(src *ExternalSource) string { return src.Username })),
		AuthType:     getString(body.AuthType, currentString(current, func(src *ExternalSource) string { return src.AuthType })),
		Password:     getStringPtr(body.Password, currentStringPtr(current, func(src *ExternalSource) *string { return src.Password })),
		PrivateKey:   getStringPtr(body.PrivateKey, currentStringPtr(current, func(src *ExternalSource) *string { return src.PrivateKey })),
		KnownHostKey: getString(body.KnownHostKey, currentString(current, func(src *ExternalSource) string { return src.KnownHostKey })),
		BasePath:     getString(body.BasePath, currentString(current, func(src *ExternalSource) string { return src.BasePath })),
		IsActive:     currentBool(body.IsActive, current, func(src *ExternalSource) bool { return src.IsActive }, true),
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

func currentString(current *ExternalSource, getter func(*ExternalSource) string) string {
	if current == nil {
		return ""
	}
	return getter(current)
}

func currentStringPtr(current *ExternalSource, getter func(*ExternalSource) *string) *string {
	if current == nil {
		return nil
	}
	return getter(current)
}

func currentInt(value *int, current *ExternalSource, getter func(*ExternalSource) int, fallback int) int {
	if value != nil {
		return *value
	}
	if current != nil {
		return getter(current)
	}
	return fallback
}

func currentBool(value *bool, current *ExternalSource, getter func(*ExternalSource) bool, fallback bool) bool {
	if value != nil {
		return *value
	}
	if current != nil {
		return getter(current)
	}
	return fallback
}
