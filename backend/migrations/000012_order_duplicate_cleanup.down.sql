-- //backend/migrations/ 000012_order_duplicate_cleanup.down.sql

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_reference ON orders (reference);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_gateway_reference ON payments (gateway_reference);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_code ON tickets (code);
CREATE INDEX IF NOT EXISTS idx_tiers_event_id ON ticket_tiers (event_id);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_order_items_event' AND conrelid = 'order_items'::regclass) THEN
    ALTER TABLE order_items ADD CONSTRAINT fk_order_items_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_tiers_stock_check' AND conrelid = 'ticket_tiers'::regclass) THEN
    ALTER TABLE ticket_tiers ADD CONSTRAINT ticket_tiers_stock_check CHECK (available >= 0);
  END IF;
END $$;