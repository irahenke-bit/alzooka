import { createAdminClient } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = createAdminClient()

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
