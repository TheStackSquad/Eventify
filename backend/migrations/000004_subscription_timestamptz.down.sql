-- backend/migrations/000004_subscription_timestamptz.down.sql

   ALTER TABLE subscriptions
       ALTER COLUMN starts_at         TYPE timestamp USING starts_at         AT TIME ZONE 'UTC',
       ALTER COLUMN expires_at        TYPE timestamp USING expires_at        AT TIME ZONE 'UTC',
       ALTER COLUMN last_payment_date TYPE timestamp USING last_payment_date AT TIME ZONE 'UTC',
       ALTER COLUMN next_payment_date TYPE timestamp USING next_payment_date AT TIME ZONE 'UTC',
       ALTER COLUMN created_at        TYPE timestamp USING created_at        AT TIME ZONE 'UTC',
       ALTER COLUMN updated_at        TYPE timestamp USING updated_at        AT TIME ZONE 'UTC';