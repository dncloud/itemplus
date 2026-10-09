package items

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/storage"
)

// Reasons why an uploaded file counts as unconnected.
const (
	UnconnectedItemDeleted   = "item_deleted" // the item it belonged to no longer exists
	UnconnectedNotReferenced = "unreferenced" // the item exists, but nothing points to the file
)

// UnconnectedFile is an uploaded file in an item folder that no existing
// item uses any more.
type UnconnectedFile struct {
	Path         string    `json:"path"` // relative to the upload directory, with forward slashes
	Realm        string    `json:"realm"`
	ItemID       int       `json:"item_id"`       // 0 when the folder name is not an item id
	OriginalName string    `json:"original_name"` // empty when no attachment record is left
	Size         int64     `json:"size"`
	ModifiedAt   time.Time `json:"modified_at"`
	Reason       string    `json:"reason"`

	attachmentID int
}

type attachmentRecord struct {
	ID       int    `db:"id"`
	ItemID   int    `db:"item_id"`
	Filename string `db:"filename"`
	FilePath string `db:"file_path"`
}

// ListUnconnectedFiles walks the item folders of the upload directory
// (<uploads>/archive/<item id>/… and <uploads>/collection/<item id>/…) and
// returns the files no existing item uses: files of deleted items, and files
// in the folder of an existing item that neither an attachment nor a file
// property refers to. Other parts of the upload directory, such as user
// avatars, are not looked at.
func ListUnconnectedFiles() ([]UnconnectedFile, error) {
	files := []UnconnectedFile{}
	for _, realm := range []string{"archive", "collection"} {
		found, err := listUnconnectedFilesOfRealm(realm)
		if err != nil {
			return nil, err
		}
		files = append(files, found...)
	}
	sort.Slice(files, func(i, j int) bool { return files[i].Path < files[j].Path })
	return files, nil
}

func listUnconnectedFilesOfRealm(realm string) ([]UnconnectedFile, error) {
	root := filepath.Join(config.C.UploadDir, realm)
	if _, err := os.Stat(root); err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	// Everything is read from the database before the folder walk starts.
	var itemIDs []int
	if err := database.DB.Select(&itemIDs, fmt.Sprintf("SELECT id FROM %s_items", realm)); err != nil {
		return nil, err
	}
	existingItems := make(map[int]bool, len(itemIDs))
	for _, id := range itemIDs {
		existingItems[id] = true
	}

	var records []attachmentRecord
	if err := database.DB.Select(&records, fmt.Sprintf(
		"SELECT id, item_id, filename, file_path FROM %s_attachments WHERE COALESCE(storage_backend, 'local') = 'local' AND COALESCE(file_path, '') <> ''", realm,
	)); err != nil {
		return nil, err
	}
	recordByPath := make(map[string]attachmentRecord, len(records))
	for _, record := range records {
		recordByPath[filepath.ToSlash(record.FilePath)] = record
	}

	propertyPaths, err := propertyFilePaths(realm)
	if err != nil {
		return nil, err
	}

	var files []UnconnectedFile
	err = filepath.WalkDir(root, func(fullPath string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil || !entry.Type().IsRegular() {
			return nil // unreadable entries, folders and links are skipped
		}
		relToRealm, err := filepath.Rel(root, fullPath)
		if err != nil {
			return nil
		}
		relative := realm + "/" + filepath.ToSlash(relToRealm)
		itemID, _ := strconv.Atoi(strings.SplitN(filepath.ToSlash(relToRealm), "/", 2)[0])

		record, hasRecord := recordByPath[relative]
		itemExists := itemID > 0 && existingItems[itemID]
		if itemExists && ((hasRecord && record.ItemID == itemID) || propertyPaths[relative]) {
			return nil // in use
		}

		info, err := entry.Info()
		if err != nil {
			return nil
		}
		file := UnconnectedFile{
			Path: relative, Realm: realm, ItemID: itemID,
			Size: info.Size(), ModifiedAt: info.ModTime().UTC(),
			Reason: UnconnectedNotReferenced,
		}
		if !itemExists {
			file.Reason = UnconnectedItemDeleted
		}
		if hasRecord {
			file.OriginalName, file.attachmentID = record.Filename, record.ID
		}
		files = append(files, file)
		return nil
	})
	return files, err
}

// propertyFilePaths returns the upload paths that file properties of
// existing items point to. Such a value is stored as JSON with a "path" key.
func propertyFilePaths(realm string) (map[string]bool, error) {
	var values []string
	if err := database.DB.Select(&values, fmt.Sprintf(
		"SELECT ip.value FROM %s_item_properties ip JOIN %s_items i ON i.id = ip.item_id WHERE ip.value LIKE ?", realm, realm,
	), `%"path"%`); err != nil {
		return nil, err
	}
	paths := map[string]bool{}
	for _, value := range values {
		var parsed struct {
			Path string `json:"path"`
		}
		if json.Unmarshal([]byte(value), &parsed) == nil && parsed.Path != "" {
			paths[filepath.ToSlash(parsed.Path)] = true
		}
	}
	return paths, nil
}

// DeleteUnconnectedFiles removes the given files, but only those that are
// unconnected at this moment: the list is computed afresh, so a path that is
// in use, lies outside the item folders or does not exist is left alone and
// returned in skipped. The attachment record of a removed file goes with it.
func DeleteUnconnectedFiles(paths []string) (deleted []string, skipped []string, err error) {
	current, err := ListUnconnectedFiles()
	if err != nil {
		return nil, nil, err
	}
	unconnected := make(map[string]UnconnectedFile, len(current))
	for _, file := range current {
		unconnected[file.Path] = file
	}

	deleted, skipped = []string{}, []string{}
	for _, requested := range paths {
		file, ok := unconnected[filepath.ToSlash(strings.TrimSpace(requested))]
		if !ok {
			skipped = append(skipped, requested)
			continue
		}
		_, fullPath, resolveErr := storage.ResolveUploadPath(config.C.UploadDir, file.Path)
		if resolveErr != nil || os.Remove(fullPath) != nil {
			skipped = append(skipped, requested)
			continue
		}
		if file.attachmentID > 0 {
			if _, err := database.DB.Exec(fmt.Sprintf("DELETE FROM %s_attachments WHERE id = ?", file.Realm), file.attachmentID); err != nil {
				return deleted, skipped, err
			}
		}
		removeEmptyFolders(filepath.Dir(fullPath), filepath.Join(config.C.UploadDir, file.Realm))
		deleted = append(deleted, file.Path)
		delete(unconnected, file.Path) // the same path twice in one request
	}
	return deleted, skipped, nil
}

// removeEmptyFolders removes folder and its parents while they are empty,
// stopping below stopAt, which always stays.
func removeEmptyFolders(folder, stopAt string) {
	stopAt = filepath.Clean(stopAt)
	for folder = filepath.Clean(folder); folder != stopAt && strings.HasPrefix(folder, stopAt+string(os.PathSeparator)); folder = filepath.Dir(folder) {
		if os.Remove(folder) != nil {
			return // not empty
		}
	}
}
