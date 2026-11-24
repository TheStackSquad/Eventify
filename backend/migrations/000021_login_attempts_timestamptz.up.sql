-- F403: last_attempt_at was timestamp without time zone, filled with the server's local time and read back as UTC, so on a
-- server in Lagos time every lock lasted an hour longer. Lock rows last 10 minutes, so they are cleared rather than
-- converted from a zone nobody can know. The guard makes a second run harmless.
DELETE FROM login_attempts;
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'login_attempts' AND column_name = 'last_attempt_at') = 'timestamp without time zone' THEN
    ALTER TABLE login_attempts ALTER COLUMN last_attempt_at DROP DEFAULT;
    ALTER TABLE login_attempts ALTER COLUMN last_attempt_at TYPE timestamptz USING last_attempt_at AT TIME ZONE 'UTC';
    ALTER TABLE login_attempts ALTER COLUMN last_attempt_at SET DEFAULT now();
  END IF;
END $$;
