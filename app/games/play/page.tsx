"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { calculateMatchRatings, getRatingChangeDescription } from "@/lib/elo";

type Question = {
  id: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
  difficulty: string;
};

type GameState = "ready" | "playing" | "finished";

type ChallengeGame = {
  id: string;
  mode: string;
  player1_id: string;
  player2_id: string;
  player1_score: number | null;
  player2_score: number | null;
  player1_allow_sharing: boolean;
  player2_allow_sharing: boolean;
  question_ids: string[];
  status: string;
  opponent_username?: string;
  opponent_score?: number;
};

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
  const [challengeGame, setChallengeGame] = useState<ChallengeGame | null>(null);
  const [ratingChange, setRatingChange] = useState<number | null>(null);
  const [gameResult, setGameResult] = useState<"win" | "loss" | "waiting" | null>(null);
  
  const questionStartTime = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const supabase = createBrowserClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "blitz";
  const gameId = searchParams.get("gameId"); // For challenge games

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

      // If this is a challenge game, load the game data
      if (gameId) {
        const { data: gameData } = await supabase
          .from("trivia_games")
          .select("*")
          .eq("id", gameId)
          .single();

        if (gameData) {
          // Get opponent info
          const opponentId = gameData.player1_id === user.id ? gameData.player2_id : gameData.player1_id;
          const { data: opponentData } = await supabase
            .from("users")
            .select("username")
            .eq("id", opponentId)
            .single();

          setChallengeGame({
            ...gameData,
            opponent_username: opponentData?.username || "Opponent",
            opponent_score: gameData.player1_id === user.id ? gameData.player2_score : gameData.player1_score,
          });

          // Load the specific questions for this game
          if (gameData.question_ids && gameData.question_ids.length > 0) {
            const { data: gameQuestions } = await supabase
              .from("trivia_questions")
              .select("*")
              .in("id", gameData.question_ids);

            if (gameQuestions && gameQuestions.length > 0) {
              setQuestions(shuffleArray(gameQuestions));
              setLoading(false);
              return;
            }
          }
        }
      }

      // Fetch questions from database (for solo games or fallback)
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

    if (!user) return;

    // Get or create player stats
    let { data: currentStats } = await supabase
      .from("trivia_player_stats")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!currentStats) {
      const { data: newStats } = await supabase
        .from("trivia_player_stats")
        .insert({ user_id: user.id })
        .select()
        .single();
      currentStats = newStats;
    }

    if (!currentStats) return;

    // Handle challenge game
    if (challengeGame && gameId) {
      const isPlayer1 = challengeGame.player1_id === user.id;
      
      // Update the game with our score
      const updateData: Record<string, unknown> = {
        [isPlayer1 ? "player1_score" : "player2_score"]: score,
        [isPlayer1 ? "player1_answers" : "player2_answers"]: JSON.stringify(answers),
        [isPlayer1 ? "player1_rating_before" : "player2_rating_before"]: currentStats.rating,
      };

      // Check if opponent has already played
      const opponentScore = isPlayer1 ? challengeGame.player2_score : challengeGame.player1_score;
      
      if (opponentScore !== null) {
        // Both players done - complete the game
        const player1Score = isPlayer1 ? score : opponentScore;
        const player2Score = isPlayer1 ? opponentScore : score;
        const player1Won = player1Score > player2Score;
        const winnerId = player1Won ? challengeGame.player1_id : challengeGame.player2_id;
        
        // Get opponent's stats for ELO calculation
        const { data: opponentStats } = await supabase
          .from("trivia_player_stats")
          .select("*")
          .eq("user_id", isPlayer1 ? challengeGame.player2_id : challengeGame.player1_id)
          .single();

        if (opponentStats) {
          const iWon = (isPlayer1 && player1Won) || (!isPlayer1 && !player1Won);
          const myRating = currentStats.rating;
          const theirRating = opponentStats.rating;
          
          const { player1NewRating, player2NewRating } = calculateMatchRatings(
            isPlayer1 ? myRating : theirRating,
            isPlayer1 ? theirRating : myRating,
            player1Won
          );

          const myNewRating = isPlayer1 ? player1NewRating : player2NewRating;
          const theirNewRating = isPlayer1 ? player2NewRating : player1NewRating;
          const change = myNewRating - myRating;
          
          setRatingChange(change);
          setGameResult(iWon ? "win" : "loss");

          // Update game record
          updateData.status = "completed";
          updateData.winner_id = winnerId;
          updateData.completed_at = new Date().toISOString();
          updateData[isPlayer1 ? "player1_rating_after" : "player2_rating_after"] = myNewRating;
          
          // Update opponent's rating in the game record
          await supabase
            .from("trivia_games")
            .update({
              [isPlayer1 ? "player2_rating_after" : "player1_rating_after"]: theirNewRating,
            })
            .eq("id", gameId);

          // Update my stats
          await supabase
            .from("trivia_player_stats")
            .update({
              rating: myNewRating,
              wins: iWon ? currentStats.wins + 1 : currentStats.wins,
              losses: iWon ? currentStats.losses : currentStats.losses + 1,
              games_played: currentStats.games_played + 1,
              current_streak: iWon ? currentStats.current_streak + 1 : 0,
              best_streak: iWon ? Math.max(currentStats.best_streak, currentStats.current_streak + 1) : currentStats.best_streak,
              blitz_high_score: mode === "blitz" && score > currentStats.blitz_high_score ? score : currentStats.blitz_high_score,
            })
            .eq("user_id", user.id);

          // Update opponent's stats
          await supabase
            .from("trivia_player_stats")
            .update({
              rating: theirNewRating,
              wins: iWon ? opponentStats.wins : opponentStats.wins + 1,
              losses: iWon ? opponentStats.losses + 1 : opponentStats.losses,
              games_played: opponentStats.games_played + 1,
              current_streak: iWon ? 0 : opponentStats.current_streak + 1,
              best_streak: iWon ? opponentStats.best_streak : Math.max(opponentStats.best_streak, opponentStats.current_streak + 1),
            })
            .eq("user_id", isPlayer1 ? challengeGame.player2_id : challengeGame.player1_id);
        }
      } else {
        // Waiting for opponent
        updateData.status = isPlayer1 ? "player1_done" : "player2_done";
        setGameResult("waiting");
      }

      await supabase
        .from("trivia_games")
        .update(updateData)
        .eq("id", gameId);
    } else {
      // Solo practice game - just update basic stats
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
  }, [user, supabase, score, mode, challengeGame, gameId, answers]);

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
        {/* Challenge result */}
        {challengeGame && gameResult && (
          <div style={{ marginBottom: 16, textAlign: "center" }}>
            {gameResult === "win" && (
              <p style={{ fontSize: 24, color: "#1DB954", margin: 0 }}>🎉 Victory!</p>
            )}
            {gameResult === "loss" && (
              <p style={{ fontSize: 24, color: "#e57373", margin: 0 }}>😔 Defeat</p>
            )}
            {gameResult === "waiting" && (
              <p style={{ fontSize: 18, opacity: 0.8, margin: 0 }}>
                Waiting for @{challengeGame.opponent_username} to play...
              </p>
            )}
          </div>
        )}

        <h1 style={{ fontSize: 32, marginBottom: 8, color: "var(--alzooka-gold)" }}>
          {challengeGame ? (gameResult === "waiting" ? "Score Submitted!" : "Game Over!") : "Game Over!"}
        </h1>
        
        <div style={{
          background: "rgba(240, 235, 224, 0.1)",
          borderRadius: 16,
          padding: 32,
          marginTop: 24,
          textAlign: "center",
          minWidth: 280,
        }}>
          {/* Challenge vs score display */}
          {challengeGame && gameResult !== "waiting" && challengeGame.opponent_score !== null ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 24, marginBottom: 24 }}>
              <div>
                <p style={{ fontSize: 36, fontWeight: 700, margin: 0, color: gameResult === "win" ? "#1DB954" : "#e57373" }}>
                  {score}
                </p>
                <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>You</p>
              </div>
              <span style={{ fontSize: 24, opacity: 0.5 }}>vs</span>
              <div>
                <p style={{ fontSize: 36, fontWeight: 700, margin: 0, color: gameResult === "loss" ? "#1DB954" : "#e57373" }}>
                  {challengeGame.opponent_score}
                </p>
                <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>@{challengeGame.opponent_username}</p>
              </div>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 48, fontWeight: 700, margin: 0, color: "var(--alzooka-gold)" }}>
                {score}
              </p>
              <p style={{ opacity: 0.7, margin: "8px 0 24px" }}>
                {mode === "blitz" ? "questions correct" : `out of 10 correct`}
              </p>
            </>
          )}

          {/* Rating change */}
          {ratingChange !== null && (
            <div style={{
              padding: "12px 16px",
              background: ratingChange > 0 ? "rgba(29, 185, 84, 0.2)" : "rgba(229, 115, 115, 0.2)",
              borderRadius: 8,
              marginBottom: 24,
            }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: ratingChange > 0 ? "#1DB954" : "#e57373" }}>
                {ratingChange > 0 ? "+" : ""}{ratingChange} Rating
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.8 }}>
                {getRatingChangeDescription(ratingChange)}
              </p>
            </div>
          )}
          
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
          {!challengeGame && (
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
          )}
          <Link
            href="/games"
            style={{
              padding: "12px 24px",
              fontSize: 16,
              fontWeight: 600,
              background: challengeGame ? "var(--alzooka-gold)" : "rgba(240, 235, 224, 0.1)",
              color: challengeGame ? "var(--alzooka-teal-dark)" : "var(--alzooka-cream)",
              border: challengeGame ? "none" : "1px solid rgba(240, 235, 224, 0.3)",
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

