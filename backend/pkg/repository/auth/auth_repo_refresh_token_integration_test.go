// backend/pkg/repository/auth/auth_repo_refresh_token_integration_test.go
//
// Integration tests for refresh token and password reset lifecycle.
// All tests hit Eventify_test directly — no mocks.
//
// Run:
//   go test ./pkg/repository/auth/ -v -run TestIntegration_RefreshToken
//   go test ./pkg/repository/auth/ -v -run TestIntegration_PasswordReset

package auth_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"
	"time"

	"github.com/eventify/backend/pkg/repository/auth"
	"github.com/google/uuid"
)

// ─── Internal helper ──────────────────────────────────────────────────────────
// Mirrors hashToken in refresh_token_repo.go so tests can compute
// the expected hash without importing unexported functions.

func hashTokenForTest(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// ─── SaveRefreshToken + GetByHash ────────────────────────────────────────────

func TestIntegration_RefreshToken_SaveAndGetByHash(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresRefreshTokenRepository(db)

	userID := uuid.New()
	email := fmt.Sprintf("save-get-%s@test.com", userID.String()[:8])
	_, err := db.ExecContext(ctx, `
		INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, 'testhash', 'customer', NOW(), NOW())`,
		userID, "Test SaveGet", email,
	)
	if err != nil {
		t.Fatalf("failed to insert test user: %v", err)
	}
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1`, userID)
		db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	})

	token := fmt.Sprintf("test-token-%s", uuid.New().String())
	expiresIn := 30 * 24 * 60 * 60 // 30 days in seconds

	tokenID, err := repo.SaveRefreshToken(ctx, userID, token, expiresIn, nil, "127.0.0.1", "test-agent/1.0")
	if err != nil {
		t.Fatalf("SaveRefreshToken returned error: %v", err)
	}
	if tokenID == uuid.Nil {
		t.Fatal("SaveRefreshToken returned nil UUID")
	}

	stored, err := repo.GetByHash(ctx, hashTokenForTest(token))
	if err != nil {
		t.Fatalf("GetByHash returned error: %v", err)
	}
	if stored.UserID != userID {
		t.Errorf("UserID mismatch: got %v, want %v", stored.UserID, userID)
	}
	if stored.Revoked {
		t.Error("newly saved token must not be revoked")
	}
	if stored.ConsumedAt != nil {
		t.Error("newly saved token must have nil consumed_at")
	}
	if stored.ParentID != nil {
		t.Error("token saved without parent must have nil parent_id")
	}
}

func TestIntegration_RefreshToken_SaveWithParentID(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresRefreshTokenRepository(db)

	userID := uuid.New()
	email := fmt.Sprintf("parent-%s@test.com", userID.String()[:8])
	_, err := db.ExecContext(ctx, `
		INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, 'testhash', 'customer', NOW(), NOW())`,
		userID, "Test Parent", email,
	)
	if err != nil {
		t.Fatalf("failed to insert test user: %v", err)
	}
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1`, userID)
		db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	})

	parentToken := fmt.Sprintf("parent-token-%s", uuid.New().String())
	parentID, err := repo.SaveRefreshToken(ctx, userID, parentToken, 86400, nil, "127.0.0.1", "agent/1.0")
	if err != nil {
		t.Fatalf("SaveRefreshToken (parent) returned error: %v", err)
	}

	childToken := fmt.Sprintf("child-token-%s", uuid.New().String())
	_, err = repo.SaveRefreshToken(ctx, userID, childToken, 86400, &parentID, "127.0.0.1", "agent/1.0")
	if err != nil {
		t.Fatalf("SaveRefreshToken (child) returned error: %v", err)
	}

	stored, err := repo.GetByHash(ctx, hashTokenForTest(childToken))
	if err != nil {
		t.Fatalf("GetByHash (child) returned error: %v", err)
	}
	if stored.ParentID == nil {
		t.Fatal("child token must have non-nil parent_id")
	}
	if *stored.ParentID != parentID {
		t.Errorf("parent_id mismatch: got %v, want %v", *stored.ParentID, parentID)
	}
}

// ─── ConsumeToken ─────────────────────────────────────────────────────────────

