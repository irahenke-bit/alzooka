"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";

// Redirect to home in production - Game Hub is dev-only
const isDev = process.env.NODE_ENV === "development";

// Custom gamepad icon - Apple emoji style with colored buttons
const GamepadIcon = ({ size = 48, color = "#9333ea" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" style={{ filter: `drop-shadow(0 4px 8px ${color}40)` }}>
    {/* Main body - exact Apple emoji shape */}
    <path fill="#3B3B3B" d="M2 17c0-3.813 2.995-7.071 3.926-8.74.89-1.596 2.391-2.86 4.324-2.86h15.5c1.933 0 3.434 1.264 4.324 2.86C30.995 9.93 34 13.188 34 17c0 5.5-3.5 12-7 12-2.5 0-4.5-2-9-2s-6.5 2-9 2c-3.5 0-7-6.5-7-12z"/>
    {/* Shine/highlight */}
    <path fill="#4A4A4A" d="M3 16c0-3.364 2.644-6.238 3.465-7.71C7.25 6.968 8.489 6 10.25 6h15.5c1.761 0 3 .968 3.785 2.29C30.356 9.762 33 12.636 33 16c0 4.5-3 10-6 10-2.5 0-5-2-9-2s-6.5 2-9 2c-3 0-6-5.5-6-10z"/>
    {/* D-pad */}
    <path fill="#1D1D1D" d="M8 14h2v5H8zm2 1.5h1.5v2H10zm-3.5 0H8v2H6.5z"/>
    <rect fill="#1D1D1D" x="7" y="14" width="4" height="5" rx="0.5"/>
    <rect fill="#1D1D1D" x="6" y="15.5" width="6" height="2" rx="0.5"/>
    {/* Face buttons - colored: Red, Green, Purple, Yellow */}
    <circle fill="#EF4444" cx="27" cy="14" r="2.2"/> {/* Top - Red */}
    <circle fill="#A855F7" cx="24" cy="17" r="2.2"/> {/* Left - Purple */}
    <circle fill="#22C55E" cx="30" cy="17" r="2.2"/> {/* Right - Green */}
    <circle fill="#EAB308" cx="27" cy="20" r="2.2"/> {/* Bottom - Yellow */}
    {/* Joysticks */}
    <circle fill="#1D1D1D" cx="14" cy="21" r="3"/>
    <circle fill="#2D2D2D" cx="14" cy="21" r="2"/>
    <circle fill="#1D1D1D" cx="20" cy="21" r="3"/>
    <circle fill="#2D2D2D" cx="20" cy="21" r="2"/>
  </svg>
);

type UserData = {
  id: string;
  username: string;
  avatar_url: string | null;
};

export default function GameHubPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  
  const supabase = createBrowserClient();
  const router = useRouter();

  useEffect(() => {
    async function init() {
      // Redirect to home in production - Game Hub is dev-only
      if (!isDev) {
        router.push("/");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);

      const { data: userInfo } = await supabase
        .from("users")
        .select("id, username, avatar_url")
        .eq("id", user.id)
        .single();
      
      if (userInfo) {
        setUserData(userInfo);
      }

      setLoading(false);
    }

    init();
  }, [supabase, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <div style={{ 
          height: 60, 
          background: "rgba(0,0,0,0.3)", 
          borderBottom: "1px solid rgba(255,255,255,0.1)"
        }} />
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          minHeight: "60vh" 
        }}>
          <div style={{
            width: 48,
            height: 48,
            border: "3px solid rgba(201, 162, 39, 0.2)",
            borderTopColor: "var(--alzooka-gold)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  const games = [
    {
      id: "bass-clicker",
      name: "Bass Clicker",
      description: "Click the speaker to drop the bass, buy upgrades, and become the ultimate bass master!",
      icon: "🔊",
      href: "/game-hub/coin-collector",
      color: "#c9a227",
      available: true,
    },
    {
      id: "music-trivia",
      name: "Music Trivia",
      description: "Test your music knowledge against friends in this fast-paced trivia game!",
      icon: "🎵",
      href: "/games",
      color: "#1DB954",
      available: true,
    },
    {
      id: "rock-drop",
      name: "Rock Drop",
      description: "Stack falling blocks to the beat! Clear lines, rack up combos, and rock out!",
      icon: "🎸",
      href: "/game-hub/rock-drop",
      color: "#dc2626",
      available: true,
    },
    {
      id: "sound-wave",
      name: "Sound Wave",
      description: "Ride the wave, collect amps, and smash through obstacles! Don't let your signal die!",
      icon: "〰️",
      href: "/game-hub/sound-wave",
      color: "#06b6d4",
      available: true,
    },
    {
      id: "musician-beggar",
      name: "Musician Beggar",
      description: "Start as a street musician, earn Zooka Coins, buy upgrades, and rise to fame!",
      icon: "🎸",
      href: "/game-hub/musician-beggar",
      color: "#eab308",
      available: true,
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--alzooka-dark)" }}>
      <Header 
        user={user} 
        userUsername={userData?.username || null} 
        userAvatarUrl={userData?.avatar_url || null} 
      />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ 
            fontSize: 64, 
            marginBottom: 16,
            filter: "drop-shadow(0 4px 12px rgba(201, 162, 39, 0.3))"
          }}>
            🎮
          </div>
          <h1 style={{ 
            fontSize: 42, 
            fontWeight: 800, 
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
            color: "var(--alzooka-cream)",
            margin: "0 0 12px 0",
            textShadow: "0 0 20px rgba(201, 162, 39, 0.5), 0 0 40px rgba(201, 162, 39, 0.3)",
          }}>
            Game Hub
          </h1>
          <p style={{ 
            fontSize: 16, 
            color: "var(--alzooka-cream)", 
            opacity: 0.7,
            margin: 0,
          }}>
            Choose a game to play
          </p>
        </div>

        {/* Games Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 24,
        }}>
          {games.map((game) => (
            <Link
              key={game.id}
              href={game.available ? game.href : "#"}
              style={{
                textDecoration: "none",
                cursor: game.available ? "pointer" : "default",
              }}
              onClick={(e) => !game.available && e.preventDefault()}
            >
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.3) 100%)",
                  borderRadius: 16,
                  padding: 24,
                  border: `2px solid ${game.color}60`,
                  transition: "all 0.3s ease",
                  boxShadow: `0 0 20px ${game.color}15, inset 0 1px 0 rgba(255,255,255,0.05)`,
                }}
                onMouseEnter={(e) => {
                  if (game.available) {
                    e.currentTarget.style.transform = "translateY(-6px) scale(1.02)";
                    e.currentTarget.style.borderColor = game.color;
                    e.currentTarget.style.boxShadow = `0 0 40px ${game.color}50, 0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
                  e.currentTarget.style.borderColor = game.color + "60";
                  e.currentTarget.style.boxShadow = `0 0 20px ${game.color}15, inset 0 1px 0 rgba(255,255,255,0.05)`;
                }}
              >
                <div style={{ 
                  fontSize: 48, 
                  marginBottom: 16,
                  filter: game.icon !== "gamepad" ? `drop-shadow(0 0 15px ${game.color}80) drop-shadow(0 0 30px ${game.color}40)` : `drop-shadow(0 0 15px ${game.color}60)`,
                }}>
                  {game.icon === "gamepad" ? <GamepadIcon size={48} color={game.color} /> : game.icon}
                </div>
                <h2 style={{ 
                  fontSize: 24, 
                  fontWeight: 700, 
                  fontFamily: "var(--font-display)",
                  letterSpacing: "-0.01em",
                  color: game.color,
                  margin: "0 0 8px 0",
                  textShadow: `0 0 20px ${game.color}40`,
                }}>
                  {game.name}
                </h2>
                <p style={{ 
                  fontSize: 14, 
                  fontFamily: "var(--font-body)",
                  color: "var(--alzooka-cream)", 
                  opacity: 0.85,
                  margin: 0,
                  lineHeight: 1.6,
                }}>
                  {game.description}
                </p>
                {game.available && (
                  <div style={{
                    marginTop: 16,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    background: game.color + "20",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "var(--font-display)",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: game.color,
                  }}>
                    Play Now →
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
