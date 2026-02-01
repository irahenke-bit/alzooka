"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";

// Dev-only game - redirect in production
const isDev = process.env.NODE_ENV === "development";

type UserData = {
  id: string;
  username: string;
  avatar_url: string | null;
};

// Game constants
const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;
const LANE_COUNT = 5;
const LANE_WIDTH = GAME_WIDTH / LANE_COUNT;
const WAVE_SIZE = 50;
const BASE_SCROLL_SPEED = 3;
const SPAWN_INTERVAL = 60; // frames between spawns
const SPEED_INCREASE_DISTANCE = 1000; // Every 1000m
const SPEED_INCREASE_PERCENT = 0.05; // 5% faster

// Item types
type ItemType = "obstacle" | "amp" | "speaker" | "mic" | "guitar" | "boost";

interface GameItem {
  id: number;
  lane: number;
  y: number;
  type: ItemType;
  value: number;
}

const ITEM_CONFIGS: Record<ItemType, { emoji: string; color: string; isGood: boolean }> = {
  obstacle: { emoji: "⛔", color: "#0165FC", isGood: false },
  amp: { emoji: "🔊", color: "#0165FC", isGood: true },
  speaker: { emoji: "📻", color: "#0165FC", isGood: true },
  mic: { emoji: "🎤", color: "#0165FC", isGood: true },
  guitar: { emoji: "🎸", color: "#0165FC", isGood: true },
  boost: { emoji: "⚡", color: "#0165FC", isGood: true },
};

