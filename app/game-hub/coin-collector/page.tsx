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

type GameSave = {
  coins: number;
  total_coins_earned: number;
  clicks: number;
  coins_per_click: number;
  coins_per_second: number;
  rebirth_count: number;
  rebirth_bonus: number;
  upgrades: Record<string, number>;
  collectors: Record<string, number>;
  current_president: number;
  highest_coins: number;
  total_rebirths: number;
  play_time_seconds: number;
};

// Steampunk speaker designs for rebirth levels
const SPEAKER_DESIGNS = [
  { id: 1, name: "Bronze Age", rimColor: "#CD7F32", coneColor: "#2D1B0E", glowColor: "#FFB347" },
  { id: 2, name: "Copper Core", rimColor: "#B87333", coneColor: "#1A1A2E", glowColor: "#FF6B35" },
  { id: 3, name: "Brass Beast", rimColor: "#D4AF37", coneColor: "#0D0D0D", glowColor: "#FFD700" },
  { id: 4, name: "Iron Heart", rimColor: "#434343", coneColor: "#1C1C1C", glowColor: "#87CEEB" },
  { id: 5, name: "Gold Standard", rimColor: "#FFD700", coneColor: "#14213D", glowColor: "#FCA311" },
  { id: 6, name: "Ruby Resonance", rimColor: "#9B2335", coneColor: "#1A0A0A", glowColor: "#FF4D6D" },
  { id: 7, name: "Sapphire Sound", rimColor: "#0F52BA", coneColor: "#0A0A1A", glowColor: "#4FC3F7" },
  { id: 8, name: "Emerald Echo", rimColor: "#046307", coneColor: "#0A1A0A", glowColor: "#00E676" },
  { id: 9, name: "Amethyst Amp", rimColor: "#9966CC", coneColor: "#1A0A1A", glowColor: "#E040FB" },
  { id: 10, name: "Obsidian Opus", rimColor: "#0D0D0D", coneColor: "#000000", glowColor: "#C9A227" },
];

// Collectors (auto-clickers)
const COLLECTORS = [
  { id: "piggy_bank", name: "Piggy Bank", baseCost: 15, baseProduction: 0.1, icon: "🐷" },
  { id: "coin_jar", name: "Coin Jar", baseCost: 100, baseProduction: 0.5, icon: "🫙" },
  { id: "cash_register", name: "Cash Register", baseCost: 500, baseProduction: 2, icon: "🧾" },
  { id: "atm", name: "ATM Machine", baseCost: 2000, baseProduction: 8, icon: "🏧" },
  { id: "bank", name: "Bank Vault", baseCost: 10000, baseProduction: 40, icon: "🏦" },
  { id: "mint", name: "Coin Mint", baseCost: 50000, baseProduction: 200, icon: "🏭" },
  { id: "treasury", name: "Treasury", baseCost: 250000, baseProduction: 1000, icon: "🏛️" },
  { id: "gold_mine", name: "Gold Mine", baseCost: 1000000, baseProduction: 5000, icon: "⛏️" },
];

// Click upgrades
const UPGRADES = [
  { id: "better_fingers", name: "Better Fingers", baseCost: 50, clickBonus: 1, icon: "👆" },
  { id: "golden_touch", name: "Golden Touch", baseCost: 500, clickBonus: 5, icon: "✨" },
  { id: "midas_hand", name: "Midas Hand", baseCost: 5000, clickBonus: 25, icon: "🤚" },
  { id: "coin_magnet", name: "Coin Magnet", baseCost: 50000, clickBonus: 100, icon: "🧲" },
  { id: "fortune_finder", name: "Fortune Finder", baseCost: 500000, clickBonus: 500, icon: "🔮" },
];

function formatNumber(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return Math.floor(num).toString();
}

function getCollectorCost(baseCost: number, owned: number): number {
  return Math.floor(baseCost * Math.pow(1.15, owned));
}

function getUpgradeCost(baseCost: number, owned: number): number {
  return Math.floor(baseCost * Math.pow(2, owned));
}

