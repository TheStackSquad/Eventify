// backend/pkg/repository/auth/refresh_token_repo.go

package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"
	"fmt"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type RefreshTokenRepository interface {
	SaveRefreshToken(ctx context.Context, userID uuid.UUID, token string, expiresIn int) error
	ValidateRefreshToken(ctx context.Context, userID uuid.UUID, token string) (bool, error)
	RevokeRefreshToken(ctx context.Context, userID uuid.UUID, token string) error
	RevokeAllUserTokens(ctx context.Context, userID uuid.UUID) error
	CleanupExpiredTokens(ctx context.Context) (int64, error)
	GetActiveTokenCount(ctx context.Context, userID uuid.UUID) (int, error)
}

type PostgresRefreshTokenRepository struct {
	DB *sqlx.DB
}

func NewPostgresRefreshTokenRepository(db *sqlx.DB) *PostgresRefreshTokenRepository {
	return &PostgresRefreshTokenRepository{DB: db}
}

// hashToken creates a SHA-256 hash of the token for secure storage
func hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// SaveRefreshToken stores a hashed refresh token in the database
func (r *PostgresRefreshTokenRepository) SaveRefreshToken(
	ctx context.Context,
	userID uuid.UUID,
	token string,
	expiresIn int,
) error {
	tokenHash := hashToken(token)
	expiresAt := time.Now().Add(time.Duration(expiresIn) * time.Second)

	query := `
		INSERT INTO refresh_tokens (id, user_id, token_hash, revoked, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	_, err := r.DB.ExecContext(
		ctx,
		query,
		uuid.New(),
		userID,
		tokenHash,
		false,
		expiresAt,
		time.Now(),
	)

	if err != nil {
		return fmt.Errorf("failed to save refresh token: %w", err)
		//return errors.New("failed to save refresh token")
	}

	return nil
}

// ValidateRefreshToken checks if a token exists, is not revoked, and not expired
func (r *PostgresRefreshTokenRepository) ValidateRefreshToken(
	ctx context.Context,
	userID uuid.UUID,
	token string,
) (bool, error) {
	tokenHash := hashToken(token)

	var exists bool
	query := `
		SELECT EXISTS(
			SELECT 1 FROM refresh_tokens
			WHERE user_id = $1
			AND token_hash = $2
			AND revoked = false
			AND expires_at > NOW()
		)
	`

	err := r.DB.GetContext(ctx, &exists, query, userID, tokenHash)
	if err != nil {
		return false, err
	}

	return exists, nil
}

// RevokeRefreshToken marks a specific token as revoked
func (r *PostgresRefreshTokenRepository) RevokeRefreshToken(
	ctx context.Context,
	userID uuid.UUID,
	token string,
) error {
	tokenHash := hashToken(token)

	query := `
		UPDATE refresh_tokens
		SET revoked = true
		WHERE user_id = $1 AND token_hash = $2
	`

	result, err := r.DB.ExecContext(ctx, query, userID, tokenHash)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err == nil && rows == 0 {
		return errors.New("token not found")
	}

	return nil
}

// RevokeAllUserTokens revokes all tokens for a user (useful for logout from all devices)
func (r *PostgresRefreshTokenRepository) RevokeAllUserTokens(
	ctx context.Context,
	userID uuid.UUID,
) error {
	query := `
		UPDATE refresh_tokens
		SET revoked = true
		WHERE user_id = $1 AND revoked = false
	`

	_, err := r.DB.ExecContext(ctx, query, userID)
	return err
}

// CleanupExpiredTokens removes expired tokens (run as periodic job)
func (r *PostgresRefreshTokenRepository) CleanupExpiredTokens(ctx context.Context) (int64, error) {
	query := `
		DELETE FROM refresh_tokens
		WHERE expires_at < NOW() OR (revoked = true AND created_at < NOW() - INTERVAL '30 days')
	`

	result, err := r.DB.ExecContext(ctx, query)
	if err != nil {
		return 0, err
	}

	return result.RowsAffected()
}

// GetActiveTokenCount returns the number of active tokens for a user
func (r *PostgresRefreshTokenRepository) GetActiveTokenCount(
	ctx context.Context,
	userID uuid.UUID,
) (int, error) {
	var count int
	query := `
		SELECT COUNT(*) FROM refresh_tokens
		WHERE user_id = $1 AND revoked = false AND expires_at > NOW()
	`

	err := r.DB.GetContext(ctx, &count, query, userID)
	return count, err
}