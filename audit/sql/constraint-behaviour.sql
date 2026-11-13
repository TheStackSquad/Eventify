-- //audit/sql/constraint-behaviour.sql

-- audit/sql/constraint-behaviour.sql (v2). Do all single-column CHECK constraints of the "= ANY (ARRAY[...])" kind
-- accept and reject the same values? Each is probed on a scratch temp table with its own literals, upper-cased copies,
-- an empty string and 'bogus'. No real data is read or written. Run against two databases and compare the output.
DO $$
DECLARE
  c record; vals text[]; v text; res text;
BEGIN
  FOR c IN
    SELECT k.conrelid::regclass::text AS tbl, k.conname AS con, a.attname AS col, pg_get_constraintdef(k.oid) AS def
    FROM pg_constraint k
    JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
    WHERE k.contype = 'c' AND k.connamespace = 'public'::regnamespace
      AND array_length(k.conkey, 1) = 1 AND pg_get_constraintdef(k.oid) LIKE '%= ANY%'
    ORDER BY 1, 2
  LOOP
    SELECT array_agg(x ORDER BY x) INTO vals FROM (
      SELECT DISTINCT (regexp_matches(c.def, '''([^'']*)''', 'g'))[1] AS x) s;
    SELECT array_agg(y ORDER BY y) INTO vals FROM (
      SELECT unnest(vals) AS y UNION SELECT upper(unnest(vals)) UNION SELECT 'bogus' UNION SELECT '') t;
    EXECUTE format('CREATE TEMP TABLE _probe (%I varchar(255))', c.col);
    EXECUTE 'ALTER TABLE _probe ADD CONSTRAINT _c ' || c.def;
    res := '';
    FOREACH v IN ARRAY vals LOOP
      BEGIN
        EXECUTE format('INSERT INTO _probe VALUES (%L)', v);
        res := res || format('[%s]=ok ', v);
      EXCEPTION WHEN check_violation THEN
        res := res || format('[%s]=no ', v);
      END;
    END LOOP;
    RAISE NOTICE '%.%: %', c.tbl, c.con, res;
    DROP TABLE _probe;
  END LOOP;
END $$;