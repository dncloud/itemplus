package items

import (
	"encoding/json"
	"fmt"
	"log"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
	settingshandlers "github.com/itemplus/backend/internal/http/settings"
	"github.com/itemplus/backend/internal/storage"
)

func uploadAttachment(realm string) gin.HandlerFunc {
	table := realm + "_attachments"
	itemsTable := realm + "_items"
	return func(c *gin.Context) {
		itemID := c.Param("id")

		if !itemExists(itemsTable, itemID) {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
			return
		}

		file, err := c.FormFile("file")
		if err != nil || file == nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "No file provided"})
			return
		}
		upload, err := storage.StoreUploadedFile(c, file, filepath.Join(config.C.UploadDir, realm, itemID), path.Join(realm, itemID))
		if err != nil {
			switch err.Error() {
			case "File too large":
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"detail": err.Error()})
			case "No file provided", "File type not allowed", "File content does not match its extension":
				c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
			default:
				c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
			}
			return
		}

		attType := c.DefaultPostForm("type", "image")
		order := c.DefaultPostForm("order", "0")
		description := c.PostForm("description")
		gallery := c.DefaultPostForm("gallery", "false") == "true"
		now := database.TimestampNow()

		result, err := database.DB.Exec(
			fmt.Sprintf("INSERT INTO %s (item_id, filename, file_path, storage_backend, attachment_type, description, gallery, size, `order`, created_at, updated_at) VALUES (?, ?, ?, 'local', ?, ?, ?, ?, ?, ?, ?)", table),
			itemID, upload.OriginalName, upload.RelativePath, attType, description, gallery, upload.Size, order, now, now,
		)
		if err != nil {
			log.Printf("DB insert error in uploadAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		newID, err := result.LastInsertId()
		if err != nil {
			log.Printf("DB last insert id error in uploadAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}

		user := middleware.GetUser(c)
		middleware.Audit(user.ID, "attachment.upload", fmt.Sprintf("realm=%s item=%s file=%s", realm, itemID, upload.OriginalName))

		row, err := loadAttachmentRow(realm, table, newID)
		if err != nil {
			log.Printf("DB read error in uploadAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		c.JSON(http.StatusCreated, row)
	}
}

func addLinkAttachment(realm string) gin.HandlerFunc {
	table := realm + "_attachments"
	itemsTable := realm + "_items"
	return func(c *gin.Context) {
		itemID := c.Param("id")

		if !itemExists(itemsTable, itemID) {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
			return
		}

		var body struct {
			URL         string `json:"url"`
			Filename    string `json:"filename"`
			Description string `json:"description"`
			Order       int    `json:"order"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
			return
		}
		if err := validateExternalAttachmentURL(body.URL); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
			return
		}

		filename := body.Filename
		if filename == "" {
			parts := strings.Split(body.URL, "?")
			urlPath := parts[0]
			if idx := strings.LastIndex(urlPath, "/"); idx >= 0 {
				filename = urlPath[idx+1:]
			}
			if filename == "" {
				filename = body.URL
			}
		}

		attType := detectLinkType(filename, "")
		var fileSize *int64

		now := database.TimestampNow()
		result, err := database.DB.Exec(
			fmt.Sprintf("INSERT INTO %s (item_id, filename, file_path, storage_backend, attachment_type, url, description, gallery, size, `order`, created_at, updated_at) VALUES (?, ?, '', 'external_url', ?, ?, ?, 0, ?, ?, ?, ?)", table),
			itemID, filename, attType, body.URL, body.Description, fileSize, body.Order, now, now,
		)
		if err != nil {
			log.Printf("DB insert error in addLinkAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		newID, err := result.LastInsertId()
		if err != nil {
			log.Printf("DB last insert id error in addLinkAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}

		row, err := loadAttachmentRow(realm, table, newID)
		if err != nil {
			log.Printf("DB read error in addLinkAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		c.JSON(http.StatusCreated, row)
	}
}

func addExternalSFTPAttachment(realm string) gin.HandlerFunc {
	table := realm + "_attachments"
	itemsTable := realm + "_items"
	return func(c *gin.Context) {
		itemID := c.Param("id")

		if !itemExists(itemsTable, itemID) {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
			return
		}

		var body struct {
			ExternalSourceID int    `json:"external_source_id"`
			ExternalPath     string `json:"external_path"`
			Filename         string `json:"filename"`
			Description      string `json:"description"`
			Order            int    `json:"order"`
			Gallery          bool   `json:"gallery"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
			return
		}
		if body.ExternalSourceID < 1 {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "external_source_id is required"})
			return
		}

		src, err := settingshandlers.LoadExternalSource(body.ExternalSourceID)
		if err != nil || !src.IsActive {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "External source is not available"})
			return
		}

		externalPath, err := storage.ResolveSFTPPath(src.BasePath, body.ExternalPath)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid external_path"})
			return
		}

		filename := strings.TrimSpace(body.Filename)
		if filename == "" {
			filename = path.Base(externalPath)
		}
		if filename == "." || filename == "/" || filename == "" {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Filename could not be derived from external_path"})
			return
		}

		attType := detectLinkType(filename, "")
		now := database.TimestampNow()
		result, err := database.DB.Exec(
			fmt.Sprintf(`INSERT INTO %s (
				item_id, filename, file_path, storage_backend, external_source_id, external_path, attachment_type,
				url, description, gallery, size, `+"`order`"+`, created_at, updated_at
			) VALUES (?, ?, '', 'external_sftp', ?, ?, ?, '', ?, ?, NULL, ?, ?, ?)`, table),
			itemID, filename, body.ExternalSourceID, externalPath, attType, body.Description, body.Gallery, body.Order, now, now,
		)
		if err != nil {
			log.Printf("DB insert error in addExternalSFTPAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}

		newID, err := result.LastInsertId()
		if err != nil {
			log.Printf("DB last insert id error in addExternalSFTPAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		row, err := loadAttachmentRow(realm, table, newID)
		if err != nil {
			log.Printf("DB read error in addExternalSFTPAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		c.JSON(http.StatusCreated, row)
	}
}

func updateAttachment(realm string) gin.HandlerFunc {
	table := realm + "_attachments"
	return func(c *gin.Context) {
		attID := c.Param("attId")
		var body map[string]interface{}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
			return
		}

		allowed := map[string]bool{"description": true, "order": true, "attachment_type": true, "url": true, "gallery": true}
		sets := ""
		var vals []interface{}
		for k, v := range body {
			if !allowed[k] {
				continue
			}
			if k == "url" {
				urlValue, ok := v.(string)
				if !ok {
					c.JSON(http.StatusBadRequest, gin.H{"detail": "Attachment URL must be a string"})
					return
				}
				if err := validateExternalAttachmentURL(urlValue); err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
					return
				}
			}
			if sets != "" {
				sets += ", "
			}
			sets += fmt.Sprintf("`%s` = ?", k)
			vals = append(vals, v)
		}
		if sets == "" {
			row, err := loadAttachmentRow(realm, table, attID)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"detail": "Not found"})
				return
			}
			c.JSON(http.StatusOK, row)
			return
		}
		sets += ", updated_at = ?"
		vals = append(vals, database.TimestampNow(), attID)

		result, err := database.DB.Exec(fmt.Sprintf("UPDATE %s SET %s WHERE id = ?", table, sets), vals...)
		if err != nil {
			log.Printf("DB update error in updateAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		affected, _ := result.RowsAffected()
		if affected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Not found"})
			return
		}

		row, err := loadAttachmentRow(realm, table, attID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Not found"})
			return
		}
		c.JSON(http.StatusOK, row)
	}
}

func validateExternalAttachmentURL(raw string) error {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fmt.Errorf("Attachment URL is required")
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("Invalid attachment URL")
	}
	if parsed.Host == "" || !parsed.IsAbs() {
		return fmt.Errorf("Attachment URL must be absolute")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return fmt.Errorf("Attachment URL must use http or https")
	}
	return nil
}

