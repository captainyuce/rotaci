-- Revert Database Changes to restore previous state

-- 1. Disable RLS on tables (Old version didn't use it or it was open)
ALTER TABLE public.vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY; 

-- 2. Drop the strict Foreign Key constraint to auth.users
ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS shipments_created_by_fkey;

-- 3. (Optional) Re-add Foreign Key to public.users if you want strict integrity with the old table
-- But to ensure the app just "works" without errors, we can leave it without strict FK for now.
-- The old app logic handles the relationships.

-- 4. Ensure public.users table is accessible (it should be, we never dropped it)
-- Just in case RLS was enabled on it
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
