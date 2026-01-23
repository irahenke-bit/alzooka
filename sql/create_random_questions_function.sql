-- Create a function to get truly random trivia questions
-- This uses PostgreSQL's random() function for better randomization than client-side

CREATE OR REPLACE FUNCTION get_random_questions(num_questions INTEGER)
RETURNS TABLE (
  id UUID,
  question TEXT,
  correct_answer TEXT,
  incorrect_answers TEXT[],
  difficulty TEXT,
  category TEXT,
  is_approved BOOLEAN
)
LANGUAGE SQL
AS $$
  SELECT 
    id,
    question,
    correct_answer,
    incorrect_answers,
    difficulty,
    category,
    is_approved
  FROM trivia_questions
  WHERE is_approved = true
  ORDER BY random()
  LIMIT num_questions;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_random_questions(INTEGER) TO authenticated;
