-- Add assigned_user_id to shipments table
-- This allows assigning shipments to workers (Foot Shipment / Ayaklı Sevkiyat)

ALTER TABLE public.shipments
ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES public.users(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_shipments_assigned_user_id ON public.shipments(assigned_user_id);
