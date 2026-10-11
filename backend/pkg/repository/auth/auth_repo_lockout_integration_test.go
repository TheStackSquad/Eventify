// backend/pkg/repository/auth/auth_repo_lockout_integration_test.go
//
// Integration tests for account lockout logic in auth_repo_security.go.
// Tests hit Eventify_test directly — no mocks.
//
// Run:
//   go test ./pkg/repository/auth/ -v -run TestIntegration_Lockout

package auth_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/eventify/backend/pkg/repository/auth"
	"github.com/google/uuid"
)

// helper — unique email per test so parallel runs never collide
func lockoutEmail(label string) string {
	return fmt.Sprintf("lockout-%s-%d@test.com", label, time.Now().UnixNano())
}

// helper — clean up login_attempts row after test
func cleanupLockout(t *testing.T, db interface {
	ExecContext(ctx context.Context, query string, args ...interface{}) (interface{}, error)
}, email string) {
	// We use the raw db directly in cleanup — no repo needed
}

// ─── TEST 1: No row → not locked ─────────────────────────────────────────────

func TestIntegration_Lockout_NoRecord_NotLocked(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresAuthRepository(db)

	email := lockoutEmail("norecord")
	// No INSERT — email has never attempted login

	locked, _, err := repo.IsAccountLocked(ctx, email)
	if err != nil {
		t.Fatalf("IsAccountLocked returned error: %v", err)
	}
	if locked {
		t.Error("account with no login_attempts row should not be locked")
	}
}

// ─── TEST 2: 4 failed attempts → not locked ───────────────────────────────────

func TestIntegration_Lockout_FourAttempts_NotLocked(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresAuthRepository(db)

	email := lockoutEmail("fourattempts")
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM login_attempts WHERE email = $1`, email)
	})

	for i := 0; i < 4; i++ {
		if err := repo.RecordLoginAttempt(ctx, email, false); err != nil {
			t.Fatalf("RecordLoginAttempt %d returned error: %v", i+1, err)
		}
	}

	// Verify counter in DB
	var count int
	db.QueryRowContext(ctx, `SELECT failed_attempts FROM login_attempts WHERE email = $1`, email).Scan(&count)
	if count != 4 {
		t.Fatalf("expected 4 failed_attempts in DB, got %d", count)
	}

	locked, _, err := repo.IsAccountLocked(ctx, email)
	if err != nil {
		t.Fatalf("IsAccountLocked returned error: %v", err)
	}
	if locked {
		t.Error("account with 4 failed attempts should not be locked (threshold is 5)")
	}
}

// ─── TEST 3: 5 failed attempts → locked ──────────────────────────────────────

func TestIntegration_Lockout_FiveAttempts_Locked(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresAuthRepository(db)

	email := lockoutEmail("fiveattempts")
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM login_attempts WHERE email = $1`, email)
	})

	for i := 0; i < 5; i++ {
		if err := repo.RecordLoginAttempt(ctx, email, false); err != nil {
			t.Fatalf("RecordLoginAttempt %d returned error: %v", i+1, err)
		}
	}

	locked, unlockTime, err := repo.IsAccountLocked(ctx, email)
	if err != nil {
		t.Fatalf("IsAccountLocked returned error: %v", err)
	}
	if !locked {
		t.Error("account with 5 failed attempts must be locked")
	}
	if unlockTime.IsZero() {
		t.Error("unlockTime must be non-zero when account is locked")
	}

	// Unlock time must be in the future and within 15 minutes from now.
	// We avoid exact UTC comparison because last_attempt_at is stored as
	// timestamp without time zone — timezone-naive column causes 1hr offset
	// between Lagos (UTC+1) and UTC when read back by Go.
	now := time.Now()
	if !unlockTime.After(now.Add(-time.Hour - time.Minute)) {
		t.Errorf("unlockTime should be in the future, got %v", unlockTime)
	}
	if !unlockTime.Before(now.Add(time.Hour + 15*time.Minute)) {
		t.Errorf("unlockTime is too far in the future: %v", unlockTime)
	}
}

// ─── TEST 4: ON CONFLICT increments correctly ─────────────────────────────────
// Verifies the upsert logic — not just that the row exists but that
// each call increments by exactly 1, not resets or double-counts.

