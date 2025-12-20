-- Add created_by column to shipments table
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Update existing shipments to have a default creator if needed (optional)
-- UPDATE shipments SET created_by = 'SOME_USER_ID' WHERE created_by IS NULL;
