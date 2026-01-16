"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";

type UserData = {
  id: string;
  username: string;
  avatar_url: string | null;
};

// Upgrade types
type Upgrade = {
  id: string;
  name: string;
  description: string;
  icon: string;
  baseCost: number;
  costMultiplier: number;
  zpsBonus: number; // Zooka coins per second
  zpcBonus: number; // Zooka coins per click
  category: "instrument" | "gear" | "band" | "venue" | "skill";
  maxLevel: number;
  unlockAt: number; // Total ZC earned to unlock
};

// Fame levels
const FAME_LEVELS = [
  { name: "Street Performer", minEarnings: 0, icon: "🎸" },
  { name: "Subway Star", minEarnings: 1000, icon: "🚇" },
  { name: "Coffee Shop Regular", minEarnings: 10000, icon: "☕" },
  { name: "Local Favorite", minEarnings: 50000, icon: "⭐" },
  { name: "Club Headliner", minEarnings: 200000, icon: "🎤" },
  { name: "Festival Act", minEarnings: 1000000, icon: "🎪" },
  { name: "Arena Rocker", minEarnings: 5000000, icon: "🏟️" },
  { name: "Platinum Artist", minEarnings: 25000000, icon: "💿" },
  { name: "Music Legend", minEarnings: 100000000, icon: "👑" },
  { name: "Hall of Fame", minEarnings: 500000000, icon: "🏆" },
];

