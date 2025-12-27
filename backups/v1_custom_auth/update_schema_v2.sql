-- Add type column to shipments
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'delivery'; -- 'pickup' or 'delivery'
