-- Create manager_messages table if not exists
CREATE TABLE IF NOT EXISTS manager_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE manager_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated read" ON manager_messages;
DROP POLICY IF EXISTS "Allow authenticated insert" ON manager_messages;

-- Create policies
-- Allow all authenticated users to read messages
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

-- Enable Realtime (Safely)
DO $$
BEGIN
  -- Check if the publication exists (it should in Supabase)
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  -- Add table to publication ONLY if it's not already there
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'manager_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE manager_messages;
  END IF;
END
$$;
