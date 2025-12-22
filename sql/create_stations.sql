-- Create stations (Alzooka FM) tables
-- Run this in your Supabase SQL Editor

-- Stations table (like groups but for music)
CREATE TABLE IF NOT EXISTS stations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Each user can only have one station for now
  UNIQUE(owner_id)
);

-- Station albums - Spotify albums/tracks added to a station
CREATE TABLE IF NOT EXISTS station_albums (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Spotify data
  spotify_uri TEXT NOT NULL,
  spotify_type TEXT NOT NULL CHECK (spotify_type IN ('album', 'track', 'playlist')),
  spotify_name TEXT NOT NULL,
  spotify_artist TEXT,
  spotify_image_url TEXT,
  spotify_url TEXT NOT NULL,
  
  -- Selection state
  is_selected BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate albums in same station
  UNIQUE(station_id, spotify_uri)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS station_albums_station_id_idx ON station_albums(station_id);
CREATE INDEX IF NOT EXISTS station_albums_is_selected_idx ON station_albums(station_id, is_selected);
CREATE INDEX IF NOT EXISTS stations_owner_id_idx ON stations(owner_id);

-- Enable Row Level Security
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_albums ENABLE ROW LEVEL SECURITY;

-- Policies for stations
CREATE POLICY "Anyone can view stations" ON stations
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own station" ON stations
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own station" ON stations
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own station" ON stations
  FOR DELETE USING (auth.uid() = owner_id);

-- Policies for station_albums
CREATE POLICY "Anyone can view station albums" ON station_albums
  FOR SELECT USING (true);

CREATE POLICY "Station owner can insert albums" ON station_albums
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    auth.uid() = (SELECT owner_id FROM stations WHERE id = station_id)
  );

CREATE POLICY "Station owner can update albums" ON station_albums
  FOR UPDATE USING (
    auth.uid() = (SELECT owner_id FROM stations WHERE id = station_id)
  );

CREATE POLICY "Station owner can delete albums" ON station_albums
  FOR DELETE USING (
    auth.uid() = (SELECT owner_id FROM stations WHERE id = station_id)
  );

