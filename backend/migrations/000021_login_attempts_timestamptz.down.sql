DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'login_attempts' AND column_name = 'last_attempt_at') = 'timestamp with time zone' THEN
    ALTER TABLE login_attempts ALTER COLUMN last_attempt_at DROP DEFAULT;
    ALTER TABLE login_attempts ALTER COLUMN last_attempt_at TYPE timestamp USING last_attempt_at AT TIME ZONE 'UTC';
    ALTER TABLE login_attempts ALTER COLUMN last_attempt_at SET DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