func deleteAttachment(realm string) gin.HandlerFunc {
	table := realm + "_attachments"
	return func(c *gin.Context) {
		attID := c.Param("attId")

		var filePath string
		var storageBackend string
		database.DB.Get(&filePath, fmt.Sprintf("SELECT COALESCE(file_path, '') FROM %s WHERE id = ?", table), attID)
		database.DB.Get(&storageBackend, fmt.Sprintf("SELECT COALESCE(storage_backend, 'local') FROM %s WHERE id = ?", table), attID)

		result, err := database.DB.Exec(fmt.Sprintf("DELETE FROM %s WHERE id = ?", table), attID)
		if err != nil {
			log.Printf("DB delete error in deleteAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		affected, _ := result.RowsAffected()
		if affected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Not found"})
			return
		}

		if storageBackend == "local" && filePath != "" {
			if _, fullPath, err := storage.ResolveUploadPath(config.C.UploadDir, filePath); err == nil {
				_ = os.Remove(fullPath)
			}
		}

		user := middleware.GetUser(c)
		middleware.Audit(user.ID, "attachment.delete", fmt.Sprintf("realm=%s att=%s", realm, attID))

		c.Status(http.StatusNoContent)
	}
}

func getAttachmentContent(realm string) gin.HandlerFunc {
	table := realm + "_attachments"
	return func(c *gin.Context) {
		attID := c.Param("attId")

		var att struct {
			ID               int     `db:"id"`
			Filename         string  `db:"filename"`
			FilePath         *string `db:"file_path"`
			StorageBackend   *string `db:"storage_backend"`
			URL              *string `db:"url"`
			ExternalSourceID *int    `db:"external_source_id"`
			ExternalPath     *string `db:"external_path"`
		}
		if err := database.DB.Get(&att, fmt.Sprintf("SELECT id, filename, file_path, storage_backend, url, external_source_id, external_path FROM %s WHERE id = ?", table), attID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Attachment not found"})
			return
		}

		backend := "local"
		if att.StorageBackend != nil && strings.TrimSpace(*att.StorageBackend) != "" {
			backend = strings.TrimSpace(*att.StorageBackend)
		}

		switch backend {
		case "local":
			if att.FilePath == nil || strings.TrimSpace(*att.FilePath) == "" {
				c.JSON(http.StatusNotFound, gin.H{"detail": "Attachment file not found"})
				return
			}
			_, fullPath, err := storage.ResolveUploadPath(config.C.UploadDir, *att.FilePath)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"detail": "Attachment file not found"})
				return
			}
			serveAttachmentFile(c, att.Filename, fullPath)
			return
		case "external_url":
			if att.URL == nil || strings.TrimSpace(*att.URL) == "" {
				c.JSON(http.StatusNotFound, gin.H{"detail": "Attachment URL not found"})
				return
			}
			c.Redirect(http.StatusTemporaryRedirect, strings.TrimSpace(*att.URL))
			return
		case "external_sftp":
			if att.ExternalSourceID == nil || att.ExternalPath == nil || strings.TrimSpace(*att.ExternalPath) == "" {
				c.JSON(http.StatusNotFound, gin.H{"detail": "External attachment is incomplete"})
				return
			}
			src, err := settingshandlers.LoadExternalSource(*att.ExternalSourceID)
			if err != nil || !src.IsActive {
				c.JSON(http.StatusBadGateway, gin.H{"detail": "External source is unavailable"})
				return
			}
			stream, err := storage.OpenSFTPFileStream(c.Request.Context(), storage.SFTPSourceConfig{
				Host:         src.Host,
				Port:         src.Port,
				Username:     src.Username,
				AuthType:     src.AuthType,
				Password:     middleware.StringValue(src.Password),
				PrivateKey:   middleware.StringValue(src.PrivateKey),
				KnownHostKey: src.KnownHostKey,
				BasePath:     src.BasePath,
			}, *att.ExternalPath)
			if err != nil {
				if isRequestCanceled(c, err) {
					c.Abort()
					return
				}
				log.Printf("SFTP stream error for attachment %s: %v", attID, err)
				c.JSON(http.StatusBadGateway, gin.H{"detail": describeSFTPAttachmentError(err)})
				return
			}
			defer stream.Close()

			setAttachmentHeaders(c, att.Filename)
			contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(att.Filename)))
			if contentType == "" {
				contentType = "application/octet-stream"
			}
			c.Header("Content-Type", contentType)
			http.ServeContent(c.Writer, c.Request, att.Filename, stream.ModTime, stream)
			return
		default:
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Unsupported attachment backend"})
			return
		}
	}
}

