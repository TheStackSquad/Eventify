-- audit/sql/ord_seed.sql
-- ORD suite fixtures: 4 events and 10 ticket tiers. Idempotent: rows that already exist are left alone
-- (so a re-run never touches stock that tests have used; ord_reset.sql restocks).
-- Usage: psql "$AUDIT_DB_URL" -v ON_ERROR_STOP=1 -v organizer_id=<user uuid> -f audit/sql/ord_seed.sql
-- Fixed ids: events a0d17000-0000-4000-8000-00000000000N, tiers a0d17000-0000-4000-8001-0000000000NN.
-- Every event title starts with AUDIT-ORD; that prefix is how reset and the invariants find ORD data.

INSERT INTO events (id, organizer_id, event_title, event_description, category, event_type,
                    event_image_url, venue_name, city, state, start_date, end_date, is_deleted, deleted_at)
VALUES
 ('a0d17000-0000-4000-8000-000000000001', :'organizer_id'::uuid, 'AUDIT-ORD Main',
  'ORD suite fixture: the main sellable event', 'Music & concerts', 'physical',
  'https://example.com/ord.jpg', 'Audit Venue', 'Lagos', 'Lagos',
  now() + interval '30 days', now() + interval '30 days 3 hours', false, NULL),
 ('a0d17000-0000-4000-8000-000000000002', :'organizer_id'::uuid, 'AUDIT-ORD Second',
  'ORD suite fixture: second event for multi-event orders', 'Music & concerts', 'physical',
  'https://example.com/ord.jpg', 'Audit Venue 2', 'Lagos', 'Lagos',
  now() + interval '45 days', now() + interval '45 days 3 hours', false, NULL),
 ('a0d17000-0000-4000-8000-000000000003', :'organizer_id'::uuid, 'AUDIT-ORD Ended',
  'ORD suite fixture: an event that already ended', 'Music & concerts', 'physical',
  'https://example.com/ord.jpg', 'Audit Venue 3', 'Lagos', 'Lagos',
  now() - interval '10 days', now() - interval '9 days 21 hours', false, NULL),
 ('a0d17000-0000-4000-8000-000000000004', :'organizer_id'::uuid, 'AUDIT-ORD Deleted',
  'ORD suite fixture: a soft-deleted event', 'Music & concerts', 'physical',
  'https://example.com/ord.jpg', 'Audit Venue 4', 'Lagos', 'Lagos',
  now() + interval '30 days', now() + interval '30 days 3 hours', true, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO ticket_tiers (id, event_id, name, price_kobo, capacity, sold, available, description)
VALUES
 ('a0d17000-0000-4000-8001-000000000001', 'a0d17000-0000-4000-8000-000000000001', 'ord-std',      300000, 1000, 0, 1000, 'ORD fixture: small-ticket fee band'),
 ('a0d17000-0000-4000-8001-000000000002', 'a0d17000-0000-4000-8000-000000000001', 'ord-prem',    1000000, 1000, 0, 1000, 'ORD fixture: premium fee band'),
 ('a0d17000-0000-4000-8001-000000000003', 'a0d17000-0000-4000-8000-000000000001', 'ord-edge-lo',  500000,  200, 0,  200, 'ORD fixture: exactly the 5000 naira threshold'),
 ('a0d17000-0000-4000-8001-000000000004', 'a0d17000-0000-4000-8000-000000000001', 'ord-edge-hi',  500001,  200, 0,  200, 'ORD fixture: one kobo above the threshold'),
 ('a0d17000-0000-4000-8001-000000000005', 'a0d17000-0000-4000-8000-000000000001', 'ord-free',          0,  200, 0,  200, 'ORD fixture: free ticket'),
 ('a0d17000-0000-4000-8001-000000000006', 'a0d17000-0000-4000-8000-000000000001', 'ord-last',     100000,    5, 0,    5, 'ORD fixture: five left, oversell target'),
 ('a0d17000-0000-4000-8001-000000000007', 'a0d17000-0000-4000-8000-000000000001', 'ord-one',      100000,    1, 0,    1, 'ORD fixture: a single ticket'),
 ('a0d17000-0000-4000-8001-000000000008', 'a0d17000-0000-4000-8000-000000000002', 'ord-b-std',    200000,  200, 0,  200, 'ORD fixture: second event'),
 ('a0d17000-0000-4000-8001-000000000009', 'a0d17000-0000-4000-8000-000000000003', 'ord-ended',    100000,  100, 0,  100, 'ORD fixture: ended event'),
 ('a0d17000-0000-4000-8001-000000000010', 'a0d17000-0000-4000-8000-000000000004', 'ord-deleted',  100000,  100, 0,  100, 'ORD fixture: deleted event')
ON CONFLICT (id) DO NOTHING;
