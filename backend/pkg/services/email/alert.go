// backend/pkg/services/email/alert.go

package email

import (
	"context"
	"os"

	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
)

// QueueAdminAlert tells a human that money needs attention: a payment held for review, an orphan, a poisoned webhook.
//
// exec is the caller's transaction or database, so the alert can be written in the same transaction as the state change.
// This version only logs, at CRITICAL level, and never returns an error, so an alert can never fail the caller's work.
// A later version queues an ADMIN_ALERT email with dedupe key "alert:<kind>:<reference>" to ADMIN_ALERT_EMAIL.
func QueueAdminAlert(ctx context.Context, exec sqlx.ExtContext, kind, reference, detail string) error {
	log.Error().
		Str("alert_kind", kind).
		Str("reference", reference).
		Str("detail", detail).
		Bool("email_configured", os.Getenv("ADMIN_ALERT_EMAIL") != "").
		Msg("CRITICAL: money needs attention")
	return nil
}