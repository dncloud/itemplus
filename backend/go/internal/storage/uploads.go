package storage

import (
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/itemplus/backend/internal/config"
)

type StoredUpload struct {
	OriginalName string
	StorageName  string
	RelativePath string
	FullPath     string
	Extension    string
	Size         int64
	ContentType  string
}

func StoreUploadedFile(c *gin.Context, file *multipart.FileHeader, destinationDir, relativeDir string) (*StoredUpload, error) {
	if file == nil {
		return nil, fmt.Errorf("No file provided")
	}
	if file.Size > config.C.MaxUploadSize {
		return nil, fmt.Errorf("File too large")
	}
	if !isAllowedExtension(file.Filename) {
		return nil, fmt.Errorf("File type not allowed")
	}

	ext := strings.ToLower(path.Ext(file.Filename))
	src, err := file.Open()
	if err != nil {
		return nil, fmt.Errorf("Failed to read file")
	}
	magicBuf := make([]byte, 512)
	n, _ := io.ReadAtLeast(src, magicBuf, 1)
	src.Close()
	if n > 0 {
		if err := validateMagicBytes(magicBuf[:n], ext); err != nil {
			return nil, fmt.Errorf("File content does not match its extension")
		}
	}

	originalName := safeFilename(file.Filename)
	storageName := uuid.New().String() + ext
	fullPath := filepath.Join(destinationDir, storageName)
	if err := os.MkdirAll(destinationDir, 0755); err != nil {
		return nil, fmt.Errorf("Upload failed")
	}
	if err := c.SaveUploadedFile(file, fullPath); err != nil {
		return nil, fmt.Errorf("Upload failed")
	}

	contentType := file.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	return &StoredUpload{
		OriginalName: originalName,
		StorageName:  storageName,
		RelativePath: path.Join(relativeDir, storageName),
		FullPath:     fullPath,
		Extension:    ext,
		Size:         file.Size,
		ContentType:  contentType,
	}, nil
}

var allowedExtensions = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
	".svg": true, ".bmp": true, ".heic": true, ".heif": true, ".avif": true,
	".tiff": true, ".tif": true,
	".pdf": true, ".doc": true, ".docx": true, ".xls": true, ".xlsx": true,
	".ppt": true, ".pptx": true, ".odt": true, ".ods": true, ".odp": true,
	".rtf": true, ".csv": true, ".tsv": true,
	".zip": true, ".tar": true, ".gz": true, ".tgz": true, ".bz2": true,
	".7z": true, ".rar": true, ".iso": true, ".dmg": true, ".img": true,
	".mp3": true, ".wav": true, ".flac": true, ".ogg": true, ".m4a": true,
	".aac": true, ".wma": true, ".opus": true, ".aiff": true, ".mid": true, ".midi": true,
	".mp4": true, ".mov": true, ".avi": true, ".mkv": true, ".webm": true,
	".flv": true, ".wmv": true, ".m4v": true, ".mpg": true, ".mpeg": true, ".m3u8": true,
	".txt": true, ".log": true, ".md": true, ".json": true, ".xml": true,
	".yaml": true, ".yml": true, ".toml": true, ".ini": true, ".cfg": true,
	".conf": true, ".py": true, ".js": true, ".ts": true,
	".go": true, ".rs": true, ".c": true, ".cpp": true, ".h": true,
	".java": true, ".swift": true, ".sql": true, ".html": true, ".css": true,
	".sh": true, ".bat": true,
}

func isAllowedExtension(filename string) bool {
	ext := strings.ToLower(path.Ext(filename))
	return allowedExtensions[ext]
}

var textExtensions = map[string]bool{
	".txt": true, ".log": true, ".md": true, ".json": true, ".xml": true,
	".yaml": true, ".yml": true, ".toml": true, ".ini": true, ".cfg": true,
	".conf": true, ".py": true, ".js": true, ".ts": true,
	".go": true, ".rs": true, ".c": true, ".cpp": true, ".h": true,
	".java": true, ".swift": true, ".sql": true, ".html": true, ".css": true,
	".sh": true, ".bat": true, ".csv": true, ".tsv": true, ".rtf": true,
	".svg": true,
}

func validateMagicBytes(header []byte, ext string) error {
	ext = strings.ToLower(ext)
	n := len(header)

	switch ext {
	case ".jpg", ".jpeg":
		if n < 3 || header[0] != 0xFF || header[1] != 0xD8 || header[2] != 0xFF {
			return fmt.Errorf("file content does not match JPEG format")
		}
	case ".png":
		if n < 4 || header[0] != 0x89 || header[1] != 0x50 || header[2] != 0x4E || header[3] != 0x47 {
			return fmt.Errorf("file content does not match PNG format")
		}
	case ".gif":
		if n < 4 || header[0] != 0x47 || header[1] != 0x49 || header[2] != 0x46 || header[3] != 0x38 {
			return fmt.Errorf("file content does not match GIF format")
		}
	case ".pdf":
		if n < 4 || header[0] != 0x25 || header[1] != 0x50 || header[2] != 0x44 || header[3] != 0x46 {
			return fmt.Errorf("file content does not match PDF format")
		}
	case ".zip", ".docx", ".xlsx", ".pptx", ".odt", ".ods", ".odp":
		if n < 2 || header[0] != 0x50 || header[1] != 0x4B {
			return fmt.Errorf("file content does not match ZIP/Office format")
		}
	default:
		if textExtensions[ext] && !utf8.Valid(header) {
			return fmt.Errorf("file content is not valid UTF-8 for text file type %s", ext)
		}
	}
	return nil
}

func safeFilename(name string) string {
	if i := strings.LastIndex(name, "/"); i >= 0 {
		name = name[i+1:]
	}
	if i := strings.LastIndex(name, "\\"); i >= 0 {
		name = name[i+1:]
	}
	name = strings.TrimLeft(name, ".")
	if name == "" {
		name = "upload"
	}
	return name
}
