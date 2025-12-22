-- Create station groups (album tagging/categorization)
-- Run this in your Supabase SQL Editor

-- Station groups table (Jazz, Country, Rock, etc.)
CREATE TABLE IF NOT EXISTS station_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#1DB954',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique group names per station
  UNIQUE(station_id, name)
);

-- Junction table: which albums belong to which groups
CREATE TABLE IF NOT EXISTS station_album_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID NOT NULL REFERENCES station_albums(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES station_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Each album can only be in a group once
  UNIQUE(album_id, group_id)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS station_groups_station_id_idx ON station_groups(station_id);
CREATE INDEX IF NOT EXISTS station_album_groups_album_id_idx ON station_album_groups(album_id);
CREATE INDEX IF NOT EXISTS station_album_groups_group_id_idx ON station_album_groups(group_id);

-- Enable Row Level Security
ALTER TABLE station_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_album_groups ENABLE ROW LEVEL SECURITY;

-- Policies for station_groups
CREATE POLICY "Anyone can view station groups" ON station_groups
  FOR SELECT USING (true);

CREATE POLICY "Station owner can create groups" ON station_groups
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT owner_id FROM stations WHERE id = station_id)
  );

CREATE POLICY "Station owner can update groups" ON station_groups
  FOR UPDATE USING (
    auth.uid() = (SELECT owner_id FROM stations WHERE id = station_id)
  );

CREATE POLICY "Station owner can delete groups" ON station_groups
  FOR DELETE USING (
    auth.uid() = (SELECT owner_id FROM stations WHERE id = station_id)
  );

-- Policies for station_album_groups
CREATE POLICY "Anyone can view album groups" ON station_album_groups
  FOR SELECT USING (true);

CREATE POLICY "Station owner can assign albums to groups" ON station_album_groups
  FOR INSERT WITH CHECK (
    auth.uid() = (
      SELECT s.owner_id FROM stations s
      JOIN station_albums sa ON sa.station_id = s.id
      WHERE sa.id = album_id
    )
  );

CREATE POLICY "Station owner can remove albums from groups" ON station_album_groups
  FOR DELETE USING (
    auth.uid() = (
      SELECT s.owner_id FROM stations s
      JOIN station_albums sa ON sa.station_id = s.id
      WHERE sa.id = album_id
    )
  );

