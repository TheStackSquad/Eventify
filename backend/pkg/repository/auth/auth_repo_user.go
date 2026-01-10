//backend/pkg/repository/auth/auth_repo_user.go

package auth

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"eventify/backend/pkg/models"

	"github.com/google/uuid"
)

func (r *PostgresAuthRepository) CreateUser(ctx context.Context, user *models.User) (uuid.UUID, error) {
	if user.ID == uuid.Nil {
		user.ID = uuid.New()
	}
	now := time.Now()
	user.CreatedAt = now
	user.UpdatedAt = now

	query := `
		INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`
	var insertedID uuid.UUID
	err := r.DB.QueryRowContext(ctx, query,
		user.ID, user.Name, user.Email, user.PasswordHash, user.Role, user.CreatedAt, user.UpdatedAt,
	).Scan(&insertedID)

	if err != nil {
		return uuid.Nil, errors.New("user with this email already exists")
	}
	return insertedID, nil
}

func (r *PostgresAuthRepository) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	query := "SELECT * FROM users WHERE email = $1"

	err := r.DB.GetContext(ctx, &user, query, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	return &user, nil
}

func (r *PostgresAuthRepository) GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var user models.User
	query := "SELECT * FROM users WHERE id = $1"

	err := r.DB.GetContext(ctx, &user, query, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	return &user, nil
}

func (r *PostgresAuthRepository) SavePasswordResetToken(
	ctx context.Context,
	email, token string,
	expiry time.Time,
) error {
	query := `
		UPDATE users
		SET reset_token = $1, reset_token_expiry = $2, updated_at = $3
		WHERE email = $4
	`
	result, err := r.DB.ExecContext(ctx, query, token, expiry, time.Now(), email)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err == nil && rows == 0 {
		return errors.New("user not found")
	}

	return err
}

func (r *PostgresAuthRepository) GetUserByResetToken(
	ctx context.Context,
	token string,
) (*models.User, error) {
	var user models.User
	query := `
		SELECT * FROM users 
		WHERE reset_token = $1 AND reset_token_expiry > NOW()
	`

	err := r.DB.GetContext(ctx, &user, query, token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("invalid or expired reset token")
		}
		return nil, err
	}
	return &user, nil
}

func (r *PostgresAuthRepository) UpdatePassword(
	ctx context.Context,
	userID uuid.UUID,
	hashedPassword string,
) error {
	query := `
		UPDATE users
		SET password_hash = $1, updated_at = $2
		WHERE id = $3
	`
	result, err := r.DB.ExecContext(ctx, query, hashedPassword, time.Now(), userID)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err == nil && rows == 0 {
		return errors.New("user not found")
	}

	return err
}

func (r *PostgresAuthRepository) ClearPasswordResetToken(
	ctx context.Context,
	userID uuid.UUID,
) error {
	query := `
		UPDATE users
		SET reset_token = NULL, reset_token_expiry = NULL, updated_at = $1
		WHERE id = $2
	`
	_, err := r.DB.ExecContext(ctx, query, time.Now(), userID)
	return err
}

func (r *PostgresAuthRepository) IsUserAdmin(ctx context.Context, id uuid.UUID) (bool, error) {
	var role models.Role
	query := `SELECT role FROM users WHERE id = $1`

	err := r.DB.GetContext(ctx, &role, query, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, errors.New("user not found")
		}
		return false, err
	}
	return role == models.RoleAdmin, nil
}