// backend/pkg/middleware/middleware_test_helpers_test.go
//
// Shared test infrastructure for all middleware unit tests.
//
// Contains:
//   - mockAuthService  : implements the full AuthService interface.
//                        Only ParseAccessToken and IsTokenBlacklisted are
//                        configurable — every other method panics loudly if
//                        called, because AuthMiddleware must never touch them.
//   - newTestRouter()  : builds a minimal Gin engine with the middleware under
//                        test wired to a single GET /test probe route.
//   - makeRequest()    : fires an *http.Request through the router and returns
//                        the recorded response — ready for assertions.
//   - fakeClaims()     : returns a valid *servicejwt.Claims for the happy path.
//
// Run all middleware tests:
//
//	go test ./pkg/middleware/ -v
//	go test ./pkg/middleware/ -race -count=3

package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/eventify/backend/pkg/models"
	authService "github.com/eventify/backend/pkg/services/auth"
	servicejwt "github.com/eventify/backend/pkg/services/jwt"
	repoauth "github.com/eventify/backend/pkg/repository/auth"
	vendorrepo "github.com/eventify/backend/pkg/repository/vendor"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ─── Test Setup ───────────────────────────────────────────────────────────────

func init() {
	// Silence Gin's router output so test logs stay clean.
	gin.SetMode(gin.TestMode)
}

// ─── mockAuthService ──────────────────────────────────────────────────────────
//
// Satisfies the full authService.AuthService interface.
//
// Design rules:
//  1. The two methods AuthMiddleware calls are driven by function fields —
//     each test case sets exactly the behaviour it needs.
//  2. Every other method panics with a precise message. An unexpected call
//     means the middleware has grown a new dependency; the suite tells you
//     immediately rather than silently returning zero values.
type mockAuthService struct {
	parseAccessTokenFn   func(ctx context.Context, token string) (*servicejwt.Claims, error)
	isTokenBlacklistedFn func(ctx context.Context, token string) (bool, error)
}
type mockVendorRepository struct {
	getByOwnerIDFn func(ctx context.Context, ownerID uuid.UUID) (*models.Vendor, error)
}

type mockJWTValidator struct {
	validateAccessTokenFn func(tokenString string) (*servicejwt.Claims, error)
}

// Compile-time proof that mockAuthService satisfies the interface.
var _ authService.AuthService = (*mockAuthService)(nil)

// Compile-time proof that mockVendorRepository satisfies the interface.
var _ vendorrepo.VendorRepository = (*mockVendorRepository)(nil)

// Compile-time proof that mockJWTValidator satisfies the interface.
var _ jwtValidator = (*mockJWTValidator)(nil)

// ── Methods AuthMiddleware actually calls ─────────────────────────────────────

func (m *mockAuthService) ParseAccessToken(ctx context.Context, token string) (*servicejwt.Claims, error) {
	if m.parseAccessTokenFn == nil {
		panic("mockAuthService: ParseAccessToken called but parseAccessTokenFn is not set — did you forget to configure the mock?")
	}
	return m.parseAccessTokenFn(ctx, token)
}

func (m *mockAuthService) IsTokenBlacklisted(ctx context.Context, token string) (bool, error) {
	if m.isTokenBlacklistedFn == nil {
		panic("mockAuthService: IsTokenBlacklisted called but isTokenBlacklistedFn is not set — did you forget to configure the mock?")
	}
	return m.isTokenBlacklistedFn(ctx, token)
}

// ── Stubbed methods — panic loudly if called ──────────────────────────────────

func (m *mockAuthService) GetUserProfile(_ context.Context, _ uuid.UUID) (*models.UserProfile, error) {
	panic("mockAuthService: GetUserProfile should never be called by AuthMiddleware")
}

func (m *mockAuthService) VerifyResetToken(_ context.Context, _ string) (bool, error) {
	panic("mockAuthService: VerifyResetToken should never be called by AuthMiddleware")
}

func (m *mockAuthService) Login(
	_ context.Context, _, _, _, _ string, _ bool,
) (*models.UserProfile, *authService.TokenPair, error) {
	panic("mockAuthService: Login should never be called by AuthMiddleware")
}

func (m *mockAuthService) Signup(_ context.Context, _ *models.User) (uuid.UUID, error) {
	panic("mockAuthService: Signup should never be called by AuthMiddleware")
}

