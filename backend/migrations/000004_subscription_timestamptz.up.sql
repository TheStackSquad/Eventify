-- backend/migrations/000004_subscription_timestamptz.up.sql

   -- Subscription times become absolute instants. Existing values were written by Go as UTC wall-clock,
   -- so they are read as UTC. created_at and updated_at may have been stamped by the database in its own
   -- zone; they are informational only.
   DROP VIEW IF EXISTS v_subscriptions_needing_1d_reminder;
   DROP VIEW IF EXISTS v_subscriptions_needing_3d_reminder;
   DROP VIEW IF EXISTS v_subscriptions_needing_7d_reminder;
   DROP VIEW IF EXISTS v_subscriptions_needing_expired_notice;

   ALTER TABLE subscriptions
       ALTER COLUMN starts_at         TYPE timestamptz USING starts_at         AT TIME ZONE 'UTC',
       ALTER COLUMN expires_at        TYPE timestamptz USING expires_at        AT TIME ZONE 'UTC',
       ALTER COLUMN last_payment_date TYPE timestamptz USING last_payment_date AT TIME ZONE 'UTC',
       ALTER COLUMN next_payment_date TYPE timestamptz USING next_payment_date AT TIME ZONE 'UTC',
       ALTER COLUMN created_at        TYPE timestamptz USING created_at        AT TIME ZONE 'UTC',
       ALTER COLUMN updated_at        TYPE timestamptz USING updated_at        AT TIME ZONE 'UTC';