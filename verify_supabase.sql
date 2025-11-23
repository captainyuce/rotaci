-- Supabase Database Verification Script
-- Run this in Supabase SQL Editor to verify all tables and columns

-- 1. Check all tables exist
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Verify critical columns in vehicles table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'vehicles'
ORDER BY ordinal_position;

-- 3. Check if push_subscription column exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'vehicles' AND column_name = 'push_subscription'
        ) THEN '✅ push_subscription EXISTS'
        ELSE '❌ push_subscription MISSING - Run: ALTER TABLE vehicles ADD COLUMN push_subscription JSONB;'
    END as status;

-- 4. Check if driver_password column exists  
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'vehicles' AND column_name = 'driver_password'
        ) THEN '✅ driver_password EXISTS'
        ELSE '❌ driver_password MISSING - Run: ALTER TABLE vehicles ADD COLUMN driver_password TEXT;'
    END as status;

-- 5. Check if delivery_date column exists in shipments
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'shipments' AND column_name = 'delivery_date'
        ) THEN '✅ delivery_date EXISTS'
        ELSE '❌ delivery_date MISSING - Run: ALTER TABLE shipments ADD COLUMN delivery_date DATE;'
    END as status;

-- 6. Verify RLS is enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 7. Count records in each table
SELECT 'users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 'vehicles', COUNT(*) FROM vehicles
UNION ALL
SELECT 'shipments', COUNT(*) FROM shipments
UNION ALL
SELECT 'addresses', COUNT(*) FROM addresses
UNION ALL
SELECT 'shipment_logs', COUNT(*) FROM shipment_logs
UNION ALL
SELECT 'messages', COUNT(*) FROM messages;
