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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);

      // Require a game ID - no solo play allowed
      if (!gameId) {
        router.push("/games");
        return;
      }

      // Load the challenge game data
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

          // Fallback: fetch random questions if game doesn't have specific ones
          const { data: fallbackQuestions } = await supabase
            .from("trivia_questions")
            .select("*")
            .eq("is_approved", true)
            .limit(gameData.mode === "five_second" ? 10 : 50);

          if (fallbackQuestions && fallbackQuestions.length > 0) {
            setQuestions(shuffleArray(fallbackQuestions));
          }
        }
      }

      setLoading(false);
    }

    init();
  }, [supabase, router, gameId]);

  // Shuffle answers when question changes - DUMMY PLACEHOLDER to keep structure
  const currentQuestion = questions[currentQuestionIndex];
  
  useEffect(() => {
    if (currentQuestion) {
      const allAnswers = [currentQuestion.correct_answer, ...currentQuestion.incorrect_answers];
      setShuffledAnswers(shuffleArray(allAnswers));
      setSelectedAnswer(null);
      setShowResult(false);
      questionStartTime.current = Date.now();
    }
  }, [currentQuestionIndex, questions]);

  // Timer for blitz mode
  useEffect(() => {
    if (gameState !== "playing") return;
    
    if (mode === "blitz") {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, mode]);

  // Timer for five second mode
  useEffect(() => {
    if (gameState !== "playing" || mode !== "five_second") return;
    
    if (!showResult) {
      setQuestionTimeLeft(5);
      const timer = setInterval(() => {
        setQuestionTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [gameState, mode, currentQuestionIndex, showResult]);

  function handleTimeout() {
    if (showResult) return;
    
    const timeMs = Date.now() - questionStartTime.current;
    setAnswers((prev) => [
      ...prev,
      { questionId: currentQuestion?.id || "", answer: "", correct: false, timeMs },
    ]);
    setShowResult(true);
    
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex((prev) => prev + 1);
      } else {
        endGame();
      }
    }, 1500);
  }

  const endGame = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setGameState("finished");

    if (!user) return;

    // If this is a challenge game, save the score and check if opponent is done
    if (challengeGame) {
      const isPlayer1 = challengeGame.player1_id === user.id;
      const scoreField = isPlayer1 ? "player1_score" : "player2_score";
      const answersField = isPlayer1 ? "player1_answers" : "player2_answers";
      const statusValue = isPlayer1 ? "player1_done" : "player2_done";

      // Update our score
      await supabase
        .from("trivia_games")
        .update({
          [scoreField]: score,
          [answersField]: answers,
          status: challengeGame.status === "active" || challengeGame.status === "pending" 
            ? statusValue 
            : "completed",
        })
        .eq("id", challengeGame.id);

      // Check if opponent already finished
      const { data: updatedGame } = await supabase
        .from("trivia_games")
        .select("*")
        .eq("id", challengeGame.id)
        .single();

      if (updatedGame) {
        const opponentScore = isPlayer1 ? updatedGame.player2_score : updatedGame.player1_score;
        const opponentDone = opponentScore !== null;

        if (opponentDone) {
          // Both players done - determine winner and update ratings
          const player1Wins = updatedGame.player1_score > updatedGame.player2_score;
          const winnerId = player1Wins ? updatedGame.player1_id : updatedGame.player2_id;

          // Get both players' current ratings
          const { data: player1Stats } = await supabase
            .from("trivia_player_stats")
            .select("rating")
            .eq("user_id", updatedGame.player1_id)
            .single();

          const { data: player2Stats } = await supabase
            .from("trivia_player_stats")
            .select("rating")
            .eq("user_id", updatedGame.player2_id)
            .single();

          const p1Rating = player1Stats?.rating || 1200;
          const p2Rating = player2Stats?.rating || 1200;

          // Calculate new ratings
          const { player1NewRating, player2NewRating } = calculateMatchRatings(
            p1Rating,
            p2Rating,
            player1Wins
          );

          // Update game with final results
          await supabase
            .from("trivia_games")
            .update({
              status: "completed",
              winner_id: winnerId,
              player1_rating_before: p1Rating,
              player2_rating_before: p2Rating,
              player1_rating_after: player1NewRating,
              player2_rating_after: player2NewRating,
              completed_at: new Date().toISOString(),
            })
            .eq("id", challengeGame.id);

          // Update player stats
          const p1Won = player1Wins;
          await supabase.rpc("update_trivia_stats", {
            p_user_id: updatedGame.player1_id,
            p_won: p1Won,
            p_new_rating: player1NewRating,
          });

          await supabase.rpc("update_trivia_stats", {
            p_user_id: updatedGame.player2_id,
            p_won: !p1Won,
            p_new_rating: player2NewRating,
          });

          // Set UI state
          const didWin = winnerId === user.id;
          setGameResult(didWin ? "win" : "loss");
          setRatingChange(isPlayer1 ? player1NewRating - p1Rating : player2NewRating - p2Rating);
        } else {
          // Opponent hasn't played yet
          setGameResult("waiting");
        }
      }
    }
  }, [user, score, answers, challengeGame, supabase]);

  function handleAnswerClick(answer: string) {
    if (showResult || selectedAnswer) return;

    const timeMs = Date.now() - questionStartTime.current;
    const isCorrect = answer === currentQuestion.correct_answer;
    
    setSelectedAnswer(answer);
    setShowResult(true);
    
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }
    
    setAnswers((prev) => [
      ...prev,
      { questionId: currentQuestion.id, answer, correct: isCorrect, timeMs },
    ]);

    // In blitz mode, auto-advance quickly
    if (mode === "blitz") {
      setTimeout(() => {
        if (currentQuestionIndex < questions.length - 1) {
          setCurrentQuestionIndex((prev) => prev + 1);
        } else {
          endGame();
        }
      }, 300);
    } else {
      // In five second mode, show result then advance
      setTimeout(() => {
        if (currentQuestionIndex < questions.length - 1) {
          setCurrentQuestionIndex((prev) => prev + 1);
        } else {
          endGame();
        }
      }, 1500);
    }
  }

  function startGame() {
    setGameState("playing");
    setScore(0);
    setAnswers([]);
    setCurrentQuestionIndex(0);
    
    if (mode === "blitz") {
      setTimeLeft(120); // 2 minutes
    }
    
    questionStartTime.current = Date.now();
  }

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "var(--alzooka-teal-dark)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}>
        <p style={{ color: "var(--alzooka-cream)", opacity: 0.7 }}>Loading game...</p>
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
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
      }}>
        <h1 style={{ fontSize: 36, marginBottom: 8, color: "var(--alzooka-gold)" }}>
          {mode === "blitz" ? "⚡ Blitz Mode" : "⏱️ Five Second Mode"}
        </h1>
        
        {challengeGame && (
          <p style={{ fontSize: 18, marginBottom: 24, opacity: 0.8 }}>
            vs @{challengeGame.opponent_username}
          </p>
        )}
        
        <p style={{ marginBottom: 32, opacity: 0.7, textAlign: "center", maxWidth: 400 }}>
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
        
        <Link href="/games" style={{ marginTop: 24, color: "var(--alzooka-cream)", opacity: 0.6 }}>
          ← Back to Games
        </Link>
      </div>
    );
  }

  // Playing screen
  if (gameState === "playing" && currentQuestion) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "var(--alzooka-teal-dark)",
        padding: 24,
      }}>
        {/* Top bar */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: 600,
          margin: "0 auto 24px",
        }}>
          <span style={{ fontSize: 18, fontWeight: 600 }}>Score: {score}</span>
          
          {mode === "blitz" && (
            <span style={{ 
              fontSize: 24, 
              fontWeight: 700,
              color: timeLeft < 30 ? "#e57373" : "var(--alzooka-gold)",
            }}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </span>
          )}
          
          {mode === "five_second" && (
            <span style={{ 
              fontSize: 24, 
              fontWeight: 700,
              color: questionTimeLeft <= 2 ? "#e57373" : "var(--alzooka-gold)",
            }}>
              {questionTimeLeft}s
            </span>
          )}
          
          <span style={{ opacity: 0.6 }}>
            {currentQuestionIndex + 1}/{mode === "five_second" ? 10 : "∞"}
          </span>
        </div>

        {/* Question card */}
        <div style={{
          maxWidth: 600,
          margin: "0 auto",
          background: "#151515",
          borderRadius: 16,
          padding: 24,
        }}>
          <p style={{ fontSize: 20, marginBottom: 24, lineHeight: 1.4 }}>
            {currentQuestion.question}
          </p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {shuffledAnswers.map((answer, index) => {
              const isCorrect = answer === currentQuestion.correct_answer;
              const isSelected = answer === selectedAnswer;
              
              // Determine background and border colors based on state
              let bgColor = "#1a1a1a";
              let borderColor = "rgba(240, 235, 224, 0.2)";
              
              // Only change colors AFTER user has answered (showResult is true)
              if (showResult) {
                if (isCorrect) {
                  bgColor = "rgba(29, 185, 84, 0.3)";
                  borderColor = "#1DB954";
                } else if (isSelected) {
                  bgColor = "rgba(229, 115, 115, 0.3)";
                  borderColor = "#e57373";
                }
              }

              return (
                <div
                  key={index}
                  onClick={() => !showResult && handleAnswerClick(answer)}
                  role="button"
                  tabIndex={showResult ? -1 : 0}
                  onKeyDown={(e) => {
                    if (!showResult && (e.key === "Enter" || e.key === " ")) {
                      handleAnswerClick(answer);
                    }
                  }}
                  style={{
                    padding: 16,
                    fontSize: 16,
                    background: bgColor,
                    border: `2px solid ${borderColor}`,
                    borderRadius: 12,
                    cursor: showResult ? "default" : "pointer",
                    color: "var(--alzooka-cream)",
                    textAlign: "left",
                    userSelect: "none",
                  }}
                >
                  {answer}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Finished screen
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--alzooka-teal-dark)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
      textAlign: "center",
    }}>
      <h1 style={{ fontSize: 48, marginBottom: 8 }}>
        {gameResult === "win" ? "🎉" : gameResult === "loss" ? "😔" : "✅"}
      </h1>
      
      <h2 style={{ fontSize: 32, marginBottom: 16, color: "var(--alzooka-gold)" }}>
        {gameResult === "win" ? "You Won!" : gameResult === "loss" ? "You Lost" : "Game Complete!"}
      </h2>
      
      <p style={{ fontSize: 24, marginBottom: 8 }}>
        Your Score: <strong>{score}</strong>
      </p>
      
      {challengeGame && gameResult === "waiting" && (
        <p style={{ marginBottom: 24, opacity: 0.7 }}>
          Waiting for @{challengeGame.opponent_username} to play...
        </p>
      )}
      
      {challengeGame && gameResult !== "waiting" && challengeGame.opponent_score !== undefined && (
        <p style={{ marginBottom: 8, opacity: 0.8 }}>
          @{challengeGame.opponent_username}&apos;s Score: {challengeGame.opponent_score}
        </p>
      )}
      
      {ratingChange !== null && (
        <p style={{ 
          marginBottom: 24, 
          fontSize: 18,
          color: ratingChange >= 0 ? "#1DB954" : "#e57373",
        }}>
          {getRatingChangeDescription(ratingChange)}
        </p>
      )}
      
      <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
        <Link
          href="/games"
          style={{
            padding: "12px 24px",
            background: "var(--alzooka-gold)",
            color: "var(--alzooka-teal-dark)",
            borderRadius: 8,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Back to Games
        </Link>
      </div>
    </div>
  );
}
