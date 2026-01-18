package vendor_test

import (
	"context"
	"testing"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	//"github.com/eventify/backend/pkg/models"
)

func TestUpdateVendor(t *testing.T) {
	service, database := setupTestService()
	ctx := context.Background()

	t.Run("Unauthorized user cannot update vendor", func(t *testing.T) {
		ownerID := uuid.New()
		hackerID := uuid.New()
		// ... Setup vendor for ownerID ...

		updates := map[string]interface{}{"name": "Hacked Name"}
		err := service.UpdateVendor(ctx, vendorID, hackerID, updates)
		
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "unauthorized")
	})

	t.Run("CAC verification boosts PVS score", func(t *testing.T) {
		// 1. Create vendor (Score: 30)
		// 2. Update with "is_business_verified": true
		// 3. Verify Score is now 70
	})
}