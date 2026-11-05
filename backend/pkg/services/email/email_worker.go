//backend/pkg/services/email/email_worker.go

package email

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"strings"
	"strconv"
	"sync"
	"time"

	"golang.org/x/time/rate"
	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
	"github.com/eventify/backend/pkg/utils"
)

const (
	batchSize     = 20
	concurrency   = 4
	leaseDuration = 2 * time.Minute  // must stay well above sendTimeout
	sendTimeout   = 30 * time.Second
	maxAttempts   = 12 // with backoff capped at 2h, about 8 hours of retrying before "dead"
)

type outboxRow struct {
	ID             string `db:"id"`
	RecipientEmail string `db:"recipient_email"`
	Subject        string `db:"subject"`
	TemplateType   string `db:"template_type"`
	Payload        string `db:"payload"`
	Attempts       int    `db:"attempts"`
}

type EmailWorker struct {
	db      *sqlx.DB
	sender  Sender
	limiter *rate.Limiter
}

func NewEmailWorker(db *sqlx.DB, sender Sender) *EmailWorker {
	perSec := 2.0
	if v, err := strconv.ParseFloat(os.Getenv("EMAIL_MAX_PER_SECOND"), 64); err == nil && v > 0 {
		perSec = v
	}
	return &EmailWorker{db: db, sender: sender, limiter: rate.NewLimiter(rate.Limit(perSec), 1)}
}

func (w *EmailWorker) Start(ctx context.Context, interval time.Duration) {
	log.Info().Dur("interval", interval).Msg("Email worker started")
	tick := time.NewTicker(interval)
	defer tick.Stop()
	stats := time.NewTicker(time.Minute)
	defer stats.Stop()
	for {
		w.drain(ctx)
		select {
		case <-ctx.Done():
			log.Info().Msg("Email worker stopped")
			return
		case <-stats.C:
			w.reportStats(ctx)
		case <-tick.C:
		}
	}
}

func (w *EmailWorker) drain(ctx context.Context) {
	defer func() {
		if p := recover(); p != nil {
			log.Error().Interface("panic", p).Msg("Email worker recovered from panic")
		}
	}()
	for ctx.Err() == nil {
		rows, err := w.claim(ctx)
		if err != nil {
			log.Error().Err(err).Msg("Email worker: could not claim emails")
			return
		}
		if len(rows) == 0 {
			return
		}
		w.sendAll(ctx, rows)
		if len(rows) < batchSize {
			return
		}
	}
}

// claim leases due rows. SKIP LOCKED makes several workers safe; the lease returns rows to the
// queue if the process dies mid-send. attempts counts every claim, so a message that keeps
// crashing the process still ends up dead instead of looping forever.
func (w *EmailWorker) claim(ctx context.Context) ([]outboxRow, error) {
	var rows []outboxRow
	err := w.db.SelectContext(ctx, &rows, `
		WITH due AS (
			SELECT id FROM email_outbox
			WHERE (status = 'pending'    AND next_attempt_at <= now())
			   OR (status = 'processing' AND locked_until < now())
			ORDER BY next_attempt_at
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE email_outbox o
		SET status = 'processing',
		    locked_until = now() + make_interval(secs => $2),
		    attempts = o.attempts + 1
		FROM due
		WHERE o.id = due.id
		RETURNING o.id::text AS id, o.recipient_email, o.subject, o.template_type,
		          o.payload::text AS payload, o.attempts`,
		batchSize, leaseDuration.Seconds())
	return rows, err
}

func (w *EmailWorker) sendAll(ctx context.Context, rows []outboxRow) {
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	for _, r := range rows {
		sem <- struct{}{}
		wg.Add(1)
		go func(r outboxRow) {
			defer wg.Done()
			defer func() { <-sem }()
			w.process(ctx, r)
		}(r)
	}
	wg.Wait()
}

func (w *EmailWorker) process(ctx context.Context, r outboxRow) {
	defer func() {
		if p := recover(); p != nil {
			log.Error().Interface("panic", p).Str("email_id", r.ID).Msg("Email worker: panic while sending")
			w.fail(r, fmt.Errorf("panic: %v", p), false)
		}
	}()
		subject, body, err := render(r)
	if err == nil {
		err = w.limiter.Wait(ctx) // stay under the provider's rate limit
	}
	if err == nil {
		sctx, cancel := context.WithTimeout(ctx, sendTimeout)
		err = w.sender.Send(sctx, r.RecipientEmail, subject, body)
		cancel()
	}
	if err != nil {
		w.fail(r, err, isPermanent(err))
		return
	}
	w.markSent(r)
}

