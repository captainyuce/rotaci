-- Add speed column to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS speed FLOAT DEFAULT 0;

-- Add heading/course column (optional but good for map rotation)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS heading FLOAT DEFAULT 0;
