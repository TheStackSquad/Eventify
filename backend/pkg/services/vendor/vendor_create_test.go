//backend/pkg/services/vendor/vendor_create_test.go

package vendor_test

import (
	"context"
	"testing"

	"github.com/eventify/backend/pkg/models"
	repovendor "github.com/eventify/backend/pkg/repository/vendor"
	servicevendor "github.com/eventify/backend/pkg/services/vendor"
	"github.com/eventify/backend/pkg/testhelper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestCreateVendor_PVSAndValidation covers the PVS score calculated at creation
// time and the input-validation rules enforced by the service layer.
func TestCreateVendor_PVSAndValidation(t *testing.T) {
	db := testhelper.NewTestDB(t)
	repo := repovendor.NewPostgresVendorRepository(db)
	svc := servicevendor.NewVendorService(repo)
	ctx := context.Background()

	t.Cleanup(func() {
		testhelper.TruncateTables(t, db, "vendors", "users")
	})

	t.Run("create with vNIN and 100% profile completion sets PVS to 45", func(t *testing.T) {
		ownerID := testhelper.CreateTestUser(t, db)

		vendor := &models.Vendor{
			OwnerID:           ownerID,
			Name:              "Test Photography",
			Category:          "Photography",
			VNIN:              "12345678901",
			State:             "Lagos",
			PhoneNumber:       "08011112222",
			ProfileCompletion: 100.0,
		}

		id, err := svc.CreateVendor(ctx, vendor)
		require.NoError(t, err)
		assert.NotEmpty(t, id)

		saved, err := svc.GetVendorByID(ctx, id)
		require.NoError(t, err)

		assert.True(t, saved.IsIdentityVerified,
			"service must set IsIdentityVerified=true when vNIN is supplied")

		// identity(30) + 100% profile_completion(15) = 45
		// No reviews, no inquiries/responses yet → no additional points
		assert.Equal(t, int32(45), saved.PVSScore,
			"expected PVS = 30 (identity) + 15 (100%% profile completion)")
	})

	t.Run("create with vNIN and CAC number auto-sets IsBusinessVerified", func(t *testing.T) {
		ownerID := testhelper.CreateTestUser(t, db)

		vendor := &models.Vendor{
			OwnerID:   ownerID,
			Name:      "RC Business Events",
			Category:  "Catering",
			State:     "Rivers",
			VNIN:      "NIN00000000002",
			CACNumber: models.ToNullString("RC-123456"),
		}

		id, err := svc.CreateVendor(ctx, vendor)
		require.NoError(t, err)

		saved, err := svc.GetVendorByID(ctx, id)
		require.NoError(t, err)

		assert.True(t, saved.IsIdentityVerified,
			"vNIN must set IsIdentityVerified")
		assert.True(t, saved.IsBusinessVerified.Bool,
			"CACNumber must auto-set IsBusinessVerified")
	})

	t.Run("fail: empty vNIN is rejected", func(t *testing.T) {
		ownerID := testhelper.CreateTestUser(t, db)

		vendor := &models.Vendor{
			OwnerID: ownerID,
			Name:    "Invalid Vendor",
			VNIN:    "",
		}

		id, err := svc.CreateVendor(ctx, vendor)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "vNIN is mandatory")
		assert.Empty(t, id)
	})

	t.Run("fail: whitespace-only vNIN is rejected", func(t *testing.T) {
		ownerID := testhelper.CreateTestUser(t, db)

		vendor := &models.Vendor{
			OwnerID: ownerID,
			Name:    "Whitespace VNIN Vendor",
			VNIN:    "   ",
		}

		id, err := svc.CreateVendor(ctx, vendor)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "vNIN is mandatory")
		assert.Empty(t, id)
	})
}