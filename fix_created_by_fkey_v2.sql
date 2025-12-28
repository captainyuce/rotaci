-- Fix Foreign Key Constraint for created_by (Version 2)
-- This script handles existing data that violates the new constraint

-- 1. Drop the existing constraint if it exists
ALTER TABLE public.shipments
DROP CONSTRAINT IF EXISTS shipments_created_by_fkey;

-- 2. Clean up invalid data
-- Set created_by to NULL for any shipment where the creator ID does not exist in auth.users
-- This prevents the "violates foreign key constraint" error when we add the new constraint
UPDATE public.shipments
SET created_by = NULL
WHERE created_by IS NOT NULL 
AND created_by NOT IN (SELECT id FROM auth.users);

-- 3. Add the constraint pointing to auth.users
ALTER TABLE public.shipments
ADD CONSTRAINT shipments_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES auth.users(id)
ON DELETE SET NULL;
