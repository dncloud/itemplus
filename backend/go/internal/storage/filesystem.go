package storage

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type FilesystemSourceConfig struct {
	BasePath string
}

type FilesystemFileStream struct {
	file    *os.File
	Size    int64
	ModTime time.Time
}

func (s *FilesystemFileStream) Read(p []byte) (int, error) {
	return s.file.Read(p)
}

func (s *FilesystemFileStream) Seek(offset int64, whence int) (int64, error) {
	return s.file.Seek(offset, whence)
}

func (s *FilesystemFileStream) Close() error {
	if s.file == nil {
		return nil
	}
	return s.file.Close()
}

func ResolveFilesystemPath(basePath, attachmentPath string) (string, string, error) {
	base := normalizeFilesystemPath(basePath)
	if base == "" {
		return "", "", fmt.Errorf("missing filesystem base path")
	}

	raw := strings.TrimSpace(attachmentPath)
	if raw == "" {
		return "", "", fmt.Errorf("empty filesystem attachment path")
	}

	var fullPath string
	if filepath.IsAbs(raw) {
		fullPath = filepath.Clean(raw)
	} else {
		fullPath = filepath.Join(base, filepath.Clean(raw))
	}

	fullAbs, err := filepath.Abs(fullPath)
	if err != nil {
		return "", "", fmt.Errorf("resolve filesystem file: %w", err)
	}

	relToBase, err := filepath.Rel(base, fullAbs)
	if err != nil {
		return "", "", fmt.Errorf("validate filesystem path: %w", err)
	}
	if relToBase == "." || relToBase == "" {
		return "", "", fmt.Errorf("invalid filesystem attachment path")
	}
	if relToBase == ".." || strings.HasPrefix(relToBase, ".."+string(os.PathSeparator)) {
		return "", "", fmt.Errorf("filesystem attachment path escapes base path")
	}

	return filepath.ToSlash(relToBase), fullAbs, nil
}

func OpenFilesystemFileStream(_ context.Context, source FilesystemSourceConfig, attachmentPath string) (*FilesystemFileStream, error) {
	_, fullPath, err := ResolveFilesystemPath(source.BasePath, attachmentPath)
	if err != nil {
		return nil, err
	}

	file, err := os.Open(fullPath)
	if err != nil {
		return nil, fmt.Errorf("open filesystem file: %w", err)
	}

	stat, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, fmt.Errorf("stat filesystem file: %w", err)
	}

	return &FilesystemFileStream{
		file:    file,
		Size:    stat.Size(),
		ModTime: stat.ModTime(),
	}, nil
}

func ListFilesystemDirectory(_ context.Context, source FilesystemSourceConfig, attachmentPath string) ([]SFTPDirectoryEntry, error) {
	base := normalizeFilesystemPath(source.BasePath)
	if base == "" {
		return nil, fmt.Errorf("missing filesystem base path")
	}

	fullDir := base
	trimmed := strings.TrimSpace(attachmentPath)
	if trimmed != "" {
		_, resolved, err := ResolveFilesystemPath(base, trimmed)
		if err != nil {
			return nil, err
		}
		fullDir = resolved
	}

	entries, err := os.ReadDir(fullDir)
	if err != nil {
		return nil, fmt.Errorf("read filesystem directory: %w", err)
	}

	items := make([]SFTPDirectoryEntry, 0, len(entries))
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		fullPath := filepath.Join(fullDir, entry.Name())
		relToBase, err := filepath.Rel(base, fullPath)
		if err != nil {
			continue
		}
		items = append(items, SFTPDirectoryEntry{
			Name:       entry.Name(),
			Path:       filepath.ToSlash(relToBase),
			IsDir:      entry.IsDir(),
			Size:       info.Size(),
			ModifiedAt: info.ModTime().UTC(),
		})
	}

	return items, nil
}

func TestFilesystemSource(_ context.Context, source FilesystemSourceConfig) error {
	base := normalizeFilesystemPath(source.BasePath)
	if base == "" {
		return fmt.Errorf("missing filesystem base path")
	}

	info, err := os.Stat(base)
	if err != nil {
		return fmt.Errorf("stat filesystem base path: %w", err)
	}
	if !info.IsDir() {
		return fmt.Errorf("filesystem base path is not a directory")
	}
	return nil
}

func normalizeFilesystemPath(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	cleaned := filepath.Clean(raw)
	if !filepath.IsAbs(cleaned) {
		return ""
	}
	abs, err := filepath.Abs(cleaned)
	if err != nil {
		return ""
	}
	return abs
}
