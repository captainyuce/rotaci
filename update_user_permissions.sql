-- Update users table to add default permissions for managers
UPDATE users 
SET permissions = ARRAY[
    'view',
    'create_shipments',
    'edit_shipments',
    'delete_shipments',
    'assign_vehicles',
    'manage_addresses',
    'manage_vehicles'
]::text[]
WHERE role = 'manager' AND (permissions IS NULL OR permissions = '{}');

-- For admin users, give all permissions
UPDATE users 
SET permissions = ARRAY[
    'view',
    'create_shipments',
    'edit_shipments',
    'delete_shipments',
    'assign_vehicles',
    'manage_addresses',
    'manage_users',
    'manage_vehicles',
    'view_logs'
]::text[]
WHERE username = 'admin' OR role = 'admin';
