package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/services"
)

func main() {
	checkFlag := flag.Bool("check", false, "Check GitHub releases for updates and store the result locally")
	downloadFlag := flag.Bool("download", false, "Download the latest matching server binary and store the result locally")
	jsonFlag := flag.Bool("json", false, "Print the update status as JSON")
	configFlag := flag.String("config", "", "Config file path (default: auto-discover itemplus.conf)")
	databaseFlag := flag.String("database", "", "Database URL override")
	outputFlag := flag.String("output", "", "Download directory (default: updates next to itemplus.conf)")
	repoFlag := flag.String("repo", "dncloud/itemplus", "GitHub repository to check")
	timeoutFlag := flag.Duration("timeout", 20*time.Second, "Network timeout for GitHub requests")
	flag.Parse()

	if !*checkFlag && !*downloadFlag {
		fmt.Fprintln(os.Stderr, "Usage: itemplus-update --check|--download [--config /path/itemplus.conf] [--json]")
		os.Exit(2)
	}

	config.SetConfigPath(*configFlag)
	config.Load()
	if *databaseFlag != "" {
		config.C.DatabaseURL = *databaseFlag
	}

	database.Connect()
	defer func() { _ = database.Close() }()

	ctx, cancel := context.WithTimeout(context.Background(), *timeoutFlag)
	defer cancel()
	client := &http.Client{Timeout: *timeoutFlag}

	status, err := services.CheckForUpdates(ctx, *repoFlag, client)
	if status != nil && !*downloadFlag {
		preserveDownloadedStatus(status)
	}
	if status != nil && *downloadFlag && err == nil {
		if downloadErr := downloadUpdate(ctx, client, *repoFlag, *outputFlag, status); downloadErr != nil {
			err = downloadErr
		}
	}
	if status != nil {
		if saveErr := saveStatus(*status); saveErr != nil && err == nil {
			err = saveErr
		}
	}
	if *jsonFlag {
		encoded, jsonErr := json.MarshalIndent(status, "", "  ")
		if jsonErr == nil {
			fmt.Println(string(encoded))
		}
	} else if status != nil {
		printStatus(*status)
	}
	if err != nil {
		log.Fatalf("Update check failed: %v", err)
	}
}

func saveStatus(status services.UpdateStatus) error {
	data, err := json.Marshal(status)
	if err != nil {
		return err
	}
	return database.UpsertAppSetting(services.UpdateStatusSettingKey, string(data), time.Now().UTC().Format(time.RFC3339))
}

func preserveDownloadedStatus(status *services.UpdateStatus) {
	var raw string
	if err := database.DB.Get(&raw, "SELECT value FROM app_settings WHERE `key` = ?", services.UpdateStatusSettingKey); err != nil {
		return
	}
	var previous services.UpdateStatus
	if err := json.Unmarshal([]byte(raw), &previous); err != nil {
		return
	}
	if previous.DownloadedBuild == "" || !strings.EqualFold(previous.DownloadedBuild, status.LatestReleaseBuild) {
		return
	}
	status.DownloadedAt = previous.DownloadedAt
	status.DownloadedVersion = previous.DownloadedVersion
	status.DownloadedBuild = previous.DownloadedBuild
	status.DownloadedPath = previous.DownloadedPath
	status.DownloadedAssetName = previous.DownloadedAssetName
}

func downloadUpdate(ctx context.Context, client *http.Client, repo string, outputDir string, status *services.UpdateStatus) error {
	release, err := services.FetchLatestRelease(ctx, client, repo)
	if err != nil {
		return err
	}
	asset, ok := services.SelectServerReleaseAsset(release.Assets, runtime.GOOS, runtime.GOARCH)
	if !ok {
		return fmt.Errorf("no server binary asset found for %s/%s", runtime.GOOS, runtime.GOARCH)
	}
	outputDir = strings.TrimSpace(outputDir)
	if outputDir == "" {
		outputDir = defaultDownloadDir()
	}
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return err
	}
	targetPath := filepath.Join(outputDir, asset.Name)
	if status.LatestReleaseBuild != "" {
		targetPath = filepath.Join(outputDir, fmt.Sprintf("%s-%s", strings.TrimSuffix(asset.Name, ".exe"), status.LatestReleaseBuild))
		if strings.HasSuffix(asset.Name, ".exe") {
			targetPath += ".exe"
		}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, asset.BrowserDownloadURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "itemplus-update")
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("download returned HTTP %d", res.StatusCode)
	}
	file, err := os.OpenFile(targetPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		return err
	}
	if _, err := io.Copy(file, res.Body); err != nil {
		_ = file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	status.DownloadedAt = time.Now().UTC().Format(time.RFC3339)
	status.DownloadedVersion = status.LatestReleaseVersion
	status.DownloadedBuild = status.LatestReleaseBuild
	status.DownloadedPath = targetPath
	status.DownloadedAssetName = asset.Name
	return nil
}

func defaultDownloadDir() string {
	if strings.TrimSpace(config.C.EnvPath) != "" {
		return filepath.Join(filepath.Dir(config.C.EnvPath), "updates")
	}
	if strings.TrimSpace(config.C.DataDir) != "" {
		return filepath.Join(filepath.Dir(config.C.DataDir), "updates")
	}
	executable, err := os.Executable()
	if err != nil {
		return "updates"
	}
	return filepath.Join(filepath.Dir(executable), "updates")
}

func printStatus(status services.UpdateStatus) {
	fmt.Printf("Database: %s\n", database.CurrentConnectionSummary())
	fmt.Printf("Installed: %s", status.InstalledVersion)
	if status.InstalledBuild != "" {
		fmt.Printf(" build %s", status.InstalledBuild)
	}
	fmt.Println()
	if status.LatestReleaseVersion != "" {
		fmt.Printf("Latest release: %s", status.LatestReleaseVersion)
		if status.LatestReleaseBuild != "" {
			fmt.Printf(" build %s", status.LatestReleaseBuild)
		}
		fmt.Println()
	}
	if status.LatestCommit != "" {
		fmt.Printf("Latest commit: %s\n", status.LatestCommit)
	}
	if status.LatestReleaseAssetName != "" {
		fmt.Printf("Release asset: %s\n", status.LatestReleaseAssetName)
	}
	if status.DownloadedPath != "" {
		fmt.Printf("Downloaded: %s", status.DownloadedPath)
		if status.DownloadedBuild != "" {
			fmt.Printf(" build %s", status.DownloadedBuild)
		}
		fmt.Println()
		fmt.Println("Stop the server, copy the downloaded binary into place, then start item+ again. Have fun.")
	}
	if status.ReleaseUpdateAvailable || status.CommitUpdateAvailable {
		fmt.Println("Update available.")
		return
	}
	fmt.Println("No update available.")
}
