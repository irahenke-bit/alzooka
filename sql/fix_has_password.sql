-- Fix has_password field for existing users
-- This updates users who have a password but has_password is false or null

-- Users who signed up with email/password have an identity with provider = 'email'
-- We can check auth.identities to find users with email provider and update their has_password flag

-- First, let's update users who have an email identity (meaning they have a password)
UPDATE public.users
SET has_password = true
WHERE id IN (
  SELECT DISTINCT user_id 
  FROM auth.identities 
  WHERE provider = 'email'
)
AND (has_password = false OR has_password IS NULL);

-- Show how many users were updated
-- SELECT COUNT(*) as updated_users FROM public.users WHERE has_password = true;

