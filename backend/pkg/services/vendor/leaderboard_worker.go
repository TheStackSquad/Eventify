//backend/pkg/services/vendor/leaderboard_worker.go

package vendor

import (
	"context"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
)

// StartLeaderboardRefreshWorker refreshes the materialized view hourly
func StartLeaderboardRefreshWorker(ctx context.Context, db *sqlx.DB, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Refresh immediately on start
	refreshLeaderboard(db)

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Leaderboard refresh worker stopped")
			return
		case <-ticker.C:
			refreshLeaderboard(db)
		}
	}
}

func refreshLeaderboard(db *sqlx.DB) {
	start := time.Now()
	_, err := db.Exec("REFRESH MATERIALIZED VIEW CONCURRENTLY vendor_of_the_month")
	if err != nil {
		log.Error().Err(err).Msg("Failed to refresh vendor_of_the_month materialized view")
		return
	}

	log.Info().
		Dur("duration_ms", time.Since(start)).
		Msg("Vendor leaderboard refreshed successfully")
}