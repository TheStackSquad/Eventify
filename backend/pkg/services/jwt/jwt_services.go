// eventify/backend/pkg/services/jwt/jwt_services.go
package jwt

import "eventify/backend/pkg/utils"

// JWTService defines the interface for JWT operations
type JWTService interface {
	GenerateAccessJWT(userID string) (string, error)
	GenerateRefreshJWT(userID string) (string, error)
	ValidateJWT(tokenString string) (*utils.Claims, error)  // Note: utils.Claims
	ValidateTokenType(tokenString string, expectedType string) (*utils.Claims, error)
}

// DefaultJWTService implements JWTService using the existing JWT functions
type DefaultJWTService struct{}

// NewJWTService creates a new default JWT service
func NewJWTService() JWTService {
	return &DefaultJWTService{}
}

func (s *DefaultJWTService) GenerateAccessJWT(userID string) (string, error) {
	return utils.GenerateAccessJWT(userID)  // Note: utils.GenerateAccessJWT
}

func (s *DefaultJWTService) GenerateRefreshJWT(userID string) (string, error) {
	return utils.GenerateRefreshJWT(userID)  // Note: utils.GenerateRefreshJWT
}

func (s *DefaultJWTService) ValidateJWT(tokenString string) (*utils.Claims, error) {
	return utils.ValidateJWT(tokenString)  // Note: utils.ValidateJWT
}

func (s *DefaultJWTService) ValidateTokenType(tokenString string, expectedType string) (*utils.Claims, error) {
	return utils.ValidateTokenType(tokenString, expectedType)  // Note: utils.ValidateTokenType
}