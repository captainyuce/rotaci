-- Add bridge_preference column to vehicles table
-- Run this in Supabase SQL Editor

ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS bridge_preference TEXT DEFAULT 'any';

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicles' AND column_name = 'bridge_preference';
