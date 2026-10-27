-- M2: reliable email outbox. Idempotent; safe to run twice.
ALTER TABLE email_outbox
  ADD COLUMN IF NOT EXISTS attempts        integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_until    timestamptz,
  ADD COLUMN IF NOT EXISTS last_error      text,
  ADD COLUMN IF NOT EXISTS sent_at         timestamptz,
  ADD COLUMN IF NOT EXISTS dedupe_key      text;

UPDATE email_outbox SET status = 'pending' WHERE status IS NULL OR status = 'processing';

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_outbox_dedupe ON email_outbox (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_outbox_due  ON email_outbox (next_attempt_at) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_email_outbox_dead ON email_outbox (created_at) WHERE status = 'dead';