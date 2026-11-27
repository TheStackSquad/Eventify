DROP TRIGGER IF EXISTS trg_refresh_tokens_session_start ON refresh_tokens;
DROP FUNCTION IF EXISTS refresh_tokens_set_session_start();
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS session_started_at;
