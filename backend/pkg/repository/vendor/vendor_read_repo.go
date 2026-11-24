//backend/pkg/repository/vendor/vendor_read_repo.go

package vendor

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
)

// vendorSelect returns every vendor column plus the real average of its review ratings (1-5).
// reviews has an index on (vendor_id, rating), so the aggregate is cheap at this scale.
const vendorSelect = `
SELECT v.*, r.avg_rating
FROM vendors v
LEFT JOIN (
    SELECT vendor_id, ROUND(AVG(rating)::numeric, 2)::float8 AS avg_rating
    FROM reviews
    GROUP BY vendor_id
) r ON r.vendor_id = v.id`

func (r *PostgresVendorRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Vendor, error) {
	var v models.Vendor
	err := r.DB.GetContext(ctx, &v, vendorSelect+` WHERE v.id = $1`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("vendor not found")
		}
		return nil, err
	}
	return &v, nil
}

func (r *PostgresVendorRepository) GetByOwnerID(ctx context.Context, ownerID uuid.UUID) (*models.Vendor, error) {
	var v models.Vendor
	err := r.DB.GetContext(ctx, &v, vendorSelect+` WHERE v.owner_id = $1 AND v.deleted_at IS NULL LIMIT 1`, ownerID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &v, nil
}

func (r *PostgresVendorRepository) IsRegisteredVendor(ctx context.Context, ownerID uuid.UUID) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM vendors WHERE owner_id = $1)`
	err := r.DB.GetContext(ctx, &exists, query, ownerID)
	return exists, err
}

func (r *PostgresVendorRepository) FindPublicVendors(ctx context.Context, filters map[string]string) ([]models.Vendor, error) {
	var vendors []models.Vendor
	where := []string{"status = $1", "deleted_at IS NULL"}
	args := []interface{}{models.VendorStatusActive}
	counter := 2

	for k, v := range filters {
		if v == "" || k == "page" || k == "limit" {
			continue
		}
		switch k {
		case "min_price":
			where = append(where, fmt.Sprintf("min_price >= $%d", counter))
		case "category", "state", "city":
			where = append(where, fmt.Sprintf("%s = $%d", k, counter))
		default:
			continue
		}
		args = append(args, v)
		counter++
	}

	query := vendorSelect + ` WHERE ` + strings.Join(where, " AND ") +
		` ORDER BY is_identity_verified DESC, pvs_score DESC, created_at DESC`

	err := r.DB.SelectContext(ctx, &vendors, query, args...)
	return vendors, err
}