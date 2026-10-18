CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

INSERT INTO users (name, email, password_hash)
SELECT 'LT Organizer', 'lt-organizer@example.com', 'not-a-real-hash'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'lt-organizer@example.com');

DO $$
DECLARE
  org uuid;
  et  event_type;
BEGIN
  SELECT id INTO org FROM users WHERE email = 'lt-organizer@example.com';

  SELECT e.enumlabel::text::event_type INTO et
  FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'event_type' ORDER BY e.enumsortorder LIMIT 1;

  INSERT INTO events (organizer_id, event_title, event_description, category, event_type,
                      event_image_url, venue_name, city, state, start_date, end_date)
  SELECT org,
         'LT Event ' || g || ' ' || (ARRAY['Afrobeats Night','Tech Meetup','Food Festival','Art Expo',
                                           'Gospel Concert','Startup Summit','Fashion Show','Comedy Night'])[1 + g % 8],
         'Load test event ' || g,
         (ARRAY['Music & concerts','Tech & business','Food & drink','Arts & culture',
                'Religion & community','Education & workshops','Fashion & lifestyle'])[1 + g % 7],
         et, 'https://example.com/lt.jpg', 'Venue ' || g,
         (ARRAY['Lagos','Abuja','Ibadan','Port Harcourt'])[1 + g % 4],
         (ARRAY['Lagos','FCT','Oyo','Rivers'])[1 + g % 4],
         now() + interval '7 days' + g * interval '1 hour',
         now() + interval '7 days 3 hours' + g * interval '1 hour'
  FROM generate_series(1, 300) g;

  INSERT INTO ticket_tiers (event_id, name, price_kobo, capacity, sold, available)
  SELECT id, 'General', 200000, 1000000, 0, 1000000 FROM events WHERE event_title LIKE 'LT Event %';
  INSERT INTO ticket_tiers (event_id, name, price_kobo, capacity, sold, available)
  SELECT id, 'VIP', 1000000, 1000000, 0, 1000000 FROM events WHERE event_title LIKE 'LT Event %';

  -- for the later oversell test
  INSERT INTO ticket_tiers (event_id, name, price_kobo, capacity, sold, available)
  SELECT id, 'LowStock10', 150000, 10, 0, 10 FROM events WHERE event_title LIKE 'LT Event %'
  ORDER BY start_date LIMIT 1;
END $$;

SELECT count(*) AS lt_events FROM events WHERE event_title LIKE 'LT Event %';
SELECT name, count(*) FROM ticket_tiers GROUP BY name ORDER BY name;
