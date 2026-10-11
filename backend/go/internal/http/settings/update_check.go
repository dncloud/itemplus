package settings

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/itemplus/backend/internal/config"
	updatescore "github.com/itemplus/backend/internal/core/updates"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/netguard"
)

const (
	updateCheckRepo = "dncloud/itemplus"
	// The first check waits until the server has settled after its start.
	updateCheckFirstDelay = time.Minute
	updateCheckInterval   = 24 * time.Hour
	updateCheckTimeout    = 20 * time.Second
)

// StartUpdateChecker asks GitHub once a day whether a newer release exists
// and stores the answer for the notice in the app. It does this only when
// the configuration file sets UPDATE_CHECK to "release" or "build"; otherwise
// it returns false and the server contacts nobody. Nothing is ever
// downloaded or installed.
func StartUpdateChecker() bool {
	if config.C.UpdateCheck == "" {
		return false
	}
	go func() {
		timer := time.NewTimer(updateCheckFirstDelay)
		defer timer.Stop()
		for range timer.C {
			if err := runUpdateCheck(netguard.NewPublicHTTPClient(updateCheckTimeout)); err != nil {
				log.Printf("Update check failed: %v", err)
			}
			timer.Reset(updateCheckInterval)
		}
	}()
	return true
}

// runUpdateCheck does one check and stores its result, also when it failed,
// so the app can say that and when the last check did not get through.
func runUpdateCheck(client *http.Client) error {
	ctx, cancel := context.WithTimeout(context.Background(), updateCheckTimeout)
	defer cancel()

	check := updatescore.CheckForReleaseUpdate
	if config.C.UpdateCheck == config.UpdateCheckBuild {
		check = updatescore.CheckForUpdatesForVersion
	}
	status, checkErr := check(ctx, updateCheckRepo, client, config.C.AppVersion)
	if status == nil {
		return checkErr
	}
	status.InstalledSource = "running server"
	data, err := json.Marshal(status)
	if err != nil {
		return err
	}
	if err := database.UpsertAppSetting(updatescore.UpdateStatusSettingKey, string(data), database.TimestampNow()); err != nil {
		return err
	}
	return checkErr
}
