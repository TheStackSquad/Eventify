// pkg/repository/vendor/vendor_repo_integration_test.go
//
// Run with: go test ./pkg/repository/vendor/... -v -tags=integration
// Requires Eventify_test DB to be running with .env.test loaded.
package vendor_test

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/eventify/backend/pkg/models"
	repovendor "github.com/eventify/backend/pkg/repository/vendor"
	"github.com/eventify/backend/pkg/testhelper"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// ============================================================================
// SUITE SETUP
// ============================================================================

type VendorRepoSuite struct {
	suite.Suite
	db   *sqlx.DB
	repo repovendor.VendorRepository
	ctx  context.Context
}

func TestVendorRepoSuite(t *testing.T) {
	suite.Run(t, new(VendorRepoSuite))
}

func (s *VendorRepoSuite) SetupSuite() {
	s.db = testhelper.NewTestDB(s.T())
	s.repo = repovendor.NewPostgresVendorRepository(s.db)
	s.ctx = context.Background()
}

func (s *VendorRepoSuite) TearDownTest() {
	// Clean in FK-safe order so each test starts with an empty slate.
	testhelper.TruncateTables(s.T(), s.db,
		"profile_views", "reviews", "inquiries", "subscriptions",
		"vendor_stats", "vendor_trust_score",
		"vendors", "users",
	)
}

// ============================================================================
// CREATE
// ============================================================================

func (s *VendorRepoSuite) TestCreate_Success() {
	ownerID := testhelper.CreateTestUser(s.T(), s.db)

	vendor := &models.Vendor{
		OwnerID:            ownerID,
		Name:               "Mama Titi Catering",
		Category:           "Catering",
		State:              "Lagos",
		Status:             models.VendorStatusActive,
		VNIN: "NIN12345678901",
		IsBusinessRegistered: false,
		IsIdentityVerified: true,
		SubscriptionTier:   models.TierFree,
	}

	id, err := s.repo.Create(s.ctx, vendor)
	s.NoError(err)
	s.NotEqual(uuid.Nil, id)

	// Verify persisted correctly
	fetched, err := s.repo.GetByID(s.ctx, id)
	s.NoError(err)
	s.Equal("Mama Titi Catering", fetched.Name)
	s.Equal(ownerID, fetched.OwnerID)
	s.True(fetched.IsIdentityVerified)
	s.False(fetched.DeletedAt.Valid, "newly created vendor should not have a deleted_at timestamp")
}

func (s *VendorRepoSuite) TestCreate_RejectsNilVendor() {
	_, err := s.repo.Create(s.ctx, nil)
	s.Error(err)
	s.Contains(err.Error(), "nil")
}

func (s *VendorRepoSuite) TestCreate_EnforcesUniqueOwnerID() {
	ownerID := testhelper.CreateTestUser(s.T(), s.db)

	first := &models.Vendor{
		OwnerID:          ownerID,
		Name:             "First Vendor",
		Category:         "Photography",
		State:            "Abuja FCT",
		Status:           models.VendorStatusActive,
		VNIN: "NIN11111111111",
		SubscriptionTier: models.TierFree,
	}
	_, err := s.repo.Create(s.ctx, first)
	s.NoError(err)

	second := &models.Vendor{
		OwnerID:          ownerID, // same owner — must fail
		Name:             "Second Vendor",
		Category:         "Catering",
		State:            "Lagos",
		Status:           models.VendorStatusActive,
		VNIN: "NIN22222222222",
		SubscriptionTier: models.TierFree,
	}
	_, err = s.repo.Create(s.ctx, second)
	s.Error(err, "UNIQUE constraint on owner_id must be enforced at DB level")
}

// ============================================================================
// GET BY ID
// ============================================================================

func (s *VendorRepoSuite) TestGetByID_Found() {
	id := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name: "DJ Khalid Events",
	})

	v, err := s.repo.GetByID(s.ctx, id)
	s.NoError(err)
	s.Equal("DJ Khalid Events", v.Name)
}

func (s *VendorRepoSuite) TestGetByID_NotFound() {
	_, err := s.repo.GetByID(s.ctx, uuid.New())
	s.Error(err, "fetching a non-existent ID should return an error")
}

