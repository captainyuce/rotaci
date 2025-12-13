-- Add route_order column to shipments
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS route_order INTEGER DEFAULT 0;
