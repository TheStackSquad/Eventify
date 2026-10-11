// backend/pkg/repository/vendor/postgres_vendor_stats_repo.go
package vendor

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// PostgresVendorStatsRepo implements VendorPublicStatsRepository
type PostgresVendorStatsRepo struct {
	db *sqlx.DB
}

// NewPostgresVendorStatsRepo creates a new stats repository
func NewPostgresVendorStatsRepo(db *sqlx.DB) VendorPublicStatsRepository {
	return &PostgresVendorStatsRepo{db: db}
}

// RecordProfileView tracks a vendor profile view with anti-gaming
func (r *PostgresVendorStatsRepo) RecordProfileView(
	ctx context.Context,
	vendorID uuid.UUID,
	viewerID *uuid.UUID,
	viewerIP string,
	sessionID string,
	userAgent string,
) (bool, error) {
	if sessionID == "" {
		return false, errors.New("session_id is required")
	}
	if viewerIP == "" {
		return false, errors.New("viewer_ip is required")
	}

	var recorded bool
	query := `SELECT record_profile_view($1, $2, $3, $4, $5)`

	err := r.db.QueryRowContext(
		ctx,
		query,
		vendorID,
		viewerID,
		viewerIP,
		sessionID,
		userAgent,
	).Scan(&recorded)

	if err != nil {
		return false, fmt.Errorf("failed to record profile view: %w", err)
	}

	return recorded, nil
}

// GetProfileViewCount30d returns view count for last 30 days
func (r *PostgresVendorStatsRepo) GetProfileViewCount30d(
	ctx context.Context,
	vendorID uuid.UUID,
) (int, error) {
	var count int
	query := `SELECT get_profile_view_count_30d($1)`

	err := r.db.QueryRowContext(ctx, query, vendorID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to get profile view count: %w", err)
	}

	return count, nil
}

// GetCategoryRank returns vendor's ranking within their category
func (r *PostgresVendorStatsRepo) GetCategoryRank(
	ctx context.Context,
	vendorID uuid.UUID,
) (rank int, totalInCategory int, categoryName string, err error) {
	query := `
	WITH max_views AS (
		SELECT 
			v.category,
			MAX(COALESCE(view_counts.view_count, 0)) as max_count
		FROM vendors v
		LEFT JOIN (
			SELECT 
				vendor_id,
				COUNT(*) as view_count
			FROM profile_views
			WHERE viewed_at > NOW() - INTERVAL '30 days'
			GROUP BY vendor_id
		) view_counts ON v.id = view_counts.vendor_id
		GROUP BY v.category
	),
	scored_vendors AS (
		SELECT 
			v.id,
			v.category,
			COALESCE(view_counts.view_count, 0) as views_30d,
			v.pvs_score,
			CASE 
				WHEN mv.max_count > 0 THEN 
					(COALESCE(view_counts.view_count, 0)::float / mv.max_count) * 100
				ELSE 0
			END as normalized_views,
			(
				CASE 
					WHEN mv.max_count > 0 THEN 
						(COALESCE(view_counts.view_count, 0)::float / mv.max_count) * 100 * 0.4
					ELSE 0
				END + (v.pvs_score * 0.6)
			) as composite_score
		FROM vendors v
		LEFT JOIN (
			SELECT 
				vendor_id,
				COUNT(*) as view_count
			FROM profile_views
			WHERE viewed_at > NOW() - INTERVAL '30 days'
			GROUP BY vendor_id
		) view_counts ON v.id = view_counts.vendor_id
		INNER JOIN max_views mv ON mv.category = v.category
		WHERE v.category = (SELECT category FROM vendors WHERE id = $1)
	),
	ranked AS (
		SELECT 
			id,
			category,
			ROW_NUMBER() OVER (
				ORDER BY composite_score DESC, id ASC
			) as rank,
			COUNT(*) OVER () as total
		FROM scored_vendors
	)
	SELECT rank, total, category
	FROM ranked
	WHERE id = $1
	`

	err = r.db.QueryRowContext(ctx, query, vendorID).Scan(&rank, &totalInCategory, &categoryName)
	if err == sql.ErrNoRows {
		return 0, 0, "", fmt.Errorf("vendor not found or has no category")
	}
	if err != nil {
		return 0, 0, "", fmt.Errorf("failed to get category rank: %w", err)
	}

	return rank, totalInCategory, categoryName, nil
}

