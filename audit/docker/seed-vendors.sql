-- audit/docker/seed-vendors.sql
-- Self-contained seed script for local audit and load testing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO users (id, name, email, password_hash, role)
VALUES ('12700232-f8db-495d-a0dd-563b66dc3a18', 'Audit Vendor 1', 'audit_vendor@example.com', crypt('audit_vendor_secure_password_1', gen_salt('bf', 10)), 'vendor')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role;

INSERT INTO users (id, name, email, password_hash, role)
VALUES ('aa86b014-6682-4fdb-91eb-e5e4aacee93d', 'Audit Vendor 2', 'audit_vendor2@example.com', crypt('audit_vendor_secure_password_2', gen_salt('bf', 10)), 'vendor')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role;

INSERT INTO vendors (id, owner_id, name, category, image_url, status, state, city, phone_number, first_name, last_name, description, email)
SELECT 'd8314ba8-0000-0000-0000-000000000001', u.id, 'Audit Vendor Store 1', 'Catering', 'https://example.com/image1.jpg', 'active',
       'Lagos', 'Ikeja', '+2348000000001', 'Audit', 'Vendor1', 'Primary audit test vendor account', 'audit_vendor@example.com'
FROM users u WHERE u.email = 'audit_vendor@example.com'
ON CONFLICT DO NOTHING;

INSERT INTO vendors (id, owner_id, name, category, image_url, status, state, city, phone_number, first_name, last_name, description, email)
SELECT 'd8314ba8-0000-0000-0000-000000000002', u.id, 'Audit Vendor Store 2', 'Photography', 'https://example.com/image2.jpg', 'active',
       'Lagos', 'Lagos Island', '+2348000000002', 'Audit', 'Vendor2', 'Secondary audit test vendor account', 'audit_vendor2@example.com'
FROM users u WHERE u.email = 'audit_vendor2@example.com'
ON CONFLICT DO NOTHING;