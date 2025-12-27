-- Add driver_password column to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS driver_password TEXT;

-- Set default password for existing vehicles (optional)
UPDATE vehicles SET driver_password = '1234' WHERE driver_password IS NULL;
