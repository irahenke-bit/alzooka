-- Trivia System Tables

-- Questions table
CREATE TABLE IF NOT EXISTS trivia_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'music', -- For now just music, could expand later
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  incorrect_answers TEXT[] NOT NULL, -- Array of 3 wrong answers
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id), -- NULL for imported questions
  is_approved BOOLEAN DEFAULT true, -- For user-submitted questions
  times_played INT DEFAULT 0,
  times_correct INT DEFAULT 0
);

-- Player stats table
CREATE TABLE IF NOT EXISTS trivia_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  rating INT DEFAULT 1200, -- ELO-style rating, start at 1200
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  games_played INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  best_streak INT DEFAULT 0,
  blitz_high_score INT DEFAULT 0, -- Best score in 2-min blitz
  hide_stats BOOLEAN DEFAULT true, -- Hidden by default
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Games/Matches table
CREATE TABLE IF NOT EXISTS trivia_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL CHECK (mode IN ('blitz', 'five_second')),
  player1_id UUID REFERENCES users(id) ON DELETE CASCADE,
  player2_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for solo practice
  player1_score INT,
  player2_score INT,
  player1_rating_before INT,
  player2_rating_before INT,
  player1_rating_after INT,
  player2_rating_after INT,
  winner_id UUID REFERENCES users(id),
  question_ids UUID[], -- Array of question IDs used
  player1_answers JSONB, -- {question_id: {answer: string, correct: bool, time_ms: int}}
  player2_answers JSONB,
  player1_allow_sharing BOOLEAN DEFAULT false,
  player2_allow_sharing BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'player1_done', 'player2_done', 'completed', 'expired', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

-- Challenges table (for pending challenges)
CREATE TABLE IF NOT EXISTS trivia_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID REFERENCES users(id) ON DELETE CASCADE,
  challenged_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('blitz', 'five_second')),
  challenger_allow_sharing BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  game_id UUID REFERENCES trivia_games(id), -- Set when accepted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

-- RLS Policies
ALTER TABLE trivia_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trivia_player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE trivia_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE trivia_challenges ENABLE ROW LEVEL SECURITY;

-- Questions: Anyone can read approved questions
CREATE POLICY "Anyone can read approved questions" ON trivia_questions
  FOR SELECT USING (is_approved = true);

-- Player stats: Anyone can read, only owner can update
CREATE POLICY "Anyone can read player stats" ON trivia_player_stats
  FOR SELECT USING (true);

CREATE POLICY "Users can update own stats" ON trivia_player_stats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stats" ON trivia_player_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Games: Participants can read/update their games
CREATE POLICY "Participants can read games" ON trivia_games
  FOR SELECT USING (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Participants can update games" ON trivia_games
  FOR UPDATE USING (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Authenticated users can create games" ON trivia_games
  FOR INSERT WITH CHECK (auth.uid() = player1_id);

-- Challenges: Participants can read, challenger can create
CREATE POLICY "Participants can read challenges" ON trivia_challenges
  FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

CREATE POLICY "Users can create challenges" ON trivia_challenges
  FOR INSERT WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Challenged user can update challenge" ON trivia_challenges
  FOR UPDATE USING (auth.uid() = challenged_id OR auth.uid() = challenger_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trivia_questions_category ON trivia_questions(category);
CREATE INDEX IF NOT EXISTS idx_trivia_questions_difficulty ON trivia_questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_trivia_player_stats_user ON trivia_player_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_trivia_player_stats_rating ON trivia_player_stats(rating DESC);
CREATE INDEX IF NOT EXISTS idx_trivia_games_players ON trivia_games(player1_id, player2_id);
CREATE INDEX IF NOT EXISTS idx_trivia_challenges_challenged ON trivia_challenges(challenged_id, status);

