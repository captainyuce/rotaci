-- Fix shipment_logs table schema
-- Run this in Supabase SQL Editor

-- Add missing JSONB columns for rich log data
ALTER TABLE shipment_logs 
ADD COLUMN IF NOT EXISTS shipment_data JSONB,
ADD COLUMN IF NOT EXISTS changes JSONB;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'shipment_logs';
