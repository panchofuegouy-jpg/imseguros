-- Migration: Add first_login field to user_profiles table
-- This field will track if a client needs to change their password on first login

-- Add the first_login column to user_profiles table
-- TRUE means the user still needs to change their password (first login)
-- FALSE means the user has already changed their password
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS first_login BOOLEAN DEFAULT TRUE;

-- Set existing admin users to first_login = FALSE since they don't need password change
UPDATE user_profiles 
SET first_login = FALSE 
WHERE role = 'admin';

-- Create an index for better performance on first_login queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_first_login 
ON user_profiles(first_login) 
WHERE first_login = TRUE;
