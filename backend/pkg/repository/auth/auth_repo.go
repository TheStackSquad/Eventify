//backend/pkg/repository/auth/auth_repo.go

package auth

import (
	"context"
	"time"

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
}

type PostgresAuthRepository struct {
	DB *sqlx.DB
}

func NewPostgresAuthRepository(db *sqlx.DB) *PostgresAuthRepository {
	return &PostgresAuthRepository{
		DB: db,
	}
}