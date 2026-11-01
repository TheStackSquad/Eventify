BEGIN;

-- 1. Create the user in eventify_loadtest if missing
INSERT INTO users (name, email, password_hash, role)
VALUES ('Audit Vendor Two', 'audit_vendor2@example.com', 'dummy_hash', 'vendor')
ON CONFLICT (email) DO UPDATE SET role = 'vendor';

-- 2. Insert the vendor record linked to the user
INSERT INTO vendors (owner_id, name, category, image_url, state, city, phone_number, first_name, last_name, description, email)
SELECT id, 'Audit Vendor Two', 'audit', 'https://example.com/audit2.png', 'Lagos', 'Lagos', '08000000001', 'Audit', 'Two', 'Second audit vendor', email
FROM users WHERE email = 'audit_vendor2@example.com'
ON CONFLICT DO NOTHING
RETURNING id, owner_id;

COMMIT;