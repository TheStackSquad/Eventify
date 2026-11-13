-- Does subscriptions accept every status and tier the code writes? Each attempt is rolled back; nothing is written.
-- Rejections name the constraint (or trigger message) that refused the value.
DO $$
DECLARE s text; t text; bad text := ''; vid uuid; cn text;
BEGIN
  SELECT v.id INTO vid FROM vendors v WHERE NOT EXISTS (SELECT 1 FROM subscriptions a WHERE a.vendor_id = v.id AND a.status = 'active') LIMIT 1;
  IF vid IS NULL THEN RAISE NOTICE 'no vendor without an active plan: probe skipped'; RETURN; END IF;
  FOREACH s IN ARRAY ARRAY['pending','active','expired','cancelled'] LOOP
    BEGIN
      INSERT INTO subscriptions (vendor_id, tier, status, starts_at, expires_at, price, currency, payment_reference, last_payment_date)
        VALUES (vid, 'basic', s, now(), now() + interval '1 day', 1, 'NGN', 'PROBE-' || gen_random_uuid(), now());
      RAISE EXCEPTION 'probe-ok';
    EXCEPTION
      WHEN check_violation THEN GET STACKED DIAGNOSTICS cn = CONSTRAINT_NAME; bad := bad || format('status:%s (%s) ', s, cn);
      WHEN raise_exception THEN IF SQLERRM <> 'probe-ok' THEN bad := bad || format('status:%s (trigger: %s) ', s, left(SQLERRM, 60)); END IF;
    END;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['basic','premium','featured'] LOOP
    BEGIN
      INSERT INTO subscriptions (vendor_id, tier, status, starts_at, expires_at, price, currency, payment_reference, last_payment_date)
        VALUES (vid, t, 'expired', now(), now() + interval '1 day', 1, 'NGN', 'PROBE-' || gen_random_uuid(), now());
      RAISE EXCEPTION 'probe-ok';
    EXCEPTION
      WHEN check_violation THEN GET STACKED DIAGNOSTICS cn = CONSTRAINT_NAME; bad := bad || format('tier:%s (%s) ', t, cn);
      WHEN raise_exception THEN IF SQLERRM <> 'probe-ok' THEN bad := bad || format('tier:%s (trigger: %s) ', t, left(SQLERRM, 60)); END IF;
    END;
  END LOOP;
  IF bad <> '' THEN RAISE EXCEPTION 'REJECTED: %', bad; END IF;
  RAISE NOTICE 'subscriptions accepts every status and tier the code writes';
END $$;