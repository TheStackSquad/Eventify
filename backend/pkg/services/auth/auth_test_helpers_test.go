// backend/pkg/services/auth/auth_test_helpers_test.go
//
// Shared test infrastructure for all auth service unit tests.
// Contains: TestMain (RSA key generation), mock implementations,
// and the buildService constructor used by every test file.
//
// Run all auth tests:
//   go test ./pkg/services/auth/ -v
//   go test ./pkg/services/auth/ -race -count=3

package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/hex"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/eventify/backend/pkg/models"
	repoevent "github.com/eventify/backend/pkg/repository/event"
	servicejwt "github.com/eventify/backend/pkg/services/jwt"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ─── Test RSA Key (generated once for the entire test run) ───────────────────

var testJWT *servicejwt.JWTService

func TestMain(m *testing.M) {
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		panic("failed to generate test RSA key: " + err.Error())
	}
	testJWT = servicejwt.NewJWTService()
  	testJWT.SetKeysForTesting(privKey, &privKey.PublicKey)
	m.Run()
}

// ─── Mock: RefreshTokenRepository ────────────────────────────────────────────

type mockRefreshTokenRepo struct {
	mu sync.RWMutex

	getByHashToken *models.RefreshToken
	getByHashErr   error
	expectedHash   string

	consumeTokenCalled     bool
	revokeFamilyCalled     bool
	revokeFamilyRootID     uuid.UUID
	revokeAllCalled        bool
	saveRefreshTokenCalled bool
	saveRefreshTokenUserID uuid.UUID

	metaIP  string
	metaUA  string
	metaErr error
}

func (m *mockRefreshTokenRepo) GetByHash(_ context.Context, hash string) (*models.RefreshToken, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.expectedHash != "" && hash != m.expectedHash {
		return nil, errors.New("hash mismatch: got " + hash + " want " + m.expectedHash)
	}
	return m.getByHashToken, m.getByHashErr
}
func (m *mockRefreshTokenRepo) ConsumeToken(_ context.Context, _ uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.consumeTokenCalled = true
	return nil
}
func (m *mockRefreshTokenRepo) RevokeFamily(_ context.Context, rootID uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.revokeFamilyCalled = true
	m.revokeFamilyRootID = rootID
	return nil
}
func (m *mockRefreshTokenRepo) RevokeAllUserTokens(_ context.Context, _ uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.revokeAllCalled = true
	return nil
}
func (m *mockRefreshTokenRepo) RevokeRefreshToken(_ context.Context, _ uuid.UUID, _ string) error {
	return nil
}
func (m *mockRefreshTokenRepo) SaveRefreshToken(_ context.Context, userID uuid.UUID, _ string, _ int, _ *uuid.UUID, _ string, _ string) (uuid.UUID, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.saveRefreshTokenCalled = true
	m.saveRefreshTokenUserID = userID
	return uuid.New(), nil
}
func (m *mockRefreshTokenRepo) ValidateRefreshToken(_ context.Context, _ uuid.UUID, _ string) (bool, error) {
	return true, nil
}
func (m *mockRefreshTokenRepo) CleanupExpiredTokens(_ context.Context) (int64, error) { return 0, nil }
func (m *mockRefreshTokenRepo) GetActiveTokenCount(_ context.Context, _ uuid.UUID) (int, error) {
	return 1, nil
}
func (m *mockRefreshTokenRepo) GetMetadataByHash(_ context.Context, _ string) (string, string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.metaIP, m.metaUA, m.metaErr
}

// ─── Mock: AuthRepository ─────────────────────────────────────────────────────

type mockAuthRepo struct {
	mu sync.RWMutex

	user              *models.User
	getUserByEmailErr error

	isLockedResult bool
	isLockedUntil  time.Time
	isLockedErr    error

	recordLoginAttemptCalled  bool
	recordLoginAttemptSuccess bool
	updateLastLoginCalled     bool

	getUserByResetTokenResult *models.User
	getUserByResetTokenErr    error

	blacklistTokenCalled bool
	isBlacklistedResult  bool
}

