package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/itemplus/backend/internal/config"
)

const UpdateStatusSettingKey = "update.status"

type UpdateStatus struct {
	CheckedAt              string `json:"checked_at"`
	InstalledVersion       string `json:"installed_version"`
	InstalledBuild         string `json:"installed_build"`
	LatestReleaseVersion   string `json:"latest_release_version,omitempty"`
	LatestReleaseBuild     string `json:"latest_release_build,omitempty"`
	LatestReleaseURL       string `json:"latest_release_url,omitempty"`
	LatestReleaseAssetName string `json:"latest_release_asset_name,omitempty"`
	LatestCommit           string `json:"latest_commit,omitempty"`
	DownloadedAt           string `json:"downloaded_at,omitempty"`
	DownloadedVersion      string `json:"downloaded_version,omitempty"`
	DownloadedBuild        string `json:"downloaded_build,omitempty"`
	DownloadedPath         string `json:"downloaded_path,omitempty"`
	DownloadedAssetName    string `json:"downloaded_asset_name,omitempty"`
	ReleaseUpdateAvailable bool   `json:"release_update_available"`
	CommitUpdateAvailable  bool   `json:"commit_update_available"`
	Status                 string `json:"status"`
	Error                  string `json:"error,omitempty"`
}

type GitHubRelease struct {
	TagName         string               `json:"tag_name"`
	HTMLURL         string               `json:"html_url"`
	TargetCommitish string               `json:"target_commitish"`
	Assets          []GitHubReleaseAsset `json:"assets"`
}

type GitHubReleaseAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
	Size               int64  `json:"size"`
}

type GitHubRef struct {
	Object struct {
		Type string `json:"type"`
		SHA  string `json:"sha"`
		URL  string `json:"url"`
	} `json:"object"`
}

type GitHubTag struct {
	Object struct {
		Type string `json:"type"`
		SHA  string `json:"sha"`
		URL  string `json:"url"`
	} `json:"object"`
}

type GitHubCommit struct {
	SHA string `json:"sha"`
}

func CheckForUpdates(ctx context.Context, repo string, client *http.Client) (*UpdateStatus, error) {
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	if strings.TrimSpace(repo) == "" {
		repo = "dncloud/itemplus"
	}

	installedVersion, installedBuild := SplitVersionDisplay(config.C.AppVersion)
	status := UpdateStatus{
		CheckedAt:        time.Now().UTC().Format(time.RFC3339),
		InstalledVersion: installedVersion,
		InstalledBuild:   installedBuild,
		Status:           "ok",
	}

	release, err := FetchLatestRelease(ctx, client, repo)
	if err != nil {
		status.Status = "error"
		status.Error = err.Error()
		return &status, err
	}

	latestVersion := strings.TrimPrefix(strings.TrimSpace(release.TagName), "v")
	status.LatestReleaseVersion = latestVersion
	status.LatestReleaseURL = release.HTMLURL
	status.ReleaseUpdateAvailable = compareVersions(latestVersion, installedVersion) > 0
	if asset, ok := SelectServerReleaseAsset(release.Assets, "", ""); ok {
		status.LatestReleaseAssetName = asset.Name
	}

	if release.TagName != "" {
		if releaseCommit, refErr := fetchReleaseCommit(ctx, client, repo, release.TagName); refErr == nil {
			status.LatestReleaseBuild = shortSHA(releaseCommit)
			if sameCommit(status.InstalledBuild, status.LatestReleaseBuild) {
				status.CommitUpdateAvailable = false
			} else if status.ReleaseUpdateAvailable || status.LatestReleaseBuild != "" {
				status.CommitUpdateAvailable = !sameCommit(status.InstalledBuild, status.LatestReleaseBuild)
			}
		}
	}

	if latestCommit, commitErr := fetchLatestMainCommit(ctx, client, repo); commitErr == nil {
		status.LatestCommit = shortSHA(latestCommit)
		status.CommitUpdateAvailable = status.CommitUpdateAvailable || !sameCommit(status.InstalledBuild, status.LatestCommit)
	}

	return &status, nil
}

