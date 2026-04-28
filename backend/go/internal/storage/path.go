package storage

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func ResolveUploadPath(baseDir, requestPath string) (string, string, error) {
	baseAbs, err := filepath.Abs(baseDir)
	if err != nil {
		return "", "", fmt.Errorf("resolve upload dir: %w", err)
	}

	trimmed := strings.TrimPrefix(requestPath, "/")
	cleanRel := filepath.Clean(trimmed)
	if cleanRel == "." || cleanRel == "" {
		return "", "", fmt.Errorf("empty upload path")
	}
	if filepath.IsAbs(cleanRel) || cleanRel == ".." || strings.HasPrefix(cleanRel, ".."+string(os.PathSeparator)) {
		return "", "", fmt.Errorf("invalid upload path")
	}

	fullPath := filepath.Join(baseAbs, cleanRel)
	fullAbs, err := filepath.Abs(fullPath)
	if err != nil {
		return "", "", fmt.Errorf("resolve upload file: %w", err)
	}

	relToBase, err := filepath.Rel(baseAbs, fullAbs)
	if err != nil {
		return "", "", fmt.Errorf("validate upload path: %w", err)
	}
	if relToBase == ".." || strings.HasPrefix(relToBase, ".."+string(os.PathSeparator)) {
		return "", "", fmt.Errorf("upload path escapes base directory")
	}

	return cleanRel, fullAbs, nil
}
