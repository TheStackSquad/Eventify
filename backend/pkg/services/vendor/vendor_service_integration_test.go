//backend/pkg/services/vendor/vendor_service_integration_test.go

package vendor_test

import (
	"context"
	"testing"

	"github.com/eventify/backend/pkg/models"
	repovendor "github.com/eventify/backend/pkg/repository/vendor"
	servicevendor "github.com/eventify/backend/pkg/services/vendor"
	"github.com/eventify/backend/pkg/testhelper"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// CREATE VENDOR
// ============================================================================

func TestCreateVendor_Integration(t *testing.T) {
	db := testhelper.NewTestDB(t)
	repo := repovendor.NewPostgresVendorRepository(db)
	svc := servicevendor.NewVendorService(repo)
	ctx := context.Background()

	t.Cleanup(func() {
		testhelper.TruncateTables(t, db,
			"profile_views", "reviews", "inquiries", "subscriptions",
			"vendor_stats", "vendor_trust_score", "vendors", "users",
		)
	})

	cases := []struct {
		name        string
		buildVendor func(ownerID uuid.UUID) *models.Vendor
		wantErrMsg  string // "" = expect success
	}{
		{
			name: "success: valid vendor with vNIN creates profile and sets isIdentityVerified",
			buildVendor: func(ownerID uuid.UUID) *models.Vendor {
				return &models.Vendor{
					OwnerID:  ownerID,
					Name:     "Blessed Decor",
					Category: "Decoration",
					State:    "Lagos",
					VNIN:     "NIN00000000001",
				}
			},
		},
		{
			name: "success: vendor with CAC number auto-sets isBusinessVerified",
			buildVendor: func(ownerID uuid.UUID) *models.Vendor {
				return &models.Vendor{
					OwnerID:   ownerID,
					Name:      "RC Business Events",
					Category:  "Catering",
					State:     "Rivers",
					VNIN:      "NIN00000000002",
					CACNumber: models.ToNullString("RC-123456"),
				}
			},
		},
		{
			name: "fail: missing vNIN is rejected",
			buildVendor: func(ownerID uuid.UUID) *models.Vendor {
				return &models.Vendor{
					OwnerID:  ownerID,
					Name:     "No VNIN Vendor",
					Category: "Photography",
					State:    "Abuja FCT",
					VNIN:     "",
				}
			},
			wantErrMsg: "vNIN is mandatory",
		},
		{
			name: "fail: whitespace-only vNIN is rejected",
			buildVendor: func(ownerID uuid.UUID) *models.Vendor {
				return &models.Vendor{
					OwnerID:  ownerID,
					Name:     "Empty VNIN Vendor",
					Category: "Music",
					State:    "Lagos",
					VNIN:     "   ",
				}
			},
			wantErrMsg: "vNIN is mandatory",
		},
		{
			name: "fail: duplicate registration for same owner",
			buildVendor: func(ownerID uuid.UUID) *models.Vendor {
				testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{
					OwnerID: ownerID,
					VNIN:    "NIN-EXISTING-01",
				})
				return &models.Vendor{
					OwnerID:  ownerID,
					Name:     "Duplicate Attempt",
					Category: "Catering",
					State:    "Lagos",
					VNIN:     "NIN00000000099",
				}
			},
			wantErrMsg: "already has an active vendor account",
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			ownerID := testhelper.CreateTestUser(t, db)
			vendor := tc.buildVendor(ownerID)

			id, err := svc.CreateVendor(ctx, vendor)

			if tc.wantErrMsg != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.wantErrMsg)
				return
			}

			require.NoError(t, err)
			assert.NotEmpty(t, id)

			fetched, fetchErr := svc.GetVendorByID(ctx, id)
			require.NoError(t, fetchErr)

			assert.True(t, fetched.IsIdentityVerified,
				"service must set IsIdentityVerified=true when vNIN is provided")

			if vendor.CACNumber.Valid && vendor.CACNumber.String != "" {
				assert.True(t, fetched.IsBusinessVerified.Bool,
					"service must auto-set IsBusinessVerified when CACNumber is provided")
			}
		})
	}
}

