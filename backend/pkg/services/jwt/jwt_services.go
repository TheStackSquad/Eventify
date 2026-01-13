// backend/pkg/services/jwt/jwt_services.go
package servicejwt

import (
	"crypto/rsa"
	"fmt"
	"sync"
	"time"
	"eventify/backend/pkg/utils"

	"github.com/golang-jwt/jwt/v5"
	//"github.com/rs/zerolog/log"
)

// Claims structure for JWT tokens
type Claims struct {
	UserID    string `json:"user_id"`
	TokenType string `json:"token_type"`
	jwt.RegisteredClaims
}

// JWTService handles all JWT operations with RSA key management
type JWTService struct {
	privateKey *rsa.PrivateKey
	publicKey  *rsa.PublicKey
	once       sync.Once
	initErr    error
}

// NewJWTService creates a new JWT service instance
func NewJWTService() *JWTService {
	return &JWTService{}
}

// Initialize loads and validates RSA keys (thread-safe)
// In backend/pkg/services/jwt/jwt_services.go
func (s *JWTService) Initialize() error {
	const service = "jwt"
	const operation = "initialize"

	s.once.Do(func() {
		utils.LogInfo(service, operation, "🔄 Initializing JWT service...")
		
		privateKey, publicKey, err := loadRSAKeys()
		if err != nil {
			s.initErr = fmt.Errorf("failed to load RSA keys: %w", err)
			utils.LogError(service, operation, "Failed to load RSA keys", err)
			return
		}

		if err := validateKeyPair(privateKey, publicKey); err != nil {
			s.initErr = fmt.Errorf("RSA key validation failed: %w", err)
			utils.LogError(service, operation, "RSA key validation failed", err)
			return
		}

		s.privateKey = privateKey
		s.publicKey = publicKey
		utils.LogSuccess(service, operation, "JWT RSA keys loaded and validated")
	})

	return s.initErr
}
// GenerateAccessToken creates a new access token (15 min expiry)
func (s *JWTService) GenerateAccessToken(userID string) (string, error) {
	if err := s.Initialize(); err != nil {
		return "", err
	}

	claims := &Claims{
		UserID:    userID,
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "eventify-api",
			Subject:   userID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	return token.SignedString(s.privateKey)
}

// GenerateRefreshToken creates a new refresh token (7 day expiry)
func (s *JWTService) GenerateRefreshToken(userID string) (string, error) {
	if err := s.Initialize(); err != nil {
		return "", err
	}

	claims := &Claims{
		UserID:    userID,
		TokenType: "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "eventify-api",
			Subject:   userID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	return token.SignedString(s.privateKey)
}

// ValidateToken validates any JWT token and returns claims
func (s *JWTService) ValidateToken(tokenString string) (*Claims, error) {
	if err := s.Initialize(); err != nil {
		return nil, err
	}

	// Parse without verification to check token type
	parser := jwt.NewParser(jwt.WithoutClaimsValidation())
	unverifiedToken, _, err := parser.ParseUnverified(tokenString, &Claims{})
	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	unverifiedClaims, ok := unverifiedToken.Claims.(*Claims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims structure")
	}

	// Now validate with proper method
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.publicKey, nil
	})

	if err != nil {
		return nil, fmt.Errorf("token validation failed: %w", err)
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}

	// Ensure token type matches (access vs refresh)
	if claims.TokenType != unverifiedClaims.TokenType {
		return nil, fmt.Errorf("token type mismatch during validation")
	}

	return claims, nil
}

// ValidateAccessToken specifically validates access tokens
func (s *JWTService) ValidateAccessToken(tokenString string) (*Claims, error) {
	claims, err := s.ValidateToken(tokenString)
	if err != nil {
		return nil, err
	}

	if claims.TokenType != "access" {
		return nil, fmt.Errorf("not an access token")
	}

	return claims, nil
}

// ValidateRefreshToken specifically validates refresh tokens
func (s *JWTService) ValidateRefreshToken(tokenString string) (*Claims, error) {
	claims, err := s.ValidateToken(tokenString)
	if err != nil {
		return nil, err
	}

	if claims.TokenType != "refresh" {
		return nil, fmt.Errorf("not a refresh token")
	}

	return claims, nil
}