func (m *mockAuthRepo) CreateUser(_ context.Context, _ *models.User) (uuid.UUID, error) {
	return uuid.New(), nil
}
func (m *mockAuthRepo) GetUserByEmail(_ context.Context, _ string) (*models.User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.user, m.getUserByEmailErr
}
func (m *mockAuthRepo) GetUserByID(_ context.Context, _ uuid.UUID) (*models.User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.user, nil
}
func (m *mockAuthRepo) GetVendorIDByOwnerID(_ context.Context, _ uuid.UUID) (*uuid.UUID, error) {
	return nil, nil
}
func (m *mockAuthRepo) SavePasswordResetToken(_ context.Context, _, _ string, _ time.Time) error {
	return nil
}
func (m *mockAuthRepo) GetUserByResetToken(_ context.Context, _ string) (*models.User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.getUserByResetTokenResult, m.getUserByResetTokenErr
}
func (m *mockAuthRepo) UpdatePassword(_ context.Context, _ uuid.UUID, _ string) error { return nil }
func (m *mockAuthRepo) ClearPasswordResetToken(_ context.Context, _ uuid.UUID) error  { return nil }
func (m *mockAuthRepo) IsUserAdmin(_ context.Context, _ uuid.UUID) (bool, error)       { return false, nil }
func (m *mockAuthRepo) IsAccountLocked(_ context.Context, _ string) (bool, time.Time, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.isLockedResult, m.isLockedUntil, m.isLockedErr
}
func (m *mockAuthRepo) RecordLoginAttempt(_ context.Context, _ string, success bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordLoginAttemptCalled = true
	m.recordLoginAttemptSuccess = success
	return nil
}
func (m *mockAuthRepo) ClearFailedLoginAttempts(_ context.Context, _ string) error { return nil }
func (m *mockAuthRepo) UpdateLastLogin(_ context.Context, _ uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.updateLastLoginCalled = true
	return nil
}
func (m *mockAuthRepo) UpdateReminderPreference(_ context.Context, _ uuid.UUID, _ bool) error {
	return nil
}
func (m *mockAuthRepo) BlacklistToken(_ context.Context, _ string, _ time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.blacklistTokenCalled = true
	return nil
}
func (m *mockAuthRepo) IsTokenBlacklisted(_ context.Context, _ string) (bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.isBlacklistedResult, nil
}
func (m *mockAuthRepo) CleanupBlacklist(_ context.Context) (int64, error) { return 0, nil }

// ─── Mock: EventRepository ───────────────────────────────────────────────────

type mockEventRepo struct {
	hasEvents    bool
	hasEventsErr error
}

func (m *mockEventRepo) HasEventsByOrganizer(_ context.Context, _ uuid.UUID) (bool, error) {
	return m.hasEvents, m.hasEventsErr
}
func (m *mockEventRepo) GetEventByID(_ context.Context, _ uuid.UUID, _ *uuid.UUID) (*models.Event, error) {
	return nil, nil
}
func (m *mockEventRepo) GetEvents(_ context.Context, _ repoevent.EventFilters) ([]*models.Event, error) {
	return nil, nil
}
func (m *mockEventRepo) CreateEvent(_ context.Context, _ *sqlx.Tx, _ *models.Event) (uuid.UUID, error) {
	return uuid.Nil, nil
}
func (m *mockEventRepo) UpdateEvent(_ context.Context, _ *sqlx.Tx, _ *models.Event) error { return nil }
func (m *mockEventRepo) SoftDeleteEvent(_ context.Context, _ uuid.UUID) error              { return nil }
func (m *mockEventRepo) GetTierDetails(_ context.Context, _ uuid.UUID, _ string) (*models.TierDetails, error) {
	return nil, nil
}
func (m *mockEventRepo) GetTierDetailsByID(_ context.Context, _ uuid.UUID) (*models.TierDetails, error) {
	return nil, nil
}
func (m *mockEventRepo) GetEventTicketTiers(_ context.Context, _ uuid.UUID) ([]models.TicketTier, error) {
	return nil, nil
}
func (m *mockEventRepo) CreateTicketTier(_ context.Context, _ *sqlx.Tx, _ *models.TicketTier) error {
	return nil
}
func (m *mockEventRepo) CreateTicketTiers(_ context.Context, _ *sqlx.Tx, _ uuid.UUID, _ []models.TicketTier) error {
	return nil
}
func (m *mockEventRepo) SyncTicketTiers(_ context.Context, _ *sqlx.Tx, _ uuid.UUID, _ []models.TicketTier) error {
	return nil
}
func (m *mockEventRepo) MarkTicketAsUsed(_ context.Context, _ string) error { return nil }
func (m *mockEventRepo) CheckTicketAvailability(_ context.Context, _ uuid.UUID, _ int32) (bool, error) {
	return true, nil
}
func (m *mockEventRepo) DecrementTicketStockTx(_ context.Context, _ *sqlx.Tx, _ uuid.UUID, _ int32) error {
	return nil
}
func (m *mockEventRepo) IncrementTicketStockTx(_ context.Context, _ *sqlx.Tx, _ uuid.UUID, _ int32) error {
	return nil
}
func (m *mockEventRepo) GetEventWithStats(_ context.Context, _ uuid.UUID) (*repoevent.EventWithStats, error) {
	return nil, nil
}

