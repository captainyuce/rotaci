-- Add location_updated_at column to vehicles table if it doesn't exist
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create or replace function to auto-update location_updated_at
CREATE OR REPLACE FUNCTION update_vehicle_location_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update timestamp if lat/lng changed
    IF (NEW.current_lat IS DISTINCT FROM OLD.current_lat) OR 
       (NEW.current_lng IS DISTINCT FROM OLD.current_lng) THEN
        NEW.location_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS vehicle_location_update_trigger ON vehicles;

CREATE TRIGGER vehicle_location_update_trigger
    BEFORE UPDATE ON vehicles
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicle_location_timestamp();

-- Update existing records to have a timestamp
UPDATE vehicles 
SET location_updated_at = NOW() 
WHERE location_updated_at IS NULL;
