-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Add delivery_order and acknowledged_at to shipments if they don't exist
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delivery_order INTEGER;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

-- Insert default base address if not exists
INSERT INTO settings (key, value)
VALUES ('base_address', '{"address": "Merkez Depo", "lat": 41.0082, "lng": 28.9784}')
ON CONFLICT (key) DO NOTHING;