// ============================================================================
// GET BY OWNER ID
// ============================================================================

func (s *VendorRepoSuite) TestGetByOwnerID_Found() {
	ownerID := testhelper.CreateTestUser(s.T(), s.db)
	testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		OwnerID: ownerID,
		Name:    "Owner's Vendor",
	})

	v, err := s.repo.GetByOwnerID(s.ctx, ownerID)
	s.NoError(err)
	s.NotNil(v)
	s.Equal("Owner's Vendor", v.Name)
}

func (s *VendorRepoSuite) TestGetByOwnerID_ReturnsNilForUnknownOwner() {
	v, err := s.repo.GetByOwnerID(s.ctx, uuid.New())
	s.NoError(err)
	s.Nil(v, "unknown owner should return nil, not error")
}

// BUG REGRESSION: soft-deleted vendors must be invisible to GetByOwnerID.
// Before fix: query had no deleted_at filter — would return the deleted vendor.
// After fix: deleted_at IS NULL filter excludes it.
func (s *VendorRepoSuite) TestGetByOwnerID_ExcludesSoftDeletedVendor() {
	ownerID := testhelper.CreateTestUser(s.T(), s.db)
	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		OwnerID: ownerID,
	})

	// Soft-delete the vendor
	testhelper.SoftDeleteVendor(s.T(), s.db, vendorID)

	v, err := s.repo.GetByOwnerID(s.ctx, ownerID)
	s.NoError(err)
	s.Nil(v, "soft-deleted vendor must NOT be returned by GetByOwnerID")
}

// ============================================================================
// IS REGISTERED VENDOR
// ============================================================================

func (s *VendorRepoSuite) TestIsRegisteredVendor_TrueForActiveVendor() {
	ownerID := testhelper.CreateTestUser(s.T(), s.db)
	testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{OwnerID: ownerID})

	ok, err := s.repo.IsRegisteredVendor(s.ctx, ownerID)
	s.NoError(err)
	s.True(ok)
}

func (s *VendorRepoSuite) TestIsRegisteredVendor_FalseForUnknownUser() {
	ok, err := s.repo.IsRegisteredVendor(s.ctx, uuid.New())
	s.NoError(err)
	s.False(ok)
}

// ============================================================================
// FIND PUBLIC VENDORS
// ============================================================================

func (s *VendorRepoSuite) TestFindPublicVendors_ReturnsActiveOnly() {
	testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name:   "Active One",
		Status: "active",
	})
	testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name:   "Suspended One",
		Status: "suspended",
	})

	vendors, err := s.repo.FindPublicVendors(s.ctx, map[string]string{})
	s.NoError(err)

	for _, v := range vendors {
		s.Equal(models.VendorStatusActive, v.Status,
			"only active vendors should appear in public listing")
	}

	names := make([]string, len(vendors))
	for i, v := range vendors {
		names[i] = v.Name
	}
	s.Contains(names, "Active One")
	s.NotContains(names, "Suspended One")
}

// BUG REGRESSION: soft-deleted vendors (deleted_at IS NOT NULL) must not
// appear in public listings even when their status column still reads "active".
// Before fix: no deleted_at filter — deleted vendor leaked into results.
func (s *VendorRepoSuite) TestFindPublicVendors_ExcludesSoftDeleted() {
	activeID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name:   "Legitimate Active",
		Status: "active",
	})
	deletedID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name:   "Ghost Vendor",
		Status: "active", // simulate pre-fix state: status still active, deleted_at set
	})
	testhelper.SoftDeleteVendor(s.T(), s.db, deletedID)

	vendors, err := s.repo.FindPublicVendors(s.ctx, map[string]string{})
	s.NoError(err)

	ids := make([]uuid.UUID, len(vendors))
	for i, v := range vendors {
		ids[i] = v.ID
	}
	s.Contains(ids, activeID, "active vendor must be in results")
	s.NotContains(ids, deletedID, "soft-deleted vendor must be excluded from public listing")
}

