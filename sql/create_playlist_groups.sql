-- Add playlists to groups (same groups as albums)

CREATE TABLE IF NOT EXISTS station_playlist_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES station_playlists(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES station_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(playlist_id, group_id)
);

CREATE INDEX IF NOT EXISTS station_playlist_groups_playlist_id_idx ON station_playlist_groups(playlist_id);
CREATE INDEX IF NOT EXISTS station_playlist_groups_group_id_idx ON station_playlist_groups(group_id);

ALTER TABLE station_playlist_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view playlist groups" ON station_playlist_groups
  FOR SELECT USING (true);

CREATE POLICY "Station owner can manage playlist groups" ON station_playlist_groups
  FOR ALL USING (
    auth.uid() = (
      SELECT s.owner_id FROM stations s
      JOIN station_playlists sp ON sp.station_id = s.id
      WHERE sp.id = playlist_id
    )
  );

