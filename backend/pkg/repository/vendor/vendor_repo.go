// backend/pkg/repository/vendor/vendor_repo.go

package vendor

import (
	"context"
	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type VendorRepository interface {
	// Write Operations
	Create(ctx context.Context, vendor *models.Vendor) (uuid.UUID, error)
	Update(ctx context.Context, vendor *models.Vendor) error
	UpdateFields(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error
	UpdateVerificationFlag(ctx context.Context, id uuid.UUID, field string, isVerified bool, reason string) error
	UpdatePVSScore(ctx context.Context, id uuid.UUID, score int) error
	IncrementField(ctx context.Context, id uuid.UUID, field string, delta int) error
	Delete(ctx context.Context, id uuid.UUID) (int64, error)

	// Read Operations
	GetByOwnerID(ctx context.Context, ownerID uuid.UUID) (*models.Vendor, error)
	GetByID(ctx context.Context, id uuid.UUID) (models.Vendor, error)
	FindPublicVendors(ctx context.Context, filters map[string]string) ([]models.Vendor, error)
	GetVendorSubscription(ctx context.Context, id uuid.UUID) (*models.VendorWithSubscription, error)
	IsRegisteredVendor(ctx context.Context, ownerID uuid.UUID) (bool, error)
}

type PostgresVendorRepository struct {
	DB *sqlx.DB
}

func NewPostgresVendorRepository(db *sqlx.DB) VendorRepository {
	return &PostgresVendorRepository{DB: db}
}