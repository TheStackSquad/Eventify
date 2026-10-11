//backend/pkg/repository/auth/auth_repo_integration_test.go
package auth_test

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"os"
	"testing"
	"strings"
	"time"

	"github.com/eventify/backend/pkg/repository/auth"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

func getTestDB(t *testing.T) *sqlx.DB {
	t.Helper()

	uri := os.Getenv("POSTGRES_TEST_URI")
	if uri == "" {
		if data, err := os.ReadFile("../../../.env.test"); err == nil {
			for _, line := range splitLines(string(data)) {
			if len(line) > 12 && line[:12] == "POSTGRES_URI" {
    uri = strings.TrimRight(line[13:], "\r\n ")
    break
}
			}
		}
	}
	if uri == "" {
		if data, err := os.ReadFile("../../../.env"); err == nil {
			for _, line := range splitLines(string(data)) {
				if len(line) > 17 && line[:17] == "POSTGRES_TEST_URI" {
    uri = strings.TrimRight(line[18:], "\r\n ")
    break
}
			}
		}
	}
	if uri == "" {
		t.Skip("POSTGRES_TEST_URI not set — skipping integration tests")
	}
	if !containsAny(uri, []string{"test", "Test", "_test"}) {
		t.Fatalf("URI does not look like a test database: %s", uri)
	}

	db, err := sqlx.Connect("postgres", uri)
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v\nURI: %s", err, uri)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestIntegration_BlacklistToken_FullHashStoredAndRetrieved(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	repo := auth.NewPostgresAuthRepository(db)

	testToken := fmt.Sprintf("integration-test-token-%s", uuid.New().String())
	expiry := time.Now().Add(24 * time.Hour)

	if err := repo.BlacklistToken(ctx, testToken, expiry); err != nil {
		t.Fatalf("BlacklistToken returned error: %v", err)
	}

	hash := sha256.Sum256([]byte(testToken))
	expectedHash := hex.EncodeToString(hash[:])

	if len(expectedHash) != 64 {
		t.Fatalf("Test setup error: SHA-256 hex is %d chars, expected 64", len(expectedHash))
	}

	var storedHash string
	err := db.QueryRowContext(ctx,
		`SELECT token_hash FROM token_blacklist WHERE token_hash = $1`,
		expectedHash,
	).Scan(&storedHash)

	if err == sql.ErrNoRows {
		var truncatedHash string
		_ = db.QueryRowContext(ctx,
			`SELECT token_hash FROM token_blacklist WHERE token_hash LIKE $1`,
			expectedHash[:1]+"%",
		).Scan(&truncatedHash)

		if truncatedHash != "" {
			t.Errorf(
				"SCHEMA BUG DETECTED: token_hash column is truncating hashes.\n"+
					"Stored:   %q (%d chars)\n"+
					"Expected: %q (%d chars)\n"+
					"Fix: ALTER TABLE token_blacklist ALTER COLUMN token_hash TYPE char(64);",
				truncatedHash, len(truncatedHash),
				expectedHash, len(expectedHash),
			)
		} else {
			t.Errorf("Blacklisted token not found in token_blacklist table.\n"+
				"Expected hash: %s\nToken: %s", expectedHash, testToken)
		}
		return
	}
	if err != nil {
		t.Fatalf("DB query error: %v", err)
	}

	if len(storedHash) != 64 {
		t.Errorf(
			"SCHEMA BUG: stored hash is %d chars, expected 64.\n"+
				"Stored:   %q\n"+
				"Expected: %q\n"+
				"Fix: ALTER TABLE token_blacklist ALTER COLUMN token_hash TYPE char(64);",
			len(storedHash), storedHash, expectedHash,
		)
	}
	if storedHash != expectedHash {
		t.Errorf("Hash mismatch:\n  stored:   %s\n  expected: %s", storedHash, expectedHash)
	}

	blacklisted, err := repo.IsTokenBlacklisted(ctx, testToken)
	if err != nil {
		t.Fatalf("IsTokenBlacklisted returned error: %v", err)
	}
	if !blacklisted {
		t.Error("IsTokenBlacklisted returned false for a token that was just blacklisted")
	}

	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM token_blacklist WHERE token_hash = $1`, expectedHash)
	})
}

func TestIntegration_RevokeFamily_CascadesThreeLevels(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	testUserID := uuid.New()

	_, err := db.ExecContext(ctx,
		`INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
		 VALUES ($1, $2, $3, 'testhash', 'customer', NOW(), NOW())
		 ON CONFLICT (email) DO NOTHING`,
		testUserID,
		fmt.Sprintf("test-user-%s", testUserID.String()[:8]),
		fmt.Sprintf("revokefamily-test-%s@test.com", testUserID.String()[:8]),
	)
	if err != nil {
		t.Fatalf("Failed to insert test user: %v", err)
	}

	rootID := uuid.New()
	childID := uuid.New()
	grandchildID := uuid.New()

	insertToken := func(id uuid.UUID, parentID *uuid.UUID) {
		t.Helper()
		_, err := db.ExecContext(ctx, `
			INSERT INTO refresh_tokens
				(id, user_id, token_hash, revoked, expires_at, created_at, parent_id)
			VALUES ($1, $2, $3, false, NOW() + INTERVAL '30 days', NOW(), $4)`,
			id, testUserID, "hash-"+id.String(), parentID,
		)
		if err != nil {
			t.Fatalf("Failed to insert test token %v: %v", id, err)
		}
	}

	insertToken(rootID, nil)
	insertToken(childID, &rootID)
	insertToken(grandchildID, &childID)

	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1`, testUserID)
		db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, testUserID)
	})

	assertRevokedState := func(id uuid.UUID, expected bool, label string) {
		t.Helper()
		var revoked bool
		err := db.QueryRowContext(ctx,
			`SELECT revoked FROM refresh_tokens WHERE id = $1`, id,
		).Scan(&revoked)
		if err != nil {
			t.Fatalf("%s: DB query error: %v", label, err)
		}
		if revoked != expected {
			t.Errorf("%s (id=%v): revoked=%v, want %v", label, id, revoked, expected)
		}
	}

	assertRevokedState(rootID, false, "root before RevokeFamily")
	assertRevokedState(childID, false, "child before RevokeFamily")
	assertRevokedState(grandchildID, false, "grandchild before RevokeFamily")

	refreshRepo := auth.NewPostgresRefreshTokenRepository(db)
	if err := refreshRepo.RevokeFamily(ctx, rootID); err != nil {
		t.Fatalf("RevokeFamily returned error: %v", err)
	}

	assertRevokedState(rootID, true, "root after RevokeFamily")
	assertRevokedState(childID, true, "child after RevokeFamily")
	assertRevokedState(grandchildID, true, "grandchild after RevokeFamily")
}

