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
        ownerID := uuid.New()
        _, _ = database.Exec("INSERT INTO users (id, email) VALUES ($1, $2)", ownerID, "interact@test.com")
        
        vendor := &models.Vendor{
            OwnerID: ownerID,
            Name: "Interactive Vendor",
            IsIdentityVerified: true,
            ProfileCompletion: 100,
        }
        idStr, _ := service.CreateVendor(ctx, vendor)
        defer cleanupVendor(database, idStr, ownerID.String())

        // Use idStr directly for service calls
        v1, _ := service.GetVendorByID(ctx, idStr)
        baseScore := v1.PVSScore

        // For repository calls, convert to UUID
        vendorID := uuid.MustParse(idStr)
        repo := service.GetRepo()
        _ = repo.IncrementField(ctx, vendorID, "inquiry_count", 10)
        _ = repo.IncrementField(ctx, vendorID, "responded_count", 10)

        // Service call uses string
        err := service.CalculateAndUpdatePVS(ctx, idStr)
        assert.NoError(t, err)

        // Service call uses string
        v2, _ := service.GetVendorByID(ctx, idStr)
        assert.Greater(t, v2.PVSScore, baseScore, "Score should increase with high response rate")
    })
}