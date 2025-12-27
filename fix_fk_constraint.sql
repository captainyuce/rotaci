-- Remove the foreign key constraint referencing auth.users
ALTER TABLE shipments 
DROP CONSTRAINT IF EXISTS shipments_prepared_by_user_id_fkey;

-- Optionally, add a constraint referencing public.users instead, or leave it unconstrained for flexibility
-- For now, we will leave it unconstrained to ensure the operation succeeds regardless of where the user record lives
-- ALTER TABLE shipments ADD CONSTRAINT shipments_prepared_by_user_id_fkey FOREIGN KEY (prepared_by_user_id) REFERENCES public.users(id);
