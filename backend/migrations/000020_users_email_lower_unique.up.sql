-- F416: emails that differ only in letter case were separate accounts. The code now lower-cases emails; this makes the
-- database itself refuse a second account whose email matches an existing one in any letter case.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users GROUP BY lower(email) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'users holds emails that differ only by letter case: merge or remove those accounts first';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));
