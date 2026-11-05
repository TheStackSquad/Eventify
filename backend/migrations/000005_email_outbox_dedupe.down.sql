-- backend/migrations/000005_email_outbox_dedupe.down.sql

DROP INDEX IF EXISTS idx_email_outbox_dedupe_key;
ALTER TABLE email_outbox DROP COLUMN IF EXISTS dedupe_key;