// GetLocationRank returns vendor's ranking within their location
func (r *PostgresVendorStatsRepo) GetLocationRank(
	ctx context.Context,
	vendorID uuid.UUID,
) (rank int, totalInLocation int, locationName string, err error) {
	query := `
	WITH vendor_location AS (
		SELECT state, city
		FROM vendors
		WHERE id = $1
	),
	max_views AS (
		SELECT 
			v.state,
			v.city,
			MAX(COALESCE(view_counts.view_count, 0)) as max_count
		FROM vendors v
		LEFT JOIN (
			SELECT 
				vendor_id,
				COUNT(*) as view_count
			FROM profile_views
			WHERE viewed_at > NOW() - INTERVAL '30 days'
			GROUP BY vendor_id
		) view_counts ON v.id = view_counts.vendor_id
		CROSS JOIN vendor_location vl
		WHERE v.state = vl.state
		  AND (v.city = vl.city OR (v.city IS NULL AND vl.city IS NULL))
		GROUP BY v.state, v.city
	),
	scored_vendors AS (
		SELECT 
			v.id,
			v.state,
			v.city,
			COALESCE(view_counts.view_count, 0) as views_30d,
			v.pvs_score,
			CASE 
				WHEN mv.max_count > 0 THEN 
					(COALESCE(view_counts.view_count, 0)::float / mv.max_count) * 100
				ELSE 0
			END as normalized_views,
			(
				CASE 
					WHEN mv.max_count > 0 THEN 
						(COALESCE(view_counts.view_count, 0)::float / mv.max_count) * 100 * 0.4
					ELSE 0
				END + (v.pvs_score * 0.6)
			) as composite_score
		FROM vendors v
		LEFT JOIN (
			SELECT 
				vendor_id,
				COUNT(*) as view_count
			FROM profile_views
			WHERE viewed_at > NOW() - INTERVAL '30 days'
			GROUP BY vendor_id
		) view_counts ON v.id = view_counts.vendor_id
		INNER JOIN max_views mv ON v.state = mv.state 
			AND (v.city = mv.city OR (v.city IS NULL AND mv.city IS NULL))
		CROSS JOIN vendor_location vl
		WHERE v.state = vl.state
		  AND (v.city = vl.city OR (v.city IS NULL AND vl.city IS NULL))
	),
	ranked AS (
		SELECT 
			id,
			state,
			city,
			ROW_NUMBER() OVER (
				ORDER BY composite_score DESC, id ASC
			) as rank,
			COUNT(*) OVER () as total,
			CASE 
				WHEN city IS NOT NULL AND city != '' THEN city || ', ' || state
				ELSE state
			END as location_name
		FROM scored_vendors
	)
	SELECT rank, total, location_name
	FROM ranked
	WHERE id = $1
	`

	err = r.db.QueryRowContext(ctx, query, vendorID).Scan(&rank, &totalInLocation, &locationName)
	if err == sql.ErrNoRows {
		return 0, 0, "", fmt.Errorf("vendor not found or has no location")
	}
	if err != nil {
		return 0, 0, "", fmt.Errorf("failed to get location rank: %w", err)
	}

	return rank, totalInLocation, locationName, nil
}

// GetVendorTier returns active subscription tier for a vendor
func (r *PostgresVendorStatsRepo) GetVendorTier(
	ctx context.Context,
	vendorID uuid.UUID,
) (models.SubscriptionTier, error) {
	query := `
	SELECT tier 
	FROM subscriptions
	WHERE vendor_id = $1
	  AND status = 'active'
	  AND (expires_at IS NULL OR expires_at > NOW())
	ORDER BY starts_at DESC
	LIMIT 1
	`

	var tier string
	err := r.db.QueryRowContext(ctx, query, vendorID).Scan(&tier)

	if err == sql.ErrNoRows {
		return models.TierFree, nil
	}
	if err != nil {
		return models.TierFree, fmt.Errorf("failed to get vendor tier: %w", err)
	}

	return models.SubscriptionTier(tier), nil
}