func (s *VendorRepoSuite) TestFindPublicVendors_FilterByCategory() {
	testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name: "Lagos Caterer", Category: "Catering",
	})
	testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name: "Lagos Photographer", Category: "Photography",
	})

	vendors, err := s.repo.FindPublicVendors(s.ctx, map[string]string{
		"category": "Catering",
	})
	s.NoError(err)
	for _, v := range vendors {
		s.Equal("Catering", v.Category)
	}
}

func (s *VendorRepoSuite) TestFindPublicVendors_FilterByState() {
	testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name: "Lagos Vendor", State: "Lagos",
	})
	testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name: "Rivers Vendor", State: "Rivers",
	})

	vendors, err := s.repo.FindPublicVendors(s.ctx, map[string]string{
		"state": "Lagos",
	})
	s.NoError(err)
	for _, v := range vendors {
		s.Equal("Lagos", v.State)
	}
}

func (s *VendorRepoSuite) TestFindPublicVendors_EmptyFiltersReturnAllActive() {
	testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{Name: "Vendor A"})
	testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{Name: "Vendor B"})

	vendors, err := s.repo.FindPublicVendors(s.ctx, map[string]string{})
	s.NoError(err)
	s.GreaterOrEqual(len(vendors), 2)
}

// ============================================================================
// UPDATE
// ============================================================================

func (s *VendorRepoSuite) TestUpdate_Success() {
	ownerID := testhelper.CreateTestUser(s.T(), s.db)
	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		OwnerID: ownerID, Name: "Old Name",
	})

	existing, err := s.repo.GetByID(s.ctx, vendorID)
	s.NoError(err)
	existing.Name = "New Name"

	err = s.repo.Update(s.ctx, &existing)
	s.NoError(err)

	updated, _ := s.repo.GetByID(s.ctx, vendorID)
	s.Equal("New Name", updated.Name)
	s.True(updated.UpdatedAt.After(existing.CreatedAt))
}

func (s *VendorRepoSuite) TestUpdate_FailsForWrongOwner() {
	rightOwner := testhelper.CreateTestUser(s.T(), s.db)
	wrongOwner := testhelper.CreateTestUser(s.T(), s.db)

	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		OwnerID: rightOwner,
	})

	existing, _ := s.repo.GetByID(s.ctx, vendorID)
	existing.OwnerID = wrongOwner // tamper with ownership
	existing.Name = "Hacked Name"

	err := s.repo.Update(s.ctx, &existing)
	s.Error(err, "update with wrong owner should be rejected")
	s.Contains(err.Error(), "not found or unauthorized")
}

// ============================================================================
// UPDATE FIELDS
// ============================================================================

func (s *VendorRepoSuite) TestUpdateFields_ChangesSpecifiedFields() {
	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name: "Pre-Update Name",
	})

	err := s.repo.UpdateFields(s.ctx, vendorID, map[string]interface{}{
		"name": "Post-Update Name",
	})
	s.NoError(err)

	v, _ := s.repo.GetByID(s.ctx, vendorID)
	s.Equal("Post-Update Name", v.Name)
}

func (s *VendorRepoSuite) TestUpdateFields_EmptyMapIsNoOp() {
	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{Name: "Stable Name"})

	err := s.repo.UpdateFields(s.ctx, vendorID, map[string]interface{}{})
	s.NoError(err)

	v, _ := s.repo.GetByID(s.ctx, vendorID)
	s.Equal("Stable Name", v.Name, "empty updates should not alter the record")
}

// ============================================================================
// INCREMENT FIELD
// ============================================================================

func (s *VendorRepoSuite) TestIncrementField_ValidFields() {
	validFields := []string{"inquiry_count", "responded_count", "review_count"}
	for _, field := range validFields {
		vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{})

		err := s.repo.IncrementField(s.ctx, vendorID, field, 1)
		s.NoError(err, "field %q should be incrementable", field)

		v, _ := s.repo.GetByID(s.ctx, vendorID)
		switch field {
		case "inquiry_count":
			s.Equal(int32(1), v.InquiryCount)
		case "responded_count":
			s.Equal(int32(1), v.RespondedCount)
		case "review_count":
			s.Equal(int32(1), v.ReviewCount)
		}
	}
}

