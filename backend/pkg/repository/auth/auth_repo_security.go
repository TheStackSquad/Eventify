//backend/pkg/repository/auth/auth_repo_security.go

package auth

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
)

// IsAccountLocked checks if the account associated with the email is locked.
func (r *PostgresAuthRepository) IsAccountLocked(
	ctx context.Context,
	email string,
) (bool, time.Time, error) {
	var attempt struct {
		FailedAttempts int       `db:"failed_attempts"`
		LastAttemptAt  time.Time `db:"last_attempt_at"`
	}

	query := `
		SELECT failed_attempts, last_attempt_at
		FROM login_attempts
		WHERE email = $1
	`

	err := r.DB.GetContext(ctx, &attempt, query, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, time.Time{}, nil
		}
		return false, time.Time{}, err
	}

	// Lock after 5 failed attempts
	const maxAttempts = 5
	const lockoutDuration = 10 * time.Minute

	if attempt.FailedAttempts >= maxAttempts {
		unlockTime := attempt.LastAttemptAt.Add(lockoutDuration)
		if time.Now().Before(unlockTime) {
			return true, unlockTime, nil
		}
		// Lockout expired, clear attempts
		_ = r.ClearFailedLoginAttempts(ctx, email)
	}

	return false, time.Time{}, nil
}

func (r *PostgresAuthRepository) RecordLoginAttempt(
	ctx context.Context,
	email string,
	success bool,
) error {
	if success {
		return r.ClearFailedLoginAttempts(ctx, email)
	}

	query := `
		INSERT INTO login_attempts (email, failed_attempts, last_attempt_at)
		VALUES ($1, 1, $2)
		ON CONFLICT (email) 
		DO UPDATE SET 
			failed_attempts = login_attempts.failed_attempts + 1,
			last_attempt_at = EXCLUDED.last_attempt_at
	`

	_, err := r.DB.ExecContext(ctx, query, email, time.Now())
	return err
}

// ClearFailedLoginAttempts resets the failed attempt count for the email.
func (r *PostgresAuthRepository) ClearFailedLoginAttempts(
	ctx context.Context,
	email string,
) error {
	query := `DELETE FROM login_attempts WHERE email = $1`
	_, err := r.DB.ExecContext(ctx, query, email)
	return err
}

// UpdateLastLogin updates the last_login timestamp for the user ID.
func (r *PostgresAuthRepository) UpdateLastLogin(ctx context.Context, userID uuid.UUID) error {
	query := `UPDATE users SET last_login = $1, updated_at = $2 WHERE id = $3`
	_, err := r.DB.ExecContext(ctx, query, time.Now(), time.Now(), userID)
	return err
}