func (m *mockAuthService) RefreshToken(
	_ context.Context, _ string, _ time.Duration, _, _ string,
) (uuid.UUID, *authService.TokenPair, error) {
	panic("mockAuthService: RefreshToken should never be called by AuthMiddleware")
}

func (m *mockAuthService) Logout(_ context.Context, _ uuid.UUID, _, _ string) error {
	panic("mockAuthService: Logout should never be called by AuthMiddleware")
}

func (m *mockAuthService) ForgotPassword(_ context.Context, _ string) (string, error) {
	panic("mockAuthService: ForgotPassword should never be called by AuthMiddleware")
}

func (m *mockAuthService) ResetPassword(_ context.Context, _, _ string) error {
	panic("mockAuthService: ResetPassword should never be called by AuthMiddleware")
}

func (m *mockAuthService) BlacklistToken(_ context.Context, _ string, _ time.Time) error {
	panic("mockAuthService: BlacklistToken should never be called by AuthMiddleware")
}

// ─── Router Builder ───────────────────────────────────────────────────────────

// newTestRouter builds a minimal Gin engine with AuthMiddleware protecting a
// single probe route GET /test.
//
// The probe handler captures the Gin context values set by the middleware into
// capturedCtx so tests can assert that user_id / user_id_string were injected
// correctly without needing a real downstream handler.
//
// Usage:
//
//	router, ctx := newTestRouter(svc)
//	w := makeRequest(t, router, requestOpts{bearerToken: "tok"})
//	assert.Equal(t, http.StatusOK, w.Code)
//	assert.Equal(t, testUserID, (*ctx)["user_id"])
func newTestRouter(svc *mockAuthService) (*gin.Engine, *map[string]interface{}) {
	capturedCtx := make(map[string]interface{})

	router := gin.New() // No Logger/Recovery — keeps test output clean.
	router.Use(AuthMiddleware(svc))
	router.GET("/test", func(c *gin.Context) {
		if val, exists := c.Get("user_id"); exists {
			capturedCtx["user_id"] = val
		}
		if val, exists := c.Get("user_id_string"); exists {
			capturedCtx["user_id_string"] = val
		}
		c.Status(http.StatusOK)
	})

	return router, &capturedCtx
}

// ─── Request Builder ──────────────────────────────────────────────────────────

// requestOpts describes a single HTTP request fired at the test router.
// Named fields keep test cases readable as the option set grows.
type requestOpts struct {
	method      string // defaults to GET
	path        string // defaults to /test
	bearerToken string // sets Authorization: Bearer <token> when non-empty
	cookieToken string // sets access_token cookie when non-empty
}

