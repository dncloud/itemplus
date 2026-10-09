package storage

import (
	"mime"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func fileResponseHeaders(t *testing.T, filename string) (dispositionType string, params map[string]string, csp string) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)

	SetFileResponseHeaders(c, filename)

	if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Fatalf("%s: X-Content-Type-Options = %q, want nosniff", filename, got)
	}
	dispositionType, params, err := mime.ParseMediaType(rec.Header().Get("Content-Disposition"))
	if err != nil {
		t.Fatalf("%s: unparsable Content-Disposition %q: %v", filename, rec.Header().Get("Content-Disposition"), err)
	}
	return dispositionType, params, rec.Header().Get("Content-Security-Policy")
}

func TestFileResponseHeadersDisposition(t *testing.T) {
	for filename, want := range map[string]string{
		"photo.JPG":   "inline",
		"manual.pdf":  "inline",
		"clip.mp4":    "inline",
		"page.html":   "attachment",
		"script.js":   "attachment",
		"archive.zip": "attachment",
		"noextension": "attachment",
	} {
		got, params, csp := fileResponseHeaders(t, filename)
		if got != want {
			t.Errorf("%s: disposition %q, want %q", filename, got, want)
		}
		if params["filename"] != filename {
			t.Errorf("%s: filename parameter %q", filename, params["filename"])
		}
		if csp != "" {
			t.Errorf("%s: unexpected Content-Security-Policy %q", filename, csp)
		}
	}
}

// An SVG is shown inline and may contain scripts, so opening it directly must
// not let it run anything in the app's origin.
func TestFileResponseHeadersSandboxSVG(t *testing.T) {
	for _, filename := range []string{"logo.svg", "LOGO.SVG"} {
		disposition, _, csp := fileResponseHeaders(t, filename)
		if disposition != "inline" {
			t.Errorf("%s: disposition %q, want inline", filename, disposition)
		}
		if csp != svgContentSecurityPolicy {
			t.Errorf("%s: Content-Security-Policy %q, want %q", filename, csp, svgContentSecurityPolicy)
		}
	}
}

func TestFileResponseHeadersKeepUnusualFilenamesIntact(t *testing.T) {
	for _, filename := range []string{`my "best" photo.png`, "Übersicht März.pdf", "a;b=c.png"} {
		_, params, _ := fileResponseHeaders(t, filename)
		if params["filename"] != filename {
			t.Errorf("filename %q came back as %q", filename, params["filename"])
		}
	}
}