// GetVendorSubscription returns full active subscription for a vendor
func (r *PostgresVendorStatsRepo) GetVendorSubscription(
	ctx context.Context,
	vendorID uuid.UUID,
) (*models.VendorWithSubscription, error) {
	query := `
	SELECT 
		id,
		vendor_id,
		tier,
		status,
		price,
		currency,
		payment_method,
		payment_reference,
		starts_at,
		expires_at,
		last_payment_date,
		next_payment_date,
		auto_renew,
		created_at,
		updated_at
	FROM subscriptions
	WHERE vendor_id = $1
	  AND status = 'active'
	  AND (expires_at IS NULL OR expires_at > NOW())
	ORDER BY starts_at DESC
	LIMIT 1
	`

	var sub models.Subscription
	err := r.db.QueryRowContext(ctx, query, vendorID).Scan(
		&sub.ID,
		&sub.VendorID,
		&sub.Tier,
		&sub.Status,
		&sub.Price,
		&sub.Currency,
		&sub.PaymentMethod,
		&sub.PaymentReference,
		&sub.StartsAt,
		&sub.ExpiresAt,
		&sub.LastPaymentDate,
		&sub.NextPaymentDate,
		&sub.AutoRenew,
		&sub.CreatedAt,
		&sub.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get vendor subscription: %w", err)
	}

	result := &models.VendorWithSubscription{
		Subscription: &sub,
		Features:     models.GetFeatures(sub.Tier),
		IsFeatured:   sub.Tier == models.TierFeatured && sub.Status == models.SubStatusActive,
	}

	return result, nil
}

// GetBatchProfileViewCounts returns view counts for multiple vendors
func (r *PostgresVendorStatsRepo) GetBatchProfileViewCounts(
	ctx context.Context,
	vendorIDs []uuid.UUID,
) (map[uuid.UUID]int, error) {
	if len(vendorIDs) == 0 {
		return make(map[uuid.UUID]int), nil
	}

	query := `
	SELECT 
		vendor_id,
		COUNT(*) as view_count
	FROM profile_views
	WHERE vendor_id = ANY($1)
	  AND viewed_at > NOW() - INTERVAL '30 days'
	GROUP BY vendor_id
	`

	rows, err := r.db.QueryContext(ctx, query, vendorIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to get batch view counts: %w", err)
	}
	defer rows.Close()

	results := make(map[uuid.UUID]int)
	for rows.Next() {
		var vendorID uuid.UUID
		var count int
		if err := rows.Scan(&vendorID, &count); err != nil {
			return nil, fmt.Errorf("failed to scan view count: %w", err)
		}
		results[vendorID] = count
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating view counts: %w", err)
	}

	for _, vid := range vendorIDs {
		if _, exists := results[vid]; !exists {
			results[vid] = 0
		}
	}

	return results, nil
}

// GetBatchVendorTiers returns tiers for multiple vendors
func (r *PostgresVendorStatsRepo) GetBatchVendorTiers(
	ctx context.Context,
	vendorIDs []uuid.UUID,
) (map[uuid.UUID]models.SubscriptionTier, error) {
	if len(vendorIDs) == 0 {
		return make(map[uuid.UUID]models.SubscriptionTier), nil
	}

	query := `
	SELECT 
		vendor_id,
		tier
	FROM subscriptions
	WHERE vendor_id = ANY($1)
	  AND status = 'active'
	  AND (expires_at IS NULL OR expires_at > NOW())
	`

	rows, err := r.db.QueryContext(ctx, query, vendorIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to get batch tiers: %w", err)
	}
	defer rows.Close()

	results := make(map[uuid.UUID]models.SubscriptionTier)
	for rows.Next() {
		var vendorID uuid.UUID
		var tier string
		if err := rows.Scan(&vendorID, &tier); err != nil {
			return nil, fmt.Errorf("failed to scan tier: %w", err)
		}
		results[vendorID] = models.SubscriptionTier(tier)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating tiers: %w", err)
	}

	for _, vid := range vendorIDs {
		if _, exists := results[vid]; !exists {
			results[vid] = models.TierFree
		}
	}

	return results, nil
}