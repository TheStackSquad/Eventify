// backend/pkg/services/jwt/jwt_services.go

package servicejwt

import (
	"crypto/rsa"
	"fmt"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/eventify/backend/pkg/utils"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	UserID    string `json:"user_id"`
	TokenType string `json:"token_type"`
	jwt.RegisteredClaims
}

type JWTService struct {
	privateKey         *rsa.PrivateKey
	publicKey          *rsa.PublicKey
	once               sync.Once
	initErr            error
	accessTokenExpiry  time.Duration
	refreshTokenExpiry time.Duration
}

func NewJWTService() *JWTService {
	accessMin, _ := strconv.Atoi(os.Getenv("ACCESS_TOKEN_EXPIRY"))
	if accessMin == 0 {
		accessMin = 1440 // Default 24h
	}

	refreshDays, _ := strconv.Atoi(os.Getenv("REFRESH_TOKEN_EXPIRY"))
	if refreshDays == 0 {
		refreshDays = 30 // Default 30d
	}

	return &JWTService{
		accessTokenExpiry:  time.Duration(accessMin) * time.Minute,
		refreshTokenExpiry: time.Duration(refreshDays) * 24 * time.Hour,
	}
}

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

// GenerateAccessToken creates access token with unique JTI
func (s *JWTService) GenerateAccessToken(userID string) (string, error) {
	if err := s.Initialize(); err != nil {
		return "", err
	}

	claims := &Claims{
		UserID:    userID,
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.NewString(), // Ensures unique tokens
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.accessTokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "eventify-api",
			Subject:   userID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	return token.SignedString(s.privateKey)
}

// GenerateRefreshToken creates refresh token with unique JTI
func (s *JWTService) GenerateRefreshToken(userID string) (string, error) {
	if err := s.Initialize(); err != nil {
		return "", err
	}

	claims := &Claims{
		UserID:    userID,
		TokenType: "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.NewString(), // Ensures unique tokens
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.refreshTokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "eventify-api",
			Subject:   userID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	return token.SignedString(s.privateKey)
}

func (s *JWTService) ValidateToken(tokenString string) (*Claims, error) {
	if err := s.Initialize(); err != nil {
		return nil, err
	}

	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.publicKey, nil
	})

	if err != nil {
		return nil, fmt.Errorf("token validation failed: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	return claims, nil
}

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