package auth

import (
	"errors"
	"fmt"
	"github.com/itemplus/backend/internal/http/middleware"
	"os"
	"path/filepath"
	"strings"

	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/storage"
)

type userDeletionBlockedError struct {
	activeCheckouts int
}

type userDeletionAdminError struct{}

func (e userDeletionBlockedError) Error() string {
	if e.activeCheckouts > 0 {
		return fmt.Sprintf("Account cannot be deleted while it still has %d active checkout(s). Please return them first.", e.activeCheckouts)
	}
	return "Account deletion is currently blocked"
}

func (e userDeletionAdminError) Error() string {
	return "Administrator accounts cannot be deleted from the app."
}

func countUserDeleteBlocks(userID int) (int, error) {
	var activeArchive int
	if err := database.DB.Get(&activeArchive, "SELECT COUNT(*) FROM archive_checkouts WHERE user_id = ? AND status = 'active'", userID); err != nil {
		return 0, err
	}
	var activeCollection int
	if err := database.DB.Get(&activeCollection, "SELECT COUNT(*) FROM collection_checkouts WHERE user_id = ? AND status = 'active'", userID); err != nil {
		return 0, err
	}
	return activeArchive + activeCollection, nil
}

func DeleteUserAccount(userID int, actorID int, selfService bool) error {
	user, err := loadVisibleUserByID(userID)
	if err != nil {
		return err
	}
	if user.IsAdmin {
		return userDeletionAdminError{}
	}

	activeCheckouts, err := countUserDeleteBlocks(userID)
	if err != nil {
		return err
	}
	if activeCheckouts > 0 {
		return userDeletionBlockedError{activeCheckouts: activeCheckouts}
	}

	tx, err := database.DB.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM device_sessions WHERE user_id = ?", userID); err != nil {
		return err
	}
	if _, err := tx.Exec("DELETE FROM checkout_requests WHERE user_id = ?", userID); err != nil {
		return err
	}
	if _, err := tx.Exec("UPDATE archive_locations SET manager_id = NULL WHERE manager_id = ?", userID); err != nil {
		return err
	}
	if _, err := tx.Exec("UPDATE collection_locations SET manager_id = NULL WHERE manager_id = ?", userID); err != nil {
		return err
	}
	if user.Email != nil && *user.Email != "" {
		if _, err := tx.Exec("DELETE FROM magic_link_tokens WHERE email = ?", *user.Email); err != nil {
			return err
		}
	}
	if err := deleteUserAvatarFile(user.AvatarPath); err != nil {
		return err
	}

	if _, err := tx.Exec("DELETE FROM users WHERE id = ?", userID); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	if actorID > 0 {
		action := "user.delete"
		detail := fmt.Sprintf("target_user=%d deleted", userID)
		if selfService {
			action = "user.delete_self"
			detail = "self-service account deletion"
		}
		middleware.Audit(actorID, action, detail)
	}

	return nil
}

func deleteUserAvatarFile(relativePath *string) error {
	if relativePath == nil || strings.TrimSpace(*relativePath) == "" {
		return nil
	}
	_, fullPath, err := storage.ResolveUploadPath(config.C.UploadDir, *relativePath)
	if err != nil {
		return err
	}
	if err := os.Remove(fullPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	parentDir := filepath.Dir(fullPath)
	rootDir := filepath.Join(config.C.UploadDir, "users")
	if strings.HasPrefix(parentDir, rootDir) {
		_ = os.Remove(parentDir)
	}
	return nil
}
