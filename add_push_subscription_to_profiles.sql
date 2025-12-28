-- Add push_subscription column to profiles table
-- This stores the Web Push subscription JSON for managers and workers

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS push_subscription jsonb;

-- Ensure RLS allows users to update their own subscription
-- (Existing policies usually allow update based on ID, but let's verify if needed)
-- Usually: create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
