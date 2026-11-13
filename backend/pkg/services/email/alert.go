// backend/pkg/services/email/alert.go

package email

import (
	"context"
	"os"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
)

// QueueAdminAlert tells a human that money needs attention: a payment held for review, an orphan, a poisoned webhook.
//
// exec is the caller's transaction or database, so the alert is written in the same transaction as the state change.
// It always logs at CRITICAL level. If ADMIN_ALERT_EMAIL is set it also queues one ADMIN_ALERT email per kind and
// reference (dedupe key "alert:<kind>:<reference>"). It never returns an error: inside a transaction the insert runs in
// a savepoint, because a failed statement would otherwise abort the caller's whole transaction.
func QueueAdminAlert(ctx context.Context, exec sqlx.ExtContext, kind, reference, detail string) error {
	log.Error().Str("alert_kind", kind).Str("reference", reference).Str("detail", detail).Msg("CRITICAL: money needs attention")

	to := strings.TrimSpace(os.Getenv("ADMIN_ALERT_EMAIL"))
	if to == "" || exec == nil {
		return nil
	}
	subject, payload, key, err := BuildAlertEmail(kind, reference, detail)
	if err != nil {
		log.Error().Err(err).Msg("admin alert could not be built; the CRITICAL log line above is the only record")
		return nil
	}

	_, inTx := exec.(*sqlx.Tx)
	if inTx {
		if _, err := exec.ExecContext(ctx, "SAVEPOINT admin_alert"); err != nil {
			log.Error().Err(err).Msg("admin alert savepoint failed; not queued")
			return nil
		}
	}
	_, err = exec.ExecContext(ctx, `
		INSERT INTO email_outbox (recipient_email, subject, template_type, payload, status, dedupe_key)
		VALUES ($1, $2, $3, $4::jsonb, 'pending', $5)
		ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
		to, subject, TplAdminAlert, payload, key)
	if err != nil {
		log.Error().Err(err).Str("dedupe_key", key).Msg("admin alert could not be queued")
		if inTx {
			_, _ = exec.ExecContext(ctx, "ROLLBACK TO SAVEPOINT admin_alert")
		}
		return nil
	}
	if inTx {
		_, _ = exec.ExecContext(ctx, "RELEASE SAVEPOINT admin_alert")
	}
	return nil
}