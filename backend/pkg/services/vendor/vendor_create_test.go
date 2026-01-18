package vendor_test

import (
	"context"
	"testing"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/eventify/backend/pkg/models"
)

func TestCreateVendor(t *testing.T) {
	service, database := setupTestService()
	ctx := context.Background()

	t.Run("Create with vNIN sets correct PVS", func(t *testing.T) {
		ownerID := uuid.New()
		// We must create a user in the DB first due to Foreign Key constraint
		_, _ = database.Exec("INSERT INTO users (id, email, password) VALUES ($1, $2, $3)", 
			ownerID, "test@example.com", "hash")

		vendor := &models.Vendor{
			OwnerID:            ownerID,
			Name:               "Test Photography",
			Category:           "Photography",
			VNIN:               "12345678901",
			IsIdentityVerified: true,
			State:              "Lagos",
			PhoneNumber:        "08011112222",
			ProfileCompletion:  100.0,
		}

		id, err := service.CreateVendor(ctx, vendor)
		defer cleanupVendor(database, id, ownerID.String())

		assert.NoError(t, err)
		
		// Fetch from DB to verify PVS logic
		saved, _ := service.GetVendorByID(ctx, uuid.MustParse(id))
		assert.Equal(t, int32(45), saved.PVSScore, "Expected 30 (Identity) + 15 (Completion)")
	})
}