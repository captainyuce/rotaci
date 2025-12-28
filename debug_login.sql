-- Debug Login Function
-- Run this and check the "Results" tab carefully.

-- 1. Check if the user exists and what the password hash looks like
SELECT id, username, password FROM public.users WHERE username = 'admin';

-- 2. Test the verification function with the correct password
-- This MUST return {"success": true, ...}
SELECT public.verify_login('admin', '123456') as test_result;

-- 3. If the above returns success: false, let's try to manually verify
SELECT 
  username, 
  password as stored_hash, 
  crypt('123456', password) as calculated_hash,
  (password = crypt('123456', password)) as match_result
FROM public.users 
WHERE username = 'admin';
