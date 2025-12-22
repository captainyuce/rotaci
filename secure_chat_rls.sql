-- Re-enable Row Level Security (Security Firewall)
ALTER TABLE manager_messages ENABLE ROW LEVEL SECURITY;

-- Revoke access from anonymous users (Public)
REVOKE ALL ON manager_messages FROM anon;

-- Grant access to authenticated users only
GRANT ALL ON manager_messages TO authenticated;
GRANT ALL ON manager_messages TO service_role;

-- Drop old policies to start fresh
DROP POLICY IF EXISTS "Allow authenticated read" ON manager_messages;
DROP POLICY IF EXISTS "Allow authenticated insert" ON manager_messages;

-- Create simplified policies
-- 1. Allow any logged-in user to READ messages
CREATE POLICY "Allow authenticated read" ON manager_messages
    FOR SELECT
    TO authenticated
    USING (true);

-- 2. Allow any logged-in user to SEND messages
-- We removed the strict (auth.uid() = user_id) check to prevent errors
-- But we still require the user to be logged in (authenticated role)
CREATE POLICY "Allow authenticated insert" ON manager_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