func (s *VendorRepoSuite) TestIncrementField_RejectsInvalidField() {
	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{})

	err := s.repo.IncrementField(s.ctx, vendorID, "pvs_score", 5)
	s.Error(err, "pvs_score is not an allowed increment field")

	err = s.repo.IncrementField(s.ctx, vendorID, "name", 1)
	s.Error(err, "name is not an allowed increment field")

	// SQL-injection-style field name attempt
	err = s.repo.IncrementField(s.ctx, vendorID, "pvs_score; DROP TABLE vendors", 1)
	s.Error(err)
}

// ============================================================================
// UPDATE VERIFICATION FLAG
// ============================================================================

func (s *VendorRepoSuite) TestUpdateVerificationFlag_ValidIdentityField() {
	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		IsIdentityVerified: false,
	})

	err := s.repo.UpdateVerificationFlag(s.ctx, vendorID, "is_identity_verified", true, "admin approved")
	s.NoError(err)

	v, _ := s.repo.GetByID(s.ctx, vendorID)
	s.True(v.IsIdentityVerified)
}

func (s *VendorRepoSuite) TestUpdateVerificationFlag_ValidBusinessField() {
	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{})

	err := s.repo.UpdateVerificationFlag(s.ctx, vendorID, "is_business_verified", true, "CAC validated")
	s.NoError(err)

	v, _ := s.repo.GetByID(s.ctx, vendorID)
	s.True(v.IsBusinessVerified.Bool)
}

func (s *VendorRepoSuite) TestUpdateVerificationFlag_RejectsArbitraryField() {
	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{})

	err := s.repo.UpdateVerificationFlag(s.ctx, vendorID, "status", true, "")
	s.Error(err, "only is_identity_verified and is_business_verified are valid fields")

	err = s.repo.UpdateVerificationFlag(s.ctx, vendorID, "pvs_score", true, "")
	s.Error(err)
}

// ============================================================================
// DELETE (SOFT DELETE)
// ============================================================================

// BUG REGRESSION: Delete must set BOTH deleted_at AND status = 'deleted'.
// Before fix: only deleted_at was set; status remained "active".
func (s *VendorRepoSuite) TestDelete_SetsBothDeletedAtAndStatus() {
	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Status: "active",
	})

	count, err := s.repo.Delete(s.ctx, vendorID)
	s.NoError(err)
	s.Equal(int64(1), count)

	// Read directly from DB to bypass any model-layer filtering
	var v struct {
		Status    string       `db:"status"`
		DeletedAt sql.NullTime `db:"deleted_at"`
	}
	err = s.db.Get(&v, `SELECT status, deleted_at FROM vendors WHERE id = $1`, vendorID)
	s.NoError(err)
	s.Equal("deleted", v.Status, "status must be 'deleted' after soft delete (BUG: was still 'active')")
	s.True(v.DeletedAt.Valid, "deleted_at must be set after soft delete")
}

func (s *VendorRepoSuite) TestDelete_IsIdempotentOnAlreadyDeletedVendor() {
	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{})

	count1, err := s.repo.Delete(s.ctx, vendorID)
	s.NoError(err)
	s.Equal(int64(1), count1)

	// Second delete should affect 0 rows (idempotent)
	count2, err := s.repo.Delete(s.ctx, vendorID)
	s.NoError(err)
	s.Equal(int64(0), count2, "second delete on already-deleted vendor must return 0 rows affected")
}

func (s *VendorRepoSuite) TestDelete_ReturnsZeroForNonExistentID() {
	count, err := s.repo.Delete(s.ctx, uuid.New())
	s.NoError(err)
	s.Equal(int64(0), count)
}

// ============================================================================
// UPDATE PVS SCORE
// ============================================================================

func (s *VendorRepoSuite) TestUpdatePVSScore_PersistsCorrectly() {
	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		PVSScore: 0,
	})

	err := s.repo.UpdatePVSScore(s.ctx, vendorID, 75)
	s.NoError(err)

	v, _ := s.repo.GetByID(s.ctx, vendorID)
	s.Equal(int32(75), v.PVSScore)
}

