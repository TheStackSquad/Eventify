-- audit/sql/ord_reset.sql
-- Deletes ONLY rows the ORD suite owns, then restocks the fixture tiers:
--   orders placed by audit-ord-* customers, or containing an AUDIT-ORD event,
--   their tickets, payments and ticket emails (dedupe_key ticket:<reference>).
-- It never touches subscriptions, the shared webhook_inbox, or another suite's rows.
-- Usage: psql "$AUDIT_DB_URL" -v ON_ERROR_STOP=1 -f audit/sql/ord_reset.sql
BEGIN;

CREATE TEMP TABLE _ord_orders ON COMMIT DROP AS
SELECT o.id, o.reference
FROM orders o
WHERE o.customer_email LIKE 'audit-ord-%'
   OR o.id IN (SELECT oi.order_id
               FROM order_items oi
               JOIN events e ON e.id = oi.event_id
               WHERE e.event_title LIKE 'AUDIT-ORD%');

DELETE FROM email_outbox WHERE dedupe_key IN (SELECT 'ticket:' || reference FROM _ord_orders);
DELETE FROM tickets      WHERE order_id   IN (SELECT id FROM _ord_orders);
DELETE FROM payments     WHERE order_id   IN (SELECT id FROM _ord_orders);
DELETE FROM orders       WHERE id         IN (SELECT id FROM _ord_orders);   -- order_items cascade

UPDATE ticket_tiers
   SET sold = 0, available = capacity
 WHERE event_id IN (SELECT id FROM events WHERE event_title LIKE 'AUDIT-ORD%');

COMMIT;
