-- Add Missing Columns to Supabase Database
-- Run this in Supabase SQL Editor

-- 1. Add push_subscription to vehicles table (for push notifications)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS push_subscription JSONB;

-- 2. Add driver_password to vehicles table (for driver login)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS driver_password TEXT;

-- 3. Add delivery_date to shipments table (for calendar feature)
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delivery_date DATE DEFAULT CURRENT_DATE;

-- Verify columns were added
SELECT 
    'vehicles.push_subscription' as column_check,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'push_subscription'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT 
    'vehicles.driver_password',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'driver_password'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 
    'shipments.delivery_date',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'delivery_date'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END;
