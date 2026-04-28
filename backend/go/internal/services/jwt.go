package services

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/itemplus/backend/internal/config"
)

type JWTClaims struct {
	UserID  int    `json:"user_id"`
	Sub     string `json:"sub"`
	IsAdmin bool   `json:"is_admin"`
	Type    string `json:"type"`
	jwt.RegisteredClaims
}

func CreateToken(userID int, sub string, isAdmin bool) (string, error) {
	claims := JWTClaims{
		UserID:  userID,
		Sub:     sub,
		IsAdmin: isAdmin,
		Type:    "access",
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "itemplus",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(config.C.JWTExpiryDays) * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.C.JWTSecret))
}

func DecodeToken(tokenStr string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(
		tokenStr,
		&JWTClaims{},
		func(t *jwt.Token) (interface{}, error) {
			return []byte(config.C.JWTSecret), nil
		},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer("itemplus"),
	)
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		if claims.Type != "access" {
			return nil, jwt.ErrTokenInvalidClaims
		}
		return claims, nil
	}
	return nil, jwt.ErrSignatureInvalid
}
