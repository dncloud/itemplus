package settings

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
	updatescore "github.com/itemplus/backend/internal/core/updates"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/testdb"
)

// recordingTransport answers like GitHub and notes every address asked for.
type recordingTransport struct {
	urls []string
}

func (r *recordingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	r.urls = append(r.urls, req.URL.String())
	body := `{}`
	switch {
	case strings.HasSuffix(req.URL.Path, "/releases/latest"):
		body = `{"tag_name":"v99.0.0","html_url":"https://github.com/dncloud/itemplus/releases/tag/v99.0.0","assets":[]}`
	case strings.Contains(req.URL.Path, "/git/ref/tags/"):
		body = `{"object":{"type":"commit","sha":"abcdef1234567890"}}`
	case strings.HasSuffix(req.URL.Path, "/commits/main"):
		body = `{"sha":"abcdef1234567890"}`
	}
	return &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(body)), Request: req}, nil
}

func updateStatusResponse(t *testing.T) map[string]interface{} {
	t.Helper()
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodGet, "/update-status", nil)
	getUpdateStatus(c)
	var result map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil || rec.Code != http.StatusOK {
		t.Fatalf("status %d, err %v: %s", rec.Code, err, rec.Body.String())
	}
	return result
}

// item+ contacts nobody on its own: without a mode for UPDATE_CHECK in the
// configuration no checker runs and the app is told nothing is available,
// even if an earlier check left a result behind.
func TestUpdateCheckIsOffUnlessConfigured(t *testing.T) {
	testdb.Use(t)
	previous := config.C.UpdateCheck
	t.Cleanup(func() { config.C.UpdateCheck = previous })

	// Only the two modes switch it on; "true", a typo or nothing do not.
	for _, value := range []string{"", "false", "true", "1", "relaese", "yes"} {
		if mode := config.ParseUpdateCheck(value); mode != "" {
			t.Fatalf("UPDATE_CHECK=%q switches the check on (%q)", value, mode)
		}
	}
	if config.ParseUpdateCheck(" Release ") != config.UpdateCheckRelease || config.ParseUpdateCheck("BUILD") != config.UpdateCheckBuild {
		t.Fatal("the two modes are not recognised")
	}

	config.C.UpdateCheck = ""
	if StartUpdateChecker() {
		t.Fatal("the update checker started without a mode")
	}
	stale, _ := json.Marshal(updatescore.UpdateStatus{LatestReleaseVersion: "99.0.0", ReleaseUpdateAvailable: true, Status: "ok"})
	if err := database.UpsertAppSetting(updatescore.UpdateStatusSettingKey, string(stale), database.TimestampNow()); err != nil {
		t.Fatal(err)
	}
	if status := updateStatusResponse(t); status["available"] != false || status["check_enabled"] != false {
		t.Fatalf("with the check off the app is told %v", status)
	}
}

// With the check on, a run asks GitHub and nobody else and stores what it
// found. "release" asks only for the newest release and ignores builds;
// "build" also reports a newer commit.
func TestUpdateCheckModes(t *testing.T) {
	testdb.Use(t)
	previousCheck, previousVersion := config.C.UpdateCheck, config.C.AppVersion
	t.Cleanup(func() { config.C.UpdateCheck, config.C.AppVersion = previousCheck, previousVersion })

	run := func(mode, installed string) (map[string]interface{}, []string) {
		t.Helper()
		config.C.UpdateCheck = mode
		config.C.AppVersion = installed
		transport := &recordingTransport{}
		if err := runUpdateCheck(&http.Client{Transport: transport}); err != nil {
			t.Fatal(err)
		}
		for _, url := range transport.urls {
			if !strings.HasPrefix(url, "https://api.github.com/repos/dncloud/itemplus/") {
				t.Errorf("the check contacted %s", url)
			}
		}
		return updateStatusResponse(t), transport.urls
	}

	// An older release installed: both modes report the newer one.
	status, urls := run(config.UpdateCheckRelease, "1.3.4 build 14c561f")
	if status["available"] != true || status["check_mode"] != "release" || status["latest_release_version"] != "99.0.0" || status["installed_version"] != "1.3.4" {
		t.Fatalf("release mode, older version: %v", status)
	}
	if len(urls) != 1 || !strings.HasSuffix(urls[0], "/releases/latest") {
		t.Fatalf("release mode asked %v, want only the newest release", urls)
	}
	if _, has := status["downloaded_path"]; has {
		t.Fatal("the status still speaks of a download")
	}

	// The newest release installed, but built from another commit.
	status, urls = run(config.UpdateCheckBuild, "99.0.0 build 0000000")
	if status["available"] != true || status["commit_update_available"] != true || status["release_update_available"] != false {
		t.Fatalf("build mode, other build: %v", status)
	}
	if len(urls) < 2 {
		t.Fatalf("build mode asked only %v", urls)
	}

	// The same installation in release mode has nothing to report, and what
	// the build check stored a moment ago does not leak through.
	config.C.UpdateCheck = config.UpdateCheckRelease
	if status := updateStatusResponse(t); status["available"] != false {
		t.Fatalf("release mode reports a build stored earlier: %v", status)
	}
	if status, _ := run(config.UpdateCheckRelease, "99.0.0 build 0000000"); status["available"] != false || status["commit_update_available"] != false {
		t.Fatalf("release mode, other build: %v", status)
	}
}
