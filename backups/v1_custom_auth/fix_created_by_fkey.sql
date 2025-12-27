-- 1. Remove the incorrect foreign key constraint
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_created_by_fkey;

-- 2. Add the correct foreign key constraint referencing public.users
ALTER TABLE shipments 
ADD CONSTRAINT shipments_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES users(id);

-- 3. (Optional) Set a default creator for existing shipments if you want
-- UPDATE shipments SET created_by = (SELECT id FROM users LIMIT 1) WHERE created_by IS NULL;
