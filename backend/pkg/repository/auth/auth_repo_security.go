//backend/pkg/repository/auth/auth_repo_security.go

package auth

import (
	"context"
	"database/sql"
	"errors"
	"time"
	"fmt"

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
        // Normalizing to UTC ensures comparison works regardless of server/local time
        unlockTime := attempt.LastAttemptAt.UTC().Add(lockoutDuration)
        
        if time.Now().UTC().Before(unlockTime) {
            return true, unlockTime, nil
        }

        // Lockout expired, clear attempts
        // We ignore the error here as per your original design, 
        // but we ensure this branch is reachable.
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

func (r *PostgresAuthRepository) GetVendorIDByOwnerID(ctx context.Context, ownerID uuid.UUID) (*uuid.UUID, error) {
    var vendorID uuid.UUID
    
    // ✅ SOFT DELETE SUPPORT: Only get active vendors
    query := `
        SELECT id 
        FROM vendors 
        WHERE owner_id = $1 
        AND deleted_at IS NULL
        LIMIT 1
    `
    
    err := r.DB.GetContext(ctx, &vendorID, query, ownerID)
    if err != nil {
        if errors.Is(err, sql.ErrNoRows) {
            return nil, nil
        }
        return nil, fmt.Errorf("failed to get vendor ID: %w", err)
    }
    
    return &vendorID, nil
}
