-- Add comment reactions support to the reactions table
-- Run this in your Supabase SQL Editor

-- Make post_id nullable (reactions can be for posts OR comments)
ALTER TABLE reactions ALTER COLUMN post_id DROP NOT NULL;

-- Add comment_id column
ALTER TABLE reactions ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES comments(id) ON DELETE CASCADE;

-- Add constraint: reaction must be for either a post or a comment, not both
ALTER TABLE reactions ADD CONSTRAINT reaction_target_check 
  CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR 
    (post_id IS NULL AND comment_id IS NOT NULL)
  );

-- Add unique constraint for comment reactions
ALTER TABLE reactions ADD CONSTRAINT unique_user_comment_reaction 
  UNIQUE(user_id, comment_id, reaction_type);

-- Create index for comment reactions
CREATE INDEX IF NOT EXISTS reactions_comment_id_idx ON reactions(comment_id);

-- Add RLS policy to prevent self-reactions on posts
CREATE POLICY "Users cannot react to own posts" ON reactions
  FOR INSERT WITH CHECK (
    post_id IS NULL OR 
    auth.uid() != (SELECT user_id FROM posts WHERE id = post_id)
  );

-- Add RLS policy to prevent self-reactions on comments
CREATE POLICY "Users cannot react to own comments" ON reactions
  FOR INSERT WITH CHECK (
    comment_id IS NULL OR 
    auth.uid() != (SELECT user_id FROM comments WHERE id = comment_id)
  );

-- Drop old insert policy and recreate with self-reaction check
DROP POLICY IF EXISTS "Users can insert own reactions" ON reactions;
CREATE POLICY "Users can insert own reactions" ON reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    (post_id IS NULL OR auth.uid() != (SELECT user_id FROM posts WHERE id = post_id)) AND
    (comment_id IS NULL OR auth.uid() != (SELECT user_id FROM comments WHERE id = comment_id))
  );

