-- Add push_subscription column to vehicles table for Web Push notifications

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS push_subscription JSONB;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicles' AND column_name = 'push_subscription';
