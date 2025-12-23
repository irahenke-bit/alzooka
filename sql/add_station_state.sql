-- Add station state persistence columns
-- This allows users to pick up where they left off across devices

-- Selected albums and playlists (stored as JSON arrays of IDs)
ALTER TABLE stations ADD COLUMN IF NOT EXISTS selected_album_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS selected_playlist_ids JSONB DEFAULT '[]'::jsonb;

-- Last playing track info
ALTER TABLE stations ADD COLUMN IF NOT EXISTS last_track_uri TEXT;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS last_track_position INT DEFAULT 0;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS last_track_name TEXT;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS last_track_artist TEXT;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS last_track_image TEXT;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS last_track_album_name TEXT;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS last_track_playlist_name TEXT;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS last_track_duration INT DEFAULT 0;

-- Timestamp for when state was last saved
ALTER TABLE stations ADD COLUMN IF NOT EXISTS state_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

