-- Add vehicle_type column to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'van';

-- Update existing records if any (optional, defaults to 'van' anyway for new ones but good for existing)
UPDATE vehicles SET vehicle_type = 'van' WHERE vehicle_type IS NULL;
