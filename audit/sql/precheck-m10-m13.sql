-- audit/sql/precheck-m10-m13.sql

\echo == dependent views or materialized views on the affected columns (must be empty) ==
SELECT DISTINCT d.refobjid::regclass AS table_name, v.relname AS dependent, v.relkind
FROM pg_depend d
JOIN pg_rewrite r ON r.oid = d.objid
JOIN pg_class v ON v.oid = r.ev_class
JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
WHERE d.refobjid IN ('orders'::regclass, 'order_items'::regclass, 'payments'::regclass, 'ticket_tiers'::regclass)
  AND d.deptype = 'n' AND v.oid <> d.refobjid
  AND a.attname IN ('subtotal','service_fee','vat_amount','final_total','amount_paid','unit_price','fees_paid','price_kobo','event_start_date','event_end_date');

\echo == rows that would break the new CHECKs (all counts should be 0) ==
SELECT 'orders amounts' AS rule, count(*) FROM orders WHERE NOT (subtotal >= 0 AND service_fee >= 0 AND vat_amount >= 0 AND final_total >= 0 AND amount_paid >= 0)
UNION ALL SELECT 'orders webhook_attempts', count(*) FROM orders WHERE webhook_attempts < 0
UNION ALL SELECT 'order_items quantity', count(*) FROM order_items WHERE quantity <= 0
UNION ALL SELECT 'order_items amounts', count(*) FROM order_items WHERE NOT (unit_price >= 0 AND subtotal >= 0)
UNION ALL SELECT 'payments amounts', count(*) FROM payments WHERE NOT (amount_paid >= 0 AND fees_paid >= 0)
UNION ALL SELECT 'tickets code', count(*) FROM tickets WHERE length(code) = 0;

\echo == the duplicate pairs (each name should appear) ==
SELECT indexname FROM pg_indexes WHERE indexname IN ('idx_orders_reference','idx_payments_gateway_reference','idx_tickets_code','idx_tiers_event_id','idx_ticket_tiers_event_id') ORDER BY 1;
SELECT conname FROM pg_constraint WHERE conname IN ('orders_reference_key','payments_gateway_reference_key','tickets_code_key','fk_order_items_event','order_items_event_id_fkey','ticket_tiers_stock_check','check_available_non_negative') ORDER BY 1;

\echo == current migration version ==
SELECT version, dirty FROM schema_migrations;