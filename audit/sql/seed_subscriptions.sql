-- //audit/sql/seed_subscriptions.sql

-- One vendor and subscription per scenario. Rig only.
DO $$
DECLARE
  sc record;
  uid uuid;
  vid uuid;
  suffix text;
BEGIN
  FOR sc IN
    SELECT * FROM (VALUES
      ('pay',     'active',  '30 days',         true,  true,  '0 hours', false),
      ('r7',      'active',  '6 days 12 hours', true,  true,  '23 days', true),
      ('r3',      'active',  '2 days 12 hours', true,  true,  '27 days', true),
      ('r1',      'active',  '12 hours',        true,  true,  '29 days', true),
      ('exp',     'expired', '-1 day',          true,  true,  '31 days', true),
      ('optout',  'active',  '6 days 12 hours', true,  false, '23 days', true),
      ('noauto',  'active',  '2 days 12 hours', false, true,  '27 days', true),
      ('stale',   'expired', '-400 days',       true,  true,  '430 days', true),
      ('renewed', 'expired', '-10 days',        true,  true,  '40 days', true)
    ) AS t(tag, status, expires_in, auto_renew, allow_mail, paid_ago, mail_sent)
  LOOP
    suffix := substr(md5(random()::text || clock_timestamp()::text), 1, 6);

    EXECUTE format(
      'INSERT INTO users (name, email, password_hash, allow_reminder_emails) VALUES (%L, %L, %L, %L) RETURNING id',
      'Sub ' || sc.tag, 'sub-' || sc.tag || '-' || suffix || '@example.com', 'seed-not-a-real-hash', sc.allow_mail) INTO uid;

    EXECUTE format(
      'INSERT INTO vendors (id, owner_id, name, category, state, city, status, image_url, phone_number, first_name, last_name, description, email, vnin, subscription_tier, is_identity_verified, is_business_registered, pvs_score, review_count, inquiry_count, responded_count, profile_completion, created_at, updated_at) VALUES (gen_random_uuid(), %L, %L, ''Catering'', ''Lagos'', ''Ikeja'', ''active'', ''https://example.com/s.jpg'', %L, ''Seed'', ''Vendor'', ''Subscription seed'', %L, %L, ''free'', false, false, 0, 0, 0, 0, 0, now(), now()) RETURNING id',
      uid, 'Seed Vendor ' || sc.tag || ' ' || suffix, '0802' || substr(md5(suffix || '1'), 1, 7),
      'v-' || sc.tag || '-' || suffix || '@example.com', 'NIN' || substr(md5(suffix || '2'), 1, 10)) INTO vid;

    EXECUTE format(
      'INSERT INTO subscriptions (id, vendor_id, tier, status, price, currency, payment_reference, starts_at, expires_at, created_at, updated_at, auto_renew, last_payment_date, payment_success_sent_at) VALUES (gen_random_uuid(), %L, ''premium'', %L, 700000, ''NGN'', %L, now() + %L::interval - interval ''30 days'', now() + %L::interval, now(), now(), %L, now() - %L::interval, %s)',
      vid, sc.status, 'SEED-' || sc.tag || '-' || suffix, sc.expires_in, sc.expires_in, sc.auto_renew, sc.paid_ago,
      CASE WHEN sc.mail_sent THEN 'now() - interval ''1 day''' ELSE 'NULL' END);

    IF sc.tag = 'renewed' THEN  -- the vendor renewed: an old expired row AND a new active one
      EXECUTE format(
        'INSERT INTO subscriptions (id, vendor_id, tier, status, price, currency, payment_reference, starts_at, expires_at, created_at, updated_at, auto_renew, last_payment_date, payment_success_sent_at) VALUES (gen_random_uuid(), %L, ''premium'', ''active'', 700000, ''NGN'', %L, now() - interval ''5 days'', now() + interval ''25 days'', now(), now(), true, now() - interval ''5 days'', now() - interval ''5 days'')',
        vid, 'SEED-renewed2-' || suffix);
    END IF;
  END LOOP;
END $$;