func uploadPropertyFile(realm string) gin.HandlerFunc {
	propsTable := realm + "_item_properties"
	itemsTable := realm + "_items"
	return func(c *gin.Context) {
		itemID := c.Param("id")
		propID := c.Param("propId")

		if !itemExists(itemsTable, itemID) {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
			return
		}

		file, err := c.FormFile("file")
		if err != nil || file == nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "No file provided"})
			return
		}
		upload, err := storage.StoreUploadedFile(c, file, filepath.Join(config.C.UploadDir, realm, itemID, "props"), path.Join(realm, itemID, "props"))
		if err != nil {
			switch err.Error() {
			case "File too large":
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"detail": err.Error()})
			case "No file provided", "File type not allowed", "File content does not match its extension":
				c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
			default:
				c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
			}
			return
		}
		valueMap := map[string]interface{}{
			"type":         "file",
			"filename":     upload.OriginalName,
			"path":         upload.RelativePath,
			"size":         upload.Size,
			"content_type": upload.ContentType,
		}
		valueBytes, _ := json.Marshal(valueMap)
		value := string(valueBytes)

		var existingID int
		err = database.DB.Get(&existingID, fmt.Sprintf("SELECT id FROM %s WHERE item_id = ? AND property_id = ?", propsTable), itemID, propID)
		if err == nil {
			database.DB.Exec(fmt.Sprintf("UPDATE %s SET value = ?, updated_at = ? WHERE id = ?", propsTable), value, database.TimestampNow(), existingID)
		} else {
			database.DB.Exec(fmt.Sprintf("INSERT INTO %s (item_id, property_id, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", propsTable),
				itemID, propID, value, database.TimestampNow(), database.TimestampNow())
		}

		c.JSON(http.StatusOK, gin.H{"status": "ok", "value": valueMap})
	}
}

