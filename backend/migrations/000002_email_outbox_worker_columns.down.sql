DROP INDEX IF EXISTS idx_email_outbox_due;
ALTER TABLE email_outbox
    DROP COLUMN IF EXISTS next_attempt_at,
    DROP COLUMN IF EXISTS locked_until,
    DROP COLUMN IF EXISTS attempts,
    DROP COLUMN IF EXISTS sent_at,
    DROP COLUMN IF EXISTS last_error;
