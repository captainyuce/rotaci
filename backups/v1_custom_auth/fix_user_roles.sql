-- 1. Fix User Roles (Example: Change 'sss' and 'aaa' to manager)
UPDATE users SET role = 'manager' WHERE username IN ('sss', 'aaa');

-- 2. Ensure RLS is DISABLED on ALL tables (Crucial for data recovery)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipments DISABLE ROW LEVEL SECURITY;
ALTER TABLE addresses DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- 3. Verify roles
SELECT username, role FROM users;
