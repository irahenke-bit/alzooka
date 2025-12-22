-- Create station playlists tables

-- Playlists table
CREATE TABLE IF NOT EXISTS station_playlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cover_image_url TEXT, -- Album cover of first track
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Playlist tracks (junction table)
CREATE TABLE IF NOT EXISTS station_playlist_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES station_playlists(id) ON DELETE CASCADE,
  spotify_uri TEXT NOT NULL,
  spotify_name TEXT NOT NULL,
  spotify_artist TEXT,
  spotify_image_url TEXT, -- Album cover
  track_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Each track can only be in a playlist once
  UNIQUE(playlist_id, spotify_uri)
);

-- Indexes
CREATE INDEX IF NOT EXISTS station_playlists_station_id_idx ON station_playlists(station_id);
CREATE INDEX IF NOT EXISTS station_playlist_tracks_playlist_id_idx ON station_playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS station_playlist_tracks_order_idx ON station_playlist_tracks(playlist_id, track_order);

-- Enable RLS
ALTER TABLE station_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_playlist_tracks ENABLE ROW LEVEL SECURITY;

-- Policies for station_playlists
CREATE POLICY "Anyone can view station playlists" ON station_playlists
  FOR SELECT USING (true);

CREATE POLICY "Station owner can create playlists" ON station_playlists
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT owner_id FROM stations WHERE id = station_id)
  );

CREATE POLICY "Station owner can update playlists" ON station_playlists
  FOR UPDATE USING (
    auth.uid() = (SELECT owner_id FROM stations WHERE id = station_id)
  );

CREATE POLICY "Station owner can delete playlists" ON station_playlists
  FOR DELETE USING (
    auth.uid() = (SELECT owner_id FROM stations WHERE id = station_id)
  );

-- Policies for station_playlist_tracks
CREATE POLICY "Anyone can view playlist tracks" ON station_playlist_tracks
  FOR SELECT USING (true);

CREATE POLICY "Station owner can add tracks to playlists" ON station_playlist_tracks
  FOR INSERT WITH CHECK (
    auth.uid() = (
      SELECT s.owner_id FROM stations s
      JOIN station_playlists sp ON sp.station_id = s.id
      WHERE sp.id = playlist_id
    )
  );

CREATE POLICY "Station owner can remove tracks from playlists" ON station_playlist_tracks
  FOR DELETE USING (
    auth.uid() = (
      SELECT s.owner_id FROM stations s
      JOIN station_playlists sp ON sp.station_id = s.id
      WHERE sp.id = playlist_id
    )
  );

