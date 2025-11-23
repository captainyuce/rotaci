-- Add permissions column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT ARRAY['view'];

-- Update existing manager users with full permissions
UPDATE users SET permissions = ARRAY['view', 'manage_shipments', 'assign_vehicles', 'manage_addresses', 'manage_users', 'manage_vehicles']
WHERE role = 'manager' AND permissions IS NULL;

-- Update existing driver users with view-only permission
UPDATE users SET permissions = ARRAY['view']
WHERE role = 'driver' AND permissions IS NULL;

-- Create sample users with different roles
INSERT INTO users (username, password, role, full_name, permissions) VALUES
('admin', '123', 'manager', 'Admin Kullanıcı', ARRAY['view', 'manage_shipments', 'assign_vehicles', 'manage_addresses', 'manage_users', 'manage_vehicles']),
('dispatcher', '123', 'manager', 'Atama Sorumlusu', ARRAY['view', 'assign_vehicles']),
('viewer', '123', 'manager', 'Görüntüleyici', ARRAY['view'])
ON CONFLICT (username) DO NOTHING;
