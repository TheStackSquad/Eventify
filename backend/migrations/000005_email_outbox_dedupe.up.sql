-- backend/migrations/000005_email_outbox_dedupe.up.sql

-- The code inserts a dedupe_key so a repeated email request is a no-op. Safe where the column already exists.
ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS dedupe_key text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_outbox_dedupe_key ON email_outbox (dedupe_key) WHERE dedupe_key IS NOT NULL;