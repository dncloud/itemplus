package netguard

import (
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func TestIsPublicIP(t *testing.T) {
	for address, want := range map[string]bool{
		"93.184.216.34":      true,
		"2606:2800:220:1::1": true,
		"127.0.0.1":          false,
		"::1":                false,
		"10.0.0.5":           false,
		"172.16.5.4":         false,
		"192.168.1.1":        false,
		"169.254.169.254":    false, // cloud metadata service
		"100.64.0.1":         false,
		"0.0.0.0":            false,
		"255.255.255.255":    false,
		"224.0.0.1":          false,
		"fe80::1":            false,
		"fc00::1":            false,
		"::ffff:127.0.0.1":   false, // IPv4-mapped loopback
		"::ffff:192.168.1.1": false,
		"64:ff9b::7f00:1":    false, // NAT64 form of 127.0.0.1
		"::":                 false,
	} {
		if got := IsPublicIP(net.ParseIP(address)); got != want {
			t.Errorf("IsPublicIP(%s) = %v, want %v", address, got, want)
		}
	}
	if IsPublicIP(nil) {
		t.Error("an unparsable address must not count as public")
	}
}

// A server on the machine itself stands for everything internal: the client
// must refuse to connect, by address and by a name that resolves to it.
func TestClientRefusesInternalAddresses(t *testing.T) {
	reached := false
	internal := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reached = true
		_, _ = w.Write([]byte("internal secret"))
	}))
	defer internal.Close()

	client := NewPublicHTTPClient(3 * time.Second)
	for _, url := range []string{internal.URL, strings.Replace(internal.URL, "127.0.0.1", "localhost", 1)} {
		resp, err := client.Get(url)
		if err == nil {
			resp.Body.Close()
			t.Fatalf("GET %s succeeded; internal addresses must be refused", url)
		}
		if !errors.Is(err, ErrBlockedAddress) {
			t.Errorf("GET %s: error %v, want ErrBlockedAddress", url, err)
		}
	}
	if reached {
		t.Fatal("the internal server received a request")
	}
}

// Opt-in, because it needs internet access:
//
//	ITEMPLUS_NET_TEST=1 go test ./internal/netguard
func TestClientReachesPublicAddresses(t *testing.T) {
	if os.Getenv("ITEMPLUS_NET_TEST") == "" {
		t.Skip("set ITEMPLUS_NET_TEST=1 to run tests that need internet access")
	}
	resp, err := NewPublicHTTPClient(10 * time.Second).Get("https://example.com/")
	if err != nil {
		t.Fatalf("a public address must stay reachable: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status %d", resp.StatusCode)
	}
}
