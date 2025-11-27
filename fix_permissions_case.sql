-- Fix User Permissions (Lowercase Mismatch)
-- Run this in Supabase SQL Editor

-- Update admin user with correct lowercase permissions matching src/lib/permissions.js
UPDATE users
SET permissions = ARRAY[
    'view',                -- Required for Dashboard & Calendar
    'create_shipments',    -- Required for Shipments
    'edit_shipments',
    'delete_shipments',
    'assign_vehicles',     -- Required for Assignments
    'manage_vehicles',     -- Required for Vehicles
    'manage_addresses',    -- Required for Addresses
    'manage_users',        -- Required for Users
    'view_logs'            -- Required for Logs
]
WHERE username = 'admin';

-- Verify the update
SELECT username, permissions FROM users WHERE username = 'admin';
