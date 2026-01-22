//backend/pkg/services/email/email_worker.go

package email

import (
	"context"
	"encoding/json"
	"time"
	"fmt"

	"github.com/eventify/backend/pkg/models"
	"github.com/eventify/backend/pkg/utils"
	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
)

type EmailWorker struct {
	db *sqlx.DB
}

func NewEmailWorker(db *sqlx.DB) *EmailWorker {
	return &EmailWorker{db: db}
}

func (w *EmailWorker) Start(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.processOutbox(ctx)
		}
	}
}

func (w *EmailWorker) processOutbox(ctx context.Context) {
	// 1. Fetch pending emails and mark as 'processing' (Atomic locking)
	var entries []models.EmailOutbox
	query := `
		UPDATE email_outbox 
		SET status = 'processing' 
		WHERE id IN (
			SELECT id FROM email_outbox 
			WHERE status = 'pending' 
			ORDER BY created_at ASC 
			LIMIT 10
		) 
		RETURNING *`
	
	err := w.db.SelectContext(ctx, &entries, query)
	if err != nil || len(entries) == 0 {
		return
	}

	for _, entry := range entries {
		// 2. Actually send the email using your existing util
		// For TICKET_DELIVERY, you'd likely want a specialized SendTicketEmail function
		err := w.sendEmail(entry)

		if err != nil {
			log.Error().Err(err).Str("email_id", entry.ID.String()).Msg("Failed to send email")
			w.db.ExecContext(ctx, "UPDATE email_outbox SET status = 'pending', retry_count = retry_count + 1 WHERE id = $1", entry.ID)
			continue
		}

		// 3. Mark as sent
		w.db.ExecContext(ctx, "UPDATE email_outbox SET status = 'sent', processed_at = NOW() WHERE id = $1", entry.ID)
	}
}

func (w *EmailWorker) sendEmail(entry models.EmailOutbox) error {
	// 1. Unmarshal the JSON payload we saved in finalizeOrder
	var payload map[string]interface{}
	if err := json.Unmarshal(entry.Payload, &payload); err != nil {
		return fmt.Errorf("failed to parse email payload: %w", err)
	}

	// 2. Build the message body based on the template type
	var body string
	switch entry.TemplateType {
	case "TICKET_DELIVERY":
		userName := payload["user_name"]
		eventTitle := payload["event_title"]
		orderRef := payload["order_ref"]
		ticketCodes := payload["ticket_codes"]

		body = fmt.Sprintf(
			"Hello %s,\n\nYour payment for %s was successful!\nOrder Reference: %s\n\nYour Ticket Codes:\n%v\n\nEnjoy the event!\n- The Eventify Team",
			userName, eventTitle, orderRef, ticketCodes,
		)
	default:
		body = fmt.Sprintf("Generic notification: %v", payload)
	}

	// 3. Call our Mock utility (later this becomes utils.SendEmail)
	return utils.MockSendEmail(entry.RecipientEmail, entry.Subject, body)
}