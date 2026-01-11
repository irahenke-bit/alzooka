"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";

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
      id: "coming-soon-1",
      name: "Coming Soon",
      description: "More games are on the way...",
      icon: "🎮",
      href: "#",
      color: "#666",
      available: false,
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
            fontSize: 36, 
            fontWeight: 700, 
            color: "var(--alzooka-cream)",
            margin: "0 0 12px 0",
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
                cursor: game.available ? "pointer" : "not-allowed",
              }}
              onClick={(e) => !game.available && e.preventDefault()}
            >
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 100%)",
                  borderRadius: 16,
                  padding: 24,
                  border: `2px solid ${game.available ? game.color + "40" : "rgba(255,255,255,0.1)"}`,
                  transition: "all 0.3s ease",
                  opacity: game.available ? 1 : 0.5,
                }}
                onMouseEnter={(e) => {
                  if (game.available) {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.borderColor = game.color;
                    e.currentTarget.style.boxShadow = `0 8px 32px ${game.color}30`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = game.available ? game.color + "40" : "rgba(255,255,255,0.1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ 
                  fontSize: 48, 
                  marginBottom: 16,
                  filter: game.available ? `drop-shadow(0 4px 8px ${game.color}40)` : "grayscale(1)",
                }}>
                  {game.icon}
                </div>
                <h2 style={{ 
                  fontSize: 22, 
                  fontWeight: 600, 
                  color: game.available ? game.color : "var(--alzooka-cream)",
                  margin: "0 0 8px 0",
                }}>
                  {game.name}
                </h2>
                <p style={{ 
                  fontSize: 14, 
                  color: "var(--alzooka-cream)", 
                  opacity: 0.7,
                  margin: 0,
                  lineHeight: 1.5,
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
                    fontSize: 13,
                    fontWeight: 600,
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