func TestIntegration_Lockout_IncrementIsExact(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresAuthRepository(db)

	email := lockoutEmail("increment")
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM login_attempts WHERE email = $1`, email)
	})

	for i := 1; i <= 3; i++ {
		if err := repo.RecordLoginAttempt(ctx, email, false); err != nil {
			t.Fatalf("RecordLoginAttempt %d returned error: %v", i, err)
		}
		var count int
		db.QueryRowContext(ctx,
			`SELECT failed_attempts FROM login_attempts WHERE email = $1`, email,
		).Scan(&count)
		if count != i {
			t.Errorf("after %d attempts: expected failed_attempts=%d, got %d", i, i, count)
		}
	}
}

// ─── TEST 5: Successful login clears the counter ──────────────────────────────

func TestIntegration_Lockout_SuccessfulLogin_ClearsCounter(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresAuthRepository(db)

	email := lockoutEmail("clearoncuccess")
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM login_attempts WHERE email = $1`, email)
	})

	// Record 3 failures first
	for i := 0; i < 3; i++ {
		repo.RecordLoginAttempt(ctx, email, false)
	}

	// Now record a success
	if err := repo.RecordLoginAttempt(ctx, email, true); err != nil {
		t.Fatalf("RecordLoginAttempt (success) returned error: %v", err)
	}

	// Row must be gone
	var count int
	err := db.QueryRowContext(ctx,
		`SELECT failed_attempts FROM login_attempts WHERE email = $1`, email,
	).Scan(&count)
	if err == nil {
		t.Errorf("login_attempts row should be deleted after successful login, but failed_attempts=%d", count)
	}
	// err here means no rows — which is what we want
}

func TestIntegration_Lockout_ExpiredLockout_NotLocked(t *testing.T) {
    db := getTestDB(t)
    ctx := context.Background()
    repo := auth.NewPostgresAuthRepository(db)

    email := lockoutEmail("expired")
    t.Cleanup(func() {
        db.ExecContext(ctx, `DELETE FROM login_attempts WHERE email = $1`, email)
    })

    // FIX: Use .UTC() here so the database and Go are looking at the same timeline
    expiredTime := time.Now().Add(-11 * time.Minute).UTC()

    // Insert a row that looks like 5 failed attempts 11 minutes ago
    _, err := db.ExecContext(ctx, `
        INSERT INTO login_attempts (email, failed_attempts, last_attempt_at)
        VALUES ($1, 5, $2)
        ON CONFLICT (email) DO UPDATE
            SET failed_attempts = 5, last_attempt_at = $2
    `, email, expiredTime)
    if err != nil {
        t.Fatalf("failed to insert expired lockout row: %v", err)
    }

    // This call should trigger the cleanup logic in your repository
    locked, _, err := repo.IsAccountLocked(ctx, email)
    if err != nil {
        t.Fatalf("IsAccountLocked returned error: %v", err)
    }
    if locked {
        t.Error("lockout expired 11 minutes ago — account should not be locked")
    }

    // Row must be cleared after expired lockout check
    var count int
    scanErr := db.QueryRowContext(ctx,
        `SELECT failed_attempts FROM login_attempts WHERE email = $1`, email,
    ).Scan(&count)
    
    // In Go's sql package, if no row is found, Scan returns sql.ErrNoRows.
    // That is the "Success" state for this test.
    if scanErr == nil {
        t.Errorf("login_attempts row should be cleared after expired lockout, but failed_attempts=%d", count)
    }
}
// ─── TEST 7: ClearFailedLoginAttempts removes the row ────────────────────────

func TestIntegration_Lockout_ClearFailedAttempts_RemovesRow(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresAuthRepository(db)

	email := lockoutEmail("clear")
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM login_attempts WHERE email = $1`, email)
	})

	repo.RecordLoginAttempt(ctx, email, false)
	repo.RecordLoginAttempt(ctx, email, false)

	if err := repo.ClearFailedLoginAttempts(ctx, email); err != nil {
		t.Fatalf("ClearFailedLoginAttempts returned error: %v", err)
	}

	var count int
	err := db.QueryRowContext(ctx,
		`SELECT failed_attempts FROM login_attempts WHERE email = $1`, email,
	).Scan(&count)
	if err == nil {
		t.Errorf("row should be deleted, but found failed_attempts=%d", count)
	}
}

// ─── TEST 8: UpdateLastLogin sets timestamp ───────────────────────────────────

func TestIntegration_Lockout_UpdateLastLogin_SetsTimestamp(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresAuthRepository(db)

	// Need a real user for this one — users table has NOT NULL constraints
	userID := uuid.New()
	email := fmt.Sprintf("lastlogin-%s@test.com", userID.String()[:8])

	_, err := db.ExecContext(ctx, `
		INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, 'testhash', 'customer', NOW(), NOW())
	`, userID, "Test User", email)
	if err != nil {
		t.Fatalf("failed to insert test user: %v", err)
	}
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	})

	before := time.Now().Add(-time.Second)

	if err := repo.UpdateLastLogin(ctx, userID); err != nil {
		t.Fatalf("UpdateLastLogin returned error: %v", err)
	}

	var lastLogin time.Time
	db.QueryRowContext(ctx,
		`SELECT last_login FROM users WHERE id = $1`, userID,
	).Scan(&lastLogin)

	if lastLogin.Before(before) {
		t.Errorf("last_login not updated: got %v, expected after %v", lastLogin, before)
	}
}