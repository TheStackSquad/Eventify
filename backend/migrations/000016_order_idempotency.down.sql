DROP INDEX IF EXISTS idx_orders_idempotency_live;
ALTER TABLE orders
    DROP COLUMN IF EXISTS authorization_url,
    DROP COLUMN IF EXISTS idempotency_hash,
    DROP COLUMN IF EXISTS idempotency_key;
