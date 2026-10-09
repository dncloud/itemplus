package items

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/storage"
	"github.com/jmoiron/sqlx"
)

// Deleting through this file removes dependent rows explicitly instead of
// relying on foreign keys. SQLite cascades them, but the MySQL schema is
// created without foreign keys, so there every dependent row would stay
// behind. Uploaded files are not covered by any database rule at all.

func validRealm(realm string) bool {
	return realm == "archive" || realm == "collection"
}

// itemOwnedTables lists the per-realm tables whose rows mean nothing without
// their item, with the column that references it.
func itemOwnedTables(realm string) [][2]string {
	return [][2]string{
		{realm + "_item_properties", "item_id"},
		{realm + "_item_components", "parent_item_id"},
		{realm + "_item_components", "child_item_id"},
		{realm + "_inventory_movements", "item_id"},
		{realm + "_maintenance_history", "item_id"},
		{realm + "_maintenance_reminders", "item_id"},
	}
}

// DeleteItem removes an item with its property values, bundle links, stock
// movements and maintenance entries. It reports false when the item does not
// exist.
//
// Two things deliberately outlive the item:
//   - Checkouts. A loan does not end because the item was removed from the
//     inventory; it stays visible as a loan of an unknown item until it is
//     returned.
//   - Uploaded files. They are not deleted here. The attachment rows of local
//     files stay as a record of what the files were, and an administrator
//     removes them later from the list of unconnected files (see
//     ListUnconnectedFiles). Attachments without a local file (links,
//     external sources) have nothing to keep and are removed.
func DeleteItem(realm string, itemID interface{}) (bool, error) {
	if !validRealm(realm) {
		return false, fmt.Errorf("invalid realm %q", realm)
	}

	found := false
	err := database.WithoutCascades(func(tx *sqlx.Tx) error {
		for _, owned := range itemOwnedTables(realm) {
			if _, err := tx.Exec(fmt.Sprintf("DELETE FROM %s WHERE %s = ?", owned[0], owned[1]), itemID); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(
			fmt.Sprintf("DELETE FROM %s_attachments WHERE item_id = ? AND (COALESCE(storage_backend, 'local') <> 'local' OR COALESCE(file_path, '') = '')", realm),
			itemID,
		); err != nil {
			return err
		}
		result, err := tx.Exec(fmt.Sprintf("DELETE FROM %s_items WHERE id = ?", realm), itemID)
		if err != nil {
			return err
		}
		affected, _ := result.RowsAffected()
		found = affected > 0
		if !found {
			return errItemNotFound
		}
		return nil
	})
	if errors.Is(err, errItemNotFound) {
		return false, nil
	}
	return found, err
}

// errItemNotFound rolls the transaction back when there was no item to delete.
var errItemNotFound = errors.New("item not found")

// DeleteAttachment removes an attachment row and, for local uploads, its
// file. It reports false when the attachment does not exist.
func DeleteAttachment(realm string, attachmentID interface{}) (bool, error) {
	if !validRealm(realm) {
		return false, fmt.Errorf("invalid realm %q", realm)
	}
	table := realm + "_attachments"

	var attachment struct {
		FilePath string `db:"file_path"`
		Backend  string `db:"storage_backend"`
	}
	// A missing row is reported by the DELETE below.
	_ = database.DB.Get(&attachment,
		fmt.Sprintf("SELECT COALESCE(file_path, '') AS file_path, COALESCE(storage_backend, 'local') AS storage_backend FROM %s WHERE id = ?", table),
		attachmentID,
	)

	result, err := database.DB.Exec(fmt.Sprintf("DELETE FROM %s WHERE id = ?", table), attachmentID)
	if err != nil {
		return false, err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return false, nil
	}
	if attachment.Backend == "local" && attachment.FilePath != "" {
		removeUploadedFiles([]string{attachment.FilePath})
	}
	return true, nil
}

// DeleteProperty removes a property definition and the values items hold for
// it. It reports false when the property does not exist.
func DeleteProperty(realm string, propertyID interface{}) (bool, error) {
	if !validRealm(realm) {
		return false, fmt.Errorf("invalid realm %q", realm)
	}
	tx, err := database.DB.Beginx()
	if err != nil {
		return false, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(fmt.Sprintf("DELETE FROM %s_item_properties WHERE property_id = ?", realm), propertyID); err != nil {
		return false, err
	}
	result, err := tx.Exec(fmt.Sprintf("DELETE FROM %s_properties WHERE id = ?", realm), propertyID)
	if err != nil {
		return false, err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return false, nil
	}
	return true, tx.Commit()
}

// removeUploadedFiles deletes files below the upload directory and then the
// folders they leave empty. Paths that do not resolve inside the upload
// directory are skipped.
func removeUploadedFiles(relativePaths []string) {
	folders := map[string]bool{}
	for _, relativePath := range relativePaths {
		if strings.TrimSpace(relativePath) == "" {
			continue
		}
		_, fullPath, err := storage.ResolveUploadPath(config.C.UploadDir, relativePath)
		if err != nil {
			continue
		}
		_ = os.Remove(fullPath)
		folders[filepath.Dir(fullPath)] = true
	}
	uploadRoot, _ := filepath.Abs(config.C.UploadDir)
	for folder := range folders {
		if folder == uploadRoot {
			continue
		}
		// Fails, as intended, while anything is left in the folder.
		_ = os.Remove(folder)
	}
}

// InUseError says why a category or location cannot be deleted: items still
// belong to it, or (locations only) it still has sub-locations. Deleting it
// would leave those without the relation they were given.
type InUseError struct {
	Items    int // items assigned to it
	Children int // direct sub-locations
}

func (e *InUseError) Error() string {
	return fmt.Sprintf("still in use by %d items and %d sub-locations", e.Items, e.Children)
}

// CategoryUsage returns how many items are assigned to the category.
func CategoryUsage(realm string, categoryID interface{}) (*InUseError, error) {
	if !validRealm(realm) {
		return nil, fmt.Errorf("invalid realm %q", realm)
	}
	usage := &InUseError{}
	err := database.DB.Get(&usage.Items, fmt.Sprintf("SELECT COUNT(*) FROM %s_items WHERE category_id = ?", realm), categoryID)
	return usage, err
}

// LocationUsage returns how many items sit at the location and how many
// sub-locations it has.
func LocationUsage(realm string, locationID interface{}) (*InUseError, error) {
	if !validRealm(realm) {
		return nil, fmt.Errorf("invalid realm %q", realm)
	}
	usage := &InUseError{}
	if err := database.DB.Get(&usage.Items, fmt.Sprintf("SELECT COUNT(*) FROM %s_items WHERE location_id = ?", realm), locationID); err != nil {
		return nil, err
	}
	err := database.DB.Get(&usage.Children, fmt.Sprintf("SELECT COUNT(*) FROM %s_locations WHERE parent_id = ?", realm), locationID)
	return usage, err
}

// DeleteCategory removes a category that no item uses, together with its
// property definitions. A category that still has items is not deleted; the
// returned error is then an *InUseError. It reports false when the category
// does not exist.
func DeleteCategory(realm string, categoryID interface{}) (bool, error) {
	usage, err := CategoryUsage(realm, categoryID)
	if err != nil {
		return false, err
	}
	if usage.Items > 0 {
		return false, usage
	}

	tx, err := database.DB.Beginx()
	if err != nil {
		return false, err
	}
	defer tx.Rollback()

	// The category's properties go with it; MySQL would otherwise keep them.
	if _, err := tx.Exec(fmt.Sprintf(
		"DELETE FROM %s_item_properties WHERE property_id IN (SELECT id FROM %s_properties WHERE category_id = ?)", realm, realm,
	), categoryID); err != nil {
		return false, err
	}
	if _, err := tx.Exec(fmt.Sprintf("DELETE FROM %s_properties WHERE category_id = ?", realm), categoryID); err != nil {
		return false, err
	}
	result, err := tx.Exec(fmt.Sprintf("DELETE FROM %s_categories WHERE id = ?", realm), categoryID)
	if err != nil {
		return false, err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return false, nil
	}
	return true, tx.Commit()
}

// DeleteLocation removes a location that holds no items and has no
// sub-locations; otherwise the returned error is an *InUseError. It reports
// false when the location does not exist.
func DeleteLocation(realm string, locationID interface{}) (bool, error) {
	usage, err := LocationUsage(realm, locationID)
	if err != nil {
		return false, err
	}
	if usage.Items > 0 || usage.Children > 0 {
		return false, usage
	}
	result, err := database.DB.Exec(fmt.Sprintf("DELETE FROM %s_locations WHERE id = ?", realm), locationID)
	if err != nil {
		return false, err
	}
	affected, _ := result.RowsAffected()
	return affected > 0, nil
}
