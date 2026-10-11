//backend/pkg/services/vendor/vendor_interaction_test.go
package vendor_test

import (
	"context"
	"testing"

	repovendor "github.com/eventify/backend/pkg/repository/vendor"
	servicevendor "github.com/eventify/backend/pkg/services/vendor"
	"github.com/eventify/backend/pkg/testhelper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestVendorInteractions_PVSWithActivity validates that PVS is re-scored correctly
// after background activity (inquiries + responses) is recorded on a vendor.
//
// Design note: we construct the repo directly from the test DB instead of calling
// service.GetRepo(). The service should never expose its repo — this keeps the
// interaction purely at the correct abstraction level.
func TestVendorInteractions_PVSWithActivity(t *testing.T) {
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

	t.Run("PVS increases after 100%% response rate is recorded", func(t *testing.T) {
		ownerID := testhelper.CreateTestUser(t, db)

		vendorID := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{
			OwnerID:            ownerID,
			Name:               "Interactive Vendor",
			IsIdentityVerified: true,
			ProfileCompletion:  100.0,
			PVSScore:           0, // start at 0 to make the change observable
		})

		// Establish a clean baseline with initial PVS calculation.
		// identity(30) + profile(15) = 45, no response rate yet (0 inquiries).
		err := svc.CalculateAndUpdatePVS(ctx, vendorID.String())
		require.NoError(t, err)

		v1, err := svc.GetVendorByID(ctx, vendorID.String())
		require.NoError(t, err)
		baseScore := v1.PVSScore
		assert.Equal(t, int32(45), baseScore,
			"baseline: identity(30) + 100%% profile(15) = 45")

		// Simulate background activity: 10 inquiries received, 10 responded to.
		// The repo is used directly here — this is the correct pattern for
		// tests that need to mutate activity fields without going through the
		// business-logic path that would also re-calculate PVS automatically.
		require.NoError(t, repo.IncrementField(ctx, vendorID, "inquiry_count", 10))
		require.NoError(t, repo.IncrementField(ctx, vendorID, "responded_count", 10))

		// Trigger an explicit recalculation.
		err = svc.CalculateAndUpdatePVS(ctx, vendorID.String())
		require.NoError(t, err)

		v2, err := svc.GetVendorByID(ctx, vendorID.String())
		require.NoError(t, err)

		// 100% response rate (10/10) adds 5 points → 45 + 5 = 50
		assert.Greater(t, v2.PVSScore, baseScore,
			"PVS must increase after 100%% response rate is recorded")
		assert.Equal(t, int32(50), v2.PVSScore,
			"identity(30) + profile(15) + 100%% response_rate(5) = 50")
	})

	t.Run("PVS increases as review count crosses tier thresholds", func(t *testing.T) {
		ownerID := testhelper.CreateTestUser(t, db)

		vendorID := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{
			OwnerID:            ownerID,
			Name:               "Growing Reviewer Vendor",
			IsIdentityVerified: true,
			ProfileCompletion:  0,
			ReviewCount:        0,
			PVSScore:           0,
		})

		// Baseline: identity only = 30
		err := svc.CalculateAndUpdatePVS(ctx, vendorID.String())
		require.NoError(t, err)

		v0, err := svc.GetVendorByID(ctx, vendorID.String())
		require.NoError(t, err)
		assert.Equal(t, int32(30), v0.PVSScore, "baseline: identity(30) only")

		// Cross tier-1 threshold: 1 review → +3
		require.NoError(t, repo.IncrementField(ctx, vendorID, "review_count", 1))
		require.NoError(t, svc.CalculateAndUpdatePVS(ctx, vendorID.String()))

		v1, err := svc.GetVendorByID(ctx, vendorID.String())
		require.NoError(t, err)
		assert.Equal(t, int32(33), v1.PVSScore, "1 review: identity(30) + tier-1 reviews(3) = 33")

		// Cross tier-2 threshold: 10 reviews → +7
		require.NoError(t, repo.IncrementField(ctx, vendorID, "review_count", 9)) // bring total to 10
		require.NoError(t, svc.CalculateAndUpdatePVS(ctx, vendorID.String()))

		v2, err := svc.GetVendorByID(ctx, vendorID.String())
		require.NoError(t, err)
		assert.Equal(t, int32(37), v2.PVSScore, "10 reviews: identity(30) + tier-2 reviews(7) = 37")

		// Cross tier-3 threshold: 20 reviews → +10
		require.NoError(t, repo.IncrementField(ctx, vendorID, "review_count", 10)) // bring total to 20
		require.NoError(t, svc.CalculateAndUpdatePVS(ctx, vendorID.String()))

		v3, err := svc.GetVendorByID(ctx, vendorID.String())
		require.NoError(t, err)
		assert.Equal(t, int32(40), v3.PVSScore, "20 reviews: identity(30) + tier-3 reviews(10) = 40")
	})
}