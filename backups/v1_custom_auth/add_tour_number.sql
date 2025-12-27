-- Add tour_number column to shipments table
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS tour_number INTEGER DEFAULT 1;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_shipments_tour ON shipments(assigned_vehicle_id, delivery_date, tour_number);

-- Update existing shipments to have tour_number = 1
UPDATE shipments 
SET tour_number = 1 
WHERE tour_number IS NULL;
