-- 000016: idempotent order initialization (ORD, finding F207).
-- A client retries POST /api/orders/initialize with the same Idempotency-Key and gets the original order back
-- instead of reserving the tickets a second time.
--   idempotency_key   what the client sent (8 to 128 characters)
--   idempotency_hash  sha256 of what was asked for; a different request under the same key is refused (422)
--   authorization_url the Paystack payment link, stored so a replay can return it
-- One LIVE order per caller and key: the unique index only covers pending, processing and paid orders, so a failed
-- or expired order frees its key and the client may try again with it.
-- Expand-only and nullable: old code keeps working, except that code which scans "SELECT *" into a struct without
-- these fields must be deployed together with this migration (see the patch notes).
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS idempotency_key   varchar(128),
    ADD COLUMN IF NOT EXISTS idempotency_hash  char(64),
    ADD COLUMN IF NOT EXISTS authorization_url text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_live
    ON orders ((coalesce(user_id::text, guest_id)), idempotency_key)
    WHERE idempotency_key IS NOT NULL AND status IN ('pending', 'processing', 'success');
