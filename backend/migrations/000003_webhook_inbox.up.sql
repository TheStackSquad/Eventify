-- backend/migrations/000003_webhook_inbox.up.sql

-- Raw Paystack webhooks, stored before processing so a bug can be fixed and the event replayed.
-- Only signature-verified bodies are stored, so unsigned traffic cannot fill this table.
CREATE TABLE webhook_inbox (
    id            BIGSERIAL PRIMARY KEY,
    provider      TEXT        NOT NULL DEFAULT 'paystack',
    event_type    TEXT        NOT NULL DEFAULT '',
    reference     TEXT        NOT NULL DEFAULT '',
    body_sha256   TEXT        NOT NULL,
    body          BYTEA       NOT NULL,
    status        TEXT        NOT NULL DEFAULT 'received'
                  CHECK (status IN ('received', 'processed', 'failed', 'orphan', 'ignored')),
    attempts      INTEGER     NOT NULL DEFAULT 1,
    last_error    TEXT        NOT NULL DEFAULT '',
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at  TIMESTAMPTZ,
    UNIQUE (provider, body_sha256)
);
CREATE INDEX idx_webhook_inbox_open ON webhook_inbox (status, last_seen_at) WHERE status IN ('received', 'failed', 'orphan');
CREATE INDEX idx_webhook_inbox_reference ON webhook_inbox (reference) WHERE reference <> '';