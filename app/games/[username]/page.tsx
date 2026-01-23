"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Header from "@/app/components/Header";
import Link from "next/link";

type PlayerProfile = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  rating: number;
  wins: number;
  losses: number;
  games_played: number;
  current_streak: number;
  best_streak: number;
  blitz_high_score: number;
  hide_stats: boolean;
};

type GameHistory = {
  id: string;
  mode: string;
  opponent_username: string;
  opponent_avatar: string | null;
  player_score: number;
  opponent_score: number;
  won: boolean;
  completed_at: string;
};

type UserData = {
  id: string;
  username: string;
  avatar_url: string | null;
};

export default function GamingProfilePage() {
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [canSeeStats, setCanSeeStats] = useState(false);

  const supabase = createBrowserClient();
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      setCurrentUser(user);

      // Get current user data for header
      if (user) {
        const { data: userInfo } = await supabase
          .from("users")
          .select("id, username, avatar_url")
          .eq("id", user.id)
          .single();
        
        if (userInfo) {
          setUserData(userInfo);
        }
      }

      // Get the profile user
      const { data: profileUser } = await supabase
        .from("users")
        .select("id, username, avatar_url")
        .ilike("username", username)
        .single();

      if (!profileUser) {
        setLoading(false);
        return;
      }

      const isOwn = user?.id === profileUser.id;
      setIsOwnProfile(isOwn);

      // Get player stats
      const { data: stats } = await supabase
        .from("trivia_player_stats")
        .select("*")
        .eq("user_id", profileUser.id)
        .single();

      if (stats) {
        const playerProfile: PlayerProfile = {
          user_id: profileUser.id,
          username: profileUser.username,
          avatar_url: profileUser.avatar_url,
          rating: stats.rating,
          wins: stats.wins,
          losses: stats.losses,
          games_played: stats.games_played,
          current_streak: stats.current_streak,
          best_streak: stats.best_streak,
          blitz_high_score: stats.blitz_high_score,
          hide_stats: stats.hide_stats,
        };
        setProfile(playerProfile);

        // Determine if we can see stats
        // Own profile: always see
        // Others: only if they don't hide OR they have winning record with 20+ games
        const hasWinningRecord = stats.wins > stats.losses;
        const hasEnoughGames = stats.games_played >= 20;
        const forcedPublic = hasWinningRecord && hasEnoughGames;
        
        setCanSeeStats(isOwn || !stats.hide_stats || forcedPublic);

        // Get game history (only completed games)
        const { data: games } = await supabase
          .from("trivia_games")
          .select("*")
          .or(`player1_id.eq.${profileUser.id},player2_id.eq.${profileUser.id}`)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(10);

        if (games) {
          // Get opponent info for each game
          const opponentIds = games.map(g => 
            g.player1_id === profileUser.id ? g.player2_id : g.player1_id
          ).filter(Boolean);

          const { data: opponents } = await supabase
            .from("users")
            .select("id, username, avatar_url")
            .in("id", opponentIds);

          const opponentMap = new Map(opponents?.map(o => [o.id, o]) || []);

          const history: GameHistory[] = games.map(g => {
            const isPlayer1 = g.player1_id === profileUser.id;
            const opponentId = isPlayer1 ? g.player2_id : g.player1_id;
            const opponent = opponentMap.get(opponentId);
            
            return {
              id: g.id,
              mode: g.mode,
              opponent_username: opponent?.username || "Unknown",
              opponent_avatar: opponent?.avatar_url || null,
              player_score: isPlayer1 ? g.player1_score : g.player2_score,
              opponent_score: isPlayer1 ? g.player2_score : g.player1_score,
              won: g.winner_id === profileUser.id,
              completed_at: g.completed_at,
            };
          });

          setGameHistory(history);
        }
      } else {
        // No stats yet - player hasn't played
        setProfile({
          user_id: profileUser.id,
          username: profileUser.username,
          avatar_url: profileUser.avatar_url,
          rating: 1200,
          wins: 0,
          losses: 0,
          games_played: 0,
          current_streak: 0,
          best_streak: 0,
          blitz_high_score: 0,
          hide_stats: true,
        });
        setCanSeeStats(isOwn);
      }

      setLoading(false);
    }

    init();
  }, [supabase, router, username]);

  async function toggleHideStats() {
    if (!profile || !currentUser) return;

    const newHideStats = !profile.hide_stats;
    
    // Check if they're allowed to hide (losing record or < 20 games)
    const hasWinningRecord = profile.wins > profile.losses;
    const hasEnoughGames = profile.games_played >= 20;
    
    if (newHideStats && hasWinningRecord && hasEnoughGames) {
      // Silently fail - they can't hide with winning record + 20 games
      // Don't tell them the policy
      return;
    }

    await supabase
      .from("trivia_player_stats")
      .update({ hide_stats: newHideStats })
      .eq("user_id", currentUser.id);

    setProfile({ ...profile, hide_stats: newHideStats });
  }

  function getWinRate() {
    if (!profile || profile.games_played === 0) return 0;
    return Math.round((profile.wins / profile.games_played) * 100);
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--alzooka-teal-dark)" }}>
        <Header user={currentUser} userUsername={userData?.username || null} userAvatarUrl={userData?.avatar_url || null} />
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
          <p style={{ color: "var(--alzooka-cream)", opacity: 0.7 }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--alzooka-teal-dark)" }}>
        <Header user={currentUser} userUsername={userData?.username || null} userAvatarUrl={userData?.avatar_url || null} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "50vh" }}>
          <p style={{ color: "var(--alzooka-cream)", marginBottom: 16 }}>Player not found</p>
          <Link href="/games" style={{ color: "var(--alzooka-gold)" }}>← Back to Games</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--alzooka-teal-dark)" }}>
      <Header user={currentUser} userUsername={userData?.username || null} userAvatarUrl={userData?.avatar_url || null} />
      
      <main style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
        <Link href="/games" style={{ color: "var(--alzooka-cream)", opacity: 0.6, textDecoration: "none", fontSize: 14 }}>
          ← Back to Games
        </Link>

        {/* Profile header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginTop: 16,
          marginBottom: 24,
        }}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: 80, height: 80, borderRadius: "50%" }} />
          ) : (
            <div style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "rgba(240, 235, 224, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
            }}>
              👤
            </div>
          )}
          <div>
            <h1 style={{ margin: "0 0 4px", fontSize: 24 }}>@{profile.username}</h1>
            <p style={{ margin: 0, opacity: 0.7, fontSize: 14 }}>
              🎯 Trivia Stats
            </p>
          </div>
        </div>

        {/* Stats card */}
        {canSeeStats ? (
          <div style={{
            background: "#151515",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            border: "1px solid rgba(240, 235, 224, 0.1)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Stats</h2>
              <span style={{ fontSize: 28, fontWeight: 700, color: "var(--alzooka-gold)" }}>
                {profile.rating}
              </span>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, textAlign: "center" }}>
              <div>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>{profile.wins}</p>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>Wins</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>{profile.losses}</p>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>Losses</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>{getWinRate()}%</p>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>Win Rate</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
                  {profile.current_streak > 0 ? `${profile.current_streak}🔥` : profile.current_streak}
                </p>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>Streak</p>
              </div>
            </div>

            {profile.blitz_high_score > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(240, 235, 224, 0.1)" }}>
                <p style={{ margin: 0, fontSize: 14, opacity: 0.7 }}>
                  ⚡ Blitz High Score: <strong>{profile.blitz_high_score}</strong>
                </p>
              </div>
            )}

            {isOwnProfile && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(240, 235, 224, 0.1)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={profile.hide_stats}
                    onChange={toggleHideStats}
                    style={{ width: 16, height: 16, accentColor: "var(--alzooka-gold)" }}
                  />
                  Hide my stats from others
                </label>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: "#151515",
            borderRadius: 12,
            padding: 32,
            marginBottom: 24,
            textAlign: "center",
            border: "1px solid rgba(240, 235, 224, 0.1)",
          }}>
            <p style={{ margin: 0, opacity: 0.6 }}>
              🔒 Stats are hidden
            </p>
          </div>
        )}

        {/* Challenge button (if not own profile) */}
        {!isOwnProfile && currentUser && (
          <Link
            href={`/games/challenge?opponent=${profile.username}`}
            style={{
              display: "block",
              width: "100%",
              padding: 16,
              fontSize: 16,
              fontWeight: 600,
              background: "var(--alzooka-gold)",
              color: "var(--alzooka-teal-dark)",
              border: "none",
              borderRadius: 12,
              textDecoration: "none",
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            🎯 Challenge @{profile.username}
          </Link>
        )}

        {/* Recent games */}
        {canSeeStats && gameHistory.length > 0 && (
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Recent Games</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {gameHistory.map((game) => (
                <div
                  key={game.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 12,
                    background: game.won ? "rgba(29, 185, 84, 0.1)" : "rgba(229, 115, 115, 0.1)",
                    borderRadius: 8,
                    border: `1px solid ${game.won ? "rgba(29, 185, 84, 0.2)" : "rgba(229, 115, 115, 0.2)"}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 18 }}>{game.won ? "✅" : "❌"}</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>
                        {game.won ? "Beat" : "Lost to"} @{game.opponent_username}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>
                        {game.mode === "blitz" ? "⚡ Blitz" : "⏱️ Five Second"} • {formatDate(game.completed_at)}
                      </p>
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>
                    {game.player_score}-{game.opponent_score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Link to main profile */}
        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Link
            href={`/profile/${profile.username}`}
            style={{ color: "var(--alzooka-cream)", opacity: 0.6, fontSize: 14 }}
          >
            View full profile →
          </Link>
        </div>
      </main>
    </div>
  );
}

