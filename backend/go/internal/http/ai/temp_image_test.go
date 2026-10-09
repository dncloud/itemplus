package ai

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	aicore "github.com/itemplus/backend/internal/core/ai"
)

var tinyPNG = []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89")

const scriptedSVG = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>`

func uploadTempImage(t *testing.T, declaredType string, content []byte) (int, map[string]interface{}) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	body := &bytes.Buffer{}
	form := multipart.NewWriter(body)
	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition", `form-data; name="file"; filename="upload"`)
	header.Set("Content-Type", declaredType)
	part, _ := form.CreatePart(header)
	_, _ = part.Write(content)
	_ = form.Close()

	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/", body)
	c.Request.Header.Set("Content-Type", form.FormDataContentType())
	uploadAITempImage(c)

	response := map[string]interface{}{}
	_ = json.Unmarshal(rec.Body.Bytes(), &response)
	return rec.Code, response
}

func TestTempImageUploadGoesByContentNotByClaim(t *testing.T) {
	// A real image is accepted whatever type the client names.
	status, response := uploadTempImage(t, "application/octet-stream", tinyPNG)
	if status != http.StatusOK || response["temp_image_id"] == nil {
		t.Fatalf("real PNG: status %d, response %v", status, response)
	}
	id := response["temp_image_id"].(string)

	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	c.Params = gin.Params{{Key: "id", Value: id}}
	getAITempImage(c)
	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "image/png" || !bytes.Equal(rec.Body.Bytes(), tinyPNG) {
		t.Fatalf("download: status %d, type %q", rec.Code, rec.Header().Get("Content-Type"))
	}
	if rec.Header().Get("X-Content-Type-Options") != "nosniff" || !strings.Contains(rec.Header().Get("Content-Security-Policy"), "sandbox") {
		t.Errorf("download lacks protective headers: %v", rec.Header())
	}

	// Something that is not a raster image is refused whatever it claims.
	for name, upload := range map[string]struct {
		declared string
		content  []byte
	}{
		"SVG with a script, declared as SVG": {"image/svg+xml", []byte(scriptedSVG)},
		"SVG with a script, declared as PNG": {"image/png", []byte(scriptedSVG)},
		"HTML declared as JPEG":              {"image/jpeg", []byte("<html><script>alert(1)</script></html>")},
		"plain text":                         {"image/png", []byte("just some text")},
	} {
		if status, response := uploadTempImage(t, upload.declared, upload.content); status != http.StatusBadRequest {
			t.Errorf("%s: status %d, response %v; want 400", name, status, response)
		}
	}
}

func TestTempImageUploadIsSizeLimited(t *testing.T) {
	tooLarge := append(append([]byte{}, tinyPNG...), make([]byte, aicore.MaxAITempImageBytes)...)
	if status, response := uploadTempImage(t, "image/png", tooLarge); status != http.StatusRequestEntityTooLarge {
		t.Fatalf("status %d, response %v; want 413", status, response)
	}
}

// The memory the store may take is bounded by evicting the oldest images.
func TestTempImageStoreKeepsOnlyRecentImages(t *testing.T) {
	first := aicore.SaveAITempImage(tinyPNG, "image/png")
	var last string
	for i := 0; i < 60; i++ {
		last = aicore.SaveAITempImage(tinyPNG, "image/png")
	}
	if _, ok := aicore.GetAITempImage(first); ok {
		t.Error("the oldest image is still stored after 60 newer ones")
	}
	if _, ok := aicore.GetAITempImage(last); !ok {
		t.Error("the newest image is missing")
	}
}
