-- Add permissions column to profiles table to support custom user permissions
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS permissions text[];

-- Update RLS policies if needed (usually checking role is enough, but if we check permissions in RLS, we need to update functions)
-- For now, permissions are mostly client-side checks or API side checks.