func itemExists(itemsTable, itemID string) bool {
	var exists int
	return database.DB.Get(&exists, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE id = ?", itemsTable), itemID) == nil && exists > 0
}

func loadAttachmentRow(realm, table string, attachmentID interface{}) (map[string]interface{}, error) {
	row := map[string]interface{}{}
	if err := database.DB.QueryRowx(fmt.Sprintf("SELECT * FROM %s WHERE id = ?", table), attachmentID).MapScan(row); err != nil {
		return nil, err
	}
	middleware.CleanRow(row)
	finalizeAttachmentRow(realm, row)
	return row, nil
}

func finalizeAttachmentRow(realm string, row map[string]interface{}) {
	id := fmt.Sprintf("%v", row["id"])
	backend := strings.TrimSpace(fmt.Sprintf("%v", row["storage_backend"]))
	if backend == "" || backend == "<nil>" {
		if urlValue, ok := row["url"].(string); ok && strings.TrimSpace(urlValue) != "" {
			backend = "external_url"
		} else {
			backend = "local"
		}
		row["storage_backend"] = backend
	}
	row["download_url"] = fmt.Sprintf("/api/%s/attachments/%s/content", realm, id)
}

func serveAttachmentFile(c *gin.Context, filename, fullPath string) {
	setAttachmentHeaders(c, filename)
	c.File(fullPath)
}

func setAttachmentHeaders(c *gin.Context, filename string) {
	ext := strings.ToLower(filepath.Ext(filename))
	inlineTypes := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true, ".svg": true, ".bmp": true, ".heic": true,
		".mp4": true, ".mov": true, ".avi": true, ".mkv": true, ".webm": true,
		".mp3": true, ".wav": true, ".flac": true, ".ogg": true, ".m4a": true, ".aac": true,
		".pdf": true,
	}

	if inlineTypes[ext] {
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	} else {
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	}
	c.Header("X-Content-Type-Options", "nosniff")
}

