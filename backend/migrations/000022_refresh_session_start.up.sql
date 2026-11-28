-- F406: the 30 day limit of a session was measured from the newest refresh token, which restarts at every refresh.
-- Every refresh token now carries the time its session began. A trigger copies it from the parent token, so the code that saves tokens does not change.
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS session_started_at timestamptz;
UPDATE refresh_tokens SET session_started_at = created_at WHERE session_started_at IS NULL;
ALTER TABLE refresh_tokens ALTER COLUMN session_started_at SET DEFAULT now();
ALTER TABLE refresh_tokens ALTER COLUMN session_started_at SET NOT NULL;
CREATE OR REPLACE FUNCTION refresh_tokens_set_session_start() RETURNS trigger AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    NEW.session_started_at := COALESCE((SELECT p.session_started_at FROM refresh_tokens p WHERE p.id = NEW.parent_id), NEW.session_started_at);
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_refresh_tokens_session_start ON refresh_tokens;
CREATE TRIGGER trg_refresh_tokens_session_start BEFORE INSERT ON refresh_tokens FOR EACH ROW EXECUTE FUNCTION refresh_tokens_set_session_start();
