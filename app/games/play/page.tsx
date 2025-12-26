"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Question = {
  id: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
  difficulty: string;
};

type GameState = "ready" | "playing" | "finished";

export default function PlayPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [gameState, setGameState] = useState<GameState>("ready");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<{ questionId: string; answer: string; correct: boolean; timeMs: number }[]>([]);
  const [shuffledAnswers, setShuffledAnswers] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(5);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const questionStartTime = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const supabase = createBrowserClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "blitz";

  // Shuffle array helper
  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Fetch questions
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);

      // Fetch questions from database
      const { data: questionData, error } = await supabase
        .from("trivia_questions")
        .select("*")
        .eq("is_approved", true)
        .limit(50); // Get 50 questions, we'll use what we need

      if (error || !questionData || questionData.length === 0) {
        // If no questions in DB, use sample questions
        const sampleQuestions: Question[] = [
          {
            id: "1",
            question: "Which band performed the song 'Bohemian Rhapsody'?",
            correct_answer: "Queen",
            incorrect_answers: ["The Beatles", "Led Zeppelin", "Pink Floyd"],
            difficulty: "easy",
          },
          {
            id: "2",
            question: "What year was Michael Jackson's 'Thriller' released?",
            correct_answer: "1982",
            incorrect_answers: ["1980", "1984", "1979"],
            difficulty: "medium",
          },
          {
            id: "3",
            question: "Who is known as the 'King of Pop'?",
            correct_answer: "Michael Jackson",
            incorrect_answers: ["Elvis Presley", "Prince", "James Brown"],
            difficulty: "easy",
          },
          {
            id: "4",
            question: "Which instrument does Jimi Hendrix famously play?",
            correct_answer: "Electric Guitar",
            incorrect_answers: ["Piano", "Drums", "Bass"],
            difficulty: "easy",
          },
          {
            id: "5",
            question: "What was Elvis Presley's first number-one hit?",
            correct_answer: "Heartbreak Hotel",
            incorrect_answers: ["Hound Dog", "Jailhouse Rock", "Love Me Tender"],
            difficulty: "hard",
          },
          {
            id: "6",
            question: "Which artist released the album 'Purple Rain'?",
            correct_answer: "Prince",
            incorrect_answers: ["Michael Jackson", "David Bowie", "George Michael"],
            difficulty: "easy",
          },
          {
            id: "7",
            question: "What is the best-selling album of all time?",
            correct_answer: "Thriller",
            incorrect_answers: ["Back in Black", "The Dark Side of the Moon", "Bat Out of Hell"],
            difficulty: "medium",
          },
          {
            id: "8",
            question: "Which band was Freddie Mercury the lead singer of?",
            correct_answer: "Queen",
            incorrect_answers: ["The Rolling Stones", "AC/DC", "Aerosmith"],
            difficulty: "easy",
          },
          {
            id: "9",
            question: "What year did The Beatles break up?",
            correct_answer: "1970",
            incorrect_answers: ["1968", "1972", "1969"],
            difficulty: "medium",
          },
          {
            id: "10",
            question: "Who wrote the song 'Imagine'?",
            correct_answer: "John Lennon",
            incorrect_answers: ["Paul McCartney", "George Harrison", "Bob Dylan"],
            difficulty: "easy",
          },
        ];
        setQuestions(shuffleArray(sampleQuestions));
      } else {
        setQuestions(shuffleArray(questionData));
      }

      setLoading(false);
    }

    init();
  }, [supabase, router]);

  // Shuffle answers when question changes
  useEffect(() => {
    if (questions.length > 0 && currentQuestionIndex < questions.length) {
      const q = questions[currentQuestionIndex];
      const allAnswers = [q.correct_answer, ...q.incorrect_answers];
      setShuffledAnswers(shuffleArray(allAnswers));
      questionStartTime.current = Date.now();
      setSelectedAnswer(null);
      setShowResult(false);
      
      if (mode === "five_second") {
        setQuestionTimeLeft(5);
      }
    }
  }, [currentQuestionIndex, questions, mode]);

  // Timer for Blitz mode (2 minutes total)
  useEffect(() => {
    if (gameState === "playing" && mode === "blitz") {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [gameState, mode]);

  // Timer for Five Second mode (5 seconds per question)
  useEffect(() => {
    if (gameState === "playing" && mode === "five_second") {
      timerRef.current = setInterval(() => {
        setQuestionTimeLeft((prev) => {
          if (prev <= 1) {
            // Time's up for this question - count as wrong
            handleTimeUp();
            return 5;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [gameState, mode, currentQuestionIndex]);

  function handleTimeUp() {
    if (questions[currentQuestionIndex]) {
      const q = questions[currentQuestionIndex];
      setAnswers((prev) => [
        ...prev,
        { questionId: q.id, answer: "", correct: false, timeMs: 5000 },
      ]);
      
      if (mode === "five_second" && currentQuestionIndex >= 9) {
        endGame();
      } else {
        setCurrentQuestionIndex((prev) => prev + 1);
      }
    }
  }

  const endGame = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState("finished");

    // Save stats to database
    if (user) {
      const { data: currentStats } = await supabase
        .from("trivia_player_stats")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (currentStats) {
        const updates: Record<string, number> = {
          games_played: currentStats.games_played + 1,
        };

        if (mode === "blitz" && score > currentStats.blitz_high_score) {
          updates.blitz_high_score = score;
        }

        await supabase
          .from("trivia_player_stats")
          .update(updates)
          .eq("user_id", user.id);
      }
    }
  }, [user, supabase, score, mode]);

  function startGame() {
    setGameState("playing");
    setScore(0);
    setAnswers([]);
    setCurrentQuestionIndex(0);
    
    if (mode === "blitz") {
      setTimeLeft(120); // 2 minutes
    } else {
      setQuestionTimeLeft(5);
    }
  }

  function handleAnswer(answer: string) {
    if (selectedAnswer || showResult) return;
    
    const q = questions[currentQuestionIndex];
    const timeMs = Date.now() - questionStartTime.current;
    const isCorrect = answer === q.correct_answer;
    
    setSelectedAnswer(answer);
    setShowResult(true);
    
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }
    
    setAnswers((prev) => [
      ...prev,
      { questionId: q.id, answer, correct: isCorrect, timeMs },
    ]);

    // Move to next question after brief delay
    setTimeout(() => {
      if (mode === "five_second" && currentQuestionIndex >= 9) {
        endGame();
      } else if (mode === "blitz" && currentQuestionIndex >= questions.length - 1) {
        endGame();
      } else {
        setCurrentQuestionIndex((prev) => prev + 1);
      }
    }, mode === "blitz" ? 300 : 800);
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "var(--alzooka-teal-dark)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <p style={{ color: "var(--alzooka-cream)", opacity: 0.7 }}>Loading questions...</p>
      </div>
    );
  }

  // Ready screen
  if (gameState === "ready") {
    return (
      <div style={{
        minHeight: "100vh",
        background: "var(--alzooka-teal-dark)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}>
        <h1 style={{ fontSize: 32, marginBottom: 8, color: "var(--alzooka-gold)" }}>
          {mode === "blitz" ? "⚡ Two Minute Blitz" : "⏱️ Five Second Challenge"}
        </h1>
        <p style={{ opacity: 0.7, marginBottom: 32, textAlign: "center" }}>
          {mode === "blitz"
            ? "Answer as many questions as you can in 2 minutes!"
            : "10 questions, 5 seconds each. No time to think!"}
        </p>
        
        <button
          onClick={startGame}
          style={{
            padding: "16px 48px",
            fontSize: 20,
            fontWeight: 700,
            background: "var(--alzooka-gold)",
            color: "var(--alzooka-teal-dark)",
            border: "none",
            borderRadius: 12,
            cursor: "pointer",
          }}
        >
          Start Game
        </button>
        
        <Link
          href="/games"
          style={{
            marginTop: 24,
            color: "var(--alzooka-cream)",
            opacity: 0.6,
            textDecoration: "none",
          }}
        >
          ← Back to Games
        </Link>
      </div>
    );
  }

  // Game finished screen
  if (gameState === "finished") {
    const correctAnswers = answers.filter((a) => a.correct).length;
    const accuracy = answers.length > 0 ? Math.round((correctAnswers / answers.length) * 100) : 0;
    
    return (
      <div style={{
        minHeight: "100vh",
        background: "var(--alzooka-teal-dark)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}>
        <h1 style={{ fontSize: 32, marginBottom: 8, color: "var(--alzooka-gold)" }}>
          Game Over!
        </h1>
        
        <div style={{
          background: "rgba(240, 235, 224, 0.1)",
          borderRadius: 16,
          padding: 32,
          marginTop: 24,
          textAlign: "center",
          minWidth: 280,
        }}>
          <p style={{ fontSize: 48, fontWeight: 700, margin: 0, color: "var(--alzooka-gold)" }}>
            {score}
          </p>
          <p style={{ opacity: 0.7, margin: "8px 0 24px" }}>
            {mode === "blitz" ? "questions correct" : `out of 10 correct`}
          </p>
          
          <div style={{ display: "flex", justifyContent: "center", gap: 32 }}>
            <div>
              <p style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>{accuracy}%</p>
              <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>Accuracy</p>
            </div>
            <div>
              <p style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>{answers.length}</p>
              <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>Attempted</p>
            </div>
          </div>
        </div>
        
        <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
          <button
            onClick={() => {
              setGameState("ready");
              setQuestions(shuffleArray(questions));
            }}
            style={{
              padding: "12px 24px",
              fontSize: 16,
              fontWeight: 600,
              background: "var(--alzooka-gold)",
              color: "var(--alzooka-teal-dark)",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Play Again
          </button>
          <Link
            href="/games"
            style={{
              padding: "12px 24px",
              fontSize: 16,
              fontWeight: 600,
              background: "rgba(240, 235, 224, 0.1)",
              color: "var(--alzooka-cream)",
              border: "1px solid rgba(240, 235, 224, 0.3)",
              borderRadius: 8,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Back to Games
          </Link>
        </div>
      </div>
    );
  }

  // Playing state
  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--alzooka-teal-dark)",
      display: "flex",
      flexDirection: "column",
      padding: 20,
    }}>
      {/* Header with timer and score */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 24, fontWeight: 700 }}>
          Score: {score}
        </div>
        
        <div style={{
          fontSize: 32,
          fontWeight: 700,
          color: mode === "five_second" && questionTimeLeft <= 2 ? "#e57373" : "var(--alzooka-gold)",
        }}>
          {mode === "blitz" ? formatTime(timeLeft) : `${questionTimeLeft}s`}
        </div>
        
        {mode === "five_second" && (
          <div style={{ fontSize: 14, opacity: 0.6 }}>
            {currentQuestionIndex + 1} / 10
          </div>
        )}
      </div>

      {/* Progress bar for five second mode */}
      {mode === "five_second" && (
        <div style={{
          width: "100%",
          height: 6,
          background: "rgba(240, 235, 224, 0.2)",
          borderRadius: 3,
          marginBottom: 24,
          overflow: "hidden",
        }}>
          <div style={{
            width: `${(questionTimeLeft / 5) * 100}%`,
            height: "100%",
            background: questionTimeLeft <= 2 ? "#e57373" : "var(--alzooka-gold)",
            transition: "width 1s linear",
          }} />
        </div>
      )}

      {/* Question */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        maxWidth: 600,
        margin: "0 auto",
        width: "100%",
      }}>
        <h2 style={{
          fontSize: 24,
          textAlign: "center",
          marginBottom: 32,
          lineHeight: 1.4,
        }}>
          {currentQuestion?.question}
        </h2>

        {/* Answers */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {shuffledAnswers.map((answer, index) => {
            const isSelected = selectedAnswer === answer;
            const isCorrect = answer === currentQuestion?.correct_answer;
            const showCorrect = showResult && isCorrect;
            const showWrong = showResult && isSelected && !isCorrect;
            
            return (
              <button
                key={index}
                onClick={() => handleAnswer(answer)}
                disabled={showResult}
                style={{
                  padding: "16px 20px",
                  fontSize: 16,
                  fontWeight: 500,
                  background: showCorrect
                    ? "#1DB954"
                    : showWrong
                    ? "#e57373"
                    : isSelected
                    ? "rgba(240, 235, 224, 0.2)"
                    : "rgba(240, 235, 224, 0.1)",
                  color: "var(--alzooka-cream)",
                  border: showCorrect
                    ? "2px solid #1DB954"
                    : showWrong
                    ? "2px solid #e57373"
                    : "2px solid rgba(240, 235, 224, 0.2)",
                  borderRadius: 12,
                  cursor: showResult ? "default" : "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                {answer}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

