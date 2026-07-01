package settings

import (
	"context"
	"github.com/itemplus/backend/internal/http/middleware"
	"log"
	"net/http"
	"path"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/storage"
)

func ListAttachmentExternalSources(c *gin.Context) {
	query := "SELECT * FROM external_sources WHERE is_active = 1 ORDER BY " + database.CaseInsensitiveOrder("name")
	var sources []ExternalSource
	if err := database.DB.Select(&sources, query); err != nil {
		log.Printf("DB query error in listAttachmentExternalSources: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}

	respondExternalSources(c, sources)
}

func BrowseAttachmentExternalSource(c *gin.Context) {
	id, ok := parseExternalSourceID(c)
	if !ok {
		return
	}
	src, err := LoadExternalSource(id)
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
		Password:     middleware.StringValue(src.Password),
		PrivateKey:   middleware.StringValue(src.PrivateKey),
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
