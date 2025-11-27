-- Add acknowledged_at field to shipments table
-- This tracks when a driver acknowledges a new assignment

ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'shipments' 
AND column_name = 'acknowledged_at';
