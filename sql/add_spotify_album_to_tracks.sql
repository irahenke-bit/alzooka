-- Add spotify_album column to station_playlist_tracks
ALTER TABLE station_playlist_tracks ADD COLUMN IF NOT EXISTS spotify_album TEXT;

