-- Fix Infinite Recursion in RLS Policies

-- 1. Create a secure function to get the current user's role
-- SECURITY DEFINER allows this function to bypass RLS
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$;

-- 2. Drop the problematic policy
DROP POLICY IF EXISTS "Admins and Managers can view all profiles" ON public.profiles;

-- 3. Re-create the policy using the secure function
CREATE POLICY "Admins and Managers can view all profiles" ON public.profiles
  FOR SELECT USING (
    get_my_role() IN ('admin', 'manager')
  );

-- 4. Update other policies to use this function for better performance/security
-- Shipments
DROP POLICY IF EXISTS "Managers and above can manage shipments" ON public.shipments;
CREATE POLICY "Managers and above can manage shipments" ON public.shipments
  FOR ALL USING (
    get_my_role() IN ('admin', 'manager', 'dispatcher')
  );

-- Vehicles
DROP POLICY IF EXISTS "Managers and above can manage vehicles" ON public.vehicles;
CREATE POLICY "Managers and above can manage vehicles" ON public.vehicles
  FOR ALL USING (
    get_my_role() IN ('admin', 'manager', 'dispatcher')
  );