func TestIntegration_RevokeFamily_DoesNotAffectUnrelatedTokens(t *testing.T) {
	db := getTestDB(t)
	ctx := context.Background()
	testUserID := uuid.New()

	_, err := db.ExecContext(ctx,
		`INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
		 VALUES ($1, $2, $3, 'testhash', 'customer', NOW(), NOW())
		 ON CONFLICT (email) DO NOTHING`,
		testUserID,
		fmt.Sprintf("test-user-%s", testUserID.String()[:8]),
		fmt.Sprintf("revokefamily-unrelated-%s@test.com", testUserID.String()[:8]),
	)
	if err != nil {
		t.Fatalf("Failed to insert test user: %v", err)
	}

	familyRootID := uuid.New()
	familyChildID := uuid.New()
	unrelatedID := uuid.New()

	insertToken := func(id uuid.UUID, parentID *uuid.UUID) {
		t.Helper()
		_, err := db.ExecContext(ctx, `
			INSERT INTO refresh_tokens
				(id, user_id, token_hash, revoked, expires_at, created_at, parent_id)
			VALUES ($1, $2, $3, false, NOW() + INTERVAL '30 days', NOW(), $4)`,
			id, testUserID, "hash-"+id.String(), parentID,
		)
		if err != nil {
			t.Fatalf("Failed to insert test token %v: %v", id, err)
		}
	}

	insertToken(familyRootID, nil)
	insertToken(familyChildID, &familyRootID)
	insertToken(unrelatedID, nil)

	t.Cleanup(func() {
		db.ExecContext(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1`, testUserID)
		db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, testUserID)
	})

	refreshRepo := auth.NewPostgresRefreshTokenRepository(db)
	if err := refreshRepo.RevokeFamily(ctx, familyRootID); err != nil {
		t.Fatalf("RevokeFamily returned error: %v", err)
	}

	var familyRootRevoked, familyChildRevoked, unrelatedRevoked bool
	db.QueryRowContext(ctx, `SELECT revoked FROM refresh_tokens WHERE id = $1`, familyRootID).Scan(&familyRootRevoked)
	db.QueryRowContext(ctx, `SELECT revoked FROM refresh_tokens WHERE id = $1`, familyChildID).Scan(&familyChildRevoked)
	db.QueryRowContext(ctx, `SELECT revoked FROM refresh_tokens WHERE id = $1`, unrelatedID).Scan(&unrelatedRevoked)

	if !familyRootRevoked {
		t.Error("Family root should be revoked")
	}
	if !familyChildRevoked {
		t.Error("Family child should be revoked")
	}
	if unrelatedRevoked {
		t.Error("CRITICAL: RevokeFamily revoked an unrelated token")
	}
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i, c := range s {
		if c == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

func containsAny(s string, subs []string) bool {
	for _, sub := range subs {
		for i := 0; i <= len(s)-len(sub); i++ {
			if s[i:i+len(sub)] == sub {
				return true
			}
		}
	}
	return false
}