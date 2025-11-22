
-- Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
  id BIGSERIAL PRIMARY KEY,
  plate TEXT NOT NULL,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  current_load INTEGER DEFAULT 0,
  status TEXT DEFAULT 'idle',
  location JSONB,
  route JSONB DEFAULT '[]'::jsonb,
  route_segments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shipments Table
CREATE TABLE IF NOT EXISTS shipments (
  id BIGSERIAL PRIMARY KEY,
  customer TEXT NOT NULL,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  load INTEGER NOT NULL,
  delivery_time TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending', -- pending, assigned, completed, next_day, waiting_approval
  assigned_driver BIGINT REFERENCES vehicles(id),
  submission_time TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Driver Locations Table (for history or real-time)
CREATE TABLE IF NOT EXISTS driver_locations (
  id BIGSERIAL PRIMARY KEY,
  driver_id TEXT NOT NULL,
  location JSONB NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Initial Vehicles (if not exists)
INSERT INTO vehicles (plate, name, capacity, current_load, status, location)
VALUES 
('34 KL 1234', 'Ford Transit', 1500, 0, 'idle', '{"lat": 41.0082, "lng": 28.9784}'),
('34 AB 5678', 'Fiat Ducato', 1300, 0, 'idle', '{"lat": 41.0082, "lng": 28.9784}'),
('34 CD 9012', 'Renault Master', 1400, 0, 'idle', '{"lat": 41.0082, "lng": 28.9784}')
ON CONFLICT DO NOTHING;
