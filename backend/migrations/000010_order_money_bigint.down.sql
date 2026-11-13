-- //backend/migrations/ 000010_order_money_bigint.down.sql

-- Fails loudly ("integer out of range") if any stored amount no longer fits 32 bits. That is intended.
ALTER TABLE ticket_tiers ALTER COLUMN price_kobo DROP DEFAULT;
ALTER TABLE ticket_tiers ALTER COLUMN price_kobo TYPE integer;
ALTER TABLE ticket_tiers ALTER COLUMN price_kobo SET DEFAULT 0;

ALTER TABLE payments
    ALTER COLUMN amount_paid TYPE integer,
    ALTER COLUMN fees_paid   TYPE integer;

ALTER TABLE order_items
    ALTER COLUMN unit_price TYPE integer,
    ALTER COLUMN subtotal   TYPE integer;

ALTER TABLE orders
    ALTER COLUMN subtotal    TYPE integer,
    ALTER COLUMN service_fee TYPE integer,
    ALTER COLUMN vat_amount  TYPE integer,
    ALTER COLUMN final_total TYPE integer,
    ALTER COLUMN amount_paid TYPE integer;