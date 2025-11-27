-- Fix messages table schema to match code
-- Run this in Supabase SQL Editor

-- Rename columns to match what the code is sending
ALTER TABLE messages 
RENAME COLUMN sender_id TO user_id;

ALTER TABLE messages 
RENAME COLUMN sender_name TO user_name;

ALTER TABLE messages 
RENAME COLUMN sender_role TO user_role;

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages';