// ============================================================================
// TABLE-DRIVEN: IS REGISTERED VENDOR (edge cases)
// ============================================================================

func TestIsRegisteredVendor_TableDriven(t *testing.T) {
	db := testhelper.NewTestDB(t)
	repo := repovendor.NewPostgresVendorRepository(db)
	ctx := context.Background()
	t.Cleanup(func() {
		testhelper.TruncateTables(t, db,
			"profile_views", "reviews", "inquiries", "subscriptions",
			"vendor_stats", "vendor_trust_score", "vendors", "users",
		)
	})

	ownerWithVendor := testhelper.CreateTestUser(t, db)
	testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{OwnerID: ownerWithVendor})

	ownerWithDeletedVendor := testhelper.CreateTestUser(t, db)
	delID := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{OwnerID: ownerWithDeletedVendor})
	testhelper.SoftDeleteVendor(t, db, delID)

	cases := []struct {
		name        string
		ownerID     uuid.UUID
		wantIsReg   bool
	}{
		{
			name:      "owner with active vendor is registered",
			ownerID:   ownerWithVendor,
			wantIsReg: true,
		},
		{
			name:      "unknown owner is not registered",
			ownerID:   uuid.New(),
			wantIsReg: false,
		},
		// NOTE: IsRegisteredVendor checks for row existence regardless of deleted_at.
		// This is intentional — the service layer uses it to gate re-registration,
		// and separately checks the status to give the right error message.
		// So we verify it returns true even for deleted vendors (soft row still exists).
		{
			name:      "owner with soft-deleted vendor still shows as registered in repo",
			ownerID:   ownerWithDeletedVendor,
			wantIsReg: true,
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			got, err := repo.IsRegisteredVendor(ctx, tc.ownerID)
			require.NoError(t, err)
			assert.Equal(t, tc.wantIsReg, got)
		})
	}
}

// ============================================================================
// TABLE-DRIVEN: PROFILE VIEW TRACKING
// ============================================================================

func TestProfileViewTracking_TableDriven(t *testing.T) {
	db := testhelper.NewTestDB(t)
	repo := repovendor.NewPostgresVendorStatsRepo(db)
	ctx := context.Background()
	t.Cleanup(func() {
		testhelper.TruncateTables(t, db,
			"profile_views", "vendors", "users",
		)
	})

	vendorID := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{})

	cases := []struct {
		name        string
		sessionID   string
		viewerIP    string
		expectErr   bool
		errContains string
	}{
		{
			name:      "valid view is recorded",
			sessionID: uuid.New().String(),
			viewerIP:  "192.168.1.1",
			expectErr: false,
		},
		{
			name:        "empty session_id returns error",
			sessionID:   "",
			viewerIP:    "192.168.1.1",
			expectErr:   true,
			errContains: "session_id",
		},
		{
			name:        "empty viewer_ip returns error",
			sessionID:   uuid.New().String(),
			viewerIP:    "",
			expectErr:   true,
			errContains: "viewer_ip",
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			_, err := repo.RecordProfileView(ctx, vendorID, nil, tc.viewerIP, tc.sessionID, "test-agent")
			if tc.expectErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.errContains)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

// TestProfileViewCount_30DayWindow verifies that only views within the last 30 days
// are counted by GetProfileViewCount30d.
func TestProfileViewCount_30DayWindow(t *testing.T) {
	db := testhelper.NewTestDB(t)
	repo := repovendor.NewPostgresVendorStatsRepo(db)
	ctx := context.Background()
	t.Cleanup(func() {
		testhelper.TruncateTables(t, db, "profile_views", "vendors", "users")
	})

	vendorID := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{})

	now := time.Now()
	old := now.AddDate(0, 0, -31) // older than 30 days

	testhelper.CreateTestProfileView(t, db, vendorID, now)
	testhelper.CreateTestProfileView(t, db, vendorID, now.AddDate(0, 0, -15))
	testhelper.CreateTestProfileView(t, db, vendorID, old) // should NOT count

	count, err := repo.GetProfileViewCount30d(ctx, vendorID)
	require.NoError(t, err)
	assert.Equal(t, 2, count, "only views within 30 days should be counted")
}