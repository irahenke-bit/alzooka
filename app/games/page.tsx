"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Header from "@/app/components/Header";
import Link from "next/link";
import { notifyTriviaChallengeAccepted } from "@/lib/notifications";

type UserData = {
  id: string;
  username: string;
  avatar_url: string | null;
};

type PlayerStats = {
  user_id: string;
  rating: number;
  wins: number;
  losses: number;
  games_played: number;
  current_streak: number;
  best_streak: number;
  blitz_high_score: number;
  hide_stats: boolean;
};

type Challenge = {
  id: string;
  challenger_id: string;
  challenged_id: string;
  mode: "blitz" | "five_second";
  challenger_allow_sharing: boolean;
  status: string;
  created_at: string;
  challenger?: { username: string; avatar_url: string | null };
  challenged?: { username: string; avatar_url: string | null };
};

type LeaderboardEntry = {
  user_id: string;
  rating: number;
  wins: number;
  losses: number;
  username: string;
  avatar_url: string | null;
};

type PendingGame = {
  id: string;
  mode: string;
  player1_id: string;
  player2_id: string;
  player1_score: number | null;
  player2_score: number | null;
  status: string;
  opponent_username: string;
  opponent_avatar_url: string | null;
  is_your_turn: boolean;
};

export default function GamesPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [pendingGames, setPendingGames] = useState<PendingGame[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"challenges" | "leaderboard">("challenges");
  
  const supabase = createBrowserClient();
  const router = useRouter();

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);

      // Get user data for header
      const { data: userInfo } = await supabase
        .from("users")
        .select("id, username, avatar_url")
        .eq("id", user.id)
        .single();
      
      if (userInfo) {
        setUserData(userInfo);
      }

      // Get or create player stats
      let { data: playerStats } = await supabase
        .from("trivia_player_stats")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!playerStats) {
        // Create stats for new player
        const { data: newStats } = await supabase
          .from("trivia_player_stats")
          .insert({ user_id: user.id })
          .select()
          .single();
        playerStats = newStats;
      }
      setStats(playerStats);

      // Get pending challenges
      const { data: challengeData } = await supabase
        .from("trivia_challenges")
        .select(`
          *,
          challenger:users!trivia_challenges_challenger_id_fkey(username, avatar_url),
          challenged:users!trivia_challenges_challenged_id_fkey(username, avatar_url)
        `)
        .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (challengeData) {
        setChallenges(challengeData);
      }

      // Get games where it's your turn to play (game is active but you haven't played yet)
      const { data: gamesData } = await supabase
        .from("trivia_games")
        .select("*")
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .in("status", ["active", "player1_done", "player2_done"])
        .order("started_at", { ascending: false });

      if (gamesData) {
        const pendingGamesWithOpponents: PendingGame[] = [];
        
        for (const game of gamesData) {
          const isPlayer1 = game.player1_id === user.id;
          const myScore = isPlayer1 ? game.player1_score : game.player2_score;
          const opponentId = isPlayer1 ? game.player2_id : game.player1_id;
          
          // If I haven't played yet (my score is null), it's my turn
          const isMyTurn = myScore === null;
          
          if (isMyTurn) {
            // Get opponent info
            const { data: opponentData } = await supabase
              .from("users")
              .select("username, avatar_url")
              .eq("id", opponentId)
              .single();
            
            pendingGamesWithOpponents.push({
              id: game.id,
              mode: game.mode,
              player1_id: game.player1_id,
              player2_id: game.player2_id,
              player1_score: game.player1_score,
              player2_score: game.player2_score,
              status: game.status,
              opponent_username: opponentData?.username || "Unknown",
              opponent_avatar_url: opponentData?.avatar_url || null,
              is_your_turn: true,
            });
          }
        }
        
        setPendingGames(pendingGamesWithOpponents);
      }

      // Get leaderboard (top 20 by rating, only players with 10+ games)
      const { data: leaderboardData } = await supabase
        .from("trivia_player_stats")
        .select(`
          user_id,
          rating,
          wins,
          losses,
          users!trivia_player_stats_user_id_fkey(username, avatar_url)
        `)
        .gte("games_played", 10)
        .order("rating", { ascending: false })
        .limit(20);

      if (leaderboardData) {
        const formatted = leaderboardData.map((entry: Record<string, unknown>) => ({
          user_id: entry.user_id as string,
          rating: entry.rating as number,
          wins: entry.wins as number,
          losses: entry.losses as number,
          username: (entry.users as Record<string, unknown>)?.username as string || "Unknown",
          avatar_url: (entry.users as Record<string, unknown>)?.avatar_url as string | null,
        }));
        setLeaderboard(formatted);
      }

      setLoading(false);
    }

    init();
  }, [supabase, router]);

  function getWinRate() {
    if (!stats || stats.games_played === 0) return 0;
    return Math.round((stats.wins / stats.games_played) * 100);
  }

  // Fisher-Yates shuffle for truly random results
  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async function acceptChallenge(challenge: Challenge) {
    if (!user) return;

    // Fetch all questions and randomly select
    const { data: allQuestions } = await supabase
      .from("trivia_questions")
      .select("id")
      .eq("is_approved", true);

    if (!allQuestions || allQuestions.length === 0) {
      alert("No questions available. Please try again later.");
      return;
    }

    // Fisher-Yates shuffle for truly random selection
    const shuffled = shuffleArray(allQuestions);
    const needed = challenge.mode === "five_second" ? 10 : 50;
    const selected = shuffled.slice(0, Math.min(needed, shuffled.length));
    const questionIds = selected.map(q => q.id);

    // Create the game record - current user (accepter) is player1 for RLS
    const { data: game, error } = await supabase
      .from("trivia_games")
      .insert({
        mode: challenge.mode,
        player1_id: user.id,  // Accepter is player1 (RLS requires this)
        player2_id: challenge.challenger_id,  // Challenger is player2
        player1_allow_sharing: true,  // Default to allowing
        player2_allow_sharing: challenge.challenger_allow_sharing,
        question_ids: questionIds,
        status: "active",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !game) {
      console.error("Failed to create game:", error);
      alert("Failed to start game. Please try again.");
      return;
    }

    // Update challenge status
    await supabase
      .from("trivia_challenges")
      .update({ status: "accepted", game_id: game.id })
      .eq("id", challenge.id);

    // Notify the challenger that their challenge was accepted
    await notifyTriviaChallengeAccepted(
      supabase,
      challenge.challenger_id,
      userData?.username || "Someone",
      user.id,
      game.id,
      challenge.mode
    );

    // Navigate to play the game
    router.push(`/games/play?gameId=${game.id}&mode=${challenge.mode}`);
  }

  async function declineChallenge(challengeId: string) {
    await supabase
      .from("trivia_challenges")
      .update({ status: "declined" })
      .eq("id", challengeId);

    setChallenges(prev => prev.filter(c => c.id !== challengeId));
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--alzooka-teal-dark)" }}>
        <Header user={user} userUsername={null} userAvatarUrl={null} />
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
          <p style={{ color: "var(--alzooka-cream)", opacity: 0.7 }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--alzooka-teal-dark)" }}>
      <Header user={user} userUsername={userData?.username || null} userAvatarUrl={userData?.avatar_url || null} />
      
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, margin: "0 0 8px", color: "var(--alzooka-gold)" }}>
            🎵 Music Trivia
          </h1>
          <p style={{ opacity: 0.7, margin: 0 }}>
            Test your music knowledge. Challenge your friends.
          </p>
        </div>

        {/* Your Stats Card */}
        {stats && (
          <div style={{
            background: "rgba(240, 235, 224, 0.05)",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            border: "1px solid rgba(240, 235, 224, 0.1)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Your Stats</h2>
              <span style={{ 
                fontSize: 24, 
                fontWeight: 700, 
                color: "var(--alzooka-gold)" 
              }}>
                {stats.rating} Rating
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, textAlign: "center" }}>
              <div>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>{stats.wins}</p>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>Wins</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>{stats.losses}</p>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>Losses</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>{getWinRate()}%</p>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>Win Rate</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
                  {stats.current_streak > 0 ? `${stats.current_streak}🔥` : stats.current_streak}
                </p>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>Streak</p>
              </div>
            </div>
          </div>
        )}

        {/* Challenge Button */}
        <button
          onClick={() => router.push("/games/challenge")}
          style={{
            width: "100%",
            padding: "18px 24px",
            fontSize: 18,
            fontWeight: 700,
            background: "linear-gradient(135deg, #1DB954 0%, #1a8f44 100%)",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            cursor: "pointer",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          🎯 Challenge Someone to Trivia
        </button>

        {/* Your Turn - Games waiting for you to play */}
        {pendingGames.length > 0 && (
          <div style={{
            background: "rgba(29, 185, 84, 0.1)",
            border: "2px solid rgba(29, 185, 84, 0.4)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
          }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "#1DB954", display: "flex", alignItems: "center", gap: 8 }}>
              🎮 Your Turn to Play!
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pendingGames.map((game) => (
                <div
                  key={game.id}
                  style={{
                    background: "rgba(240, 235, 224, 0.05)",
                    borderRadius: 8,
                    padding: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {game.opponent_avatar_url ? (
                      <img
                        src={game.opponent_avatar_url}
                        alt=""
                        style={{ width: 36, height: 36, borderRadius: "50%" }}
                      />
                    ) : (
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "rgba(240, 235, 224, 0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                        👤
                      </div>
                    )}
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>
                        vs @{game.opponent_username}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
                        {game.mode === "blitz" ? "⚡ Blitz" : "⏱️ Five Second"}
                        {(game.player1_score !== null || game.player2_score !== null) && " • Opponent already played"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/games/play?gameId=${game.id}&mode=${game.mode}`)}
                    style={{
                      padding: "8px 16px",
                      background: "#1DB954",
                      border: "none",
                      borderRadius: 6,
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    Play Now
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {(["challenges", "leaderboard"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 600,
                background: activeTab === tab ? "var(--alzooka-gold)" : "rgba(240, 235, 224, 0.1)",
                color: activeTab === tab ? "var(--alzooka-teal-dark)" : "var(--alzooka-cream)",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {tab === "challenges" && challenges.filter(c => c.challenged_id === user?.id).length > 0 && (
                <span style={{
                  background: "#e57373",
                  color: "#fff",
                  borderRadius: "50%",
                  padding: "2px 6px",
                  fontSize: 11,
                  marginRight: 6,
                }}>
                  {challenges.filter(c => c.challenged_id === user?.id).length}
                </span>
              )}
              {tab === "challenges" ? "Your Challenges" : "Leaderboard"}
            </button>
          ))}
        </div>

        {/* Challenges Tab */}
        {activeTab === "challenges" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {challenges.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, opacity: 0.6 }}>
                <p>No pending challenges</p>
                <button
                  onClick={() => router.push("/games/challenge")}
                  style={{
                    marginTop: 16,
                    padding: "10px 20px",
                    background: "var(--alzooka-gold)",
                    color: "var(--alzooka-teal-dark)",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Challenge Someone
                </button>
              </div>
            ) : (
              challenges.map((challenge) => {
                const isChallenger = challenge.challenger_id === user?.id;
                const opponent = isChallenger ? challenge.challenged : challenge.challenger;
                
                return (
                  <div
                    key={challenge.id}
                    style={{
                      background: "rgba(240, 235, 224, 0.05)",
                      borderRadius: 12,
                      padding: 16,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      border: "1px solid rgba(240, 235, 224, 0.1)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {opponent?.avatar_url ? (
                        <img
                          src={opponent.avatar_url}
                          alt=""
                          style={{ width: 40, height: 40, borderRadius: "50%" }}
                        />
                      ) : (
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          background: "rgba(240, 235, 224, 0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}>
                          👤
                        </div>
                      )}
                      <div>
                        <p style={{ margin: 0, fontWeight: 600 }}>
                          {isChallenger ? `You challenged @${opponent?.username}` : `@${opponent?.username} challenged you`}
                        </p>
                        <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>
                          {challenge.mode === "blitz" ? "⚡ Blitz" : "⏱️ Five Second"}
                          {challenge.challenger_allow_sharing && " • May be shared"}
                        </p>
                      </div>
                    </div>
                    
                    {!isChallenger && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => declineChallenge(challenge.id)}
                          style={{
                            padding: "8px 16px",
                            background: "transparent",
                            border: "1px solid rgba(240, 235, 224, 0.3)",
                            borderRadius: 6,
                            color: "var(--alzooka-cream)",
                            cursor: "pointer",
                          }}
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => acceptChallenge(challenge)}
                          style={{
                            padding: "8px 16px",
                            background: "var(--alzooka-gold)",
                            border: "none",
                            borderRadius: 6,
                            color: "var(--alzooka-teal-dark)",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Accept
                        </button>
                      </div>
                    )}
                    
                    {isChallenger && (
                      <span style={{ fontSize: 12, opacity: 0.6 }}>Waiting...</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === "leaderboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {leaderboard.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, opacity: 0.6 }}>
                <p>No players with 10+ games yet</p>
                <p style={{ fontSize: 13 }}>Be the first to reach the leaderboard!</p>
              </div>
            ) : (
              leaderboard.map((entry, index) => (
                <Link
                  key={entry.user_id}
                  href={`/games/${entry.username}`}
                  style={{
                    background: index < 3 
                      ? `rgba(${index === 0 ? "255, 215, 0" : index === 1 ? "192, 192, 192" : "205, 127, 50"}, 0.1)`
                      : "rgba(240, 235, 224, 0.05)",
                    borderRadius: 12,
                    padding: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    textDecoration: "none",
                    color: "var(--alzooka-cream)",
                    border: index < 3 ? `1px solid rgba(${index === 0 ? "255, 215, 0" : index === 1 ? "192, 192, 192" : "205, 127, 50"}, 0.3)` : "1px solid rgba(240, 235, 224, 0.1)",
                  }}
                >
                  <span style={{ 
                    width: 30, 
                    textAlign: "center", 
                    fontWeight: 700,
                    fontSize: index < 3 ? 20 : 14,
                  }}>
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                  </span>
                  
                  {entry.avatar_url ? (
                    <img src={entry.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%" }} />
                  ) : (
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "rgba(240, 235, 224, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      👤
                    </div>
                  )}
                  
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>@{entry.username}</p>
                    <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>
                      {entry.wins}-{entry.losses} ({Math.round((entry.wins / (entry.wins + entry.losses)) * 100)}%)
                    </p>
                  </div>
                  
                  <span style={{ fontWeight: 700, color: "var(--alzooka-gold)" }}>
                    {entry.rating}
                  </span>
                </Link>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

