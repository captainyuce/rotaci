-- Create messages table for shipment chat
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL, -- 'driver', 'manager', 'warehouse'
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_messages_shipment ON messages(shipment_id, created_at DESC);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages" ON messages;

-- Users can read messages for shipments they have access to
CREATE POLICY "Users can read messages"
ON messages FOR SELECT
USING (
    -- Managers and warehouse staff can read all messages
    EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = auth.uid() 
        AND role IN ('manager', 'warehouse')
    )
    OR
    -- Drivers can read messages for their assigned shipments
    EXISTS (
        SELECT 1 FROM shipments 
        WHERE id = shipment_id 
        AND assigned_vehicle_id = auth.uid()
    )
);

-- Users can insert their own messages
CREATE POLICY "Users can insert messages"
ON messages FOR INSERT
WITH CHECK (auth.uid() = user_id);
