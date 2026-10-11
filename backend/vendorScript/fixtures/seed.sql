DELETE FROM login_attempts WHERE email IN ('arike@events.com', 'constellar@events.com');

UPDATE users SET password_hash = '$2a$10$lrVj6SnDjpC6HTQkSK.0T.bwBJ724g4ZJ6ByFVMb2GQ1WABmGQpQO' WHERE email = 'constellar@events.com';

UPDATE vendors SET name = 'Arike Events', description = 'Premium event planning services' WHERE id = '30da92cc-6881-45e2-a5a2-69c46593c4fd';

REFRESH MATERIALIZED VIEW CONCURRENTLY vendor_daily_metrics;
REFRESH MATERIALIZED VIEW CONCURRENTLY vendor_of_the_month;
