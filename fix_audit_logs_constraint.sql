-- Fix foreign key constraint issue in shipment_logs
-- Drop the existing foreign key constraint
ALTER TABLE shipment_logs DROP CONSTRAINT IF EXISTS shipment_logs_shipment_id_fkey;

-- shipment_id is already nullable, so we just remove the constraint
-- This allows us to keep logs even after shipments are deleted
