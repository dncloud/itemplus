package main

import (
	"net/url"
	"strings"
	"testing"
)

func TestRedactedQueryMasksCredentials(t *testing.T) {
	values, _ := url.ParseQuery("token=eyJsecret&ticket=abc123&device_type=ios&device_name=Olis+iPhone")
	got := redactedQuery(values)

	for _, secret := range []string{"eyJsecret", "abc123"} {
		if strings.Contains(got, secret) {
			t.Fatalf("credential %q leaked into log line: %s", secret, got)
		}
	}
	for _, want := range []string{"token=REDACTED", "ticket=REDACTED", "device_type=ios", "device_name=Olis+iPhone"} {
		if !strings.Contains(got, want) {
			t.Fatalf("log line %q is missing %q", got, want)
		}
	}
}

func TestRedactedQueryEmpty(t *testing.T) {
	if got := redactedQuery(url.Values{}); got != "" {
		t.Fatalf("expected empty string, got %q", got)
	}
}