func TestCreateVendor_ReregistrationAfterDelete_GivesGracePeriodError(t *testing.T) {
	db := testhelper.NewTestDB(t)
	repo := repovendor.NewPostgresVendorRepository(db)
	svc := servicevendor.NewVendorService(repo)
	ctx := context.Background()

	t.Cleanup(func() {
		testhelper.TruncateTables(t, db, "vendors", "users")
	})

	ownerID := testhelper.CreateTestUser(t, db)
	vendorID := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{OwnerID: ownerID})

	err := svc.DeleteVendor(ctx, vendorID.String())
	require.NoError(t, err)

	newVendor := &models.Vendor{
		OwnerID:  ownerID,
		Name:     "Re-registered Vendor",
		Category: "Catering",
		State:    "Lagos",
		VNIN:     "NIN-FRESH-0001",
	}

	_, err = svc.CreateVendor(ctx, newVendor)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "deleted")
}

func TestUpdateVendor(t *testing.T) {
	db := testhelper.NewTestDB(t)
	repo := repovendor.NewPostgresVendorRepository(db)
	svc := servicevendor.NewVendorService(repo)
	ctx := context.Background()

	t.Cleanup(func() {
		testhelper.TruncateTables(t, db, "vendors", "users")
	})

	t.Run("success: owner can update their own vendor", func(t *testing.T) {
		ownerID := testhelper.CreateTestUser(t, db)
		vendorID := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{
			OwnerID: ownerID, Name: "Old Name",
		})

		updated := &models.Vendor{
			Name:     "New Name",
			Category: "Photography",
			State:    "Lagos",
			Status:   models.VendorStatusActive,
			VNIN:     "NIN-UPDATE-001",
		}

		err := svc.UpdateVendor(ctx, vendorID.String(), ownerID, updated)
		require.NoError(t, err)

		v, _ := svc.GetVendorByID(ctx, vendorID.String())
		assert.Equal(t, "New Name", v.Name)
	})

	t.Run("preserved: PVS-relevant fields not overwritten on update", func(t *testing.T) {
		ownerID := testhelper.CreateTestUser(t, db)
		vendorID := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{
			OwnerID:            ownerID,
			IsIdentityVerified: true,
			ProfileCompletion:  80.0,
			ReviewCount:        15,
		})

		updated := &models.Vendor{
			Name:     "Updated Name Only",
			Category: "Catering",
			State:    "Lagos",
			Status:   models.VendorStatusActive,
			VNIN:     "NIN-PRESERVE-01",
		}
		err := svc.UpdateVendor(ctx, vendorID.String(), ownerID, updated)
		require.NoError(t, err)

		v, _ := svc.GetVendorByID(ctx, vendorID.String())
		assert.Greater(t, v.PVSScore, int32(0),
			"PVS-contributing fields must survive a name-only update")
	})
}

// ============================================================================
// DELETE VENDOR
// ============================================================================

func TestDeleteVendor(t *testing.T) {
	db := testhelper.NewTestDB(t)
	repo := repovendor.NewPostgresVendorRepository(db)
	svc := servicevendor.NewVendorService(repo)
	ctx := context.Background()

	t.Cleanup(func() {
		testhelper.TruncateTables(t, db,
			"profile_views", "reviews", "inquiries", "subscriptions",
			"vendor_stats", "vendor_trust_score", "vendors", "users",
		)
	})

	t.Run("success: vendor is soft-deleted", func(t *testing.T) {
		vendorID := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{})

		err := svc.DeleteVendor(ctx, vendorID.String())
		require.NoError(t, err)

		// Row still exists (soft delete) but status must be "deleted"
		var status string
		err = db.Get(&status, `SELECT status FROM vendors WHERE id = $1`, vendorID)
		require.NoError(t, err)
		assert.Equal(t, "deleted", status)
	})

	t.Run("fail: deleting non-existent vendor returns error", func(t *testing.T) {
		err := svc.DeleteVendor(ctx, uuid.New().String())
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})

	t.Run("fail: invalid UUID returns error", func(t *testing.T) {
		err := svc.DeleteVendor(ctx, "bad-id")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid vendor ID format")
	})
}

// ============================================================================
// CALCULATE AND UPDATE PVS
// ============================================================================

