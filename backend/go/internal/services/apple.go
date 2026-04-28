package services

import (
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/itemplus/backend/internal/config"
)

type AppleClaims struct {
	Email string `json:"email"`
	jwt.RegisteredClaims
}

// appleJWKS caches Apple's public keys.
type appleJWKS struct {
	mu        sync.RWMutex
	keys      map[string]*rsa.PublicKey // kid -> key
	fetchedAt time.Time
	ttl       time.Duration
}

var jwksCache = &appleJWKS{
	ttl: 1 * time.Hour,
}

const appleJWKSURL = "https://appleid.apple.com/auth/keys"
const appleIssuer = "https://appleid.apple.com"

type jwksResponse struct {
	Keys []jwkKey `json:"keys"`
}

type jwkKey struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Use string `json:"use"`
	Alg string `json:"alg"`
	N   string `json:"n"`
	E   string `json:"e"`
}

// fetchKeys downloads and parses Apple's JWKS endpoint.
func (j *appleJWKS) fetchKeys() error {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(appleJWKSURL)
	if err != nil {
		return fmt.Errorf("failed to fetch Apple JWKS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Apple JWKS returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1 MB limit
	if err != nil {
		return fmt.Errorf("failed to read Apple JWKS response: %w", err)
	}

	var jwks jwksResponse
	if err := json.Unmarshal(body, &jwks); err != nil {
		return fmt.Errorf("failed to parse Apple JWKS: %w", err)
	}

	keys := make(map[string]*rsa.PublicKey, len(jwks.Keys))
	for _, k := range jwks.Keys {
		if k.Kty != "RSA" {
			continue
		}
		pubKey, err := parseRSAPublicKey(k.N, k.E)
		if err != nil {
			continue
		}
		keys[k.Kid] = pubKey
	}

	if len(keys) == 0 {
		return errors.New("no valid RSA keys found in Apple JWKS")
	}

	j.mu.Lock()
	j.keys = keys
	j.fetchedAt = time.Now()
	j.mu.Unlock()

	return nil
}

// getKey returns the RSA public key for the given kid, fetching/refreshing as needed.
func (j *appleJWKS) getKey(kid string) (*rsa.PublicKey, error) {
	j.mu.RLock()
	expired := time.Since(j.fetchedAt) > j.ttl
	key, found := j.keys[kid]
	j.mu.RUnlock()

	if found && !expired {
		return key, nil
	}

	// Fetch fresh keys
	if err := j.fetchKeys(); err != nil {
		// If we have a cached key and fetch failed, use the cached one
		if found {
			return key, nil
		}
		return nil, err
	}

	j.mu.RLock()
	key, found = j.keys[kid]
	j.mu.RUnlock()

	if !found {
		return nil, fmt.Errorf("key with kid %q not found in Apple JWKS", kid)
	}
	return key, nil
}

// parseRSAPublicKey builds an *rsa.PublicKey from base64url-encoded n and e values.
func parseRSAPublicKey(nB64, eB64 string) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(nB64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode n: %w", err)
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(eB64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode e: %w", err)
	}

	n := new(big.Int).SetBytes(nBytes)
	e := new(big.Int).SetBytes(eBytes)

	return &rsa.PublicKey{
		N: n,
		E: int(e.Int64()),
	}, nil
}

// DecodeAppleToken verifies an Apple identity token against Apple's JWKS
// and returns the validated claims.
func DecodeAppleToken(tokenStr string) (*AppleClaims, error) {
	// Parse the token header to extract kid without verifying yet
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithIssuer(appleIssuer),
		jwt.WithExpirationRequired(),
	)

	claims := &AppleClaims{}
	token, err := parser.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}

		// Get kid from header
		kid, ok := token.Header["kid"].(string)
		if !ok || kid == "" {
			return nil, errors.New("missing kid in token header")
		}

		// Fetch the matching public key from Apple's JWKS
		return jwksCache.getKey(kid)
	})

	if err != nil {
		return nil, fmt.Errorf("invalid Apple token: %w", err)
	}

	if !token.Valid {
		return nil, errors.New("Apple token is not valid")
	}

	// Validate audience (aud) — must match our Apple Bundle ID
	bundleID := config.C.AppleBundleID
	if bundleID == "" {
		return nil, errors.New("APPLE_BUNDLE_ID not configured — cannot verify Apple token audience")
	}
	aud, _ := claims.GetAudience()
	audMatch := false
	for _, a := range aud {
		if a == bundleID {
			audMatch = true
			break
		}
	}
	if !audMatch {
		return nil, fmt.Errorf("Apple token audience %v does not match expected %s", aud, bundleID)
	}

	return claims, nil
}