// All upgrades
const UPGRADES: Upgrade[] = [
  // Instruments
  { id: "guitar", name: "Acoustic Guitar", description: "A basic guitar to strum some tunes", icon: "🎸", baseCost: 50, costMultiplier: 1.15, zpsBonus: 1, zpcBonus: 0, category: "instrument", maxLevel: 50, unlockAt: 0 },
  { id: "keyboard", name: "Keyboard", description: "Add some keys to your sound", icon: "🎹", baseCost: 300, costMultiplier: 1.15, zpsBonus: 5, zpcBonus: 0, category: "instrument", maxLevel: 50, unlockAt: 500 },
  { id: "electric", name: "Electric Guitar", description: "Time to plug in and rock out", icon: "🎸", baseCost: 2000, costMultiplier: 1.15, zpsBonus: 25, zpcBonus: 0, category: "instrument", maxLevel: 50, unlockAt: 5000 },
  { id: "drums", name: "Drum Kit", description: "Keep the beat going strong", icon: "🥁", baseCost: 10000, costMultiplier: 1.15, zpsBonus: 100, zpcBonus: 0, category: "instrument", maxLevel: 50, unlockAt: 25000 },
  { id: "bass", name: "Bass Guitar", description: "Drop that bass line", icon: "🎸", baseCost: 50000, costMultiplier: 1.15, zpsBonus: 400, zpcBonus: 0, category: "instrument", maxLevel: 50, unlockAt: 100000 },
  { id: "synth", name: "Synthesizer", description: "Electronic sounds for the modern musician", icon: "🎛️", baseCost: 250000, costMultiplier: 1.15, zpsBonus: 1500, zpcBonus: 0, category: "instrument", maxLevel: 50, unlockAt: 500000 },
  
  // Gear
  { id: "amp", name: "Amplifier", description: "Make yourself heard", icon: "🔊", baseCost: 100, costMultiplier: 1.15, zpsBonus: 2, zpcBonus: 0, category: "gear", maxLevel: 50, unlockAt: 100 },
  { id: "mic", name: "Microphone", description: "Sing your heart out", icon: "🎤", baseCost: 500, costMultiplier: 1.15, zpsBonus: 8, zpcBonus: 0, category: "gear", maxLevel: 50, unlockAt: 1000 },
  { id: "pedals", name: "Effects Pedals", description: "Add some flair to your sound", icon: "🎚️", baseCost: 5000, costMultiplier: 1.15, zpsBonus: 50, zpcBonus: 0, category: "gear", maxLevel: 50, unlockAt: 15000 },
  { id: "mixer", name: "Mixing Board", description: "Professional sound mixing", icon: "🎛️", baseCost: 75000, costMultiplier: 1.15, zpsBonus: 500, zpcBonus: 0, category: "gear", maxLevel: 50, unlockAt: 150000 },
  
  // Band Members
  { id: "drummer", name: "Hire Drummer", description: "A drummer to keep the rhythm", icon: "🧑‍🎤", baseCost: 1500, costMultiplier: 1.2, zpsBonus: 15, zpcBonus: 0, category: "band", maxLevel: 25, unlockAt: 3000 },
  { id: "bassist", name: "Hire Bassist", description: "Someone to hold down the low end", icon: "🧑‍🎤", baseCost: 8000, costMultiplier: 1.2, zpsBonus: 75, zpcBonus: 0, category: "band", maxLevel: 25, unlockAt: 20000 },
  { id: "keyboardist", name: "Hire Keyboardist", description: "Ivory tickler for hire", icon: "🧑‍🎤", baseCost: 40000, costMultiplier: 1.2, zpsBonus: 300, zpcBonus: 0, category: "band", maxLevel: 25, unlockAt: 80000 },
  { id: "backup", name: "Backup Singers", description: "Harmonies that wow the crowd", icon: "👯", baseCost: 200000, costMultiplier: 1.2, zpsBonus: 1200, zpcBonus: 0, category: "band", maxLevel: 25, unlockAt: 400000 },
  
  // Venues
  { id: "corner", name: "Better Corner", description: "A busier street corner", icon: "🏙️", baseCost: 200, costMultiplier: 1.25, zpsBonus: 3, zpcBonus: 0, category: "venue", maxLevel: 20, unlockAt: 200 },
  { id: "subway", name: "Subway Station", description: "More foot traffic underground", icon: "🚇", baseCost: 2500, costMultiplier: 1.25, zpsBonus: 30, zpcBonus: 0, category: "venue", maxLevel: 20, unlockAt: 7500 },
  { id: "cafe", name: "Coffee Shop Gig", description: "A cozy venue with loyal fans", icon: "☕", baseCost: 25000, costMultiplier: 1.25, zpsBonus: 200, zpcBonus: 0, category: "venue", maxLevel: 20, unlockAt: 60000 },
  { id: "club", name: "Club Residency", description: "Regular gigs at a local club", icon: "🎵", baseCost: 150000, costMultiplier: 1.25, zpsBonus: 1000, zpcBonus: 0, category: "venue", maxLevel: 20, unlockAt: 300000 },
  { id: "arena", name: "Arena Shows", description: "The big time!", icon: "🏟️", baseCost: 1000000, costMultiplier: 1.25, zpsBonus: 5000, zpcBonus: 0, category: "venue", maxLevel: 20, unlockAt: 2000000 },
  
  // Skills (boost click earnings)
  { id: "strumming", name: "Strumming Practice", description: "Faster fingers, more tips", icon: "✋", baseCost: 25, costMultiplier: 1.1, zpsBonus: 0, zpcBonus: 1, category: "skill", maxLevel: 100, unlockAt: 0 },
  { id: "showmanship", name: "Showmanship", description: "Wow the crowd with your moves", icon: "💃", baseCost: 750, costMultiplier: 1.12, zpsBonus: 0, zpcBonus: 5, category: "skill", maxLevel: 100, unlockAt: 2000 },
  { id: "vocals", name: "Vocal Training", description: "Sing better, earn more", icon: "🗣️", baseCost: 5000, costMultiplier: 1.12, zpsBonus: 0, zpcBonus: 20, category: "skill", maxLevel: 100, unlockAt: 12000 },
  { id: "charisma", name: "Crowd Charisma", description: "Make them fall in love with you", icon: "💖", baseCost: 35000, costMultiplier: 1.12, zpsBonus: 0, zpcBonus: 75, category: "skill", maxLevel: 100, unlockAt: 75000 },
  { id: "fame", name: "Social Media Fame", description: "Go viral, get tips from fans worldwide", icon: "📱", baseCost: 500000, costMultiplier: 1.15, zpsBonus: 0, zpcBonus: 500, category: "skill", maxLevel: 50, unlockAt: 1000000 },
];

// Format large numbers
function formatNumber(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return Math.floor(num).toString();
}

// Calculate upgrade cost at level
function getUpgradeCost(upgrade: Upgrade, level: number): number {
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, level));
}