func TestIntegration_RefreshToken_ConsumeToken_SetsConsumedAt(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresRefreshTokenRepository(db)

	userID := uuid.New()
	email := fmt.Sprintf("consume-%s@test.com", userID.String()[:8])
	_, err := db.ExecContext(ctx, `
		INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, 'testhash', 'customer', NOW(), NOW())`,
		userID, "Test Consume", email,
	)
	if err != nil {
		t.Fatalf("failed to insert test user: %v", err)
	}
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1`, userID)
		db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	})

	token := fmt.Sprintf("consume-token-%s", uuid.New().String())
	tokenID, err := repo.SaveRefreshToken(ctx, userID, token, 86400, nil, "127.0.0.1", "agent/1.0")
	if err != nil {
		t.Fatalf("SaveRefreshToken returned error: %v", err)
	}

	before := time.Now().Add(-time.Second)

	if err := repo.ConsumeToken(ctx, tokenID); err != nil {
		t.Fatalf("ConsumeToken returned error: %v", err)
	}

	stored, err := repo.GetByHash(ctx, hashTokenForTest(token))
	if err != nil {
		t.Fatalf("GetByHash returned error: %v", err)
	}
	if stored.ConsumedAt == nil {
		t.Fatal("consumed_at must be set after ConsumeToken")
	}
	if stored.ConsumedAt.Before(before) {
		t.Errorf("consumed_at %v is before test start %v", stored.ConsumedAt, before)
	}
}

func TestIntegration_RefreshToken_ConsumeToken_IdempotentGuard(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresRefreshTokenRepository(db)

	userID := uuid.New()
	email := fmt.Sprintf("idempotent-%s@test.com", userID.String()[:8])
	_, err := db.ExecContext(ctx, `
		INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, 'testhash', 'customer', NOW(), NOW())`,
		userID, "Test Idempotent", email,
	)
	if err != nil {
		t.Fatalf("failed to insert test user: %v", err)
	}
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1`, userID)
		db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	})

	token := fmt.Sprintf("idempotent-token-%s", uuid.New().String())
	tokenID, err := repo.SaveRefreshToken(ctx, userID, token, 86400, nil, "127.0.0.1", "agent/1.0")
	if err != nil {
		t.Fatalf("SaveRefreshToken returned error: %v", err)
	}

	if err := repo.ConsumeToken(ctx, tokenID); err != nil {
		t.Fatalf("ConsumeToken (first) returned error: %v", err)
	}

	first, _ := repo.GetByHash(ctx, hashTokenForTest(token))
	firstConsumedAt := *first.ConsumedAt

	// Second consume — AND consumed_at IS NULL guard must prevent update
	if err := repo.ConsumeToken(ctx, tokenID); err != nil {
		t.Fatalf("ConsumeToken (second) returned error: %v", err)
	}

	second, _ := repo.GetByHash(ctx, hashTokenForTest(token))
	if !second.ConsumedAt.Equal(firstConsumedAt) {
		t.Errorf("consumed_at changed on second call: first=%v, second=%v",
			firstConsumedAt, second.ConsumedAt)
	}
}

// ─── ValidateRefreshToken ─────────────────────────────────────────────────────

func TestIntegration_RefreshToken_Validate_ActiveToken_ReturnsTrue(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresRefreshTokenRepository(db)

	userID := uuid.New()
	email := fmt.Sprintf("validate-active-%s@test.com", userID.String()[:8])
	_, err := db.ExecContext(ctx, `
		INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, 'testhash', 'customer', NOW(), NOW())`,
		userID, "Test Validate", email,
	)
	if err != nil {
		t.Fatalf("failed to insert test user: %v", err)
	}
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1`, userID)
		db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	})

	token := fmt.Sprintf("validate-token-%s", uuid.New().String())
	_, err = repo.SaveRefreshToken(ctx, userID, token, 86400, nil, "127.0.0.1", "agent/1.0")
	if err != nil {
		t.Fatalf("SaveRefreshToken returned error: %v", err)
	}

	valid, err := repo.ValidateRefreshToken(ctx, userID, token)
	if err != nil {
		t.Fatalf("ValidateRefreshToken returned error: %v", err)
	}
	if !valid {
		t.Error("active non-expired token must validate as true")
	}
}

func TestIntegration_RefreshToken_Validate_RevokedToken_ReturnsFalse(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresRefreshTokenRepository(db)

	userID := uuid.New()
	email := fmt.Sprintf("validate-revoked-%s@test.com", userID.String()[:8])
	_, err := db.ExecContext(ctx, `
		INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, 'testhash', 'customer', NOW(), NOW())`,
		userID, "Test Revoked", email,
	)
	if err != nil {
		t.Fatalf("failed to insert test user: %v", err)
	}
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1`, userID)
		db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	})

	token := fmt.Sprintf("revoked-token-%s", uuid.New().String())
	_, err = repo.SaveRefreshToken(ctx, userID, token, 86400, nil, "127.0.0.1", "agent/1.0")
	if err != nil {
		t.Fatalf("SaveRefreshToken returned error: %v", err)
	}

	if err := repo.RevokeRefreshToken(ctx, userID, token); err != nil {
		t.Fatalf("RevokeRefreshToken returned error: %v", err)
	}

	valid, err := repo.ValidateRefreshToken(ctx, userID, token)
	if err != nil {
		t.Fatalf("ValidateRefreshToken returned error: %v", err)
	}
	if valid {
		t.Error("revoked token must not validate as true")
	}
}

