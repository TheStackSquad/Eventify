//backend/pkg/testhelper/seed.go
package testhelper

import (
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/require"
)

func CreateTestUser(t *testing.T, db *sqlx.DB) uuid.UUID {
	t.Helper()
	id := uuid.New()
	shortID := id.String()[:8]
	_, err := db.Exec(`
		INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'customer', NOW(), NOW())`,
		id,
		fmt.Sprintf("Test User %s", shortID),
		fmt.Sprintf("testuser-%s@eventify-test.com", shortID),
		"$2a$10$test_hash_not_real",
	)
	require.NoError(t, err, "seed: CreateTestUser failed")
	return id
}

type VendorSeedOpts struct {
	OwnerID            uuid.UUID
	Name               string
	Category           string
	State              string
	City               string
	Status             string
	ImageURL           string
	PhoneNumber        string
	FirstName          string
	LastName           string
	Description        string
	Email              string
	VNIN               string
	SubscriptionTier   string
	MiddleName         *string
	CACNumber          *string
	IsBusinessVerified *bool
	IsIdentityVerified   bool
	IsBusinessRegistered bool
	PVSScore          int
	ReviewCount       int
	InquiryCount      int
	RespondedCount    int
	ProfileCompletion float32
	DeletedAt *time.Time
}

func CreateTestVendor(t *testing.T, db *sqlx.DB, opts VendorSeedOpts) uuid.UUID {
	t.Helper()

	if opts.OwnerID == uuid.Nil {
		opts.OwnerID = CreateTestUser(t, db)
	}
	if opts.Name == "" {
		opts.Name = fmt.Sprintf("Test Vendor %s", uuid.New().String()[:8])
	}
	if opts.Category == "" {
		opts.Category = "Catering"
	}
	if opts.State == "" {
		opts.State = "Lagos"
	}
	if opts.City == "" {
		opts.City = "Ikeja"
	}
	if opts.Status == "" {
		opts.Status = "active"
	}
	if opts.ImageURL == "" {
		opts.ImageURL = "https://example.com/default.jpg"
	}
	if opts.PhoneNumber == "" {
		opts.PhoneNumber = fmt.Sprintf("0801%s", uuid.New().String()[:7])
	}
	if opts.FirstName == "" {
		opts.FirstName = "Test"
	}
	if opts.LastName == "" {
		opts.LastName = "Vendor"
	}
	if opts.Description == "" {
		opts.Description = "A test vendor for automated tests."
	}
	if opts.Email == "" {
		opts.Email = fmt.Sprintf("vendor-%s@eventify-test.com", uuid.New().String()[:8])
	}
	if opts.VNIN == "" {
		opts.VNIN = fmt.Sprintf("NIN%s", uuid.New().String()[:10])
	}
	if opts.SubscriptionTier == "" {
		opts.SubscriptionTier = "free"
	}

	var middleName sql.NullString
	if opts.MiddleName != nil {
		middleName = sql.NullString{String: *opts.MiddleName, Valid: true}
	}

	var cacNumber sql.NullString
	if opts.CACNumber != nil {
		cacNumber = sql.NullString{String: *opts.CACNumber, Valid: true}
	}

	var isBusinessVerified sql.NullBool
	if opts.IsBusinessVerified != nil {
		isBusinessVerified = sql.NullBool{Bool: *opts.IsBusinessVerified, Valid: true}
	}

	id := uuid.New()
	_, err := db.Exec(`
		INSERT INTO vendors (
			id, owner_id, name, category,
			state, city, status,
			image_url, phone_number,
			first_name, middle_name, last_name,
			description, email,
			vnin, cac_number,
			subscription_tier,
			is_identity_verified, is_business_registered,
			is_business_verified,
			pvs_score, review_count, inquiry_count, responded_count,
			profile_completion, deleted_at,
			created_at, updated_at
		) VALUES (
			$1,  $2,  $3,  $4,
			$5,  $6,  $7,
			$8,  $9,
			$10, $11, $12,
			$13, $14,
			$15, $16,
			$17,
			$18, $19,
			$20,
			$21, $22, $23, $24,
			$25, $26,
			NOW(), NOW()
		)`,
		id, opts.OwnerID, opts.Name, opts.Category,
		opts.State, opts.City, opts.Status,
		opts.ImageURL, opts.PhoneNumber,
		opts.FirstName, middleName, opts.LastName,
		opts.Description, opts.Email,
		opts.VNIN, cacNumber,
		opts.SubscriptionTier,
		opts.IsIdentityVerified, opts.IsBusinessRegistered,
		isBusinessVerified,
		opts.PVSScore, opts.ReviewCount, opts.InquiryCount, opts.RespondedCount,
		opts.ProfileCompletion, opts.DeletedAt,
	)
	require.NoError(t, err, "seed: CreateTestVendor failed for %q", opts.Name)
	return id
}

