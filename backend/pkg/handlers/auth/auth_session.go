// backend/pkg/handlers/auth/auth_session.go

package auth

import (
	"context"
	"eventify/backend/pkg/models"
	"eventify/backend/pkg/utils"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

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

	access, _ := h.JWTService.GenerateAccessJWT(user.ID.String())
	refresh, _ := h.JWTService.GenerateRefreshJWT(user.ID.String())

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

//Token rotation + Absolute session timeout
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	oldRefreshToken, err := c.Cookie(RefreshTokenCookieName)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "No session."})
		return
	}

	// Validate refresh token JWT
	claims, err := h.JWTService.ValidateTokenType(oldRefreshToken, utils.TokenTypeRefresh)
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

	// ✅ WEEK 1 ENHANCEMENT: Validate refresh token exists in DB and isn't revoked
	valid, err := h.RefreshTokenRepo.ValidateRefreshToken(ctx, userID, oldRefreshToken)
	if err != nil || !valid {
		log.Debug().Msg("Auth: Refresh token not found or revoked in database")
		clearAuthCookies(c)
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid session."})
		return
	}

	// ✅ WEEK 2 ENHANCEMENT: Check absolute session timeout
	tokenAge := time.Since(time.Unix(claims.IssuedAt, 0))
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

	// ✅ WEEK 1 ENHANCEMENT: Generate NEW tokens (rotation for security)
	newAccessToken, err := h.JWTService.GenerateAccessJWT(claims.UserID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate new access token")
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to refresh session."})
		return
	}

	newRefreshToken, err := h.JWTService.GenerateRefreshJWT(claims.UserID)
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