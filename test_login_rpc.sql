-- Test verify_login RPC directly
-- This helps us see if the function works inside the database

-- 1. Test with correct credentials
SELECT public.verify_login('admin', '123456') as result_correct;

-- 2. Test with wrong password
SELECT public.verify_login('admin', 'wrongpass') as result_wrong;

-- 3. Check the stored hash again manually
SELECT username, password FROM public.users WHERE username = 'admin';
