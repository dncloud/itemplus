package services

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/itemplus/backend/internal/config"
)

func TestDecodeTokenAcceptsAccessToken(t *testing.T) {
	config.C.JWTSecret = "test-secret"
	config.C.JWTExpiryDays = 1

	token, err := CreateToken(1, "sub", false)
	if err != nil {
		t.Fatalf("create token: %v", err)
	}

	claims, err := DecodeToken(token)
	if err != nil {
		t.Fatalf("decode token: %v", err)
	}
	if claims.Type != "access" {
		t.Fatalf("unexpected token type: %s", claims.Type)
	}
}

func TestDecodeTokenRejectsWrongType(t *testing.T) {
	config.C.JWTSecret = "test-secret"

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, JWTClaims{
		UserID:  1,
		Sub:     "sub",
		IsAdmin: false,
		Type:    "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "itemplus",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	})

	tokenStr, err := token.SignedString([]byte(config.C.JWTSecret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	if _, err := DecodeToken(tokenStr); err == nil {
		t.Fatal("expected wrong token type to be rejected")
	}
}
