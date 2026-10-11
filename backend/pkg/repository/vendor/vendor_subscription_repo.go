// backend/pkg/repository/vendor/vendor_subscription_repo.go
package vendor

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
)

const getVendorWithSubscriptionQuery = `
SELECT
    v.id, v.owner_id, v.name, v.category, v.image_url, v.status,
    v.is_identity_verified, v.is_business_registered, v.state,
    v.city, v.phone_number, v.min_price, v.pvs_score,
    v.review_count, v.profile_completion, v.inquiry_count,
    v.responded_count, v.created_at, v.updated_at, v.vnin,
    v.first_name, v.middle_name, v.last_name,
    v.description, v.email, v.cac_number,
    v.is_business_verified, v.subscription_tier, v.deleted_at,

	s.id                AS sub_id,
	s.vendor_id         AS sub_vendor_id,
	s.tier              AS sub_tier,
	s.status            AS sub_status,
	s.starts_at         AS sub_starts_at,
	s.expires_at        AS sub_expires_at,
	s.auto_renew        AS sub_auto_renew,
	s.price             AS sub_price,
	s.currency          AS sub_currency,
	s.payment_reference AS sub_payment_reference,
	s.payment_method    AS sub_payment_method,
	s.last_payment_date AS sub_last_payment_date,
	s.next_payment_date AS sub_next_payment_date,
	s.created_at        AS sub_created_at,
	s.updated_at        AS sub_updated_at
FROM vendors v
LEFT JOIN subscriptions s ON s.vendor_id = v.id
WHERE v.id = $1
ORDER BY 
	CASE WHEN s.status = 'active' THEN 1 ELSE 2 END ASC, 
	s.created_at DESC 
NULLS LAST
LIMIT 1
`

type vendorWithSubscriptionRow struct {
	models.Vendor
	SubID              *uuid.UUID     `db:"sub_id"`
	SubVendorID        *uuid.UUID     `db:"sub_vendor_id"`
	SubTier            *string        `db:"sub_tier"`
	SubStatus          *string        `db:"sub_status"`
	SubStartsAt        *time.Time     `db:"sub_starts_at"`
	SubExpiresAt       sql.NullTime   `db:"sub_expires_at"`
	SubAutoRenew       *bool          `db:"sub_auto_renew"`
	SubPrice           *int64         `db:"sub_price"`
	SubCurrency        *string        `db:"sub_currency"`
	SubPaymentRef      sql.NullString `db:"sub_payment_reference"`
	SubPaymentMethod   sql.NullString `db:"sub_payment_method"`
	SubLastPaymentDate sql.NullTime   `db:"sub_last_payment_date"`
	SubNextPaymentDate sql.NullTime   `db:"sub_next_payment_date"`
	SubCreatedAt       *time.Time     `db:"sub_created_at"`
	SubUpdatedAt       *time.Time     `db:"sub_updated_at"`
}

// GetVendorSubscription fetches vendor with subscription data
func (r *PostgresVendorRepository) GetVendorSubscription(ctx context.Context, vendorID uuid.UUID) (*models.VendorWithSubscription, error) {
	var row vendorWithSubscriptionRow
	err := r.DB.GetContext(ctx, &row, getVendorWithSubscriptionQuery, vendorID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("vendor not found")
		}
		return nil, fmt.Errorf("failed to get vendor with subscription: %w", err)
	}

	return assembleVendorWithSubscription(&row), nil
}

// assembleVendorWithSubscription converts flat row to nested structure
func assembleVendorWithSubscription(row *vendorWithSubscriptionRow) *models.VendorWithSubscription {
	result := &models.VendorWithSubscription{
		Vendor: row.Vendor,
	}

	// No subscription found
	if row.SubID == nil {
		result.Features = models.GetFeatures(models.TierFree)
		return result
	}

	// Extract tier and status with nil safety
	tier := models.TierFree
	if row.SubTier != nil {
		tier = models.SubscriptionTier(*row.SubTier)
	}

	status := models.SubStatusPending
	if row.SubStatus != nil {
		status = models.SubscriptionStatus(*row.SubStatus)
	}

	// Build subscription object
	result.Subscription = &models.Subscription{
		ID:               *row.SubID,
		VendorID:         *row.SubVendorID,
		Tier:             tier,
		Status:           status,
		StartsAt:         *row.SubStartsAt,
		ExpiresAt:        row.SubExpiresAt,
		AutoRenew:        *row.SubAutoRenew,
		Price:            *row.SubPrice,
		Currency:         *row.SubCurrency,
		PaymentReference: row.SubPaymentRef,
		PaymentMethod:    row.SubPaymentMethod,
		LastPaymentDate:  row.SubLastPaymentDate,
		NextPaymentDate:  row.SubNextPaymentDate,
		CreatedAt:        *row.SubCreatedAt,
		UpdatedAt:        *row.SubUpdatedAt,
	}

	// Set derived fields
	result.Features = models.GetFeatures(tier)
	result.IsFeatured = tier == models.TierFeatured && status == models.SubStatusActive
	result.BadgeColor = result.ResolveBadgeColor()

	return result
}