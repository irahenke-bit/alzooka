-- Add feed control preferences to users table
-- Run this in your Supabase SQL Editor

-- Feed control: show posts from all profiles or just friends
ALTER TABLE users ADD COLUMN IF NOT EXISTS feed_show_all_profiles BOOLEAN DEFAULT true;

-- Feed control: show posts from all groups or just followed groups
ALTER TABLE users ADD COLUMN IF NOT EXISTS feed_show_all_groups BOOLEAN DEFAULT true;

-- Wall post visibility: whether the wall post appears in feeds or only on the wall
ALTER TABLE posts ADD COLUMN IF NOT EXISTS show_in_feed BOOLEAN DEFAULT true;

-- Create index for efficient feed filtering
CREATE INDEX IF NOT EXISTS posts_show_in_feed_idx ON posts(show_in_feed) WHERE show_in_feed = true;

