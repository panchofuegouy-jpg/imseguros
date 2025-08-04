-- Migration: Add first_login field to user_profiles table
-- Execute this in Supabase SQL Editor

-- Add the first_login column to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS first_login BOOLEAN DEFAULT TRUE;

-- Set existing admin users to first_login = FALSE
UPDATE user_profiles 
SET first_login = FALSE 
WHERE role = 'admin';

-- Set existing client users to first_login = FALSE (they won't be forced to change password)
-- If you want to force existing clients to change password, comment out this line
UPDATE user_profiles 
SET first_login = FALSE 
WHERE role = 'client';

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_first_login 
ON user_profiles(first_login) 
WHERE first_login = TRUE;

-- Verify the column was added
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable, 
    column_default 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
  AND column_name = 'first_login';

-- Check current data
SELECT id, role, first_login, created_at 
FROM user_profiles 
ORDER BY created_at DESC;
