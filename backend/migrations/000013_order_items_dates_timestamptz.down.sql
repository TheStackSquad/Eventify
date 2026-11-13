-- //backend/migrations/ 000013_order_items_dates_timestamptz.down.sql

DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'event_start_date') = 'timestamp with time zone' THEN
    ALTER TABLE order_items ALTER COLUMN event_start_date TYPE timestamp USING event_start_date AT TIME ZONE 'UTC';
  END IF;
  IF (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'event_end_date') = 'timestamp with time zone' THEN
    ALTER TABLE order_items ALTER COLUMN event_end_date TYPE timestamp USING event_end_date AT TIME ZONE 'UTC';
  END IF;
END $$;