export default function MusicianBeggarPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Game state
  const [zc, setZc] = useState(0); // Current Zooka Coins
  const [totalEarned, setTotalEarned] = useState(0); // Lifetime earnings
  const [zps, setZps] = useState(0); // Zooka coins per second
  const [zpc, setZpc] = useState(1); // Zooka coins per click
  const [upgradeLevels, setUpgradeLevels] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [clickEffects, setClickEffects] = useState<Array<{ id: number; x: number; y: number; amount: number }>>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const effectIdRef = useRef(0);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const saveLoopRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createBrowserClient();
  const router = useRouter();

  // Calculate current fame level
  const getCurrentFameLevel = useCallback(() => {
    for (let i = FAME_LEVELS.length - 1; i >= 0; i--) {
      if (totalEarned >= FAME_LEVELS[i].minEarnings) {
        return FAME_LEVELS[i];
      }
    }
    return FAME_LEVELS[0];
  }, [totalEarned]);

  // Get next fame level
  const getNextFameLevel = useCallback(() => {
    const currentIndex = FAME_LEVELS.findIndex(f => f.name === getCurrentFameLevel().name);
    if (currentIndex < FAME_LEVELS.length - 1) {
      return FAME_LEVELS[currentIndex + 1];
    }
    return null;
  }, [getCurrentFameLevel]);

  // Recalculate ZPS and ZPC from upgrades
  const recalculateStats = useCallback((levels: Record<string, number>) => {
    let newZps = 0;
    let newZpc = 1; // Base click value
    
    for (const upgrade of UPGRADES) {
      const level = levels[upgrade.id] || 0;
      newZps += upgrade.zpsBonus * level;
      newZpc += upgrade.zpcBonus * level;
    }
    
    setZps(newZps);
    setZpc(newZpc);
  }, []);

  // Load game state
  const loadGame = useCallback(() => {
    try {
      const saved = localStorage.getItem("musician-beggar-save");
      if (saved) {
        const data = JSON.parse(saved);
        setZc(data.zc || 0);
        setTotalEarned(data.totalEarned || 0);
        setUpgradeLevels(data.upgradeLevels || {});
        recalculateStats(data.upgradeLevels || {});
        
        // Calculate offline earnings (max 8 hours)
        if (data.lastSave) {
          const offlineSeconds = Math.min((Date.now() - data.lastSave) / 1000, 8 * 60 * 60);
          let offlineZps = 0;
          for (const upgrade of UPGRADES) {
            const level = data.upgradeLevels?.[upgrade.id] || 0;
            offlineZps += upgrade.zpsBonus * level;
          }
          const offlineEarnings = Math.floor(offlineSeconds * offlineZps * 0.5); // 50% efficiency while offline
          if (offlineEarnings > 0) {
            setZc(prev => prev + offlineEarnings);
            setTotalEarned(prev => prev + offlineEarnings);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load game:", e);
    }
  }, [recalculateStats]);

  // Save game state
  const saveGame = useCallback(() => {
    try {
      const data = {
        zc,
        totalEarned,
        upgradeLevels,
        lastSave: Date.now(),
      };
      localStorage.setItem("musician-beggar-save", JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save game:", e);
    }
  }, [zc, totalEarned, upgradeLevels]);

  // Handle click
  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setZc(prev => prev + zpc);
    setTotalEarned(prev => prev + zpc);
    setIsPlaying(true);
    
    // Add click effect
    const effectId = effectIdRef.current++;
    setClickEffects(prev => [...prev, { id: effectId, x, y, amount: zpc }]);
    
    // Remove effect after animation
    setTimeout(() => {
      setClickEffects(prev => prev.filter(e => e.id !== effectId));
    }, 1000);
    
    // Reset playing animation
    setTimeout(() => setIsPlaying(false), 150);
  }, [zpc]);

  // Buy upgrade
  const buyUpgrade = useCallback((upgradeId: string) => {
    const upgrade = UPGRADES.find(u => u.id === upgradeId);
    if (!upgrade) return;
    
    const currentLevel = upgradeLevels[upgradeId] || 0;
    if (currentLevel >= upgrade.maxLevel) return;
    
    const cost = getUpgradeCost(upgrade, currentLevel);
    if (zc < cost) return;
    
    setZc(prev => prev - cost);
    setUpgradeLevels(prev => {
      const newLevels = { ...prev, [upgradeId]: currentLevel + 1 };
      recalculateStats(newLevels);
      return newLevels;
    });
  }, [zc, upgradeLevels, recalculateStats]);

  // Initialize
  useEffect(() => {
    async function init() {
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

      loadGame();
      setLoading(false);
    }

    init();
  }, [supabase, router, loadGame]);

  // Game loop for passive income
  useEffect(() => {
    if (loading) return;
    
    gameLoopRef.current = setInterval(() => {
      if (zps > 0) {
        const earned = zps / 10; // Update 10 times per second
        setZc(prev => prev + earned);
        setTotalEarned(prev => prev + earned);
      }
    }, 100);
    
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [loading, zps]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (loading) return;
    
    saveLoopRef.current = setInterval(saveGame, 30000);
    
    // Save on unmount
    return () => {
      if (saveLoopRef.current) clearInterval(saveLoopRef.current);
      saveGame();
    };
  }, [loading, saveGame]);

  // Save before leaving
  useEffect(() => {
    const handleBeforeUnload = () => saveGame();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveGame]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a" }}>
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
            border: "3px solid rgba(234, 179, 8, 0.2)",
            borderTopColor: "#eab308",
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

  const fameLevel = getCurrentFameLevel();
  const nextFame = getNextFameLevel();
  const fameProgress = nextFame 
    ? ((totalEarned - fameLevel.minEarnings) / (nextFame.minEarnings - fameLevel.minEarnings)) * 100
    : 100;

  const categories = [
    { id: "all", name: "All", icon: "🎵" },
    { id: "skill", name: "Skills", icon: "✋" },
    { id: "instrument", name: "Instruments", icon: "🎸" },
    { id: "gear", name: "Gear", icon: "🔊" },
    { id: "band", name: "Band", icon: "🧑‍🎤" },
    { id: "venue", name: "Venues", icon: "🏙️" },
  ];

  const filteredUpgrades = UPGRADES.filter(u => 
    (selectedCategory === "all" || u.category === selectedCategory) &&
    totalEarned >= u.unlockAt * 0.5 // Show when at 50% of unlock requirement
  );

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "linear-gradient(180deg, #0f0a1a 0%, #1a0f2e 50%, #0f0a1a 100%)",
    }}>
      <Header 
        user={user} 
        userUsername={userData?.username || null} 
        userAvatarUrl={userData?.avatar_url || null} 
      />

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px" }}>
        {/* Back link */}
        <Link 
          href="/game-hub" 
          style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: 8, 
            color: "#eab308", 
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
            color: "#eab308",
            margin: 0,
            textShadow: "0 0 20px rgba(234, 179, 8, 0.5)",
            fontFamily: "system-ui",
            letterSpacing: 2,
          }}>
            🎸 MUSICIAN BEGGAR 🎸
          </h1>
          <p style={{ color: "#888", fontSize: 14, margin: "8px 0 0 0" }}>
            {fameLevel.icon} {fameLevel.name}
          </p>
        </div>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
          {/* Left Panel - Click Area */}
          <div style={{ flex: "0 0 320px" }}>
            {/* ZC Display */}
            <div style={{
              background: "rgba(0,0,0,0.6)",
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              border: "2px solid #eab30840",
              textAlign: "center",
            }}>
              <div style={{ color: "#888", fontSize: 12, marginBottom: 4, letterSpacing: 1 }}>ZOOKA COINS</div>
              <div style={{ 
                color: "#eab308", 
                fontSize: 36, 
                fontWeight: 800,
                textShadow: "0 0 20px rgba(234, 179, 8, 0.5)",
              }}>
                {formatNumber(zc)} ZC
              </div>
              <div style={{ color: "#666", fontSize: 12, marginTop: 8 }}>
                {formatNumber(zpc)} per click • {formatNumber(zps)}/sec
              </div>
            </div>

            {/* Click Button */}
            <div style={{
              background: "rgba(0,0,0,0.6)",
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              border: "2px solid #eab30840",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}>
              <button
                onClick={handleClick}
                style={{
                  width: 200,
                  height: 200,
                  borderRadius: "50%",
                  background: isPlaying 
                    ? "radial-gradient(circle, #fbbf24 0%, #eab308 50%, #ca8a04 100%)"
                    : "radial-gradient(circle, #eab308 0%, #ca8a04 50%, #a16207 100%)",
                  border: "4px solid #fbbf24",
                  cursor: "pointer",
                  fontSize: 64,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: isPlaying
                    ? "0 0 40px rgba(234, 179, 8, 0.8), inset 0 -4px 20px rgba(0,0,0,0.3)"
                    : "0 0 20px rgba(234, 179, 8, 0.4), inset 0 -4px 20px rgba(0,0,0,0.3)",
                  transform: isPlaying ? "scale(0.95)" : "scale(1)",
                  transition: "transform 0.1s, box-shadow 0.1s, background 0.1s",
                  position: "relative",
                  overflow: "visible",
                }}
              >
                🎸
                {/* Click effects */}
                {clickEffects.map(effect => (
                  <div
                    key={effect.id}
                    style={{
                      position: "absolute",
                      left: effect.x,
                      top: effect.y,
                      color: "#fbbf24",
                      fontSize: 18,
                      fontWeight: 700,
                      pointerEvents: "none",
                      animation: "floatUp 1s ease-out forwards",
                      textShadow: "0 0 10px rgba(234, 179, 8, 0.8)",
                    }}
                  >
                    +{formatNumber(effect.amount)}
                  </div>
                ))}
              </button>
            </div>

            {/* Fame Progress */}
            <div style={{
              background: "rgba(0,0,0,0.6)",
              borderRadius: 16,
              padding: 16,
              border: "2px solid #eab30840",
            }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: 8,
              }}>
                <span style={{ color: "#eab308", fontSize: 14, fontWeight: 600 }}>
                  {fameLevel.icon} {fameLevel.name}
                </span>
                {nextFame && (
                  <span style={{ color: "#666", fontSize: 12 }}>
                    → {nextFame.icon} {nextFame.name}
                  </span>
                )}
              </div>
              <div style={{
                height: 8,
                background: "#1a1a1a",
                borderRadius: 4,
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(fameProgress, 100)}%`,
                  background: "linear-gradient(90deg, #eab308, #fbbf24)",
                  borderRadius: 4,
                  transition: "width 0.3s",
                }} />
              </div>
              <div style={{ color: "#666", fontSize: 11, marginTop: 6, textAlign: "center" }}>
                Total earned: {formatNumber(totalEarned)} ZC
                {nextFame && ` • Next: ${formatNumber(nextFame.minEarnings)} ZC`}
              </div>
            </div>
          </div>

          {/* Right Panel - Upgrades */}
          <div style={{ flex: "1 1 500px", minWidth: 300 }}>
            {/* Category Tabs */}
            <div style={{
              display: "flex",
              gap: 8,
              marginBottom: 16,
              flexWrap: "wrap",
            }}>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 20,
                    border: selectedCategory === cat.id ? "2px solid #eab308" : "2px solid #333",
                    background: selectedCategory === cat.id ? "#eab30820" : "rgba(0,0,0,0.4)",
                    color: selectedCategory === cat.id ? "#eab308" : "#888",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>

            {/* Upgrades List */}
            <div style={{
              background: "rgba(0,0,0,0.4)",
              borderRadius: 16,
              border: "2px solid #eab30830",
              maxHeight: 500,
              overflowY: "auto",
            }}>
              {filteredUpgrades.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#666" }}>
                  Keep earning to unlock more upgrades!
                </div>
              ) : (
                filteredUpgrades.map(upgrade => {
                  const level = upgradeLevels[upgrade.id] || 0;
                  const cost = getUpgradeCost(upgrade, level);
                  const canAfford = zc >= cost && level < upgrade.maxLevel;
                  const isLocked = totalEarned < upgrade.unlockAt;
                  const isMaxed = level >= upgrade.maxLevel;

                  return (
                    <div
                      key={upgrade.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: 16,
                        borderBottom: "1px solid #ffffff10",
                        opacity: isLocked ? 0.5 : 1,
                      }}
                    >
                      <div style={{ fontSize: 32, width: 48, textAlign: "center" }}>
                        {upgrade.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          color: isLocked ? "#666" : "#fff", 
                          fontWeight: 600,
                          fontSize: 14,
                        }}>
                          {upgrade.name}
                          {level > 0 && <span style={{ color: "#eab308", marginLeft: 8 }}>Lv.{level}</span>}
                        </div>
                        <div style={{ color: "#888", fontSize: 12, marginTop: 2 }}>
                          {isLocked 
                            ? `🔒 Unlocks at ${formatNumber(upgrade.unlockAt)} ZC`
                            : upgrade.description
                          }
                        </div>
                        {!isLocked && !isMaxed && (
                          <div style={{ color: "#22c55e", fontSize: 11, marginTop: 4 }}>
                            +{upgrade.zpsBonus > 0 ? `${formatNumber(upgrade.zpsBonus)}/sec` : `${formatNumber(upgrade.zpcBonus)}/click`}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => buyUpgrade(upgrade.id)}
                        disabled={!canAfford || isLocked}
                        style={{
                          padding: "10px 16px",
                          borderRadius: 8,
                          border: "none",
                          background: isMaxed 
                            ? "#22c55e" 
                            : canAfford 
                              ? "linear-gradient(135deg, #eab308, #ca8a04)" 
                              : "#333",
                          color: isMaxed || canAfford ? "#000" : "#666",
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: canAfford && !isLocked ? "pointer" : "default",
                          minWidth: 90,
                          transition: "transform 0.1s",
                        }}
                        onMouseEnter={(e) => canAfford && (e.currentTarget.style.transform = "scale(1.05)")}
                        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                      >
                        {isMaxed ? "MAX" : `${formatNumber(cost)} ZC`}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes floatUp {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-60px) scale(1.5);
          }
        }
      `}</style>
    </div>
  );
}