func SplitVersionDisplay(display string) (string, string) {
	display = strings.TrimSpace(display)
	if display == "" {
		return "", ""
	}
	before, after, ok := strings.Cut(display, " build ")
	if !ok {
		return display, ""
	}
	return strings.TrimSpace(before), strings.TrimSpace(after)
}

func FetchLatestRelease(ctx context.Context, client *http.Client, repo string) (*GitHubRelease, error) {
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	if strings.TrimSpace(repo) == "" {
		repo = "dncloud/itemplus"
	}
	var release GitHubRelease
	if err := fetchGitHubJSON(ctx, client, fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", repo), &release); err != nil {
		return nil, err
	}
	if strings.TrimSpace(release.TagName) == "" {
		return nil, fmt.Errorf("latest release has no tag")
	}
	return &release, nil
}

func SelectServerReleaseAsset(assets []GitHubReleaseAsset, goos string, goarch string) (GitHubReleaseAsset, bool) {
	goos = strings.TrimSpace(goos)
	goarch = strings.TrimSpace(goarch)
	if goos == "" {
		goos = runtime.GOOS
	}
	if goarch == "" {
		goarch = runtime.GOARCH
	}
	osName := goos
	if osName == "darwin" {
		osName = "macos"
	}
	required := []string{"itemplus", osName, goarch}
	for _, asset := range assets {
		name := strings.ToLower(asset.Name)
		if strings.Contains(name, "itemplus-update") {
			continue
		}
		matches := true
		for _, part := range required {
			if !strings.Contains(name, strings.ToLower(part)) {
				matches = false
				break
			}
		}
		if matches && strings.TrimSpace(asset.BrowserDownloadURL) != "" {
			return asset, true
		}
	}
	return GitHubReleaseAsset{}, false
}

func fetchReleaseCommit(ctx context.Context, client *http.Client, repo string, tag string) (string, error) {
	var ref GitHubRef
	if err := fetchGitHubJSON(ctx, client, fmt.Sprintf("https://api.github.com/repos/%s/git/ref/tags/%s", repo, strings.TrimPrefix(tag, "refs/tags/")), &ref); err != nil {
		return "", err
	}
	if ref.Object.Type == "commit" {
		return ref.Object.SHA, nil
	}
	if ref.Object.Type == "tag" && ref.Object.URL != "" {
		var tagObj GitHubTag
		if err := fetchGitHubJSON(ctx, client, ref.Object.URL, &tagObj); err != nil {
			return "", err
		}
		return tagObj.Object.SHA, nil
	}
	return ref.Object.SHA, nil
}

func fetchLatestMainCommit(ctx context.Context, client *http.Client, repo string) (string, error) {
	var commit GitHubCommit
	if err := fetchGitHubJSON(ctx, client, fmt.Sprintf("https://api.github.com/repos/%s/commits/main", repo), &commit); err != nil {
		return "", err
	}
	return commit.SHA, nil
}

func fetchGitHubJSON(ctx context.Context, client *http.Client, url string, target interface{}) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "itemplus-update")
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("GitHub returned HTTP %d", res.StatusCode)
	}
	return json.NewDecoder(res.Body).Decode(target)
}

func shortSHA(value string) string {
	value = strings.TrimSpace(value)
	if len(value) > 7 {
		return value[:7]
	}
	return value
}

func sameCommit(left, right string) bool {
	left = strings.TrimSpace(left)
	right = strings.TrimSpace(right)
	if left == "" || right == "" {
		return false
	}
	return strings.HasPrefix(left, right) || strings.HasPrefix(right, left)
}

var versionPartPattern = regexp.MustCompile(`\d+`)

func compareVersions(left, right string) int {
	leftParts := versionPartPattern.FindAllString(left, -1)
	rightParts := versionPartPattern.FindAllString(right, -1)
	maxLen := len(leftParts)
	if len(rightParts) > maxLen {
		maxLen = len(rightParts)
	}
	for i := 0; i < maxLen; i++ {
		leftValue := 0
		rightValue := 0
		if i < len(leftParts) {
			leftValue, _ = strconv.Atoi(leftParts[i])
		}
		if i < len(rightParts) {
			rightValue, _ = strconv.Atoi(rightParts[i])
		}
		if leftValue > rightValue {
			return 1
		}
		if leftValue < rightValue {
			return -1
		}
	}
	return 0
}
