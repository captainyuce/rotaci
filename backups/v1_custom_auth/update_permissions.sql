-- Add manage_settings permission to all admins and managers
UPDATE users
SET permissions = array_append(permissions, 'manage_settings')
WHERE (role = 'admin' OR role = 'manager')
  AND NOT ('manage_settings' = ANY(permissions));