// makeRequest fires opts through router and returns the recorded response.
func makeRequest(t *testing.T, router *gin.Engine, opts requestOpts) *httptest.ResponseRecorder {
	t.Helper()

	method := opts.method
	if method == "" {
		method = http.MethodGet
	}
	path := opts.path
	if path == "" {
		path = "/test"
	}

	req := httptest.NewRequest(method, path, nil)

	if opts.bearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+opts.bearerToken)
	}
	if opts.cookieToken != "" {
		req.AddCookie(&http.Cookie{
			Name:  "access_token",
			Value: opts.cookieToken,
		})
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

// ─── Test Fixtures ────────────────────────────────────────────────────────────

// testUserID is a fixed, deterministic UUID used across all happy-path cases.
// Using a constant makes assertions simple and failures obvious.
var testUserID = uuid.MustParse("550e8400-e29b-41d4-a716-446655440000")

// fakeClaims returns a *servicejwt.Claims that represents a valid, non-expired
// token for testUserID. TokenType mirrors what a real access token carries.
func fakeClaims() *servicejwt.Claims {
	return &servicejwt.Claims{
		UserID:    testUserID.String(),
		TokenType: "access",
	}
}

// validSvc returns a mockAuthService pre-configured for the happy path:
// token parses cleanly and is not blacklisted.
// Tests that need to deviate override only the field they care about.
func validSvc() *mockAuthService {
	return &mockAuthService{
		parseAccessTokenFn:   func(_ context.Context, _ string) (*servicejwt.Claims, error) { return fakeClaims(), nil },
		isTokenBlacklistedFn: func(_ context.Context, _ string) (bool, error) { return false, nil },
	}
}

// ─── mockAuthRepository ───────────────────────────────────────────────────────
//
// Satisfies the full repoauth.AuthRepository interface.
// Only IsUserAdmin is configurable — every other method panics loudly.
// AdminMiddleware must never call anything else.

type mockAuthRepository struct {
	isUserAdminFn func(ctx context.Context, id uuid.UUID) (bool, error)
}

// Compile-time proof that mockAuthRepository satisfies the interface.
var _ repoauth.AuthRepository = (*mockAuthRepository)(nil)

func (m *mockAuthRepository) IsUserAdmin(ctx context.Context, id uuid.UUID) (bool, error) {
	if m.isUserAdminFn == nil {
		panic("mockAuthRepository: IsUserAdmin called but isUserAdminFn is not set")
	}
	return m.isUserAdminFn(ctx, id)
}

func (m *mockAuthRepository) CreateUser(_ context.Context, _ *models.User) (uuid.UUID, error) {
	panic("mockAuthRepository: CreateUser should never be called by AdminMiddleware")
}
func (m *mockAuthRepository) GetUserByEmail(_ context.Context, _ string) (*models.User, error) {
	panic("mockAuthRepository: GetUserByEmail should never be called by AdminMiddleware")
}
func (m *mockAuthRepository) GetUserByID(_ context.Context, _ uuid.UUID) (*models.User, error) {
	panic("mockAuthRepository: GetUserByID should never be called by AdminMiddleware")
}
func (m *mockAuthRepository) GetVendorIDByOwnerID(_ context.Context, _ uuid.UUID) (*uuid.UUID, error) {
	panic("mockAuthRepository: GetVendorIDByOwnerID should never be called by AdminMiddleware")
}
func (m *mockAuthRepository) SavePasswordResetToken(_ context.Context, _, _ string, _ time.Time) error {
	panic("mockAuthRepository: SavePasswordResetToken should never be called by AdminMiddleware")
}
func (m *mockAuthRepository) GetUserByResetToken(_ context.Context, _ string) (*models.User, error) {
	panic("mockAuthRepository: GetUserByResetToken should never be called by AdminMiddleware")
}
func (m *mockAuthRepository) UpdatePassword(_ context.Context, _ uuid.UUID, _ string) error {
	panic("mockAuthRepository: UpdatePassword should never be called by AdminMiddleware")
}
func (m *mockAuthRepository) ClearPasswordResetToken(_ context.Context, _ uuid.UUID) error {
	panic("mockAuthRepository: ClearPasswordResetToken should never be called by AdminMiddleware")
}
func (m *mockAuthRepository) IsAccountLocked(_ context.Context, _ string) (bool, time.Time, error) {
	panic("mockAuthRepository: IsAccountLocked should never be called by AdminMiddleware")
}
func (m *mockAuthRepository) RecordLoginAttempt(_ context.Context, _ string, _ bool) error {
	panic("mockAuthRepository: RecordLoginAttempt should never be called by AdminMiddleware")
}
func (m *mockAuthRepository) ClearFailedLoginAttempts(_ context.Context, _ string) error {
	panic("mockAuthRepository: ClearFailedLoginAttempts should never be called by AdminMiddleware")
}
func (m *mockAuthRepository) UpdateLastLogin(_ context.Context, _ uuid.UUID) error {
	panic("mockAuthRepository: UpdateLastLogin should never be called by AdminMiddleware")
}
func (m *mockAuthRepository) UpdateReminderPreference(_ context.Context, _ uuid.UUID, _ bool) error {
	panic("mockAuthRepository: UpdateReminderPreference should never be called by AdminMiddleware")
}
func (m *mockAuthRepository) BlacklistToken(_ context.Context, _ string, _ time.Time) error {
	panic("mockAuthRepository: BlacklistToken should never be called by AdminMiddleware")
}
func (m *mockAuthRepository) IsTokenBlacklisted(_ context.Context, _ string) (bool, error) {
	panic("mockAuthRepository: IsTokenBlacklisted should never be called by AdminMiddleware")
}
func (m *mockAuthRepository) CleanupBlacklist(_ context.Context) (int64, error) {
	panic("mockAuthRepository: CleanupBlacklist should never be called by AdminMiddleware")
}

// validAdminRepo returns a mockAuthRepository pre-configured for the happy path:
// the user exists and is an admin.
func validAdminRepo() *mockAuthRepository {
	return &mockAuthRepository{
		isUserAdminFn: func(_ context.Context, _ uuid.UUID) (bool, error) {
			return true, nil
		},
	}
}

// ─── mockVendorRepository ─────────────────────────────────────────────────────
//
// Satisfies the full vendor.VendorRepository interface.
// Only GetByOwnerID is configurable — every other method panics loudly.
// ExtractVendorID must never call anything else.


func (m *mockVendorRepository) GetByOwnerID(ctx context.Context, ownerID uuid.UUID) (*models.Vendor, error) {
	if m.getByOwnerIDFn == nil {
		panic("mockVendorRepository: GetByOwnerID called but getByOwnerIDFn is not set")
	}
	return m.getByOwnerIDFn(ctx, ownerID)
}

func (m *mockVendorRepository) Create(_ context.Context, _ *models.Vendor) (uuid.UUID, error) {
	panic("mockVendorRepository: Create should never be called by ExtractVendorID")
}
func (m *mockVendorRepository) Update(_ context.Context, _ *models.Vendor) error {
	panic("mockVendorRepository: Update should never be called by ExtractVendorID")
}
func (m *mockVendorRepository) UpdateFields(_ context.Context, _ uuid.UUID, _ map[string]interface{}) error {
	panic("mockVendorRepository: UpdateFields should never be called by ExtractVendorID")
}
func (m *mockVendorRepository) UpdateVerificationFlag(_ context.Context, _ uuid.UUID, _ string, _ bool, _ string) error {
	panic("mockVendorRepository: UpdateVerificationFlag should never be called by ExtractVendorID")
}
func (m *mockVendorRepository) UpdatePVSScore(_ context.Context, _ uuid.UUID, _ int) error {
	panic("mockVendorRepository: UpdatePVSScore should never be called by ExtractVendorID")
}
func (m *mockVendorRepository) IncrementField(_ context.Context, _ uuid.UUID, _ string, _ int) error {
	panic("mockVendorRepository: IncrementField should never be called by ExtractVendorID")
}
func (m *mockVendorRepository) Delete(_ context.Context, _ uuid.UUID) (int64, error) {
	panic("mockVendorRepository: Delete should never be called by ExtractVendorID")
}
func (m *mockVendorRepository) GetByID(_ context.Context, _ uuid.UUID) (models.Vendor, error) {
	panic("mockVendorRepository: GetByID should never be called by ExtractVendorID")
}
func (m *mockVendorRepository) FindPublicVendors(_ context.Context, _ map[string]string) ([]models.Vendor, error) {
	panic("mockVendorRepository: FindPublicVendors should never be called by ExtractVendorID")
}
func (m *mockVendorRepository) GetVendorSubscription(_ context.Context, _ uuid.UUID) (*models.VendorWithSubscription, error) {
	panic("mockVendorRepository: GetVendorSubscription should never be called by ExtractVendorID")
}
func (m *mockVendorRepository) IsRegisteredVendor(_ context.Context, _ uuid.UUID) (bool, error) {
	panic("mockVendorRepository: IsRegisteredVendor should never be called by ExtractVendorID")
}

// testVendorID is a fixed vendor UUID for happy-path assertions.
var testVendorID = uuid.MustParse("ffffffff-ffff-ffff-ffff-ffffffffffff")

// fakeVendor returns a minimal *models.Vendor for the happy path.
func fakeVendor() *models.Vendor {
	return &models.Vendor{
		ID:      testVendorID,
		OwnerID: testUserID,
	}
}

// validVendorRepo returns a mockVendorRepository pre-configured for the
// happy path: GetByOwnerID returns fakeVendor with no error.
func validVendorRepo() *mockVendorRepository {
	return &mockVendorRepository{
		getByOwnerIDFn: func(_ context.Context, _ uuid.UUID) (*models.Vendor, error) {
			return fakeVendor(), nil
		},
	}
}

// ─── mockJWTValidator ─────────────────────────────────────────────────────────
//
// Satisfies the jwtValidator interface defined in optional_auth.go.
// One method, one configurable field — no panic stubs needed.



func (m *mockJWTValidator) ValidateAccessToken(tokenString string) (*servicejwt.Claims, error) {
	if m.validateAccessTokenFn == nil {
		panic("mockJWTValidator: ValidateAccessToken called but validateAccessTokenFn is not set")
	}
	return m.validateAccessTokenFn(tokenString)
}

// validJWTValidator returns a mockJWTValidator pre-configured for the happy
// path: ValidateAccessToken returns valid claims with no error.
func validJWTValidator() *mockJWTValidator {
	return &mockJWTValidator{
		validateAccessTokenFn: func(_ string) (*servicejwt.Claims, error) {
			return fakeClaims(), nil
		},
	}
}