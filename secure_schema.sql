-- Enable RLS on all tables
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
-- We will migrate 'users' table data to 'auth.users' and 'public.profiles', then drop 'users' or keep it as legacy
-- For now, let's create 'profiles' linked to auth.users

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'worker', -- 'admin', 'manager', 'dispatcher', 'driver', 'worker'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for Profiles
-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins and Managers can view all profiles
CREATE POLICY "Admins and Managers can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Policies for Shipments
-- Authenticated users can read shipments (or restrict based on role)
CREATE POLICY "Authenticated users can view shipments" ON public.shipments
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only Managers, Admins, and Dispatchers can insert/update/delete shipments
CREATE POLICY "Managers and above can manage shipments" ON public.shipments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'dispatcher')
    )
  );
  
-- Workers can update specific fields (e.g. status) - simplified for now to allow update if authenticated
-- Ideally we want granular permissions, but let's start with role-based access
-- For now, let's allow authenticated users to update shipments (needed for workers to mark as ready)
CREATE POLICY "Authenticated users can update shipments" ON public.shipments
  FOR UPDATE USING (auth.role() = 'authenticated');


-- Policies for Vehicles
CREATE POLICY "Authenticated users can view vehicles" ON public.vehicles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Managers and above can manage vehicles" ON public.vehicles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'dispatcher')
    )
  );

-- Function to handle new user signup (optional, but good for auto-profile creation)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', COALESCE(new.raw_user_meta_data->>'role', 'worker'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
