-- Test query to check if driver logs are being created
-- Run this in Supabase SQL Editor after driver performs an action

SELECT 
    id,
    action,
    user_name,
    created_at,
    shipment_id
FROM shipment_logs
ORDER BY created_at DESC
LIMIT 10;
