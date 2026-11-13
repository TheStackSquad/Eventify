-- //backend/migrations/000011_order_checks.down.sql

ALTER TABLE tickets     DROP CONSTRAINT IF EXISTS chk_tickets_code_not_empty;
ALTER TABLE payments    DROP CONSTRAINT IF EXISTS chk_payments_amounts_non_negative;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS chk_order_items_amounts_non_negative;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS chk_order_items_quantity_positive;
ALTER TABLE orders      DROP CONSTRAINT IF EXISTS chk_orders_webhook_attempts_non_negative;
ALTER TABLE orders      DROP CONSTRAINT IF EXISTS chk_orders_amounts_non_negative;