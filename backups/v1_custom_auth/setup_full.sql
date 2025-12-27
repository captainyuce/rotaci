-- 1. Clean up existing tables (to start fresh)
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. Create Users Table (for Managers)
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'manager',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Vehicles Table (for Drivers)
CREATE TABLE vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plate TEXT UNIQUE NOT NULL,
  driver_name TEXT,
  capacity INTEGER NOT NULL,
  current_load INTEGER DEFAULT 0,
  status TEXT DEFAULT 'idle',
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Shipments Table
CREATE TABLE shipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  delivery_address TEXT,
  delivery_lat DOUBLE PRECISION,
  delivery_lng DOUBLE PRECISION,
  weight INTEGER NOT NULL,
  delivery_time TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  assigned_vehicle_id UUID REFERENCES vehicles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Disable RLS (Row Level Security) for easy access
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipments DISABLE ROW LEVEL SECURITY;

-- 6. Insert Default Manager
INSERT INTO users (username, password, full_name, role)
VALUES ('admin', '123456', 'Depo Sorumlusu', 'manager');

-- 7. Insert Default Vehicles
INSERT INTO vehicles (plate, driver_name, capacity, current_lat, current_lng)
VALUES 
('34 KL 1234', 'Ahmet Yılmaz', 1500, 41.0082, 28.9784),
('34 AB 5678', 'Mehmet Demir', 1300, 41.0082, 28.9784),
('34 CD 9012', 'Ayşe Kaya', 1400, 41.0082, 28.9784);

-- 8. Insert Sample Shipments
INSERT INTO shipments (customer_name, delivery_address, weight, delivery_lat, delivery_lng, status)
VALUES 
('Market A', 'Kadıköy Merkez', 200, 40.990, 29.020, 'pending'),
('Teknoloji B', 'Beşiktaş Çarşı', 50, 41.042, 29.007, 'pending');