// markSent and fail use their own context so the result is still saved during shutdown.
func (w *EmailWorker) markSent(r outboxRow) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := w.db.ExecContext(ctx, `
		UPDATE email_outbox
		SET status = 'sent', sent_at = now(), processed_at = now(), locked_until = NULL, last_error = NULL
		WHERE id = $1::uuid`, r.ID)
	if err != nil {
		log.Error().Err(err).Str("email_id", r.ID).Msg("Email delivered but not marked sent; it may be sent again")
	}
}

func (w *EmailWorker) fail(r outboxRow, cause error, permanent bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	dead := permanent || r.Attempts >= maxAttempts
	status := "pending"
	if dead {
		status = "dead"
	}
	_, err := w.db.ExecContext(ctx, `
		UPDATE email_outbox
		SET status = $2, last_error = left($3, 500), locked_until = NULL,
		    next_attempt_at = now() + make_interval(secs => $4)
		WHERE id = $1::uuid`, r.ID, status, cause.Error(), backoff(r.Attempts).Seconds())
	if err != nil {
		log.Error().Err(err).Str("email_id", r.ID).Msg("Email worker: could not record failure")
		return
	}
	ev := log.Warn()
	if dead {
		ev = log.Error()
	}
	ev.Err(cause).Str("email_id", r.ID).Int("attempt", r.Attempts).Bool("dead", dead).Msg("Email send failed")
}

// backoff: 30s, 1m, 2m, 4m ... capped at 2h, plus up to 20% jitter.
func backoff(attempt int) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	d := 30 * time.Second << uint(min(attempt-1, 8))
	if d > 2*time.Hour {
		d = 2 * time.Hour
	}
	return d + time.Duration(rand.Int63n(int64(d/5))) // #nosec G404 -- jitter only
}

func render(r outboxRow) (subject, body string, err error) {
	var p map[string]interface{}
	if err := json.Unmarshal([]byte(r.Payload), &p); err != nil {
		return "", "", permanentError{fmt.Errorf("unreadable payload: %w", err)}
	}
	str := func(k string) string {
		v, _ := p[k].(string)
		return v
	}
	switch r.TemplateType {
	case "TICKET_DELIVERY":
		var codes []string
		if arr, ok := p["ticket_codes"].([]interface{}); ok {
			for _, c := range arr {
				if s, ok := c.(string); ok {
					codes = append(codes, "  "+s)
				}
			}
		}
		link := ""
		if base, err := utils.FrontendBaseURL(); err == nil && base != "" {
			link = fmt.Sprintf("\nView your tickets: %s/tickets?ref=%s\n", base, str("order_ref"))
		}
		body = fmt.Sprintf("Hello %s,\n\nYour payment for %s was successful.\n\nDate: %s\nVenue: %s\nOrder reference: %s\n\nYour ticket codes:\n%s\n%s\nSee you there,\nThe Eventify Team\n",
			str("user_name"), str("event_title"), str("event_date"), str("event_venue"), str("order_ref"),
			strings.Join(codes, "\n"), link)
		return r.Subject, body, nil

		case TplSubPaymentSuccess, TplSubReminder7D, TplSubReminder3D, TplSubReminder1D, TplSubExpired:
		var sp SubscriptionPayload
		if err := json.Unmarshal([]byte(r.Payload), &sp); err != nil {
			return "", "", permanentError{fmt.Errorf("unreadable subscription payload: %w", err)}
		}
		return r.Subject, renderSubscriptionBody(r.TemplateType, sp), nil
		
	default:
		return "", "", permanentError{fmt.Errorf("unknown template %q", r.TemplateType)}
	}
}

func (w *EmailWorker) reportStats(ctx context.Context) {
	var s struct {
		Pending    int `db:"pending"`
		Processing int `db:"processing"`
		Dead       int `db:"dead"`
		OldestSecs int `db:"oldest_secs"`
	}
	err := w.db.GetContext(ctx, &s, `
		SELECT count(*) FILTER (WHERE status = 'pending')    AS pending,
		       count(*) FILTER (WHERE status = 'processing') AS processing,
		       count(*) FILTER (WHERE status = 'dead')       AS dead,
		       COALESCE(EXTRACT(EPOCH FROM now() - min(created_at) FILTER (WHERE status = 'pending')), 0)::int AS oldest_secs
		FROM email_outbox WHERE status IN ('pending', 'processing', 'dead')`)
	if err != nil {
		return
	}
	ev := log.Info()
	if s.Dead > 0 || s.OldestSecs > 300 {
		ev = log.Warn()
	} else if s.Pending+s.Processing == 0 {
		return
	}
	ev.Int("pending", s.Pending).Int("processing", s.Processing).Int("dead", s.Dead).Int("oldest_pending_secs", s.OldestSecs).Msg("Email queue")
}