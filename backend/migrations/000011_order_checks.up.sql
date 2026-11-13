-- //backend/migrations/ 000011_order_checks.up.sql

-- F211: the order tables had no CHECK constraints at all (only ticket_tiers did).
-- Each constraint is added NOT VALID (enforced for every new write at once), then validated against existing rows.
-- If existing rows break one, validation is skipped with a NOTICE and the constraint keeps guarding new writes.
-- Only invariants that cannot be wrong live here. Totals arithmetic and status transitions wait for ORD to confirm the rules.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_amounts_non_negative;
ALTER TABLE orders ADD CONSTRAINT chk_orders_amounts_non_negative
    CHECK (subtotal >= 0 AND service_fee >= 0 AND vat_amount >= 0 AND final_total >= 0 AND amount_paid >= 0) NOT VALID;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_webhook_attempts_non_negative;
ALTER TABLE orders ADD CONSTRAINT chk_orders_webhook_attempts_non_negative CHECK (webhook_attempts >= 0) NOT VALID;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS chk_order_items_quantity_positive;
ALTER TABLE order_items ADD CONSTRAINT chk_order_items_quantity_positive CHECK (quantity > 0) NOT VALID;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS chk_order_items_amounts_non_negative;
ALTER TABLE order_items ADD CONSTRAINT chk_order_items_amounts_non_negative CHECK (unit_price >= 0 AND subtotal >= 0) NOT VALID;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payments_amounts_non_negative;
ALTER TABLE payments ADD CONSTRAINT chk_payments_amounts_non_negative CHECK (amount_paid >= 0 AND fees_paid >= 0) NOT VALID;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS chk_tickets_code_not_empty;
ALTER TABLE tickets ADD CONSTRAINT chk_tickets_code_not_empty CHECK (length(code) > 0) NOT VALID;

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conrelid::regclass AS tbl, conname FROM pg_constraint
    WHERE NOT convalidated AND conname IN (
      'chk_orders_amounts_non_negative', 'chk_orders_webhook_attempts_non_negative',
      'chk_order_items_quantity_positive', 'chk_order_items_amounts_non_negative',
      'chk_payments_amounts_non_negative', 'chk_tickets_code_not_empty')
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', c.tbl, c.conname);
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'constraint % left NOT VALID: existing rows violate it', c.conname;
    END;
  END LOOP;
END $$;