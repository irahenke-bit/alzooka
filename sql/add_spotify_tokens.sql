-- Add Spotify OAuth tokens to users table
-- Run this in your Supabase SQL Editor

-- Spotify access token (short-lived, ~1 hour)
ALTER TABLE users ADD COLUMN IF NOT EXISTS spotify_access_token TEXT;

-- Spotify refresh token (long-lived, used to get new access tokens)
ALTER TABLE users ADD COLUMN IF NOT EXISTS spotify_refresh_token TEXT;

-- When the access token expires
ALTER TABLE users ADD COLUMN IF NOT EXISTS spotify_token_expires_at TIMESTAMP WITH TIME ZONE;

-- Spotify user ID (for reference)
ALTER TABLE users ADD COLUMN IF NOT EXISTS spotify_user_id TEXT;