func TestCalculateAndUpdatePVS(t *testing.T) {
	db := testhelper.NewTestDB(t)
	repo := repovendor.NewPostgresVendorRepository(db)
	svc := servicevendor.NewVendorService(repo)
	ctx := context.Background()

	t.Cleanup(func() {
		testhelper.TruncateTables(t, db, "vendors", "users")
	})

	t.Run("recalculates and persists PVS correctly", func(t *testing.T) {
		// A fully-loaded vendor: identity + business verified, 100% profile,
		// 20 reviews, 10/10 responded (100% response rate).
		// Expected score: identity+business(70) + profile(15) + reviews(10) + response(5) = 100.
		isVerified := true

		vendorID := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{
			IsIdentityVerified: isVerified,
			IsBusinessVerified: &isVerified,
			ProfileCompletion:  100.0,
			ReviewCount:        20,
			InquiryCount:       10,
			RespondedCount:     10,
			PVSScore:           0, // start at 0 to prove recalculation writes a new value
		})

		err := svc.CalculateAndUpdatePVS(ctx, vendorID.String())
		require.NoError(t, err)

		v, err := svc.GetVendorByID(ctx, vendorID.String())
		require.NoError(t, err)

		assert.Equal(t, int32(100), v.PVSScore,
			"fully loaded vendor must recalculate to 100 (capped at max)")
	})

	t.Run("fail: invalid ID returns error", func(t *testing.T) {
		err := svc.CalculateAndUpdatePVS(ctx, "garbage-id")
		require.Error(t, err)
	})

	t.Run("fail: non-existent vendor returns error", func(t *testing.T) {
		err := svc.CalculateAndUpdatePVS(ctx, uuid.New().String())
		require.Error(t, err)
	})
}

// ============================================================================
// GET VENDOR BY OWNER ID (service layer)
// ============================================================================

func TestGetVendorByOwnerID_ServiceLayer(t *testing.T) {
	db := testhelper.NewTestDB(t)
	repo := repovendor.NewPostgresVendorRepository(db)
	svc := servicevendor.NewVendorService(repo)
	ctx := context.Background()

	t.Cleanup(func() {
		testhelper.TruncateTables(t, db, "vendors", "users")
	})

	t.Run("returns nil for unknown owner", func(t *testing.T) {
		v, err := svc.GetVendorByOwnerID(ctx, uuid.New())
		require.NoError(t, err)
		assert.Nil(t, v)
	})

	t.Run("returns vendor for known owner", func(t *testing.T) {
		ownerID := testhelper.CreateTestUser(t, db)
		testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{
			OwnerID: ownerID, Name: "Known Owner Vendor",
		})

		v, err := svc.GetVendorByOwnerID(ctx, ownerID)
		require.NoError(t, err)
		require.NotNil(t, v)
		assert.Equal(t, "Known Owner Vendor", v.Name)
	})
}

// ============================================================================
// GET VENDORS (public listing)
// ============================================================================

func TestGetVendors_Filtering(t *testing.T) {
	db := testhelper.NewTestDB(t)
	repo := repovendor.NewPostgresVendorRepository(db)
	svc := servicevendor.NewVendorService(repo)
	ctx := context.Background()

	t.Cleanup(func() {
		testhelper.TruncateTables(t, db, "vendors", "users")
	})

	// Seed a mix of vendors
	testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{
		Name: "Lagos Caterer", Category: "Catering", State: "Lagos", Status: "active",
	})
	testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{
		Name: "Rivers Caterer", Category: "Catering", State: "Rivers", Status: "active",
	})
	testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{
		Name: "Lagos Photographer", Category: "Photography", State: "Lagos", Status: "active",
	})
	deletedID := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{
		Name: "Deleted Vendor", Category: "Catering", State: "Lagos", Status: "active",
	})
	testhelper.SoftDeleteVendor(t, db, deletedID)

	t.Run("no filters returns all active non-deleted", func(t *testing.T) {
		vendors, err := svc.GetVendors(ctx, map[string]interface{}{})
		require.NoError(t, err)
		for _, v := range vendors {
			assert.Equal(t, models.VendorStatusActive, v.Status)
			assert.False(t, v.DeletedAt.Valid, "deleted vendors must not appear")
		}
	})

	t.Run("category filter is applied", func(t *testing.T) {
		vendors, err := svc.GetVendors(ctx, map[string]interface{}{"category": "Photography"})
		require.NoError(t, err)
		for _, v := range vendors {
			assert.Equal(t, "Photography", v.Category)
		}
	})

	t.Run("state filter is applied", func(t *testing.T) {
		vendors, err := svc.GetVendors(ctx, map[string]interface{}{"state": "Rivers"})
		require.NoError(t, err)
		for _, v := range vendors {
			assert.Equal(t, "Rivers", v.State)
		}
	})

	t.Run("empty string filter values are ignored", func(t *testing.T) {
		vendors, err := svc.GetVendors(ctx, map[string]interface{}{
			"category": "",
			"state":    "",
		})
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(vendors), 3,
			"empty string filters must be treated as no-op, returning all active vendors")
	})
}