func SoftDeleteVendor(t *testing.T, db *sqlx.DB, vendorID uuid.UUID) {
	t.Helper()
	_, err := db.Exec(`
		UPDATE vendors SET deleted_at = NOW(), status = 'deleted', updated_at = NOW()
		WHERE id = $1`, vendorID)
	require.NoError(t, err, "seed: SoftDeleteVendor failed")
}

type ReviewSeedOpts struct {
	VendorID   uuid.UUID
	Rating     int
	Comment    string
	UserName   string
	CreatedAt  *time.Time
	IsVerified bool
}

func CreateTestReview(t *testing.T, db *sqlx.DB, opts ReviewSeedOpts) uuid.UUID {
	t.Helper()
	if opts.Rating == 0 {
		opts.Rating = 5
	}
	if opts.Comment == "" {
		opts.Comment = "Great vendor!"
	}
	if opts.UserName == "" {
		opts.UserName = "Test User"
	}

	createdAt := time.Now()
	if opts.CreatedAt != nil {
		createdAt = *opts.CreatedAt
	}

	id := uuid.New()
	_, err := db.Exec(`
		INSERT INTO reviews (id, vendor_id, rating, comment, user_name, email, created_at, updated_at, is_verified)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8)`,
		id, opts.VendorID, opts.Rating, opts.Comment, opts.UserName,
		"reviewer@test.com", createdAt, opts.IsVerified,
	)
	require.NoError(t, err, "seed: CreateTestReview failed")
	return id
}

type InquirySeedOpts struct {
	VendorID  uuid.UUID
	Name      string
	Email     string
	Message   string
	CreatedAt *time.Time
}

func CreateTestInquiry(t *testing.T, db *sqlx.DB, opts InquirySeedOpts) uuid.UUID {
	t.Helper()
	if opts.Name == "" {
		opts.Name = "Test Inquirer"
	}
	if opts.Email == "" {
		opts.Email = "inquirer@test.com"
	}
	if opts.Message == "" {
		opts.Message = "I would like to book your services."
	}

	createdAt := time.Now()
	if opts.CreatedAt != nil {
		createdAt = *opts.CreatedAt
	}

	id := uuid.New()
	_, err := db.Exec(`
		INSERT INTO inquiries (id, vendor_id, name, email, message, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $6)`,
		id, opts.VendorID, opts.Name, opts.Email, opts.Message, createdAt,
	)
	require.NoError(t, err, "seed: CreateTestInquiry failed")
	return id
}

type SubscriptionSeedOpts struct {
	VendorID         uuid.UUID
	Tier             string
	Status           string
	ExpiresAt        *time.Time
	PaymentReference *string
}

func CreateTestSubscription(t *testing.T, db *sqlx.DB, opts SubscriptionSeedOpts) uuid.UUID {
	t.Helper()
	if opts.Tier == "" {
		opts.Tier = "premium"
	}
	if opts.Status == "" {
		opts.Status = "pending"
	}

	id := uuid.New()

	var paymentRef sql.NullString
	var expiresAt sql.NullTime

	if opts.Status == "active" {
		ref := fmt.Sprintf("TEST-REF-%s", id.String())
		if opts.PaymentReference != nil {
			ref = *opts.PaymentReference
		}
		paymentRef = sql.NullString{String: ref, Valid: true}

		expiry := time.Now().AddDate(0, 1, 0)
		if opts.ExpiresAt != nil {
			expiry = *opts.ExpiresAt
		}
		expiresAt = sql.NullTime{Time: expiry, Valid: true}
	} else {
		if opts.ExpiresAt != nil {
			expiresAt = sql.NullTime{Time: *opts.ExpiresAt, Valid: true}
		}
		if opts.PaymentReference != nil {
			paymentRef = sql.NullString{String: *opts.PaymentReference, Valid: true}
		}
	}

	_, err := db.Exec(`
		INSERT INTO subscriptions (
			id, vendor_id, tier, status,
			price, currency,
			payment_reference,
			starts_at, expires_at,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4,
			$5, 'NGN',
			$6,
			NOW(), $7,
			NOW(), NOW()
		)`,
		id, opts.VendorID, opts.Tier, opts.Status,
		int64(700_000),
		paymentRef,
		expiresAt,
	)
	require.NoError(t, err, "seed: CreateTestSubscription failed (tier=%s status=%s)", opts.Tier, opts.Status)
	return id
}

func CreateTestProfileView(t *testing.T, db *sqlx.DB, vendorID uuid.UUID, viewedAt time.Time) {
	t.Helper()
	_, err := db.Exec(`
		INSERT INTO profile_views (vendor_id, viewer_ip, session_id, viewed_at)
		VALUES ($1, '127.0.0.1', $2, $3)`,
		vendorID, uuid.New().String(), viewedAt,
	)
	require.NoError(t, err, "seed: CreateTestProfileView failed")
}