-- Create table to store optimized routes
CREATE TABLE IF NOT EXISTS vehicle_routes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    route_geometry JSONB NOT NULL, -- Array of [lat, lng] coordinates
    total_distance NUMERIC,
    total_duration NUMERIC,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vehicle_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vehicle_routes_vehicle_id ON vehicle_routes(vehicle_id);
