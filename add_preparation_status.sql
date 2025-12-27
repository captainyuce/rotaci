-- Add preparation status columns to shipments table
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS preparation_status TEXT DEFAULT 'pending', -- 'pending', 'ready'
ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_shipments_preparation_status ON shipments(preparation_status);
