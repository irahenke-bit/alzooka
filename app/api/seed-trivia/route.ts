import { createAdminClient } from '@/lib/supabaseAdmin'
import { getServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

// =============================================================================
// ADMIN-ONLY ROUTE - Database seeding
// Protected by: SEED_TRIVIA_ENABLED env + authentication + admin allowlist
// =============================================================================

// Admin user IDs - only these users can run admin operations
const ADMIN_USER_IDS = [
  "5aa34cc1-ed8e-4b31-9b88-12ffe6de250a", // irahenke
];

export async function POST() {
  // GUARD 1: Safety switch - must be explicitly enabled via env var
  // In production, this defaults to OFF. Set SEED_TRIVIA_ENABLED=true to allow.
  const seedEnabled = process.env.SEED_TRIVIA_ENABLED === "true";
  if (!seedEnabled) {
    return NextResponse.json(
      { error: "Seed endpoint is not enabled" },
      { status: 404 }
    );
  }

  // GUARD 2: Require authenticated user
  const supabaseAuth = await getServerClient();
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // GUARD 3: Require admin role
  if (!ADMIN_USER_IDS.includes(user.id)) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  // GUARD 4: Admin client must be available
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Admin features disabled in this environment" },
      { status: 503 }
    );
  }

  try {
    // Read the SQL file content
    const fs = require('fs')
    const path = require('path')
    const sqlPath = path.join(process.cwd(), 'sql', 'seed_trivia_questions.sql')
    const sqlContent = fs.readFileSync(sqlPath, 'utf8')

    // Parse the SQL INSERT statements
    const insertMatch = sqlContent.match(/INSERT INTO trivia_questions \(category, difficulty, question, correct_answer, incorrect_answers\) VALUES\s*\(([\s\S]*?)\);/)

    if (!insertMatch) {
      return NextResponse.json({ error: 'Could not parse SQL file' }, { status: 400 })
    }

    // Split the values and parse each question
    const valuesString = insertMatch[1]
    const questionRegex = /\('([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*ARRAY\[([^\]]*)\]\)/g

    const questions = []
    let match

    while ((match = questionRegex.exec(valuesString)) !== null) {
      const [, category, difficulty, question, correct_answer, incorrect_answers] = match

      // Parse the incorrect answers array
      const incorrectMatch = incorrect_answers.match(/'([^']*)'/g)
      const incorrectArray = incorrectMatch ? incorrectMatch.map(s => s.slice(1, -1)) : []

      questions.push({
        category: category.replace(/''/g, "'"),
        difficulty,
        question: question.replace(/''/g, "'"),
        correct_answer: correct_answer.replace(/''/g, "'"),
        incorrect_answers: incorrectArray.map(ans => ans.replace(/''/g, "'"))
      })
    }

    // Check how many questions already exist
    const { data: existingQuestions, error: countError } = await supabase
      .from('trivia_questions')
      .select('id', { count: 'exact' })

    if (countError) {
      console.error('Error counting existing questions:', countError)
      return NextResponse.json({ error: 'Failed to check existing questions' }, { status: 500 })
    }

    if (existingQuestions && existingQuestions.length > 0) {
      return NextResponse.json({
        message: `Database already has ${existingQuestions.length} questions. Skipping seed.`
      })
    }

    // Insert the questions
    const { error: insertError } = await supabase
      .from('trivia_questions')
      .insert(questions)

    if (insertError) {
      console.error('Error inserting trivia questions:', insertError)
      return NextResponse.json({ error: 'Failed to insert trivia questions' }, { status: 500 })
    }

    return NextResponse.json({
      message: `Successfully seeded ${questions.length} trivia questions`
    })
  } catch (error) {
    console.error('Error in seed-trivia route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
