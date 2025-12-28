-- Setup Password Encryption

-- 1. Enable pgcrypto extension for hashing functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Migrate existing plain-text passwords to Bcrypt hashes
-- We check if password starts with $2a$ (Bcrypt prefix) to avoid double-hashing
UPDATE public.users
SET password = crypt(password, gen_salt('bf'))
WHERE password NOT LIKE '$2a$%';

-- 3. Create a secure function to verify login
-- This function allows the client to check password without reading the hash directly
CREATE OR REPLACE FUNCTION public.verify_login(username_input text, password_input text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with admin privileges to read users table
AS $$
DECLARE
  found_user record;
BEGIN
  -- Find the user by username
  SELECT * INTO found_user
  FROM public.users
  WHERE username = username_input;

  -- If user not found, return error
  IF found_user IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Kullanıcı bulunamadı');
  END IF;

  -- Verify password
  IF found_user.password = crypt(password_input, found_user.password) THEN
    -- Return user data (excluding password)
    RETURN json_build_object(
      'success', true,
      'user', json_build_object(
        'id', found_user.id,
        'username', found_user.username,
        'full_name', found_user.full_name,
        'role', found_user.role,
        'permissions', found_user.permissions
      )
    );
  ELSE
    RETURN json_build_object('success', false, 'message', 'Şifre hatalı');
  END IF;
END;
$$;

-- 4. (Optional) Secure the users table so it can't be read directly
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Deny public read" ON public.users FOR SELECT USING (false);
-- NOTE: We will do this step LATER after verifying the RPC works, to avoid locking ourselves out.
