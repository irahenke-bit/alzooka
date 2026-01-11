-- Create coin collector game saves table
CREATE TABLE IF NOT EXISTS coin_collector_saves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  coins BIGINT DEFAULT 0,
  total_coins_earned BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  coins_per_click INTEGER DEFAULT 1,
  coins_per_second NUMERIC DEFAULT 0,
  rebirth_count INTEGER DEFAULT 0,
  rebirth_bonus NUMERIC DEFAULT 1.0,
  -- Upgrades owned (JSON object with upgrade_id -> quantity)
  upgrades JSONB DEFAULT '{}'::jsonb,
  -- Collectors owned (JSON object with collector_id -> quantity)
  collectors JSONB DEFAULT '{}'::jsonb,
  -- Current president coin (changes with each rebirth)
  current_president INTEGER DEFAULT 1,
  -- Stats
  highest_coins BIGINT DEFAULT 0,
  total_rebirths INTEGER DEFAULT 0,
  play_time_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_coin_collector_user_id ON coin_collector_saves(user_id);

-- Enable RLS
ALTER TABLE coin_collector_saves ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own saves
CREATE POLICY "Users can view own save" ON coin_collector_saves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own save" ON coin_collector_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own save" ON coin_collector_saves
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_coin_collector_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS coin_collector_updated_at ON coin_collector_saves;
CREATE TRIGGER coin_collector_updated_at
  BEFORE UPDATE ON coin_collector_saves
  FOR EACH ROW
  EXECUTE FUNCTION update_coin_collector_updated_at();
