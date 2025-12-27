-- Add preparation status columns to shipments table
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS preparation_status TEXT DEFAULT 'pending', -- 'pending', 'ready'
ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS prepared_by_name TEXT; -- Stores the name of the worker who prepared it

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_shipments_preparation_status ON shipments(preparation_status);
