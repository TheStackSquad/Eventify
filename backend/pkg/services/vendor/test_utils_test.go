package vendor_test

import (
//	"context"
//	"log"
	"github.com/eventify/backend/pkg/db"
	"github.com/eventify/backend/pkg/repository/vendor"
	vendorService "github.com/eventify/backend/pkg/services/vendor"
	"github.com/jmoiron/sqlx"
)

// setupTestService initializes the real service with a real DB connection
func setupTestService() (*vendorService.VendorServiceImpl, *sqlx.DB) {
	db.ConnectDB() // Uses your existing logic from db.go
	database := db.GetDB()

	repo := vendor.NewPostgresVendorRepository(database)
	// Passing repo to the service implementation
	service := vendorService.NewVendorService(repo)

return service, database
}

// cleanupVendor removes a specific vendor and their owner to keep DB clean
func cleanupVendor(database *sqlx.DB, vendorID string, ownerID string) {
	_, _ = database.Exec("DELETE FROM vendors WHERE id = $1", vendorID)
	_, _ = database.Exec("DELETE FROM users WHERE id = $1", ownerID)
}