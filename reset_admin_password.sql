-- Reset Admin Password to '123456' (Hashed)
-- This ensures we have a known valid hash in the database

UPDATE public.users
SET password = crypt('123456', gen_salt('bf'))
WHERE username = 'admin';

-- Check if passwords are hashed correctly
-- This query returns the username and whether the password looks like a hash
SELECT 
  username, 
  (password LIKE '$2a$%') as is_hashed, 
  substring(password from 1 for 10) as password_prefix
FROM public.users;
