package auth

import (
	"context"
	"net/http"
	"time"

	"github.com/eventify/backend/pkg/models"
	//repoauth "github.com/eventify/backend/pkg/repository/auth"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

// Login handles user authentication
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request."})
		return
	}

	user, err := h.AuthRepo.GetUserByEmail(ctx, req.Email)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid credentials."})
		return
	}

	// ✅ Fixed: Use new method names from JWT service
	access, _ := h.JWTService.GenerateAccessToken(user.ID.String())    // Changed from GenerateAccessJWT
	refresh, _ := h.JWTService.GenerateRefreshToken(user.ID.String()) // Changed from GenerateRefreshJWT

	h.RefreshTokenRepo.SaveRefreshToken(ctx, user.ID, refresh, RefreshMaxAge)
	setAuthCookies(c, access, refresh)

	// Update last login
	h.AuthRepo.UpdateLastLogin(ctx, user.ID)

	log.Info().Msgf("Auth: Login success: %s", user.ID.String()[:8])
	c.JSON(http.StatusOK, models.AuthResponse{
		Message: "Welcome back!",
		User:    user.ToUserProfile(false, false),
	})
}

// RefreshToken handles token rotation with absolute session timeout
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	oldRefreshToken, err := c.Cookie(RefreshTokenCookieName)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "No session."})
		return
	}

	// ✅ Fixed: Use ValidateRefreshToken instead of ValidateTokenType with constant
	claims, err := h.JWTService.ValidateRefreshToken(oldRefreshToken) // Changed from ValidateTokenType
	if err != nil {
		log.Debug().Err(err).Msg("Auth: Refresh token expired or invalid")
		clearAuthCookies(c)
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Session expired."})
		return
	}

	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		clearAuthCookies(c)
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid user ID in token."})
		return
	}

	// Validate refresh token exists in DB and isn't revoked
	valid, err := h.RefreshTokenRepo.ValidateRefreshToken(ctx, userID, oldRefreshToken)
	if err != nil || !valid {
		log.Debug().Msg("Auth: Refresh token not found or revoked in database")
		clearAuthCookies(c)
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid session."})
		return
	}

	// Check absolute session timeout
	tokenAge := time.Since(claims.IssuedAt.Time)
	if tokenAge > AbsoluteSessionTimeout*time.Second {
		log.Info().
			Str("user_id", userID.String()[:8]).
			Dur("age", tokenAge).
			Msg("Auth: Absolute session timeout reached")
		
		// Revoke the token
		h.RefreshTokenRepo.RevokeRefreshToken(ctx, userID, oldRefreshToken)
		clearAuthCookies(c)
		
		c.JSON(http.StatusUnauthorized, gin.H{
			"message": "Session expired. Please log in again.",
			"code":    "ABSOLUTE_TIMEOUT",
		})
		return
	}

	// Generate NEW tokens (rotation for security)
	// ✅ Fixed: Use new method names
	newAccessToken, err := h.JWTService.GenerateAccessToken(claims.UserID)    // Changed from GenerateAccessJWT
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate new access token")
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to refresh session."})
		return
	}

	newRefreshToken, err := h.JWTService.GenerateRefreshToken(claims.UserID) // Changed from GenerateRefreshJWT
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate new refresh token")
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to refresh session."})
		return
	}

	// Revoke old refresh token
	if err := h.RefreshTokenRepo.RevokeRefreshToken(ctx, userID, oldRefreshToken); err != nil {
		log.Warn().Err(err).Msg("Failed to revoke old refresh token")
		// Continue anyway - new token is more important
	}

	// Save new refresh token with remaining time from absolute timeout
	remainingTime := int(AbsoluteSessionTimeout - tokenAge.Seconds())
	if remainingTime < RefreshMaxAge {
		// Use remaining time if less than standard expiry
		h.RefreshTokenRepo.SaveRefreshToken(ctx, userID, newRefreshToken, remainingTime)
	} else {
		h.RefreshTokenRepo.SaveRefreshToken(ctx, userID, newRefreshToken, RefreshMaxAge)
	}

	// Set new cookies
	setAuthCookies(c, newAccessToken, newRefreshToken)

	log.Info().
		Msgf("Auth: Token rotated for %s (age: %s)", claims.UserID[:8], tokenAge.Round(time.Minute))
	
	c.JSON(http.StatusOK, gin.H{"message": "Session refreshed successfully"})
}

// Logout handles user session termination
func (h *AuthHandler) Logout(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Get user ID from context (set by auth middleware)
	userIDInterface, exists := c.Get("user_id")
	if !exists {
		clearAuthCookies(c)
		c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully."})
		return
	}

	userID, ok := userIDInterface.(uuid.UUID)
	if !ok {
		clearAuthCookies(c)
		c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully."})
		return
	}

	// Get refresh token and revoke it
	refreshToken, err := c.Cookie(RefreshTokenCookieName)
	if err == nil && refreshToken != "" {
		h.RefreshTokenRepo.RevokeRefreshToken(ctx, userID, refreshToken)
	}

	clearAuthCookies(c)
	log.Info().Msgf("Auth: User %s logged out", userID.String()[:8])
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully."})
}