-- Update users table role constraint to include 'subcontractor'

-- First, drop the existing constraint if it exists (naming convention might vary, so we try a few common ones or just generic alter)
-- Note: Supabase/Postgres doesn't support "DROP CONSTRAINT IF EXISTS" easily without knowing the name.
-- We will try to add the constraint. If it fails, it might be because of existing data or constraint name conflict.

-- Ideally, we should find the constraint name. But for now, let's try to just add the check.
-- If there is an existing check, we might need to drop it.
-- Let's try to drop a likely named constraint 'users_role_check'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Now add the updated constraint
ALTER TABLE users ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'manager', 'dispatcher', 'worker', 'driver', 'subcontractor', 'viewer'));

-- If the column is an ENUM type (less likely for this project structure but possible), we would need:
-- ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'subcontractor';
