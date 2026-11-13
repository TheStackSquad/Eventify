-- // backend/migrations/ 000013_order_items_dates_timestamptz.up.sql

-- F214: the event dates copied into order_items had no time zone. Existing values are read as UTC.
-- Guarded, so running it twice can never shift the dates (the F19 lesson).
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'event_start_date') = 'timestamp without time zone' THEN
    ALTER TABLE order_items ALTER COLUMN event_start_date TYPE timestamptz USING event_start_date AT TIME ZONE 'UTC';
  END IF;
  IF (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'event_end_date') = 'timestamp without time zone' THEN
    ALTER TABLE order_items ALTER COLUMN event_end_date TYPE timestamptz USING event_end_date AT TIME ZONE 'UTC';
  END IF;
END $$;