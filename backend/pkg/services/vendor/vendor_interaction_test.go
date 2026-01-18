package vendor_test

import (
	"context"
	"testing"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/eventify/backend/pkg/models"
)

func TestVendorInteractions(t *testing.T) {
	service, database := setupTestService()
	ctx := context.Background()

	t.Run("PVS increases with inquiries and responses", func(t *testing.T) {
		// 1. Setup: Create a verified vendor
		ownerID := uuid.New()
		_, _ = database.Exec("INSERT INTO users (id, email) VALUES ($1, $2)", ownerID, "interact@test.com")
		
		vendor := &models.Vendor{
			OwnerID: ownerID,
			Name: "Interactive Vendor",
			IsIdentityVerified: true,
			ProfileCompletion: 100,
		}
		idStr, _ := service.CreateVendor(ctx, vendor)
		vendorID := uuid.MustParse(idStr)
		defer cleanupVendor(database, idStr, ownerID.String())

		// Initial Score check (Expected: 30 + 15 = 45)
		v1, _ := service.GetVendorByID(ctx, vendorID)
		baseScore := v1.PVSScore

		// 2. Simulate 10 inquiries and 10 responses (100% response rate)
		// We use the Repo directly to simulate background actions
		repo := service.GetRepo() // Assuming you added a getter or use the exported field
		_ = repo.IncrementField(ctx, vendorID, "inquiry_count", 10)
		_ = repo.IncrementField(ctx, vendorID, "responded_count", 10)

		// 3. Trigger recalculation
		err := service.CalculateAndUpdatePVS(ctx, idStr)
		assert.NoError(t, err)

		// 4. Verify Score increase (Response rate adds up to 5 points)
		v2, _ := service.GetVendorByID(ctx, vendorID)
		assert.Greater(t, v2.PVSScore, baseScore, "Score should increase with high response rate")
	})
}