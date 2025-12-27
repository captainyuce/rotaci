-- Add working hours to addresses
ALTER TABLE addresses 
ADD COLUMN IF NOT EXISTS opening_time TIME,
ADD COLUMN IF NOT EXISTS closing_time TIME;

-- Add working hours to shipments
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS opening_time TIME,
ADD COLUMN IF NOT EXISTS closing_time TIME;
