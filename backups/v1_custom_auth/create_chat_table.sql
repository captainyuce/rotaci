-- Create manager_messages table
CREATE TABLE IF NOT EXISTS manager_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE manager_messages ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Allow all authenticated users to read messages (managers/admins)
CREATE POLICY "Allow authenticated read" ON manager_messages
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert messages
CREATE POLICY "Allow authenticated insert" ON manager_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON manager_messages TO authenticated;
GRANT ALL ON manager_messages TO service_role;
