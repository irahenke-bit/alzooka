const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

async function seedTriviaQuestions() {
  // Load environment variables from .env.local
  const fs = require('fs')
  const envContent = fs.readFileSync('.env.local', 'utf8')
  const envVars = {}
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim()
    }
  })

  const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Read the SQL file content
    const sqlPath = path.join(__dirname, 'sql', 'seed_trivia_questions.sql')
    const sqlContent = fs.readFileSync(sqlPath, 'utf8')

    // Parse the SQL INSERT statements
    const insertMatch = sqlContent.match(/INSERT INTO trivia_questions \(category, difficulty, question, correct_answer, incorrect_answers\) VALUES\s*\(([\s\S]*?)\);/)

    if (!insertMatch) {
      console.error('Could not parse SQL file')
      process.exit(1)
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

    console.log(`Parsed ${questions.length} questions from SQL file`)

    // Check how many questions already exist
    const { data: existingQuestions, error: countError } = await supabase
      .from('trivia_questions')
      .select('id', { count: 'exact' })

    if (countError) {
      console.error('Error counting existing questions:', countError)
      process.exit(1)
    }

    if (existingQuestions && existingQuestions.length > 0) {
      console.log(`Database already has ${existingQuestions.length} questions. Skipping seed.`)
      return
    }

    // Insert the questions in batches to avoid timeout
    const batchSize = 10
    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize)
      const { error: insertError } = await supabase
        .from('trivia_questions')
        .insert(batch)

      if (insertError) {
        console.error(`Error inserting batch ${Math.floor(i/batchSize) + 1}:`, insertError)
        process.exit(1)
      }

      console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(questions.length/batchSize)}`)
    }

    console.log(`Successfully seeded ${questions.length} trivia questions`)
  } catch (error) {
    console.error('Error seeding trivia questions:', error)
    process.exit(1)
  }
}

seedTriviaQuestions()
