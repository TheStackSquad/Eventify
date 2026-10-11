//backend/pkg/services/vendor/analytics_scheduler.go

package vendor

import (
	"context"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
)

// ============================================================================
// ANALYTICS MATERIALIZED VIEW REFRESH WORKER
// Refreshes vendor_daily_metrics materialized view periodically
// ============================================================================

// StartAnalyticsRefreshWorker runs a background job to refresh analytics
// materialized views at the specified interval
func StartAnalyticsRefreshWorker(ctx context.Context, db *sqlx.DB, refreshInterval time.Duration) {
	log.Info().
		Dur("interval", refreshInterval).
		Msg("Starting vendor analytics refresh worker")

	// Initial refresh on startup
	if err := refreshVendorAnalyticsMaterializedView(ctx, db); err != nil {
		log.Error().
			Err(err).
			Msg("Failed initial analytics refresh on startup")
	} else {
		log.Info().Msg("Initial analytics refresh completed successfully")
	}

	// Start periodic refresh
	ticker := time.NewTicker(refreshInterval)
	defer ticker.Stop()

	go func() {
		for {
			select {
			case <-ticker.C:
				// Execute refresh
				if err := refreshVendorAnalyticsMaterializedView(ctx, db); err != nil {
					log.Error().
						Err(err).
						Msg("Scheduled analytics refresh failed")
				} else {
					log.Info().
						Dur("interval", refreshInterval).
						Msg("Scheduled analytics refresh completed successfully")
				}

			case <-ctx.Done():
				// Graceful shutdown
				log.Info().Msg("Analytics refresh worker shutting down gracefully")
				return
			}
		}
	}()

	log.Info().Msg("Vendor analytics refresh worker started successfully")
}

// refreshVendorAnalyticsMaterializedView executes the refresh function
func refreshVendorAnalyticsMaterializedView(ctx context.Context, db *sqlx.DB) error {
	startTime := time.Now()

	log.Debug().Msg("Starting vendor analytics materialized view refresh")

	// Execute the PostgreSQL function that refreshes the materialized view
	_, err := db.ExecContext(ctx, "SELECT refresh_vendor_analytics()")
	if err != nil {
		return err
	}

	duration := time.Since(startTime)

	log.Info().
		Dur("duration_ms", duration).
		Msg("Vendor analytics materialized view refreshed")

	return nil
}

// ============================================================================
// OPTIONAL: MANUAL REFRESH ENDPOINT (for debugging/admin purposes)
// ============================================================================

// RefreshAnalyticsNow triggers an immediate refresh (can be called from admin API)
func RefreshAnalyticsNow(ctx context.Context, db *sqlx.DB) error {
	log.Info().Msg("Manual analytics refresh triggered")

	err := refreshVendorAnalyticsMaterializedView(ctx, db)
	if err != nil {
		log.Error().
			Err(err).
			Msg("Manual analytics refresh failed")
		return err
	}

	log.Info().Msg("Manual analytics refresh completed successfully")
	return nil
}