export default function SoundWavePage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Game state
  const [waveLane, setWaveLane] = useState(2); // Middle lane (0-4)
  const [power, setPower] = useState(10);
  const [score, setScore] = useState(0);
  const [items, setItems] = useState<GameItem[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [boosted, setBoosted] = useState(false);
  const [boostTimer, setBoostTimer] = useState(0);
  const [distance, setDistance] = useState(0);
  
  const frameRef = useRef(0);
  const itemIdRef = useRef(0);
  const gameLoopRef = useRef<number | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  
  const supabase = createBrowserClient();
  const router = useRouter();

  // Spawn new items
  const spawnItem = useCallback(() => {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const rand = Math.random();
    
    let type: ItemType;
    let value: number;
    
    if (rand < 0.4) {
      // 40% obstacles
      type = "obstacle";
      value = Math.floor(Math.random() * 5) + 1 + Math.floor(distance / 500); // Harder over time
    } else if (rand < 0.6) {
      // 20% amps
      type = "amp";
      value = Math.floor(Math.random() * 3) + 2;
    } else if (rand < 0.75) {
      // 15% speakers
      type = "speaker";
      value = Math.floor(Math.random() * 2) + 3;
    } else if (rand < 0.85) {
      // 10% mics
      type = "mic";
      value = Math.floor(Math.random() * 2) + 2;
    } else if (rand < 0.95) {
      // 10% guitars
      type = "guitar";
      value = Math.floor(Math.random() * 3) + 4;
    } else {
      // 5% boost
      type = "boost";
      value = 5; // seconds of boost
    }
    
    const newItem: GameItem = {
      id: itemIdRef.current++,
      lane,
      y: -60,
      type,
      value,
    };
    
    setItems(prev => [...prev, newItem]);
  }, [distance]);

  // Calculate current speed based on distance
  const getCurrentSpeed = useCallback((dist: number) => {
    const speedMultiplier = 1 + Math.floor(dist / SPEED_INCREASE_DISTANCE) * SPEED_INCREASE_PERCENT;
    return BASE_SCROLL_SPEED * speedMultiplier;
  }, []);

  // Game loop
  const gameLoop = useCallback(() => {
    if (gameOver || !gameStarted) return;
    
    frameRef.current++;
    
    // Calculate current speed
    const currentSpeed = getCurrentSpeed(distance);
    
    // Handle continuous movement
    if (keysRef.current.has("ArrowLeft") || keysRef.current.has("KeyA")) {
      setWaveLane(prev => Math.max(0, prev - 0.15));
    }
    if (keysRef.current.has("ArrowRight") || keysRef.current.has("KeyD")) {
      setWaveLane(prev => Math.min(LANE_COUNT - 1, prev + 0.15));
    }
    
    // Update distance
    setDistance(prev => prev + currentSpeed);
    
    // Update boost timer
    if (boosted) {
      setBoostTimer(prev => {
        if (prev <= 0) {
          setBoosted(false);
          return 0;
        }
        return prev - 1/60;
      });
    }
    
    // Spawn items
    if (frameRef.current % SPAWN_INTERVAL === 0) {
      spawnItem();
    }
    
    // Move items and check collisions
    setItems(prev => {
      const newItems: GameItem[] = [];
      const waveX = Math.round(waveLane) * LANE_WIDTH + LANE_WIDTH / 2;
      const waveY = GAME_HEIGHT - 100;
      
      for (const item of prev) {
        const newY = item.y + currentSpeed + (boosted ? 2 : 0);
        
        // Check collision
        const itemX = item.lane * LANE_WIDTH + LANE_WIDTH / 2;
        const itemY = newY + 30;
        
        const dx = Math.abs(itemX - waveX);
        const dy = Math.abs(itemY - waveY);
        
        if (dx < LANE_WIDTH * 0.6 && dy < 40) {
          // Collision!
          const config = ITEM_CONFIGS[item.type];
          
          if (config.isGood) {
            if (item.type === "boost") {
              setBoosted(true);
              setBoostTimer(item.value);
              setScore(s => s + 50);
            } else {
              setPower(p => p + item.value);
              setCombo(c => c + 1);
              const points = item.value * 10 * (boosted ? 2 : 1) * (1 + combo * 0.1);
              setScore(s => s + Math.floor(points));
            }
          } else {
            // Hit obstacle
            if (boosted) {
              // Boosted = smash through obstacles for bonus points!
              const smashPoints = 100 + (item.value * 20); // 100+ points per smash!
              setScore(s => s + smashPoints);
              setCombo(c => c + 1);
              setPower(p => p + 2); // Gain 2 power for smashing!
            } else {
              // Not boosted = take damage
              setPower(p => {
                const newPower = p - item.value;
                if (newPower <= 0) {
                  setGameOver(true);
                  if (score > highScore) {
                    setHighScore(score);
                  }
                }
                return Math.max(0, newPower);
              });
              setCombo(0);
            }
          }
          continue; // Don't add to new items
        }
        
        // Remove if off screen
        if (newY > GAME_HEIGHT + 50) {
          continue;
        }
        
        newItems.push({ ...item, y: newY });
      }
      
      return newItems;
    });
    
    // Add distance score
    if (frameRef.current % 30 === 0) {
      setScore(s => s + 1);
    }
    
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameOver, gameStarted, waveLane, spawnItem, boosted, combo, score, highScore]);

  // Start game
  const startGame = useCallback(() => {
    setWaveLane(2);
    setPower(10);
    setScore(0);
    setItems([]);
    setGameOver(false);
    setGameStarted(true);
    setCombo(0);
    setBoosted(false);
    setBoostTimer(0);
    setDistance(0);
    frameRef.current = 0;
    itemIdRef.current = 0;
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      
      if (!gameStarted || gameOver) {
        if (e.code === "Space" || e.code === "Enter") {
          startGame();
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameStarted, gameOver, startGame]);

  // Game loop
  useEffect(() => {
    if (gameStarted && !gameOver) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameStarted, gameOver, gameLoop]);

  // Initialize
  useEffect(() => {
    async function init() {
      // Redirect to home in production - this game is dev-only
      if (!isDev) {
        router.push("/");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);

      const { data: userInfo } = await supabase
        .from("users")
        .select("id, username, avatar_url")
        .eq("id", currentUser.id)
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
      <div style={{ minHeight: "100vh", background: "var(--bg-card)" }}>
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
            border: "3px solid rgba(6, 182, 212, 0.2)",
            borderTopColor: "#0165FC",
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

  const waveX = Math.round(waveLane) * LANE_WIDTH + LANE_WIDTH / 2;

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "linear-gradient(180deg, #000000 0%, #000000 50%, #000000 100%)",
    }}>
      <Header 
        user={user} 
        userUsername={userData?.username || null} 
        userAvatarUrl={userData?.avatar_url || null} 
      />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px" }}>
        {/* Back link */}
        <Link 
          href="/game-hub" 
          style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: 8, 
            color: "#0165FC", 
            textDecoration: "none",
            fontSize: 14,
            marginBottom: 20,
          }}
        >
          ← Back to Game Hub
        </Link>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ 
            fontSize: 36, 
            fontWeight: 800, 
            color: "#0165FC",
            margin: 0,
            textShadow: "0 0 20px rgba(6, 182, 212, 0.5)",
            letterSpacing: 2,
          }}>
            🔊 SOUND WAVE 🔊
          </h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, margin: "8px 0 0 0" }}>
            Collect amps • Dodge obstacles • Ride the wave!
          </p>
        </div>

        <div style={{ display: "flex", gap: 24, justifyContent: "center" }}>
          {/* Game Area */}
          <div style={{
            position: "relative",
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
            background: "linear-gradient(180deg, #000000 0%, #000000 100%)",
            borderRadius: 12,
            overflow: "hidden",
            border: "2px solid #0165FC40",
          }}>
            {/* Lane lines */}
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: i * LANE_WIDTH,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: "rgba(6, 182, 212, 0.1)",
                }}
              />
            ))}

            {/* Scrolling background effect */}
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 50px,
                rgba(6, 182, 212, 0.03) 50px,
                rgba(6, 182, 212, 0.03) 51px
              )`,
              transform: `translateY(${distance % 51}px)`,
            }} />

            {/* Items */}
            {items.map(item => {
              const config = ITEM_CONFIGS[item.type];
              const isObstacle = !config.isGood;
              return (
                <div
                  key={item.id}
                  style={{
                    position: "absolute",
                    left: item.lane * LANE_WIDTH + LANE_WIDTH / 2 - 30,
                    top: item.y,
                    width: 60,
                    height: 55,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                    borderRadius: isObstacle ? 4 : 12,
                    background: isObstacle 
                      ? "linear-gradient(180deg, #000000 0%, #000000 100%)"
                      : `radial-gradient(circle, ${config.color}30 0%, rgba(0,50,0,0.8) 100%)`,
                    border: isObstacle 
                      ? "3px solid #0165FC" 
                      : `2px solid ${config.color}`,
                    boxShadow: isObstacle
                      ? "0 0 15px rgba(239, 68, 68, 0.6), inset 0 0 10px rgba(0,0,0,0.5)"
                      : `0 0 15px ${config.color}60, inset 0 0 10px rgba(0,0,0,0.3)`,
                  }}
                >
                  <span style={{ filter: isObstacle ? "none" : "drop-shadow(0 0 4px #0165FC)" }}>
                    {config.emoji}
                  </span>
                  <span style={{ 
                    fontSize: 11, 
                    color: isObstacle ? "rgba(255,255,255,0.8)" : "#0165FC",
                    fontWeight: 700,
                    textShadow: isObstacle ? "0 0 4px #0165FC" : "0 0 4px #0165FC",
                  }}>
                    {config.isGood ? `+${item.value}` : `-${item.value}`}
                  </span>
                </div>
              );
            })}

            {/* Sound Wave (Player) */}
            <div
              style={{
                position: "absolute",
                left: waveX - WAVE_SIZE / 2,
                top: GAME_HEIGHT - 100,
                width: WAVE_SIZE,
                height: WAVE_SIZE,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                transition: "left 0.05s ease-out",
              }}
            >
              {/* Wave visual */}
              <svg width={WAVE_SIZE} height={WAVE_SIZE} viewBox="0 0 50 50">
                <defs>
                  <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0165FC" />
                    <stop offset="50%" stopColor="#0165FC" />
                    <stop offset="100%" stopColor="#0165FC" />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                {/* Wave shape */}
                <path
                  d="M 5 25 Q 12 10 20 25 Q 28 40 35 25 Q 42 10 45 25"
                  fill="none"
                  stroke={boosted ? "#0165FC" : "url(#waveGrad)"}
                  strokeWidth="4"
                  strokeLinecap="round"
                  filter="url(#glow)"
                />
                {/* Power circle */}
                <circle
                  cx="25"
                  cy="25"
                  r="18"
                  fill="rgba(6, 182, 212, 0.2)"
                  stroke={boosted ? "#0165FC" : "#0165FC"}
                  strokeWidth="2"
                />
                <text
                  x="25"
                  y="30"
                  textAnchor="middle"
                  fill={boosted ? "#0165FC" : "#fff"}
                  fontSize="14"
                  fontWeight="bold"
                >
                  {power}
                </text>
              </svg>
              
              {/* Boost indicator */}
              {boosted && (
                <div style={{
                  position: "absolute",
                  top: -20,
                  fontSize: 16,
                  color: "#0165FC",
                  animation: "pulse 0.5s ease-in-out infinite",
                }}>
                  ⚡ BOOST ⚡
                </div>
              )}
            </div>

            {/* Game Over / Start overlay */}
            {(!gameStarted || gameOver) && (
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.85)",
              }}>
                {gameOver ? (
                  <>
                    <div style={{ fontSize: 32, fontWeight: 800, color: "#0165FC", marginBottom: 8 }}>
                      SIGNAL LOST
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
                      Final Score: {score.toLocaleString()}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: 16, fontSize: 14 }}>
                      Distance: {Math.floor(distance)}m
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 24, fontWeight: 600, color: "#ffffff", marginBottom: 12 }}>
                      Ready to Ride the Wave?
                    </div>
                    <div style={{ fontSize: 14, marginBottom: 16, textAlign: "center" }}>
                      <span style={{ color: "#0165FC", fontWeight: 600 }}>GREEN = COLLECT</span>
                      <span style={{ color: "rgba(255,255,255,0.7)" }}> (🔊 🎸 🎤)</span><br/>
                      <span style={{ color: "#0165FC", fontWeight: 600 }}>RED = AVOID</span>
                      <span style={{ color: "rgba(255,255,255,0.7)" }}> (⛔)</span><br/>
                      <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>Don't let your power hit 0!</span>
                    </div>
                  </>
                )}
                <button
                  onClick={startGame}
                  style={{
                    padding: "12px 32px",
                    fontSize: 16,
                    fontWeight: 600,
                    background: "#0165FC",
                    color: "#000",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  {gameOver ? "Play Again" : "Start Game"}
                </button>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 12 }}>
                  Use ← → or A/D to move
                </p>
              </div>
            )}
          </div>

          {/* Side Panel */}
          <div style={{ width: 140 }}>
            {/* Score */}
            <div style={{
              background: "rgba(0,0,0,0.4)",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
              border: "1px solid #0165FC30",
            }}>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 4 }}>SCORE</div>
              <div style={{ color: "#0165FC", fontSize: 24, fontWeight: 700 }}>
                {score.toLocaleString()}
              </div>
              {combo > 2 && (
                <div style={{ color: "#0165FC", fontSize: 12, marginTop: 4 }}>
                  🔥 {combo}x COMBO!
                </div>
              )}
            </div>

            {/* Power */}
            <div style={{
              background: "rgba(0,0,0,0.4)",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
              border: "1px solid #0165FC30",
            }}>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 4 }}>POWER</div>
              <div style={{ 
                color: power <= 3 ? "#0165FC" : power <= 6 ? "#0165FC" : "#0165FC", 
                fontSize: 28, 
                fontWeight: 700 
              }}>
                {power}
              </div>
              <div style={{
                marginTop: 8,
                height: 6,
                background: "var(--bg-card)",
                borderRadius: 3,
                overflow: "hidden",
              }}>
                <div style={{
                  width: `${Math.min(100, power * 5)}%`,
                  height: "100%",
                  background: power <= 3 ? "#0165FC" : power <= 6 ? "#0165FC" : "#0165FC",
                  transition: "width 0.2s",
                }} />
              </div>
            </div>

            {/* Distance & Speed */}
            <div style={{
              background: "rgba(0,0,0,0.4)",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
              border: "1px solid #0165FC30",
            }}>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 4 }}>DISTANCE</div>
              <div style={{ color: "#ffffff", fontSize: 18, fontWeight: 600 }}>
                {Math.floor(distance)}m
              </div>
              <div style={{ 
                color: "#0165FC", 
                fontSize: 11, 
                marginTop: 6,
                fontWeight: 600,
              }}>
                ⚡ {Math.round((1 + Math.floor(distance / SPEED_INCREASE_DISTANCE) * SPEED_INCREASE_PERCENT) * 100)}% speed
              </div>
            </div>

            {/* High Score */}
            <div style={{
              background: "rgba(0,0,0,0.4)",
              borderRadius: 8,
              padding: 16,
              border: "1px solid #0165FC30",
            }}>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 4 }}>HIGH SCORE</div>
              <div style={{ color: "#0165FC", fontSize: 16, fontWeight: 600 }}>
                {highScore.toLocaleString()}
              </div>
            </div>

            {/* Legend */}
            <div style={{
              marginTop: 16,
              padding: 12,
              background: "rgba(0,0,0,0.3)",
              borderRadius: 8,
              fontSize: 11,
            }}>
              <div style={{ color: "#0165FC", marginBottom: 6, fontWeight: 600 }}>✓ COLLECT (Green)</div>
              <div style={{ color: "#0165FC", marginBottom: 2 }}>🔊 🎸 🎤 📻</div>
              <div style={{ color: "rgba(255,255,255,0.7)", marginBottom: 8, fontSize: 10 }}>Adds power</div>
              
              <div style={{ color: "#0165FC", marginBottom: 4 }}>⚡ Boost = SMASH!</div>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, marginBottom: 4 }}>Hit ⛔ = +100 pts +2 pwr</div>
              
              <div style={{ color: "#0165FC", marginBottom: 6, fontWeight: 600, marginTop: 8 }}>✗ AVOID (Red)</div>
              <div style={{ color: "rgba(255,255,255,0.8)" }}>⛔ Drains power!</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
