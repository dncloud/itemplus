package storage

import (
	"path/filepath"
	"testing"
)

func TestResolveUploadPathAcceptsChildPath(t *testing.T) {
	baseDir := filepath.Join(string(filepath.Separator), "srv", "itemplus", "uploads")

	relPath, fullPath, err := ResolveUploadPath(baseDir, "/archive/42/file.png")
	if err != nil {
		t.Fatalf("expected path to resolve, got error: %v", err)
	}
	if relPath != filepath.Join("archive", "42", "file.png") {
		t.Fatalf("unexpected relative path: %s", relPath)
	}
	expectedFull := filepath.Join(baseDir, "archive", "42", "file.png")
	if fullPath != expectedFull {
		t.Fatalf("unexpected full path: %s", fullPath)
	}
}

func TestResolveUploadPathRejectsTraversal(t *testing.T) {
	baseDir := filepath.Join(string(filepath.Separator), "srv", "itemplus", "uploads")

	if _, _, err := ResolveUploadPath(baseDir, "/../../itemplus.conf"); err == nil {
		t.Fatal("expected traversal path to be rejected")
	}
}