func TestIntegration_RefreshToken_Validate_ExpiredToken_ReturnsFalse(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresRefreshTokenRepository(db)

	userID := uuid.New()
	email := fmt.Sprintf("validate-expired-%s@test.com", userID.String()[:8])
	_, err := db.ExecContext(ctx, `
		INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, 'testhash', 'customer', NOW(), NOW())`,
		userID, "Test Expired", email,
	)
	if err != nil {
		t.Fatalf("failed to insert test user: %v", err)
	}
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1`, userID)
		db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	})

	// Insert expired token directly — SaveRefreshToken won't let us set past expiry
	token := fmt.Sprintf("expired-token-%s", uuid.New().String())
	_, err = db.ExecContext(ctx, `
		INSERT INTO refresh_tokens (id, user_id, token_hash, revoked, expires_at, created_at)
		VALUES ($1, $2, $3, false, NOW() - INTERVAL '1 hour', NOW())`,
		uuid.New(), userID, hashTokenForTest(token),
	)
	if err != nil {
		t.Fatalf("failed to insert expired token: %v", err)
	}

	valid, err := repo.ValidateRefreshToken(ctx, userID, token)
	if err != nil {
		t.Fatalf("ValidateRefreshToken returned error: %v", err)
	}
	if valid {
		t.Error("expired token must not validate as true")
	}
}

// ─── GetActiveTokenCount ──────────────────────────────────────────────────────

func TestIntegration_RefreshToken_GetActiveTokenCount(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresRefreshTokenRepository(db)

	userID := uuid.New()
	email := fmt.Sprintf("count-%s@test.com", userID.String()[:8])
	_, err := db.ExecContext(ctx, `
		INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, 'testhash', 'customer', NOW(), NOW())`,
		userID, "Test Count", email,
	)
	if err != nil {
		t.Fatalf("failed to insert test user: %v", err)
	}
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1`, userID)
		db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	})

	// 2 active tokens
	for i := 0; i < 2; i++ {
		token := fmt.Sprintf("active-%d-%s", i, uuid.New().String())
		_, err := repo.SaveRefreshToken(ctx, userID, token, 86400, nil, "127.0.0.1", "agent/1.0")
		if err != nil {
			t.Fatalf("SaveRefreshToken %d returned error: %v", i, err)
		}
	}

	// 1 expired token (inserted directly)
	_, err = db.ExecContext(ctx, `
		INSERT INTO refresh_tokens (id, user_id, token_hash, revoked, expires_at, created_at)
		VALUES ($1, $2, $3, false, NOW() - INTERVAL '1 hour', NOW())`,
		uuid.New(), userID, "expired-hash-"+uuid.New().String(),
	)
	if err != nil {
		t.Fatalf("failed to insert expired token: %v", err)
	}

	// 1 revoked token
	revokedToken := fmt.Sprintf("revoked-%s", uuid.New().String())
	revokedID, _ := repo.SaveRefreshToken(ctx, userID, revokedToken, 86400, nil, "127.0.0.1", "agent/1.0")
	db.ExecContext(ctx, `UPDATE refresh_tokens SET revoked = true WHERE id = $1`, revokedID)

	count, err := repo.GetActiveTokenCount(ctx, userID)
	if err != nil {
		t.Fatalf("GetActiveTokenCount returned error: %v", err)
	}
	if count != 2 {
		t.Errorf("expected 2 active tokens, got %d", count)
	}
}

// ─── CleanupExpiredTokens ─────────────────────────────────────────────────────

