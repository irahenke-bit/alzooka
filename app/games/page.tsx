"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Header from "@/app/components/Header";
import Link from "next/link";

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

export default function GamesPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"play" | "challenges" | "leaderboard">("play");
  
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

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {(["play", "challenges", "leaderboard"] as const).map((tab) => (
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
              {tab === "challenges" && challenges.length > 0 && (
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
              {tab}
            </button>
          ))}
        </div>

        {/* Play Tab */}
        {activeTab === "play" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Blitz Mode */}
            <div
              onClick={() => router.push("/games/play?mode=blitz")}
              style={{
                background: "linear-gradient(135deg, #1DB954 0%, #1a8f44 100%)",
                borderRadius: 16,
                padding: 24,
                cursor: "pointer",
                transition: "transform 0.2s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              <h3 style={{ margin: "0 0 8px", fontSize: 22 }}>⚡ Two Minute Blitz</h3>
              <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>
                Answer as many questions as you can in 2 minutes. Speed matters!
              </p>
              {stats && stats.blitz_high_score > 0 && (
                <p style={{ margin: "12px 0 0", fontSize: 13, opacity: 0.8 }}>
                  Your best: {stats.blitz_high_score} correct
                </p>
              )}
            </div>

            {/* Five Second Mode */}
            <div
              onClick={() => router.push("/games/play?mode=five_second")}
              style={{
                background: "linear-gradient(135deg, #e57373 0%, #c62828 100%)",
                borderRadius: 16,
                padding: 24,
                cursor: "pointer",
                transition: "transform 0.2s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              <h3 style={{ margin: "0 0 8px", fontSize: 22 }}>⏱️ Five Second Challenge</h3>
              <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>
                10 questions, 5 seconds each. No time to think!
              </p>
            </div>

            {/* Challenge a Friend */}
            <div
              onClick={() => router.push("/games/challenge")}
              style={{
                background: "rgba(240, 235, 224, 0.1)",
                borderRadius: 16,
                padding: 24,
                cursor: "pointer",
                border: "2px dashed rgba(240, 235, 224, 0.3)",
                textAlign: "center",
              }}
            >
              <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>🎯 Challenge a Friend</h3>
              <p style={{ margin: 0, opacity: 0.7, fontSize: 14 }}>
                Pick an opponent and prove who knows music better
              </p>
            </div>
          </div>
        )}

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
                          onClick={() => {/* TODO: Decline */}}
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
                          onClick={() => {/* TODO: Accept and play */}}
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

