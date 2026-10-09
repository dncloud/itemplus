package ai

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// The logo search fetches addresses typed in by users. Pointed at the server
// itself (standing in for anything internal), it must not make the request,
// neither for the website nor for a direct logo address.
func TestVendorLogoSearchDoesNotFetchInternalAddresses(t *testing.T) {
	requests := 0
	internal := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write([]byte("\x89PNG\r\n\x1a\ninternal"))
	}))
	defer internal.Close()

	// No vendor name: a name would additionally trigger a public lookup.
	if result, err := ResolveVendorLogoPreview("", internal.URL, "", ""); err == nil {
		t.Errorf("website on an internal address returned %+v", result)
	}
	if result, err := ResolveVendorLogoPreview("", "", "", internal.URL+"/logo.png"); err == nil {
		t.Errorf("logo on an internal address returned %+v", result)
	}
	if requests != 0 {
		t.Fatalf("the internal server received %d requests", requests)
	}
}
