-- Add vehicle_type column to vehicles table
-- Run this in Supabase SQL Editor

ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'van';

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicles' AND column_name = 'vehicle_type';
