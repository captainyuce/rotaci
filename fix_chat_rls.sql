-- Drop the strict insert policy
DROP POLICY IF EXISTS "Allow authenticated insert" ON manager_messages;

-- Create a more permissive insert policy for authenticated users
-- This allows any authenticated user to insert a message
-- We trust the application to send the correct user_id
CREATE POLICY "Allow authenticated insert" ON manager_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Ensure permissions are granted
GRANT ALL ON manager_messages TO authenticated;
GRANT ALL ON manager_messages TO service_role;
