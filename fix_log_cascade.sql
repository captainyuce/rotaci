-- Fix shipment_logs cascade deletion issue
-- Run this in Supabase SQL Editor

-- Drop the existing foreign key constraint with CASCADE
ALTER TABLE shipment_logs 
DROP CONSTRAINT IF EXISTS shipment_logs_shipment_id_fkey;

-- Add the foreign key back with SET NULL instead of CASCADE
-- This way, when a shipment is deleted, the log remains but shipment_id becomes null
ALTER TABLE shipment_logs
ADD CONSTRAINT shipment_logs_shipment_id_fkey 
FOREIGN KEY (shipment_id) 
REFERENCES shipments(id) 
ON DELETE SET NULL;

-- Verify the constraint
SELECT 
    conname AS constraint_name,
    confdeltype AS delete_action
FROM pg_constraint
WHERE conname = 'shipment_logs_shipment_id_fkey';
