-- Drop the check constraint on the action column to allow new action types
ALTER TABLE shipment_logs DROP CONSTRAINT IF EXISTS shipment_logs_action_check;

-- Add a new check constraint that includes 'unauthorized_access' (optional, or just leave it open)
-- For flexibility, we will just drop the constraint, but if you want to enforce it:
-- ALTER TABLE shipment_logs ADD CONSTRAINT shipment_logs_action_check 
-- CHECK (action IN ('created', 'updated', 'deleted', 'assigned', 'acknowledged', 'delivered', 'failed', 'unauthorized_access'));
