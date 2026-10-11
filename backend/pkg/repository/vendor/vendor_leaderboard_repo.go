// backend/pkg/repository/vendor/vendor_leaderboard_repo.go
package vendor

import (
	"context"
	"fmt"

	"github.com/eventify/backend/pkg/models"
	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
)

type VendorLeaderboardRepo struct {
	db *sqlx.DB
}

func NewVendorLeaderboardRepo(db *sqlx.DB) *VendorLeaderboardRepo {
	return &VendorLeaderboardRepo{db: db}
}

// Base query joining the ranking view with the vendors table
const rankingBaseQuery = `
    SELECT 
        -- From materialized view
        v_rank.vendor_id, 
        v_rank.name, 
        v_rank.category, 
        v_rank.state, 
        v_rank.city,
        v_rank.subscription_tier,
        v_rank.monthly_views, 
        v_rank.pvs_score, 
        v_rank.review_count,
        v_rank.overall_rank,
        v_rank.category_rank,
        v_rank.location_rank,
        v_rank.last_updated,
        -- From vendors table JOIN
        COALESCE(v_main.image_url, '') as image_url,
        COALESCE(v_main.is_identity_verified, false) as is_identity_verified,
        v_main.is_business_verified,
        COALESCE(v_main.is_business_registered, false) as is_business_registered
    FROM vendor_of_the_month v_rank
    LEFT JOIN vendors v_main ON v_rank.vendor_id = v_main.id
`

func (r *VendorLeaderboardRepo) GetTopVendorsByCategory(ctx context.Context, category string, limit int) ([]models.VendorRanking, error) {
	query := rankingBaseQuery + `
		WHERE v_rank.category = $1
		ORDER BY v_rank.category_rank
		LIMIT $2
	`
	
	var rankings []models.VendorRanking
	err := r.db.SelectContext(ctx, &rankings, query, category, limit)
	
	// 🆕 DEBUG LOGGING
	if err == nil && len(rankings) > 0 {
		log.Debug().
			Str("category", category).
			Int("count", len(rankings)).
			Str("first_vendor", rankings[0].Name).
			Str("first_image", rankings[0].ImageURL).
			Bool("has_image", rankings[0].ImageURL != "").
			Msg("🔍 DEBUG: Category Query Results")
	}
	
	return rankings, err
}

func (r *VendorLeaderboardRepo) GetTopVendorsByLocation(ctx context.Context, state, city string, limit int) ([]models.VendorRanking, error) {
	query := rankingBaseQuery + `
		WHERE v_rank.state = $1 
		  AND (v_rank.city = $2 OR $2 = '' OR $2 IS NULL)
		ORDER BY v_rank.location_rank
		LIMIT $3
	`
	
	var rankings []models.VendorRanking
	err := r.db.SelectContext(ctx, &rankings, query, state, city, limit)
	
	// 🆕 DEBUG LOGGING
	if err == nil && len(rankings) > 0 {
		log.Debug().
			Str("state", state).
			Str("city", city).
			Int("count", len(rankings)).
			Msg("🔍 DEBUG: Location Query Results")
	}
	
	return rankings, err
}

func (r *VendorLeaderboardRepo) GetVendorOfTheMonth(ctx context.Context) (*models.VendorRanking, error) {
	query := rankingBaseQuery + `
		WHERE v_rank.overall_rank = 1
		LIMIT 1
	`
	
	var ranking models.VendorRanking
	err := r.db.GetContext(ctx, &ranking, query)
	if err != nil {
		return nil, fmt.Errorf("vendor of the month not found: %w", err)
	}
	
	// 🆕 DEBUG LOGGING
	log.Debug().
		Str("vendor_id", ranking.VendorID.String()).
		Str("name", ranking.Name).
		Str("image_url", ranking.ImageURL).
		Str("subscription_tier", ranking.SubscriptionTier).
		Int("pvs_score", ranking.PVSScore).
		Int("monthly_views", ranking.MonthlyViews).
		Bool("has_image", ranking.ImageURL != "").
		Bool("is_verified", ranking.IsIdentityVerified).
		Msg("🔍 DEBUG: Vendor of Month Data")
	
	return &ranking, nil
}

// GetTopByAllCategories retrieves the top N vendors for every category
func (r *VendorLeaderboardRepo) GetTopByAllCategories(ctx context.Context, limitPerCategory int) ([]models.VendorRanking, error) {
	query := `
		WITH RankedVendors AS (
			SELECT 
				vendor_id, name, category, state, city,
				subscription_tier, monthly_views, pvs_score, review_count,
				category_rank, last_updated,
				ROW_NUMBER() OVER(PARTITION BY category ORDER BY category_rank ASC) as rank_in_cat
			FROM vendor_of_the_month
		)
		SELECT 
			rv.vendor_id, rv.name, rv.category, rv.state, rv.city,
			rv.subscription_tier, rv.monthly_views, rv.pvs_score, rv.review_count,
			rv.category_rank, rv.last_updated,
			COALESCE(v.image_url, '') as image_url,
			COALESCE(v.is_identity_verified, false) as is_identity_verified,
			v.is_business_verified,
			COALESCE(v.is_business_registered, false) as is_business_registered
		FROM RankedVendors rv
		LEFT JOIN vendors v ON rv.vendor_id = v.id
		WHERE rv.rank_in_cat <= $1
		ORDER BY rv.category, rv.category_rank
	`
	
	var rankings []models.VendorRanking
	err := r.db.SelectContext(ctx, &rankings, query, limitPerCategory)
	
	// 🆕 DEBUG LOGGING
	if err == nil {
		imageCount := 0
		for _, r := range rankings {
			if r.ImageURL != "" {
				imageCount++
			}
		}
		log.Debug().
			Int("total_vendors", len(rankings)).
			Int("with_images", imageCount).
			Msg("🔍 DEBUG: All Categories Query Results")
	}
	
	return rankings, err
}

func (r *VendorLeaderboardRepo) GetLeaderboardCount(ctx context.Context) (int, error) {
	query := `SELECT COUNT(*) FROM vendor_of_the_month`
	var count int
	err := r.db.GetContext(ctx, &count, query)
	return count, err
}