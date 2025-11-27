-- Rotacı Database Setup - Complete Schema
-- Run this in Supabase SQL Editor

-- 1. Create Users Table (for Managers)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'manager',
  permissions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Vehicles Table (for Drivers)
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plate TEXT UNIQUE NOT NULL,
  driver_name TEXT,
  driver_password TEXT,
  capacity INTEGER NOT NULL,
  current_load INTEGER DEFAULT 0,
  status TEXT DEFAULT 'idle',
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  push_subscription JSONB,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Addresses Table
CREATE TABLE IF NOT EXISTS addresses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  category TEXT DEFAULT 'customer',
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Shipments Table
CREATE TABLE IF NOT EXISTS shipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  delivery_address TEXT,
  delivery_lat DOUBLE PRECISION,
  delivery_lng DOUBLE PRECISION,
  weight INTEGER NOT NULL,
  delivery_time TEXT,
  delivery_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  assigned_vehicle_id UUID REFERENCES vehicles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Shipment Logs Table (Audit Trail)
CREATE TABLE IF NOT EXISTS shipment_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  user_id UUID,
  user_name TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create Messages Table (Chat System)
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  sender_id UUID,
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Enable Realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE shipments;
ALTER PUBLICATION supabase_realtime ADD TABLE vehicles;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 8. Disable RLS (for development - enable in production!)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE addresses DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipments DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- 9. Insert Default Manager
INSERT INTO users (username, password, full_name, role, permissions)
VALUES ('admin', '123456', 'Yönetici', 'manager', 
  ARRAY['MANAGE_USERS', 'MANAGE_VEHICLES', 'MANAGE_SHIPMENTS', 'ASSIGN_SHIPMENTS', 'VIEW_LOGS'])
ON CONFLICT (username) DO NOTHING;

-- 10. Insert Default Vehicles with Passwords
INSERT INTO vehicles (plate, driver_name, driver_password, capacity, current_lat, current_lng)
VALUES 
('34 KL 1234', 'Ahmet Yılmaz', '1234', 1500, 41.0082, 28.9784),
('34 AB 5678', 'Mehmet Demir', '1234', 1300, 41.0082, 28.9784),
('34 CD 9012', 'Ayşe Kaya', '1234', 1400, 41.0082, 28.9784)
ON CONFLICT (plate) DO NOTHING;

-- 11. Insert Sample Addresses
INSERT INTO addresses (name, address, lat, lng, category)
VALUES 
('Akalbatu Depo', 'Kadıköy, İstanbul', 40.990, 29.020, 'warehouse'),
('Market A', 'Beşiktaş, İstanbul', 41.042, 29.007, 'customer'),
('Tedarikçi B', 'Şişli, İstanbul', 41.060, 28.985, 'supplier')
ON CONFLICT DO NOTHING;

-- 12. Verification Query
SELECT 
  'users' as table_name, COUNT(*) as records FROM users
UNION ALL
SELECT 'vehicles', COUNT(*) FROM vehicles
UNION ALL
SELECT 'addresses', COUNT(*) FROM addresses
UNION ALL
SELECT 'shipments', COUNT(*) FROM shipments
UNION ALL
SELECT 'shipment_logs', COUNT(*) FROM shipment_logs
UNION ALL
SELECT 'messages', COUNT(*) FROM messages;
