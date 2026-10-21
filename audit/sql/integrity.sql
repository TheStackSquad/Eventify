SELECT 'stock arithmetic' AS check, count(*) AS violations FROM ticket_tiers WHERE available <> capacity - sold OR available < 0 OR sold > capacity
UNION ALL SELECT 'reserved vs live orders', count(*) FROM ticket_tiers t LEFT JOIN (SELECT oi.ticket_tier_id, SUM(oi.quantity) q FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status::text IN ('pending','success') GROUP BY 1) x ON x.ticket_tier_id = t.id WHERE t.sold <> COALESCE(x.q, 0)
UNION ALL SELECT 'paid orders: ticket count', count(*) FROM (SELECT o.id FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.status::text = 'success' GROUP BY o.id HAVING SUM(oi.quantity) <> (SELECT count(*) FROM tickets tk WHERE tk.order_id = o.id)) s
UNION ALL SELECT 'tickets on unpaid orders', count(*) FROM tickets tk JOIN orders o ON o.id = tk.order_id WHERE o.status::text <> 'success'
UNION ALL SELECT 'duplicate ticket codes', count(*) FROM (SELECT code FROM tickets GROUP BY code HAVING count(*) > 1) d
UNION ALL SELECT 'duplicate ticket emails', count(*) FROM (SELECT payload->>'order_ref' FROM email_outbox WHERE template_type = 'TICKET_DELIVERY' GROUP BY 1 HAVING count(*) > 1) e
UNION ALL SELECT 'amount paid <> total', count(*) FROM orders WHERE status::text = 'success' AND amount_paid <> final_total
UNION ALL SELECT 'INFO: emails never sent', count(*) FROM email_outbox WHERE status = 'pending';