func stringValue(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func isRequestCanceled(c *gin.Context, err error) bool {
	if c.Request != nil && c.Request.Context().Err() != nil {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "operation was canceled") || strings.Contains(msg, "context canceled") || strings.Contains(msg, "request canceled")
}

func describeSFTPAttachmentError(err error) string {
	msg := strings.ToLower(err.Error())
	switch {
	case strings.Contains(msg, "no such file"), strings.Contains(msg, "file does not exist"), strings.Contains(msg, "not exist"):
		return "SFTP file not found"
	case strings.Contains(msg, "unable to authenticate"), strings.Contains(msg, "permission denied"), strings.Contains(msg, "missing sftp password"), strings.Contains(msg, "missing sftp private key"):
		return "SFTP authentication failed"
	case strings.Contains(msg, "known_host_key"), strings.Contains(msg, "host key"), strings.Contains(msg, "mismatch"):
		return "SFTP host key mismatch"
	case strings.Contains(msg, "dial sftp source"):
		return "SFTP server not reachable"
	case strings.Contains(msg, "handshake sftp source"):
		return "SFTP handshake failed"
	case strings.Contains(msg, "invalid sftp attachment path"), strings.Contains(msg, "escapes base path"), strings.Contains(msg, "empty sftp attachment path"):
		return "Invalid SFTP path"
	default:
		return "Could not read external attachment"
	}
}

func detectLinkType(filename string, contentType string) string {
	ext := strings.ToLower(path.Ext(filename))
	ct := strings.ToLower(contentType)

	imageExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true, ".svg": true, ".bmp": true, ".heic": true}
	videoExts := map[string]bool{".mp4": true, ".mov": true, ".avi": true, ".mkv": true, ".webm": true, ".m3u8": true}
	audioExts := map[string]bool{".mp3": true, ".wav": true, ".flac": true, ".ogg": true, ".m4a": true, ".aac": true}
	archiveExts := map[string]bool{".zip": true, ".tar": true, ".gz": true, ".rar": true, ".7z": true, ".iso": true, ".dmg": true, ".img": true}
	documentExts := map[string]bool{".pdf": true, ".doc": true, ".docx": true, ".xls": true, ".xlsx": true, ".ppt": true, ".pptx": true, ".odt": true}
	codeExts := map[string]bool{".py": true, ".js": true, ".ts": true, ".go": true, ".rs": true, ".c": true, ".cpp": true, ".h": true, ".sh": true, ".json": true, ".yaml": true, ".xml": true}

	if imageExts[ext] {
		return "image"
	}
	if videoExts[ext] {
		return "video"
	}
	if audioExts[ext] {
		return "audio"
	}
	if archiveExts[ext] {
		return "archive"
	}
	if documentExts[ext] {
		return "document"
	}
	if codeExts[ext] {
		return "code"
	}

	if strings.Contains(ct, "image") {
		return "image"
	}
	if strings.Contains(ct, "video") {
		return "video"
	}
	if strings.Contains(ct, "audio") {
		return "audio"
	}
	if strings.Contains(ct, "pdf") || strings.Contains(ct, "document") {
		return "document"
	}

	return "link"
}
