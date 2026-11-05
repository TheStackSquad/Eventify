ALTER TABLE email_outbox
    ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS locked_until    timestamptz,
    ADD COLUMN IF NOT EXISTS attempts        integer     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sent_at         timestamptz,
    ADD COLUMN IF NOT EXISTS last_error      text;

CREATE INDEX IF NOT EXISTS idx_email_outbox_due
    ON email_outbox (next_attempt_at) WHERE status = 'pending';
