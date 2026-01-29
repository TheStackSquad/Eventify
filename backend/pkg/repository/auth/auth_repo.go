//backend/pkg/repository/auth/auth_repo.go

package auth

import (
	"context"
	"time"
	"crypto/sha256"
    "encoding/hex"

	"github.com/eventify/backend/pkg/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type AuthRepository interface {
	CreateUser(ctx context.Context, user *models.User) (uuid.UUID, error)
	GetUserByEmail(ctx context.Context, email string) (*models.User, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error)
	SavePasswordResetToken(ctx context.Context, email, token string, expiry time.Time) error
	GetUserByResetToken(ctx context.Context, token string) (*models.User, error)
	UpdatePassword(ctx context.Context, userID uuid.UUID, hashedPassword string) error
	ClearPasswordResetToken(ctx context.Context, userID uuid.UUID) error
	IsUserAdmin(ctx context.Context, id uuid.UUID) (bool, error)

	IsAccountLocked(ctx context.Context, email string) (bool, time.Time, error)
	RecordLoginAttempt(ctx context.Context, email string, success bool) error
	ClearFailedLoginAttempts(ctx context.Context, email string) error
	UpdateLastLogin(ctx context.Context, userID uuid.UUID) error

	BlacklistToken(ctx context.Context, token string, expiry time.Time) error
    IsTokenBlacklisted(ctx context.Context, token string) (bool, error)
    CleanupBlacklist(ctx context.Context) (int64, error)
}

type PostgresAuthRepository struct {
	DB *sqlx.DB
}

func NewPostgresAuthRepository(db *sqlx.DB) *PostgresAuthRepository {
	return &PostgresAuthRepository{
		DB: db,
	}
}


func (r *PostgresAuthRepository) BlacklistToken(ctx context.Context, token string, expiry time.Time) error {
    hash := sha256.Sum256([]byte(token))
    tokenHash := hex.EncodeToString(hash[:])

    query := `
        INSERT INTO token_blacklist (token_hash, expires_at, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (token_hash) DO NOTHING
    `
        
    _, err := r.DB.ExecContext(ctx, query, tokenHash, expiry)
    return err
}

func (r *PostgresAuthRepository) IsTokenBlacklisted(ctx context.Context, token string) (bool, error) {
    hash := sha256.Sum256([]byte(token))
    tokenHash := hex.EncodeToString(hash[:])

    var exists bool
query := `
        SELECT EXISTS(
            SELECT 1 FROM token_blacklist 
            WHERE TRIM(token_hash) = $1
        )
    `
    
    err := r.DB.GetContext(ctx, &exists, query, tokenHash)
    return exists, err
}

func (r *PostgresAuthRepository) CleanupBlacklist(ctx context.Context) (int64, error) {
    query := `DELETE FROM token_blacklist WHERE expires_at < NOW()`
    result, err := r.DB.ExecContext(ctx, query)
    if err != nil {
        return 0, err
    }
    return result.RowsAffected()
}