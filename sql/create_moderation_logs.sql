-- Moderation Logs Table
-- Tracks all content moderation events for compliance and review

CREATE TABLE IF NOT EXISTS moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who uploaded
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address TEXT,
  
  -- What happened
  action TEXT NOT NULL, -- 'blocked', 'approved', 'flagged_for_review'
  
  -- Detection results from Google Vision SafeSearch
  categories JSONB, -- { adult: 'LIKELY', violence: 'UNLIKELY', ... }
  block_reason TEXT,
  
  -- Metadata
  image_type TEXT, -- 'base64', 'url'
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_moderation_logs_user_id ON moderation_logs(user_id);

-- Index for querying by action
CREATE INDEX IF NOT EXISTS idx_moderation_logs_action ON moderation_logs(action);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_moderation_logs_created_at ON moderation_logs(created_at DESC);

-- RLS Policies
ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view moderation logs (you'll need to create an admins table or use a role)
-- For now, allow service role only (backend access)
CREATE POLICY "Service role can manage moderation logs" ON moderation_logs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Optional: Add a view for basic stats without exposing sensitive data
CREATE OR REPLACE VIEW moderation_stats AS
SELECT 
  DATE(created_at) as date,
  action,
  COUNT(*) as count
FROM moderation_logs
GROUP BY DATE(created_at), action
ORDER BY date DESC;

-- Grant access to the view for authenticated users (optional - for admin dashboard)
-- GRANT SELECT ON moderation_stats TO authenticated;

COMMENT ON TABLE moderation_logs IS 'Logs all image moderation events for compliance. Never stores actual images - only metadata and detection results.';

