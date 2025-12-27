-- Create shipment_logs table for audit trail
CREATE TABLE IF NOT EXISTS shipment_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  shipment_data JSONB,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_shipment_logs_created_at ON shipment_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipment_logs_shipment_id ON shipment_logs(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_logs_action ON shipment_logs(action);

-- Disable RLS for simplicity
ALTER TABLE shipment_logs DISABLE ROW LEVEL SECURITY;
