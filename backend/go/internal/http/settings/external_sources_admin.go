package settings

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
	"github.com/itemplus/backend/internal/storage"
)

func listExternalSources(c *gin.Context) {
	includeInactive := c.Query("include_inactive") == "1"
	query := "SELECT * FROM external_sources"
	if !includeInactive {
		query += " WHERE is_active = 1"
	}
	query += " ORDER BY " + database.CaseInsensitiveOrder("name")

	var sources []ExternalSource
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
	src, err := LoadExternalSource(id)
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
	src, err := LoadExternalSource(int(id64))
	if err != nil {
		c.JSON(http.StatusCreated, gin.H{"id": id64})
		return
	}

	user := middleware.GetUser(c)
	middleware.Audit(user.ID, "external_source.create", "source_id="+strconv.Itoa(src.ID))
	c.JSON(http.StatusCreated, externalSourceResponse(*src))
}

func updateExternalSource(c *gin.Context) {
	id, ok := parseExternalSourceID(c)
	if !ok {
		return
	}
	current, err := LoadExternalSource(id)
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

	src, _ := LoadExternalSource(id)
	user := middleware.GetUser(c)
	middleware.Audit(user.ID, "external_source.update", "source_id="+strconv.Itoa(id))
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
	middleware.Audit(user.ID, "external_source.delete", "source_id="+strconv.Itoa(id))
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
		Password:     middleware.StringValue(values.Password),
		PrivateKey:   middleware.StringValue(values.PrivateKey),
		KnownHostKey: values.KnownHostKey,
		BasePath:     values.BasePath,
	})
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