export default function CoinCollectorPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Game state
  const [coins, setCoins] = useState(0);
  const [totalCoinsEarned, setTotalCoinsEarned] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [coinsPerClick, setCoinsPerClick] = useState(1);
  const [coinsPerSecond, setCoinsPerSecond] = useState(0);
  const [rebirthCount, setRebirthCount] = useState(0);
  const [rebirthBonus, setRebirthBonus] = useState(1);
  const [upgrades, setUpgrades] = useState<Record<string, number>>({});
  const [collectors, setCollectors] = useState<Record<string, number>>({});
  const [currentPresident, setCurrentPresident] = useState(1);
  const [highestCoins, setHighestCoins] = useState(0);
  const [playTimeSeconds, setPlayTimeSeconds] = useState(0);
  
  // UI state
  const [activeTab, setActiveTab] = useState<"collectors" | "upgrades">("collectors");
  const [clickEffect, setClickEffect] = useState<{ x: number; y: number; id: number } | null>(null);
  const [showRebirthModal, setShowRebirthModal] = useState(false);
  const clickEffectId = useRef(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const supabase = createBrowserClient();
  const router = useRouter();

  // Calculate coins per second from collectors
  const calculateCoinsPerSecond = useCallback((collectorState: Record<string, number>, bonus: number) => {
    let total = 0;
    COLLECTORS.forEach(collector => {
      const owned = collectorState[collector.id] || 0;
      total += owned * collector.baseProduction;
    });
    return total * bonus;
  }, []);

  // Calculate coins per click from upgrades
  const calculateCoinsPerClick = useCallback((upgradeState: Record<string, number>, bonus: number) => {
    let total = 1; // Base click value
    UPGRADES.forEach(upgrade => {
      const owned = upgradeState[upgrade.id] || 0;
      total += owned * upgrade.clickBonus;
    });
    return Math.floor(total * bonus);
  }, []);

  // Load game save
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

      // Load or create game save
      const { data: save } = await supabase
        .from("coin_collector_saves")
        .select("*")
        .eq("user_id", currentUser.id)
        .single();

      if (save) {
        setCoins(save.coins || 0);
        setTotalCoinsEarned(save.total_coins_earned || 0);
        setClicks(save.clicks || 0);
        setRebirthCount(save.rebirth_count || 0);
        setRebirthBonus(save.rebirth_bonus || 1);
        setUpgrades(save.upgrades || {});
        setCollectors(save.collectors || {});
        setCurrentPresident(save.current_president || 1);
        setHighestCoins(save.highest_coins || 0);
        setPlayTimeSeconds(save.play_time_seconds || 0);
        
        // Calculate derived values
        setCoinsPerClick(calculateCoinsPerClick(save.upgrades || {}, save.rebirth_bonus || 1));
        setCoinsPerSecond(calculateCoinsPerSecond(save.collectors || {}, save.rebirth_bonus || 1));
      } else {
        // Create new save
        await supabase.from("coin_collector_saves").insert({
          user_id: currentUser.id,
        });
      }

      setLoading(false);
    }

    init();
  }, [supabase, router, calculateCoinsPerClick, calculateCoinsPerSecond]);

  // Auto-save game periodically
  const saveGame = useCallback(async () => {
    if (!user || saving) return;
    
    setSaving(true);
    await supabase
      .from("coin_collector_saves")
      .update({
        coins: Math.floor(coins),
        total_coins_earned: Math.floor(totalCoinsEarned),
        clicks,
        coins_per_click: coinsPerClick,
        coins_per_second: coinsPerSecond,
        rebirth_count: rebirthCount,
        rebirth_bonus: rebirthBonus,
        upgrades,
        collectors,
        current_president: currentPresident,
        highest_coins: Math.floor(highestCoins),
        play_time_seconds: playTimeSeconds,
      })
      .eq("user_id", user.id);
    setSaving(false);
  }, [user, saving, coins, totalCoinsEarned, clicks, coinsPerClick, coinsPerSecond, rebirthCount, rebirthBonus, upgrades, collectors, currentPresident, highestCoins, playTimeSeconds, supabase]);

  // Debounced save
  useEffect(() => {
    if (!user || loading) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveGame();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [coins, collectors, upgrades, rebirthCount, user, loading, saveGame]);

  // Game tick - add coins per second
  useEffect(() => {
    if (loading) return;

    const interval = setInterval(() => {
      if (coinsPerSecond > 0) {
        setCoins(prev => {
          const newCoins = prev + coinsPerSecond / 10;
          if (newCoins > highestCoins) {
            setHighestCoins(newCoins);
          }
          return newCoins;
        });
        setTotalCoinsEarned(prev => prev + coinsPerSecond / 10);
      }
      setPlayTimeSeconds(prev => prev + 0.1);
    }, 100);

    return () => clearInterval(interval);
  }, [coinsPerSecond, highestCoins, loading]);

  // Handle coin click
  const handleClick = (e: React.MouseEvent) => {
    const earnedCoins = coinsPerClick;
    setCoins(prev => {
      const newCoins = prev + earnedCoins;
      if (newCoins > highestCoins) {
        setHighestCoins(newCoins);
      }
      return newCoins;
    });
    setTotalCoinsEarned(prev => prev + earnedCoins);
    setClicks(prev => prev + 1);

    // Show click effect
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    clickEffectId.current++;
    setClickEffect({ x, y, id: clickEffectId.current });
    setTimeout(() => setClickEffect(null), 500);
  };

  // Buy collector
  const buyCollector = (collectorId: string) => {
    const collector = COLLECTORS.find(c => c.id === collectorId);
    if (!collector) return;

    const owned = collectors[collectorId] || 0;
    const cost = getCollectorCost(collector.baseCost, owned);

    if (coins >= cost) {
      setCoins(prev => prev - cost);
      setCollectors(prev => {
        const updated = { ...prev, [collectorId]: owned + 1 };
        setCoinsPerSecond(calculateCoinsPerSecond(updated, rebirthBonus));
        return updated;
      });
    }
  };

  // Buy upgrade
  const buyUpgrade = (upgradeId: string) => {
    const upgrade = UPGRADES.find(u => u.id === upgradeId);
    if (!upgrade) return;

    const owned = upgrades[upgradeId] || 0;
    const cost = getUpgradeCost(upgrade.baseCost, owned);

    if (coins >= cost) {
      setCoins(prev => prev - cost);
      setUpgrades(prev => {
        const updated = { ...prev, [upgradeId]: owned + 1 };
        setCoinsPerClick(calculateCoinsPerClick(updated, rebirthBonus));
        return updated;
      });
    }
  };

  // Rebirth requirement
  const rebirthRequirement = Math.pow(10, 6 + rebirthCount); // 1M, 10M, 100M, etc.
  const canRebirth = totalCoinsEarned >= rebirthRequirement;

  // Handle rebirth
  const handleRebirth = async () => {
    if (!canRebirth) return;

    const newRebirthCount = rebirthCount + 1;
    const newBonus = 1 + (newRebirthCount * 0.25); // 25% bonus per rebirth
    const newPresident = ((currentPresident) % SPEAKER_DESIGNS.length) + 1;

    // Reset progress but keep rebirth bonuses
    setCoins(0);
    setTotalCoinsEarned(0);
    setClicks(0);
    setUpgrades({});
    setCollectors({});
    setCoinsPerClick(Math.floor(1 * newBonus));
    setCoinsPerSecond(0);
    setRebirthCount(newRebirthCount);
    setRebirthBonus(newBonus);
    setCurrentPresident(newPresident);
    setShowRebirthModal(false);

    // Save immediately
    if (user) {
      await supabase
        .from("coin_collector_saves")
        .update({
          coins: 0,
          total_coins_earned: 0,
          clicks: 0,
          coins_per_click: Math.floor(1 * newBonus),
          coins_per_second: 0,
          rebirth_count: newRebirthCount,
          rebirth_bonus: newBonus,
          upgrades: {},
          collectors: {},
          current_president: newPresident,
          total_rebirths: newRebirthCount,
        })
        .eq("user_id", user.id);
    }
  };

  const speakerDesign = SPEAKER_DESIGNS[(currentPresident - 1) % SPEAKER_DESIGNS.length];

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

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: `linear-gradient(180deg, #0a0612 0%, #12081a 50%, #0d0618 100%)`,
    }}>
      <Header 
        user={user} 
        userUsername={userData?.username || null} 
        userAvatarUrl={userData?.avatar_url || null} 
      />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px" }}>
        {/* Back to Hub */}
        <Link 
          href="/game-hub" 
          style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: 8, 
            color: "var(--alzooka-gold)", 
            textDecoration: "none",
            fontSize: 14,
            marginBottom: 20,
          }}
        >
          ← Back to Game Hub
        </Link>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: 24 }}>
          {/* Main Game Area */}
          <div>
            {/* Stats Bar */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(0,0,0,0.3)",
              borderRadius: 12,
              padding: "16px 24px",
              marginBottom: 24,
            }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "var(--alzooka-gold)" }}>
                  🪙 {formatNumber(coins)}
                </div>
                <div style={{ fontSize: 13, color: "var(--alzooka-cream)", opacity: 0.7 }}>
                  +{formatNumber(coinsPerSecond)}/sec • +{formatNumber(coinsPerClick)}/click
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, color: "var(--alzooka-cream)", opacity: 0.7 }}>
                  Rebirth Level: {rebirthCount}
                </div>
                <div style={{ fontSize: 13, color: "var(--alzooka-gold)" }}>
                  {rebirthBonus.toFixed(2)}x bonus
                </div>
              </div>
            </div>

            {/* Speaker Click Area */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: `radial-gradient(ellipse at center, ${speakerDesign.glowColor}15 0%, #0a0612 50%, #06030a 100%)`,
              borderRadius: 24,
              padding: "60px 40px",
              marginBottom: 24,
              position: "relative",
              overflow: "hidden",
              border: `1px solid ${speakerDesign.rimColor}30`,
            }}>
              {/* Ambient glow effect */}
              <div style={{
                position: "absolute",
                width: 300,
                height: 300,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${speakerDesign.glowColor}20 0%, transparent 70%)`,
                filter: "blur(40px)",
                pointerEvents: "none",
              }} />

              {/* Click Effect */}
              {clickEffect && (
                <div
                  key={clickEffect.id}
                  style={{
                    position: "absolute",
                    left: clickEffect.x,
                    top: clickEffect.y,
                    color: speakerDesign.glowColor,
                    fontWeight: 700,
                    fontSize: 24,
                    pointerEvents: "none",
                    animation: "floatUp 0.5s ease-out forwards",
                    textShadow: `0 2px 8px ${speakerDesign.glowColor}`,
                  }}
                >
                  +{formatNumber(coinsPerClick)}
                </div>
              )}

              {/* The Steampunk Speaker */}
              <button
                onClick={handleClick}
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: "50%",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "transform 0.1s",
                  position: "relative",
                  padding: 0,
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = "scale(0.95)";
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                {/* Speaker SVG */}
                <svg viewBox="0 0 200 200" width="220" height="220" style={{ filter: `drop-shadow(0 0 20px ${speakerDesign.glowColor}40)` }}>
                  {/* Outer metal rim with rivets */}
                  <defs>
                    <linearGradient id={`rimGrad-${speakerDesign.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={speakerDesign.rimColor} />
                      <stop offset="50%" stopColor={`${speakerDesign.rimColor}80`} />
                      <stop offset="100%" stopColor={speakerDesign.rimColor} />
                    </linearGradient>
                    <radialGradient id={`coneGrad-${speakerDesign.id}`} cx="35%" cy="35%">
                      <stop offset="0%" stopColor="#3a3a3a" />
                      <stop offset="60%" stopColor={speakerDesign.coneColor} />
                      <stop offset="100%" stopColor="#000" />
                    </radialGradient>
                    <radialGradient id={`dustCapGrad-${speakerDesign.id}`} cx="40%" cy="35%">
                      <stop offset="0%" stopColor={speakerDesign.rimColor} />
                      <stop offset="100%" stopColor={`${speakerDesign.rimColor}60`} />
                    </radialGradient>
                  </defs>

                  {/* Outer rim */}
                  <circle cx="100" cy="100" r="96" fill={`url(#rimGrad-${speakerDesign.id})`} />
                  <circle cx="100" cy="100" r="88" fill={speakerDesign.coneColor} />
                  
                  {/* Rivets around the rim */}
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
                    const rad = (angle * Math.PI) / 180;
                    const x = 100 + 92 * Math.cos(rad);
                    const y = 100 + 92 * Math.sin(rad);
                    return (
                      <g key={angle}>
                        <circle cx={x} cy={y} r="4" fill="#2a2a2a" />
                        <circle cx={x - 0.5} cy={y - 0.5} r="3" fill={speakerDesign.rimColor} />
                        <circle cx={x - 1} cy={y - 1} r="1.5" fill="#fff" opacity="0.3" />
                      </g>
                    );
                  })}

                  {/* Speaker cone with ridges */}
                  <circle cx="100" cy="100" r="75" fill={`url(#coneGrad-${speakerDesign.id})`} />
                  
                  {/* Concentric cone ridges */}
                  {[70, 60, 50, 40].map((r) => (
                    <circle 
                      key={r} 
                      cx="100" 
                      cy="100" 
                      r={r} 
                      fill="none" 
                      stroke={`${speakerDesign.rimColor}30`} 
                      strokeWidth="1"
                    />
                  ))}

                  {/* Surround ring */}
                  <circle cx="100" cy="100" r="80" fill="none" stroke="#1a1a1a" strokeWidth="6" />
                  <circle cx="100" cy="100" r="80" fill="none" stroke={`${speakerDesign.rimColor}20`} strokeWidth="2" />

                  {/* Dust cap (center dome) */}
                  <circle cx="100" cy="100" r="28" fill={`url(#dustCapGrad-${speakerDesign.id})`} />
                  <circle cx="100" cy="100" r="28" fill="none" stroke={speakerDesign.rimColor} strokeWidth="2" />
                  
                  {/* Gear decoration on dust cap */}
                  <circle cx="100" cy="100" r="18" fill="none" stroke={`${speakerDesign.coneColor}`} strokeWidth="3" />
                  {[0, 60, 120, 180, 240, 300].map((angle) => {
                    const rad = (angle * Math.PI) / 180;
                    const x1 = 100 + 15 * Math.cos(rad);
                    const y1 = 100 + 15 * Math.sin(rad);
                    const x2 = 100 + 22 * Math.cos(rad);
                    const y2 = 100 + 22 * Math.sin(rad);
                    return (
                      <line 
                        key={angle}
                        x1={x1} y1={y1} x2={x2} y2={y2} 
                        stroke={speakerDesign.rimColor} 
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    );
                  })}

                  {/* Center bolt */}
                  <circle cx="100" cy="100" r="6" fill="#1a1a1a" />
                  <circle cx="100" cy="100" r="4" fill={speakerDesign.rimColor} />
                  <circle cx="98" cy="98" r="2" fill="#fff" opacity="0.4" />

                  {/* Rebirth stars indicator */}
                  {rebirthCount > 0 && (
                    <text 
                      x="100" 
                      y="170" 
                      textAnchor="middle" 
                      fill={speakerDesign.glowColor}
                      fontSize="14"
                      fontWeight="bold"
                    >
                      {"★".repeat(Math.min(rebirthCount, 5))} {rebirthCount > 5 ? `+${rebirthCount - 5}` : ""}
                    </text>
                  )}
                </svg>
              </button>

              <div style={{ 
                marginTop: 16, 
                color: speakerDesign.glowColor, 
                fontSize: 16,
                fontWeight: 600,
                textShadow: `0 0 10px ${speakerDesign.glowColor}60`,
              }}>
                {speakerDesign.name}
              </div>

              <p style={{ 
                marginTop: 8, 
                color: "var(--alzooka-cream)", 
                opacity: 0.6,
                fontSize: 13,
              }}>
                Click the speaker to collect!
              </p>
            </div>

            {/* Rebirth Button */}
            <button
              onClick={() => setShowRebirthModal(true)}
              disabled={!canRebirth}
              style={{
                width: "100%",
                padding: "16px 24px",
                borderRadius: 12,
                border: "none",
                background: canRebirth 
                  ? "linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)"
                  : "rgba(255,255,255,0.1)",
                color: canRebirth ? "#fff" : "rgba(255,255,255,0.3)",
                fontSize: 16,
                fontWeight: 600,
                cursor: canRebirth ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              🔄 Rebirth {canRebirth ? "(Ready!)" : `(Need ${formatNumber(rebirthRequirement)} total coins)`}
            </button>
          </div>

          {/* Shop Sidebar */}
          <div style={{
            background: "rgba(0,0,0,0.3)",
            borderRadius: 16,
            padding: 20,
            height: "fit-content",
          }}>
            {/* Shop Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <button
                onClick={() => setActiveTab("collectors")}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: activeTab === "collectors" ? "var(--alzooka-gold)" : "rgba(255,255,255,0.1)",
                  color: activeTab === "collectors" ? "var(--alzooka-teal-dark)" : "var(--alzooka-cream)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Collectors
              </button>
              <button
                onClick={() => setActiveTab("upgrades")}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: activeTab === "upgrades" ? "var(--alzooka-gold)" : "rgba(255,255,255,0.1)",
                  color: activeTab === "upgrades" ? "var(--alzooka-teal-dark)" : "var(--alzooka-cream)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Upgrades
              </button>
            </div>

            {/* Collectors List */}
            {activeTab === "collectors" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {COLLECTORS.map(collector => {
                  const owned = collectors[collector.id] || 0;
                  const cost = getCollectorCost(collector.baseCost, owned);
                  const canAfford = coins >= cost;
                  const production = collector.baseProduction * rebirthBonus;

                  return (
                    <button
                      key={collector.id}
                      onClick={() => buyCollector(collector.id)}
                      disabled={!canAfford}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: 12,
                        borderRadius: 10,
                        border: canAfford ? "1px solid var(--alzooka-gold)" : "1px solid rgba(255,255,255,0.1)",
                        background: canAfford ? "rgba(201, 162, 39, 0.1)" : "rgba(255,255,255,0.05)",
                        cursor: canAfford ? "pointer" : "not-allowed",
                        textAlign: "left",
                        opacity: canAfford ? 1 : 0.5,
                      }}
                    >
                      <div style={{ fontSize: 28 }}>{collector.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontWeight: 600, 
                          color: "var(--alzooka-cream)",
                          fontSize: 14,
                          marginBottom: 2,
                        }}>
                          {collector.name}
                          {owned > 0 && (
                            <span style={{ 
                              marginLeft: 8, 
                              color: "var(--alzooka-gold)",
                              fontWeight: 400,
                            }}>
                              x{owned}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--alzooka-cream)", opacity: 0.6 }}>
                          +{production.toFixed(1)}/sec each
                        </div>
                      </div>
                      <div style={{ 
                        fontWeight: 600, 
                        color: canAfford ? "var(--alzooka-gold)" : "var(--alzooka-cream)",
                        fontSize: 13,
                      }}>
                        🪙 {formatNumber(cost)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Upgrades List */}
            {activeTab === "upgrades" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {UPGRADES.map(upgrade => {
                  const owned = upgrades[upgrade.id] || 0;
                  const cost = getUpgradeCost(upgrade.baseCost, owned);
                  const canAfford = coins >= cost;
                  const bonus = upgrade.clickBonus * rebirthBonus;

                  return (
                    <button
                      key={upgrade.id}
                      onClick={() => buyUpgrade(upgrade.id)}
                      disabled={!canAfford}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: 12,
                        borderRadius: 10,
                        border: canAfford ? "1px solid var(--alzooka-gold)" : "1px solid rgba(255,255,255,0.1)",
                        background: canAfford ? "rgba(201, 162, 39, 0.1)" : "rgba(255,255,255,0.05)",
                        cursor: canAfford ? "pointer" : "not-allowed",
                        textAlign: "left",
                        opacity: canAfford ? 1 : 0.5,
                      }}
                    >
                      <div style={{ fontSize: 28 }}>{upgrade.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontWeight: 600, 
                          color: "var(--alzooka-cream)",
                          fontSize: 14,
                          marginBottom: 2,
                        }}>
                          {upgrade.name}
                          {owned > 0 && (
                            <span style={{ 
                              marginLeft: 8, 
                              color: "var(--alzooka-gold)",
                              fontWeight: 400,
                            }}>
                              x{owned}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--alzooka-cream)", opacity: 0.6 }}>
                          +{Math.floor(bonus)}/click each
                        </div>
                      </div>
                      <div style={{ 
                        fontWeight: 600, 
                        color: canAfford ? "var(--alzooka-gold)" : "var(--alzooka-cream)",
                        fontSize: 13,
                      }}>
                        🪙 {formatNumber(cost)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Stats */}
            <div style={{
              marginTop: 20,
              padding: 16,
              background: "rgba(0,0,0,0.2)",
              borderRadius: 10,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--alzooka-cream)", marginBottom: 12 }}>
                Stats
              </div>
              <div style={{ fontSize: 12, color: "var(--alzooka-cream)", opacity: 0.7, lineHeight: 1.8 }}>
                <div>Total Clicks: {clicks.toLocaleString()}</div>
                <div>All-time Coins: {formatNumber(totalCoinsEarned)}</div>
                <div>Highest Balance: {formatNumber(highestCoins)}</div>
                <div>Play Time: {Math.floor(playTimeSeconds / 60)}m {Math.floor(playTimeSeconds % 60)}s</div>
              </div>
            </div>

            {/* Save indicator */}
            {saving && (
              <div style={{ 
                marginTop: 12, 
                textAlign: "center", 
                fontSize: 12, 
                color: "var(--alzooka-gold)",
                opacity: 0.7,
              }}>
                Saving...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rebirth Modal */}
      {showRebirthModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={() => setShowRebirthModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--alzooka-teal-light)",
              borderRadius: 16,
              padding: 32,
              maxWidth: 400,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
            <h2 style={{ color: "var(--alzooka-cream)", marginBottom: 12 }}>
              Ready to Rebirth?
            </h2>
            <p style={{ color: "var(--alzooka-cream)", opacity: 0.8, marginBottom: 8 }}>
              You&apos;ll reset all progress but gain:
            </p>
            <div style={{
              background: "rgba(201, 162, 39, 0.2)",
              borderRadius: 8,
              padding: 16,
              marginBottom: 24,
            }}>
              <div style={{ color: "var(--alzooka-gold)", fontWeight: 600, fontSize: 18 }}>
                +25% permanent bonus
              </div>
              <div style={{ color: "var(--alzooka-cream)", opacity: 0.7, fontSize: 14, marginTop: 4 }}>
                New total: {((rebirthBonus + 0.25) * 100).toFixed(0)}% production
              </div>
              <div style={{ color: "var(--alzooka-cream)", opacity: 0.7, fontSize: 14, marginTop: 8 }}>
                New speaker design: {SPEAKER_DESIGNS[currentPresident % SPEAKER_DESIGNS.length].name}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setShowRebirthModal(false)}
                style={{
                  flex: 1,
                  padding: "12px 24px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "transparent",
                  color: "var(--alzooka-cream)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRebirth}
                style={{
                  flex: 1,
                  padding: "12px 24px",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Rebirth!
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes floatUp {
          0% {
            opacity: 1;
            transform: translateY(0) translateX(-50%);
          }
          100% {
            opacity: 0;
            transform: translateY(-60px) translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
