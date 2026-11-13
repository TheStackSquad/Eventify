-- // backend/migrations/ 000010_order_money_bigint.up.sql

-- F218: order money is kept in kobo. 32-bit integers stop at 21,474,836.47 naira, which a ten-ticket VIP order can pass.
-- paystack_fee and app_profit are already bigint. Each ALTER TABLE rewrites its table once.
ALTER TABLE orders
    ALTER COLUMN subtotal    TYPE bigint,
    ALTER COLUMN service_fee TYPE bigint,
    ALTER COLUMN vat_amount  TYPE bigint,
    ALTER COLUMN final_total TYPE bigint,
    ALTER COLUMN amount_paid TYPE bigint;

ALTER TABLE order_items
    ALTER COLUMN unit_price TYPE bigint,
    ALTER COLUMN subtotal   TYPE bigint;

ALTER TABLE payments
    ALTER COLUMN amount_paid TYPE bigint,
    ALTER COLUMN fees_paid   TYPE bigint;

-- price_kobo had a numeric default (0.00) on an integer column: replace it with a plain 0.
ALTER TABLE ticket_tiers ALTER COLUMN price_kobo DROP DEFAULT;
ALTER TABLE ticket_tiers ALTER COLUMN price_kobo TYPE bigint;
ALTER TABLE ticket_tiers ALTER COLUMN price_kobo SET DEFAULT 0;