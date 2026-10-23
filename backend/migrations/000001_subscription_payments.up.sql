CREATE TABLE IF NOT EXISTS subscription_payments (
    reference         varchar(100) PRIMARY KEY,
    vendor_id         uuid        NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    subscription_id   uuid        REFERENCES subscriptions(id) ON DELETE SET NULL,
    tier              varchar(20) NOT NULL,
    amount_kobo       bigint      NOT NULL CHECK (amount_kobo > 0),
    currency          char(3)     NOT NULL DEFAULT 'NGN',
    status            varchar(20) NOT NULL DEFAULT 'initiated',
    paid_amount_kobo  bigint,
    paid_currency     char(3),
    channel           varchar(30),
    review_reason     text,
    webhook_attempts  integer     NOT NULL DEFAULT 0,
    paid_at           timestamptz,
    applied_at        timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sp_valid_status CHECK (status IN ('initiated','applied','failed','needs_review')),
    CONSTRAINT sp_valid_tier   CHECK (tier IN ('basic','premium','featured'))
);
CREATE INDEX IF NOT EXISTS idx_sp_vendor_created  ON subscription_payments (vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sp_needs_review    ON subscription_payments (created_at) WHERE status = 'needs_review';
CREATE INDEX IF NOT EXISTS idx_sp_stale_initiated ON subscription_payments (created_at) WHERE status = 'initiated';
CREATE OR REPLACE TRIGGER trg_sp_updated_at BEFORE UPDATE ON subscription_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();