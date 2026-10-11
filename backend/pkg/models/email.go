//backend/pkg/models/email.go

package models

import (
	"encoding/json"
	"time"
	"github.com/google/uuid"
)

type EmailOutbox struct {
	ID             uuid.UUID       `db:"id"`
	RecipientEmail string          `db:"recipient_email"`
	Subject        string          `db:"subject"`
	TemplateType   string          `db:"template_type"`
	Payload        json.RawMessage `db:"payload"`
	Status         string          `db:"status"`
	RetryCount     int             `db:"retry_count"`
	CreatedAt      time.Time       `db:"created_at"`
	ProcessedAt    *time.Time      `db:"processed_at"`
}