func TestIntegration_RefreshToken_CleanupExpiredTokens_BothBranches(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresRefreshTokenRepository(db)

	userID := uuid.New()
	email := fmt.Sprintf("cleanup-%s@test.com", userID.String()[:8])
	_, err := db.ExecContext(ctx, `
		INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, 'testhash', 'customer', NOW(), NOW())`,
		userID, "Test Cleanup", email,
	)
	if err != nil {
		t.Fatalf("failed to insert test user: %v", err)
	}
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1`, userID)
		db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	})

	// Branch 1: expired (expires_at < NOW())
	expiredID := uuid.New()
	_, err = db.ExecContext(ctx, `
		INSERT INTO refresh_tokens (id, user_id, token_hash, revoked, expires_at, created_at)
		VALUES ($1, $2, $3, false, NOW() - INTERVAL '1 hour', NOW())`,
		expiredID, userID, "expired-"+uuid.New().String(),
	)
	if err != nil {
		t.Fatalf("failed to insert expired token: %v", err)
	}

	// Branch 2: revoked AND old (created_at < NOW() - 30 days)
	oldRevokedID := uuid.New()
	_, err = db.ExecContext(ctx, `
		INSERT INTO refresh_tokens (id, user_id, token_hash, revoked, expires_at, created_at)
		VALUES ($1, $2, $3, true, NOW() + INTERVAL '1 day', NOW() - INTERVAL '31 days')`,
		oldRevokedID, userID, "old-revoked-"+uuid.New().String(),
	)
	if err != nil {
		t.Fatalf("failed to insert old revoked token: %v", err)
	}

	// Active token — must survive
	activeToken := fmt.Sprintf("active-survive-%s", uuid.New().String())
	activeID, err := repo.SaveRefreshToken(ctx, userID, activeToken, 86400, nil, "127.0.0.1", "agent/1.0")
	if err != nil {
		t.Fatalf("SaveRefreshToken (active) returned error: %v", err)
	}

	deleted, err := repo.CleanupExpiredTokens(ctx)
	if err != nil {
		t.Fatalf("CleanupExpiredTokens returned error: %v", err)
	}
	if deleted < 2 {
		t.Errorf("expected at least 2 rows deleted, got %d", deleted)
	}

	var count int

	db.QueryRowContext(ctx, `SELECT COUNT(*) FROM refresh_tokens WHERE id = $1`, expiredID).Scan(&count)
	if count != 0 {
		t.Error("expired token must be deleted by cleanup")
	}

	db.QueryRowContext(ctx, `SELECT COUNT(*) FROM refresh_tokens WHERE id = $1`, oldRevokedID).Scan(&count)
	if count != 0 {
		t.Error("old revoked token must be deleted by cleanup")
	}

	db.QueryRowContext(ctx, `SELECT COUNT(*) FROM refresh_tokens WHERE id = $1`, activeID).Scan(&count)
	if count != 1 {
		t.Error("active token must not be deleted by cleanup")
	}
}

// ─── Password Reset Lifecycle ─────────────────────────────────────────────────

func TestIntegration_PasswordReset_SaveAndRetrieve(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresAuthRepository(db)

	userID := uuid.New()
	email := fmt.Sprintf("resettest-%s@test.com", userID.String()[:8])
	_, err := db.ExecContext(ctx, `
		INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, 'testhash', 'customer', NOW(), NOW())`,
		userID, "Test Reset", email,
	)
	if err != nil {
		t.Fatalf("failed to insert test user: %v", err)
	}
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	})

	token := uuid.New().String()
	expiry := time.Now().Add(1 * time.Hour)

	if err := repo.SavePasswordResetToken(ctx, email, token, expiry); err != nil {
		t.Fatalf("SavePasswordResetToken returned error: %v", err)
	}

	user, err := repo.GetUserByResetToken(ctx, token)
	if err != nil {
		t.Fatalf("GetUserByResetToken returned error: %v", err)
	}
	if user.ID != userID {
		t.Errorf("user ID mismatch: got %v, want %v", user.ID, userID)
	}
}

func TestIntegration_PasswordReset_ExpiredToken_NotFound(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresAuthRepository(db)

	userID := uuid.New()
	email := fmt.Sprintf("resetexpired-%s@test.com", userID.String()[:8])
	_, err := db.ExecContext(ctx, `
		INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, 'testhash', 'customer', NOW(), NOW())`,
		userID, "Test ResetExpired", email,
	)
	if err != nil {
		t.Fatalf("failed to insert test user: %v", err)
	}
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	})

	token := uuid.New().String()
	expiredExpiry := time.Now().Add(-1 * time.Hour)

	if err := repo.SavePasswordResetToken(ctx, email, token, expiredExpiry); err != nil {
		t.Fatalf("SavePasswordResetToken returned error: %v", err)
	}

	user, err := repo.GetUserByResetToken(ctx, token)
	if err == nil {
		t.Errorf("expected error for expired token, got user: %v", user)
	}
	if user != nil {
		t.Error("expired reset token must return nil user")
	}
}

func TestIntegration_PasswordReset_ClearToken_TokenGone(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresAuthRepository(db)

	userID := uuid.New()
	email := fmt.Sprintf("resetclear-%s@test.com", userID.String()[:8])
	_, err := db.ExecContext(ctx, `
		INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, 'testhash', 'customer', NOW(), NOW())`,
		userID, "Test ResetClear", email,
	)
	if err != nil {
		t.Fatalf("failed to insert test user: %v", err)
	}
	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	})

	token := uuid.New().String()
	expiry := time.Now().Add(1 * time.Hour)

	repo.SavePasswordResetToken(ctx, email, token, expiry)

	if err := repo.ClearPasswordResetToken(ctx, userID); err != nil {
		t.Fatalf("ClearPasswordResetToken returned error: %v", err)
	}

	user, err := repo.GetUserByResetToken(ctx, token)
	if err == nil {
		t.Errorf("expected error after clear, got user: %v", user)
	}
	if user != nil {
		t.Error("token must not be findable after ClearPasswordResetToken")
	}
}