-- 1. Disable RLS on tables to allow public access (Simplest fix for this demo)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipments DISABLE ROW LEVEL SECURITY;

-- 2. Ensure the admin user exists (in case it wasn't created)
INSERT INTO users (username, password, full_name, role)
VALUES ('admin', '123456', 'Depo Sorumlusu', 'manager')
ON CONFLICT (username) DO NOTHING;

-- 3. Ensure vehicles exist
INSERT INTO vehicles (plate, driver_name, capacity, current_lat, current_lng)
VALUES 
('34 KL 1234', 'Ahmet Yılmaz', 1500, 41.0082, 28.9784),
('34 AB 5678', 'Mehmet Demir', 1300, 41.0082, 28.9784),
('34 CD 9012', 'Ayşe Kaya', 1400, 41.0082, 28.9784)
ON CONFLICT (plate) DO NOTHING;
