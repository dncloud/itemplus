package auth

import (
	"encoding/json"
	"testing"
)

func TestAppleClaimsVerifiedEmail(t *testing.T) {
	for name, tc := range map[string]struct {
		payload string
		want    string
	}{
		"verified as boolean":   {`{"email":"Oli@Example.DE ","email_verified":true}`, "oli@example.de"},
		"verified as string":    {`{"email":"oli@example.de","email_verified":"true"}`, "oli@example.de"},
		"unverified as boolean": {`{"email":"oli@example.de","email_verified":false}`, ""},
		"unverified as string":  {`{"email":"oli@example.de","email_verified":"false"}`, ""},
		"verification missing":  {`{"email":"oli@example.de"}`, ""},
		"no email":              {`{"email_verified":true}`, ""},
	} {
		var claims AppleClaims
		if err := json.Unmarshal([]byte(tc.payload), &claims); err != nil {
			t.Fatalf("%s: unmarshal: %v", name, err)
		}
		if got := claims.VerifiedEmail(); got != tc.want {
			t.Errorf("%s: VerifiedEmail() = %q, want %q", name, got, tc.want)
		}
	}
}
