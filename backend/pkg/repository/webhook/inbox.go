// backend/pkg/repository/webhook/inbox.go
// Package webhook stores raw provider webhooks so they can be inspected and replayed.
package webhook

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/jmoiron/sqlx"
)

const (
	StatusProcessed = "processed"
	StatusFailed    = "failed"
	StatusOrphan    = "orphan"
	StatusIgnored   = "ignored"
)

// Entry is the stored row a handler works with.
type Entry struct {
	ID       int64
	Attempts int
	Status   string
}

// Inbox keeps signature-verified webhook bodies.
type Inbox interface {
	// Store saves the body. The same body arriving again only counts another attempt.
	Store(ctx context.Context, provider, eventType, reference string, body []byte) (Entry, error)
	// Mark records what happened when the event was processed.
	Mark(ctx context.Context, id int64, status, lastError string) error
}

type inbox struct{ db *sqlx.DB }

func NewInbox(db *sqlx.DB) Inbox { return &inbox{db: db} }

func (r *inbox) Store(ctx context.Context, provider, eventType, reference string, body []byte) (Entry, error) {
	sum := sha256.Sum256(body)
	var e Entry
	err := r.db.QueryRowxContext(ctx, `
		INSERT INTO webhook_inbox (provider, event_type, reference, body_sha256, body)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (provider, body_sha256)
		DO UPDATE SET attempts = webhook_inbox.attempts + 1, last_seen_at = now()
		RETURNING id, attempts, status`,
		provider, eventType, reference, hex.EncodeToString(sum[:]), body).Scan(&e.ID, &e.Attempts, &e.Status)
	if err != nil {
		return Entry{}, fmt.Errorf("store webhook: %w", err)
	}
	return e, nil
}

func (r *inbox) Mark(ctx context.Context, id int64, status, lastError string) error {
	if len(lastError) > 500 {
		lastError = lastError[:500]
	}
	_, err := r.db.ExecContext(ctx, `
		UPDATE webhook_inbox
		SET status = $2::text, last_error = $3,
		    processed_at = CASE WHEN $2::text IN ('processed', 'ignored', 'orphan') THEN now() ELSE processed_at END
		WHERE id = $1`, id, status, lastError)
	if err != nil {
		return fmt.Errorf("mark webhook: %w", err)
	}
	return nil
}