// ─── Mock: VendorRepository ──────────────────────────────────────────────────

type mockVendorRepo struct {
	vendorID    *uuid.UUID
	vendorIDErr error
}

func (m *mockVendorRepo) Create(_ context.Context, _ *models.Vendor) (uuid.UUID, error) {
	return uuid.Nil, nil
}
func (m *mockVendorRepo) Update(_ context.Context, _ *models.Vendor) error { return nil }
func (m *mockVendorRepo) UpdateFields(_ context.Context, _ uuid.UUID, _ map[string]interface{}) error {
	return nil
}
func (m *mockVendorRepo) UpdateVerificationFlag(_ context.Context, _ uuid.UUID, _ string, _ bool, _ string) error {
	return nil
}
func (m *mockVendorRepo) UpdatePVSScore(_ context.Context, _ uuid.UUID, _ int) error { return nil }
func (m *mockVendorRepo) IncrementField(_ context.Context, _ uuid.UUID, _ string, _ int) error {
	return nil
}
func (m *mockVendorRepo) Delete(_ context.Context, _ uuid.UUID) (int64, error) { return 0, nil }
func (m *mockVendorRepo) GetByOwnerID(_ context.Context, _ uuid.UUID) (*models.Vendor, error) {
	return nil, nil
}
func (m *mockVendorRepo) GetByID(_ context.Context, _ uuid.UUID) (models.Vendor, error) {
	return models.Vendor{}, nil
}
func (m *mockVendorRepo) FindPublicVendors(_ context.Context, _ map[string]string) ([]models.Vendor, error) {
	return nil, nil
}
func (m *mockVendorRepo) GetVendorSubscription(_ context.Context, _ uuid.UUID) (*models.VendorWithSubscription, error) {
	return nil, nil
}
func (m *mockVendorRepo) IsRegisteredVendor(_ context.Context, _ uuid.UUID) (bool, error) {
	return false, nil
}

// ─── Builder ──────────────────────────────────────────────────────────────────

func buildService(t *testing.T) (*authWriteService, *mockAuthRepo, *mockRefreshTokenRepo) {
	t.Helper()

	authRepo := &mockAuthRepo{
		user: &models.User{ID: uuid.New()},
	}
	refreshRepo := &mockRefreshTokenRepo{
		metaErr: errors.New("no metadata"),
	}
	eventRepo := &mockEventRepo{}
	vendorRepo := &mockVendorRepo{}

	readSvc := authReadService{
		authRepo:         authRepo,
		refreshTokenRepo: refreshRepo,
		jwtService:       testJWT,
	}

	svc := &authWriteService{
		authReadService:  readSvc,
		authRepo:         authRepo,
		refreshTokenRepo: refreshRepo,
		jwtService:       testJWT,
		eventRepo:        eventRepo,
		vendorRepo:       vendorRepo,
		tokenCache:       make(map[string]*cachedTokenPair),
	}

	return svc, authRepo, refreshRepo
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func generateValidRefreshToken(t *testing.T, userID string) string {
	t.Helper()
	token, err := testJWT.GenerateRefreshToken(userID)
	if err != nil {
		t.Fatalf("failed to generate test refresh token: %v", err)
	}
	return token
}

func sha256Hex(s string) string {
	return hex.EncodeToString(sha256Hash(s))
}

func makeStoredToken(userID uuid.UUID, tokenHash string) *models.RefreshToken {
	return &models.RefreshToken{
		ID:         uuid.New(),
		UserID:     userID,
		TokenHash:  tokenHash,
		Revoked:    false,
		ExpiresAt:  time.Now().Add(30 * 24 * time.Hour),
		CreatedAt:  time.Now().Add(-1 * time.Hour),
		ConsumedAt: nil,
	}
}

func primeCache(t *testing.T, svc *authWriteService, key string, userID uuid.UUID, pair *TokenPair) {
	t.Helper()
	svc.tokenCacheMutex.Lock()
	svc.tokenCache[key] = &cachedTokenPair{
		Tokens:    pair,
		UserID:    userID,
		CreatedAt: time.Now(),
	}
	svc.tokenCacheMutex.Unlock()
}