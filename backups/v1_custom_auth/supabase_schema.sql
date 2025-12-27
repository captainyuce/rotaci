-- Drop existing tables if they exist to start fresh
DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS users;

-- Users Table (for Managers)
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- In a real app, hash this!
  full_name TEXT,
  role TEXT DEFAULT 'manager', -- 'manager'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicles Table (for Drivers)
CREATE TABLE vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plate TEXT UNIQUE NOT NULL,
  driver_name TEXT,
  capacity INTEGER NOT NULL, -- in kg
  current_load INTEGER DEFAULT 0,
  status TEXT DEFAULT 'idle', -- 'idle', 'moving', 'returning'
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Shipments Table
CREATE TABLE shipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  delivery_address TEXT,
  delivery_lat DOUBLE PRECISION,
  delivery_lng DOUBLE PRECISION,
  weight INTEGER NOT NULL, -- in kg
  delivery_time TEXT, -- e.g. "14:00"
  notes TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'assigned', 'delivered', 'failed'
  assigned_vehicle_id UUID REFERENCES vehicles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Default Manager
INSERT INTO users (username, password, full_name, role)
VALUES ('admin', '123456', 'Depo Sorumlusu', 'manager');

-- Insert Default Vehicles
INSERT INTO vehicles (plate, driver_name, capacity, current_lat, current_lng)
VALUES 
('34 KL 1234', 'Ahmet Yılmaz', 1500, 41.0082, 28.9784),
('34 AB 5678', 'Mehmet Demir', 1300, 41.0082, 28.9784),
('34 CD 9012', 'Ayşe Kaya', 1400, 41.0082, 28.9784);
