-- //backend/migrations/000012_order_duplicate_cleanup.up.sql

-- F212: exact duplicates on the order tables. One of each pair is dropped, and only when its twin exists,
-- so this can never remove the only protection. The constraint side is kept: other tooling may name it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_reference_key' AND conrelid = 'orders'::regclass) THEN
    DROP INDEX IF EXISTS idx_orders_reference;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_gateway_reference_key' AND conrelid = 'payments'::regclass) THEN
    DROP INDEX IF EXISTS idx_payments_gateway_reference;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_code_key' AND conrelid = 'tickets'::regclass) THEN
    DROP INDEX IF EXISTS idx_tickets_code;
  END IF;
  IF to_regclass('public.idx_ticket_tiers_event_id') IS NOT NULL THEN
    DROP INDEX IF EXISTS idx_tiers_event_id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_event_id_fkey' AND conrelid = 'order_items'::regclass) THEN
    ALTER TABLE order_items DROP CONSTRAINT IF EXISTS fk_order_items_event;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_available_non_negative' AND conrelid = 'ticket_tiers'::regclass) THEN
    ALTER TABLE ticket_tiers DROP CONSTRAINT IF EXISTS ticket_tiers_stock_check;
  END IF;
END $$;