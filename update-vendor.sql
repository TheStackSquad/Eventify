BEGIN;

-- 1. Ensure the user exists and has the vendor role
INSERT INTO users (name, email, password_hash, role)
VALUES ('Audit Vendor One', 'audit_vendor@example.com', 'dummy_hash', 'vendor')
ON CONFLICT (email) DO UPDATE SET role = 'vendor';

-- 2. Insert the vendor record linked to the user
INSERT INTO vendors (owner_id, name, category, image_url, state, city, phone_number, first_name, last_name, description, email)
SELECT id, 'Audit Vendor One', 'audit', 'https://example.com/audit.png', 'Lagos', 'Lagos', '08000000000', 'Audit', 'Vendor', 'Audit test vendor', email
FROM users WHERE email = 'audit_vendor@example.com'
ON CONFLICT DO NOTHING
RETURNING id, owner_id;

COMMIT;