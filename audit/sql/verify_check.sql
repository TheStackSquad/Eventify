SELECT CASE WHEN regexp_replace(customer_email,'^vr\+([0-9]+)@.*','\1')::int % 2 = 1 THEN 'race' ELSE 'early' END AS scenario,
       status, count(*)
FROM orders
WHERE customer_email LIKE 'vr+%@example.com' AND created_at > now() - interval '15 minutes'
GROUP BY 1, 2 ORDER BY 1, 2;
