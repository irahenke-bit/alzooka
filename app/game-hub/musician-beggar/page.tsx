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

// Venue/Scene definitions
const VENUES = [
  { 
    id: "street", 
    name: "Street Corner", 
    unlockCost: 0,
    background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 40%, #1a1a2e 100%)",
    groundColor: "#2d2d44",
    description: "Where every legend begins",
    crowdSize: 2,
  },
  { 
    id: "subway", 
    name: "Subway Station", 
    unlockCost: 5000,
    background: "linear-gradient(180deg, #1a1a1a 0%, #2d2d2d 40%, #1a1a1a 100%)",
    groundColor: "#3d3d3d",
    description: "Underground vibes",
    crowdSize: 5,
  },
  { 
    id: "cafe", 
    name: "Coffee Shop", 
    unlockCost: 50000,
    background: "linear-gradient(180deg, #2d1b0e 0%, #4a2c17 40%, #2d1b0e 100%)",
    groundColor: "#5c3d2e",
    description: "Cozy acoustics",
    crowdSize: 8,
  },
  { 
    id: "club", 
    name: "Night Club", 
    unlockCost: 500000,
    background: "linear-gradient(180deg, #0a0a1a 0%, #1a0a2e 40%, #0a0a1a 100%)",
    groundColor: "#1a1a2e",
    description: "Neon dreams",
    crowdSize: 15,
  },
  { 
    id: "arena", 
    name: "Arena", 
    unlockCost: 5000000,
    background: "linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 40%, #0a0a0a 100%)",
    groundColor: "#2a2a2a",
    description: "The big time",
    crowdSize: 30,
  },
];

// Upgrade categories
type UpgradeType = {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costMultiplier: number;
  zpsBonus: number;
  zpcBonus: number;
  maxLevel: number;
  category: "instrument" | "gear" | "band" | "skill";
};

const UPGRADES: UpgradeType[] = [
  // Instruments - visually change what musician holds
  { id: "acoustic", name: "Acoustic Guitar", description: "Your trusty six-string", baseCost: 50, costMultiplier: 1.15, zpsBonus: 1, zpcBonus: 0, maxLevel: 25, category: "instrument" },
  { id: "electric", name: "Electric Guitar", description: "Time to plug in", baseCost: 2000, costMultiplier: 1.15, zpsBonus: 10, zpcBonus: 0, maxLevel: 25, category: "instrument" },
  { id: "keyboard", name: "Keyboard", description: "Ivory keys", baseCost: 10000, costMultiplier: 1.15, zpsBonus: 50, zpcBonus: 0, maxLevel: 25, category: "instrument" },
  { id: "drums", name: "Drum Kit", description: "Keep the beat", baseCost: 75000, costMultiplier: 1.15, zpsBonus: 200, zpcBonus: 0, maxLevel: 25, category: "instrument" },
  
  // Gear - appears around musician
  { id: "amp", name: "Amplifier", description: "Get loud", baseCost: 100, costMultiplier: 1.12, zpsBonus: 2, zpcBonus: 0, maxLevel: 30, category: "gear" },
  { id: "mic", name: "Microphone", description: "Sing it out", baseCost: 500, costMultiplier: 1.12, zpsBonus: 5, zpcBonus: 0, maxLevel: 30, category: "gear" },
  { id: "speakers", name: "Speakers", description: "Full sound", baseCost: 5000, costMultiplier: 1.12, zpsBonus: 30, zpcBonus: 0, maxLevel: 30, category: "gear" },
  { id: "lights", name: "Stage Lights", description: "Spotlight on you", baseCost: 50000, costMultiplier: 1.12, zpsBonus: 150, zpcBonus: 0, maxLevel: 30, category: "gear" },
  
  // Band members - appear on stage
  { id: "drummer", name: "Drummer", description: "Rhythm section", baseCost: 3000, costMultiplier: 1.2, zpsBonus: 20, zpcBonus: 0, maxLevel: 15, category: "band" },
  { id: "bassist", name: "Bassist", description: "Low end power", baseCost: 15000, costMultiplier: 1.2, zpsBonus: 80, zpcBonus: 0, maxLevel: 15, category: "band" },
  { id: "keyboardist", name: "Keyboardist", description: "Keys player", baseCost: 100000, costMultiplier: 1.2, zpsBonus: 400, zpcBonus: 0, maxLevel: 15, category: "band" },
  { id: "backup", name: "Backup Singers", description: "Harmonies", baseCost: 500000, costMultiplier: 1.2, zpsBonus: 1500, zpcBonus: 0, maxLevel: 15, category: "band" },
  
  // Skills - boost click power
  { id: "practice", name: "Practice", description: "Better technique", baseCost: 25, costMultiplier: 1.08, zpsBonus: 0, zpcBonus: 1, maxLevel: 100, category: "skill" },
  { id: "showmanship", name: "Showmanship", description: "Work the crowd", baseCost: 500, costMultiplier: 1.1, zpsBonus: 0, zpcBonus: 5, maxLevel: 50, category: "skill" },
  { id: "charisma", name: "Charisma", description: "Natural charm", baseCost: 10000, costMultiplier: 1.12, zpsBonus: 0, zpcBonus: 25, maxLevel: 50, category: "skill" },
  { id: "viral", name: "Go Viral", description: "Internet fame", baseCost: 250000, costMultiplier: 1.15, zpsBonus: 0, zpcBonus: 200, maxLevel: 25, category: "skill" },
];

function formatNumber(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(1) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(1) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return Math.floor(num).toString();
}

function getUpgradeCost(upgrade: UpgradeType, level: number): number {
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, level));
}

// Musician Character Component
function Musician({ 
  isPlaying, 
  hasElectric, 
  hasMic,
  outfit,
}: { 
  isPlaying: boolean;
  hasElectric: boolean;
  hasMic: boolean;
  outfit: number;
}) {
  const bodyColor = outfit >= 3 ? "#1a1a1a" : outfit >= 2 ? "#2d4a6d" : outfit >= 1 ? "#4a3728" : "#3d3d5c";
  const pantsColor = outfit >= 2 ? "#1a1a1a" : "#2d2d44";
  
  return (
    <div style={{
      position: "relative",
      width: 120,
      height: 200,
      transform: isPlaying ? "scale(1.02)" : "scale(1)",
      transition: "transform 0.1s",
    }}>
      {/* Head */}
      <div style={{
        position: "absolute",
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: 40,
        height: 45,
        background: "#e8c4a0",
        borderRadius: "50% 50% 45% 45%",
      }}>
        {/* Hair */}
        <div style={{
          position: "absolute",
          top: -5,
          left: -3,
          right: -3,
          height: 25,
          background: outfit >= 2 ? "#1a1a1a" : "#4a3728",
          borderRadius: "50% 50% 30% 30%",
        }} />
        {/* Eyes */}
        <div style={{ position: "absolute", top: 18, left: 8, width: 6, height: 6, background: "#2d2d2d", borderRadius: "50%" }} />
        <div style={{ position: "absolute", top: 18, right: 8, width: 6, height: 6, background: "#2d2d2d", borderRadius: "50%" }} />
        {/* Smile */}
        <div style={{
          position: "absolute",
          bottom: 10,
          left: "50%",
          transform: "translateX(-50%)",
          width: 12,
          height: 6,
          borderBottom: "2px solid #c4846a",
          borderRadius: "0 0 50% 50%",
        }} />
      </div>
      
      {/* Body/Torso */}
      <div style={{
        position: "absolute",
        top: 45,
        left: "50%",
        transform: "translateX(-50%)",
        width: 50,
        height: 60,
        background: bodyColor,
        borderRadius: "10px 10px 5px 5px",
      }}>
        {/* Shirt detail */}
        {outfit >= 1 && (
          <div style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            width: 20,
            height: 2,
            background: outfit >= 3 ? "#eab308" : "#888",
          }} />
        )}
      </div>
      
      {/* Arms */}
      <div style={{
        position: "absolute",
        top: 55,
        left: 10,
        width: 15,
        height: 45,
        background: bodyColor,
        borderRadius: 8,
        transform: isPlaying ? "rotate(-10deg)" : "rotate(-5deg)",
        transformOrigin: "top center",
        transition: "transform 0.1s",
      }} />
      <div style={{
        position: "absolute",
        top: 55,
        right: 10,
        width: 15,
        height: 45,
        background: bodyColor,
        borderRadius: 8,
        transform: isPlaying ? "rotate(15deg)" : "rotate(5deg)",
        transformOrigin: "top center",
        transition: "transform 0.1s",
      }} />
      
      {/* Hands */}
      <div style={{
        position: "absolute",
        top: 95,
        left: 5,
        width: 12,
        height: 12,
        background: "#e8c4a0",
        borderRadius: "50%",
        transform: isPlaying ? "rotate(-10deg)" : "rotate(-5deg)",
      }} />
      <div style={{
        position: "absolute",
        top: 95,
        right: 5,
        width: 12,
        height: 12,
        background: "#e8c4a0",
        borderRadius: "50%",
      }} />
      
      {/* Legs */}
      <div style={{
        position: "absolute",
        top: 105,
        left: 30,
        width: 20,
        height: 55,
        background: pantsColor,
        borderRadius: "5px 5px 8px 8px",
      }} />
      <div style={{
        position: "absolute",
        top: 105,
        right: 30,
        width: 20,
        height: 55,
        background: pantsColor,
        borderRadius: "5px 5px 8px 8px",
      }} />
      
      {/* Shoes */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 25,
        width: 25,
        height: 12,
        background: outfit >= 2 ? "#8b4513" : "#2d2d2d",
        borderRadius: "5px 8px 5px 5px",
      }} />
      <div style={{
        position: "absolute",
        bottom: 0,
        right: 25,
        width: 25,
        height: 12,
        background: outfit >= 2 ? "#8b4513" : "#2d2d2d",
        borderRadius: "8px 5px 5px 5px",
      }} />
      
      {/* Guitar */}
      <div style={{
        position: "absolute",
        top: 60,
        left: "50%",
        transform: `translateX(-50%) rotate(${isPlaying ? -5 : 0}deg)`,
        transition: "transform 0.1s",
      }}>
        {/* Guitar body */}
        <div style={{
          width: 35,
          height: 45,
          background: hasElectric 
            ? "linear-gradient(180deg, #dc2626 0%, #991b1b 100%)" 
            : "linear-gradient(180deg, #d4a574 0%, #8b6914 100%)",
          borderRadius: hasElectric ? "5px 5px 15px 15px" : "50%",
          border: hasElectric ? "2px solid #7f1d1d" : "2px solid #6b4f1d",
          position: "relative",
        }}>
          {/* Sound hole */}
          {!hasElectric && (
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 12,
              height: 12,
              background: "#3d2810",
              borderRadius: "50%",
            }} />
          )}
          {/* Pickups for electric */}
          {hasElectric && (
            <>
              <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: 20, height: 4, background: "#fbbf24", borderRadius: 2 }} />
              <div style={{ position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", width: 20, height: 4, background: "#fbbf24", borderRadius: 2 }} />
            </>
          )}
        </div>
        {/* Guitar neck */}
        <div style={{
          position: "absolute",
          bottom: 40,
          left: "50%",
          transform: "translateX(-50%)",
          width: 8,
          height: 50,
          background: hasElectric ? "#1a1a1a" : "#5c4033",
          borderRadius: "3px 3px 0 0",
        }}>
          {/* Frets */}
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{
              position: "absolute",
              top: 8 + i * 10,
              left: 0,
              right: 0,
              height: 1,
              background: "#888",
            }} />
          ))}
        </div>
        {/* Headstock */}
        <div style={{
          position: "absolute",
          bottom: 85,
          left: "50%",
          transform: "translateX(-50%)",
          width: 12,
          height: 15,
          background: hasElectric ? "#1a1a1a" : "#5c4033",
          borderRadius: "3px 3px 0 0",
        }} />
      </div>
      
      {/* Microphone (if owned) */}
      {hasMic && (
        <div style={{
          position: "absolute",
          top: 30,
          right: -20,
          transform: "rotate(-15deg)",
        }}>
          <div style={{ width: 8, height: 40, background: "#666", borderRadius: 2 }} />
          <div style={{ 
            width: 16, 
            height: 20, 
            background: "linear-gradient(180deg, #444 0%, #222 100%)", 
            borderRadius: "8px 8px 4px 4px",
            position: "absolute",
            top: -18,
            left: -4,
            border: "2px solid #555",
          }}>
            <div style={{
              position: "absolute",
              top: 2,
              left: 2,
              right: 2,
              bottom: 6,
              background: "repeating-linear-gradient(0deg, #333 0px, #333 2px, #444 2px, #444 4px)",
              borderRadius: "6px 6px 2px 2px",
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

// Crowd member component
function CrowdMember({ x, delay, isHappy }: { x: number; delay: number; isHappy: boolean }) {
  const colors = ["#3d5a80", "#5c4033", "#2d4a3e", "#4a3050", "#503020"];
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  return (
    <div style={{
      position: "absolute",
      bottom: 0,
      left: x,
      animation: isHappy ? `bounce 0.5s ease-in-out ${delay}s infinite` : undefined,
    }}>
      {/* Head */}
      <div style={{
        width: 16,
        height: 18,
        background: "#dbb896",
        borderRadius: "50% 50% 40% 40%",
        marginBottom: 2,
      }} />
      {/* Body */}
      <div style={{
        width: 20,
        height: 25,
        background: color,
        borderRadius: "5px 5px 0 0",
        marginLeft: -2,
      }} />
    </div>
  );
}

// Amp component
function Amp({ level }: { level: number }) {
  const size = Math.min(40 + level * 3, 70);
  return (
    <div style={{
      width: size,
      height: size * 0.9,
      background: "linear-gradient(180deg, #2d2d2d 0%, #1a1a1a 100%)",
      borderRadius: 4,
      border: "2px solid #3d3d3d",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    }}>
      <div style={{
        width: size * 0.7,
        height: size * 0.4,
        background: "#1a1a1a",
        borderRadius: 2,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        gap: 1,
        padding: 2,
      }}>
        {Array(12).fill(0).map((_, i) => (
          <div key={i} style={{ background: "#333", borderRadius: 1 }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6,
            height: 6,
            background: i === 0 ? "#22c55e" : "#444",
            borderRadius: "50%",
          }} />
        ))}
      </div>
    </div>
  );
}

// Tip Jar component
function TipJar({ fillPercent, onClick }: { fillPercent: number; onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      style={{
        width: 50,
        height: 60,
        background: "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
        borderRadius: "5px 5px 10px 10px",
        border: "2px solid rgba(255,255,255,0.2)",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
      }}
    >
      {/* Coins fill */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: `${Math.min(fillPercent, 100)}%`,
        background: "linear-gradient(180deg, #fbbf24 0%, #eab308 50%, #ca8a04 100%)",
        transition: "height 0.3s",
      }} />
      {/* Coins texture */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: `${Math.min(fillPercent, 100)}%`,
        background: "repeating-linear-gradient(90deg, transparent 0px, transparent 8px, rgba(0,0,0,0.1) 8px, rgba(0,0,0,0.1) 10px)",
      }} />
      {/* Label */}
      <div style={{
        position: "absolute",
        top: 5,
        left: "50%",
        transform: "translateX(-50%)",
        fontSize: 8,
        color: "rgba(255,255,255,0.5)",
        fontWeight: 600,
      }}>
        TIPS
      </div>
    </div>
  );
}

// Flying coin effect
function FlyingCoin({ x, y, amount }: { x: number; y: number; amount: number }) {
  return (
    <div style={{
      position: "absolute",
      left: x,
      top: y,
      pointerEvents: "none",
      animation: "coinFly 1s ease-out forwards",
      zIndex: 100,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        color: "#fbbf24",
        fontWeight: 700,
        fontSize: 16,
        textShadow: "0 2px 4px rgba(0,0,0,0.5)",
      }}>
        <span style={{ fontSize: 20 }}>🪙</span>
        +{formatNumber(amount)}
      </div>
    </div>
  );
}

export default function MusicianBeggarPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Game state
  const [zc, setZc] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [zps, setZps] = useState(0);
  const [zpc, setZpc] = useState(1);
  const [upgradeLevels, setUpgradeLevels] = useState<Record<string, number>>({});
  const [currentVenue, setCurrentVenue] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [flyingCoins, setFlyingCoins] = useState<Array<{ id: number; x: number; y: number; amount: number }>>([]);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"instrument" | "gear" | "band" | "skill" | "venue">("skill");
  const [crowdHappy, setCrowdHappy] = useState(false);
  
  const coinIdRef = useRef(0);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createBrowserClient();
  const router = useRouter();

  // Calculate stats from upgrades
  const recalculateStats = useCallback((levels: Record<string, number>) => {
    let newZps = 0;
    let newZpc = 1;
    
    for (const upgrade of UPGRADES) {
      const level = levels[upgrade.id] || 0;
      newZps += upgrade.zpsBonus * level;
      newZpc += upgrade.zpcBonus * level;
    }
    
    setZps(newZps);
    setZpc(newZpc);
  }, []);

  // Load game
  const loadGame = useCallback(() => {
    try {
      const saved = localStorage.getItem("musician-beggar-v2");
      if (saved) {
        const data = JSON.parse(saved);
        setZc(data.zc || 0);
        setTotalEarned(data.totalEarned || 0);
        setUpgradeLevels(data.upgradeLevels || {});
        setCurrentVenue(data.currentVenue || 0);
        recalculateStats(data.upgradeLevels || {});
        
        // Offline earnings
        if (data.lastSave && data.zps) {
          const offlineSeconds = Math.min((Date.now() - data.lastSave) / 1000, 8 * 60 * 60);
          const offlineEarnings = Math.floor(offlineSeconds * data.zps * 0.5);
          if (offlineEarnings > 0) {
            setZc(prev => prev + offlineEarnings);
            setTotalEarned(prev => prev + offlineEarnings);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load:", e);
    }
  }, [recalculateStats]);

  // Save game
  const saveGame = useCallback(() => {
    try {
      localStorage.setItem("musician-beggar-v2", JSON.stringify({
        zc, totalEarned, upgradeLevels, currentVenue, zps, lastSave: Date.now(),
      }));
    } catch (e) {
      console.error("Failed to save:", e);
    }
  }, [zc, totalEarned, upgradeLevels, currentVenue, zps]);

  // Handle click on musician
  const handleMusicianClick = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setZc(prev => prev + zpc);
    setTotalEarned(prev => prev + zpc);
    setIsPlaying(true);
    setCrowdHappy(true);
    
    // Flying coin effect
    const coinId = coinIdRef.current++;
    setFlyingCoins(prev => [...prev, { id: coinId, x, y, amount: zpc }]);
    setTimeout(() => setFlyingCoins(prev => prev.filter(c => c.id !== coinId)), 1000);
    
    setTimeout(() => setIsPlaying(false), 150);
    setTimeout(() => setCrowdHappy(false), 500);
  }, [zpc]);

  // Buy upgrade
  const buyUpgrade = useCallback((upgradeId: string) => {
    const upgrade = UPGRADES.find(u => u.id === upgradeId);
    if (!upgrade) return;
    
    const level = upgradeLevels[upgradeId] || 0;
    if (level >= upgrade.maxLevel) return;
    
    const cost = getUpgradeCost(upgrade, level);
    if (zc < cost) return;
    
    setZc(prev => prev - cost);
    setUpgradeLevels(prev => {
      const newLevels = { ...prev, [upgradeId]: level + 1 };
      recalculateStats(newLevels);
      return newLevels;
    });
  }, [zc, upgradeLevels, recalculateStats]);

  // Unlock venue
  const unlockVenue = useCallback((venueIndex: number) => {
    const venue = VENUES[venueIndex];
    if (!venue || zc < venue.unlockCost) return;
    if (venueIndex <= currentVenue) return;
    
    setZc(prev => prev - venue.unlockCost);
    setCurrentVenue(venueIndex);
  }, [zc, currentVenue]);

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
      
      if (userInfo) setUserData(userInfo);
      loadGame();
      setLoading(false);
    }
    init();
  }, [supabase, router, loadGame]);

  // Game loop
  useEffect(() => {
    if (loading) return;
    
    gameLoopRef.current = setInterval(() => {
      if (zps > 0) {
        const earned = zps / 10;
        setZc(prev => prev + earned);
        setTotalEarned(prev => prev + earned);
      }
    }, 100);
    
    return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current); };
  }, [loading, zps]);

  // Auto-save
  useEffect(() => {
    if (loading) return;
    const interval = setInterval(saveGame, 30000);
    return () => { clearInterval(interval); saveGame(); };
  }, [loading, saveGame]);

  // Save on leave
  useEffect(() => {
    window.addEventListener("beforeunload", saveGame);
    return () => window.removeEventListener("beforeunload", saveGame);
  }, [saveGame]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a" }}>
        <div style={{ height: 60, background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(255,255,255,0.1)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{
            width: 48, height: 48,
            border: "3px solid rgba(234, 179, 8, 0.2)",
            borderTopColor: "#eab308",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
        </div>
      </div>
    );
  }

  const venue = VENUES[currentVenue];
  const hasElectric = (upgradeLevels["electric"] || 0) > 0;
  const hasMic = (upgradeLevels["mic"] || 0) > 0;
  const hasAmp = (upgradeLevels["amp"] || 0) > 0;
  const ampLevel = upgradeLevels["amp"] || 0;
  const outfit = Math.min(3, Math.floor(totalEarned / 100000));
  const tipJarFill = Math.min(100, (zc % 1000) / 10);

  // Generate crowd
  const crowdMembers = [];
  for (let i = 0; i < venue.crowdSize; i++) {
    crowdMembers.push({
      x: 20 + (i * 25) + (Math.random() * 10 - 5),
      delay: Math.random() * 0.3,
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: venue.background }}>
      <Header user={user} userUsername={userData?.username || null} userAvatarUrl={userData?.avatar_url || null} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px" }}>
        <Link href="/game-hub" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#eab308", textDecoration: "none", fontSize: 14, marginBottom: 16 }}>
          ← Back to Game Hub
        </Link>

        {/* ZC Display */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ color: "#fbbf24", fontSize: 42, fontWeight: 800, textShadow: "0 0 30px rgba(234, 179, 8, 0.5)" }}>
            🪙 {formatNumber(zc)} ZC
          </div>
          <div style={{ color: "#888", fontSize: 14 }}>
            {formatNumber(zpc)}/click • {formatNumber(zps)}/sec
          </div>
        </div>

        {/* Stage/Scene */}
        <div 
          onClick={handleMusicianClick}
          style={{
            position: "relative",
            height: 350,
            background: venue.groundColor,
            borderRadius: 16,
            overflow: "hidden",
            cursor: "pointer",
            border: "2px solid rgba(255,255,255,0.1)",
            marginBottom: 16,
          }}
        >
          {/* Background elements based on venue */}
          {currentVenue === 0 && (
            <>
              {/* Street buildings */}
              <div style={{ position: "absolute", top: 0, left: 20, width: 60, height: 150, background: "#1a1a2e", borderRadius: "0 0 4px 4px" }} />
              <div style={{ position: "absolute", top: 0, left: 100, width: 80, height: 180, background: "#16213e", borderRadius: "0 0 4px 4px" }} />
              <div style={{ position: "absolute", top: 0, right: 50, width: 70, height: 160, background: "#1a1a2e", borderRadius: "0 0 4px 4px" }} />
              {/* Windows */}
              {[30, 60, 90].map((top, i) => (
                <div key={i} style={{ position: "absolute", top, left: 30, width: 15, height: 20, background: "#fbbf2440", borderRadius: 2 }} />
              ))}
              {/* Street lamp */}
              <div style={{ position: "absolute", bottom: 100, right: 30, width: 8, height: 100, background: "#3d3d3d" }} />
              <div style={{ position: "absolute", bottom: 190, right: 20, width: 30, height: 15, background: "#fbbf24", borderRadius: "50%", boxShadow: "0 0 30px #fbbf24" }} />
            </>
          )}
          
          {currentVenue === 1 && (
            <>
              {/* Subway tiles */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 100, background: "repeating-linear-gradient(90deg, #3d3d3d 0px, #3d3d3d 48px, #2d2d2d 48px, #2d2d2d 50px)" }} />
              {/* Subway sign */}
              <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", padding: "8px 24px", background: "#1a1a1a", border: "2px solid #fbbf24", borderRadius: 4 }}>
                <span style={{ color: "#fbbf24", fontWeight: 700, fontSize: 14 }}>🚇 SUBWAY</span>
              </div>
            </>
          )}
          
          {currentVenue === 2 && (
            <>
              {/* Cafe interior */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, background: "#5c3d2e" }} />
              {/* Shelves */}
              <div style={{ position: "absolute", top: 30, left: 30, width: 100, height: 8, background: "#3d2a1e" }} />
              <div style={{ position: "absolute", top: 50, left: 30, width: 100, height: 8, background: "#3d2a1e" }} />
              {/* Coffee cups */}
              {[40, 60, 80, 100].map((left, i) => (
                <div key={i} style={{ position: "absolute", top: 20, left, width: 12, height: 15, background: "#f5f5dc", borderRadius: "0 0 4px 4px" }} />
              ))}
              {/* Warm lighting */}
              <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 200, height: 200, background: "radial-gradient(circle, rgba(251,191,36,0.2) 0%, transparent 70%)" }} />
            </>
          )}
          
          {currentVenue === 3 && (
            <>
              {/* Club lights */}
              <div style={{ position: "absolute", top: 20, left: "20%", width: 20, height: 100, background: "linear-gradient(180deg, #dc2626 0%, transparent 100%)", opacity: 0.5, animation: "pulse 2s infinite" }} />
              <div style={{ position: "absolute", top: 20, left: "50%", width: 20, height: 100, background: "linear-gradient(180deg, #8b5cf6 0%, transparent 100%)", opacity: 0.5, animation: "pulse 2s infinite 0.5s" }} />
              <div style={{ position: "absolute", top: 20, right: "20%", width: 20, height: 100, background: "linear-gradient(180deg, #06b6d4 0%, transparent 100%)", opacity: 0.5, animation: "pulse 2s infinite 1s" }} />
              {/* Disco ball */}
              <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 30, height: 30, background: "radial-gradient(circle, #fff 0%, #888 100%)", borderRadius: "50%", boxShadow: "0 0 20px rgba(255,255,255,0.5)" }} />
            </>
          )}
          
          {currentVenue === 4 && (
            <>
              {/* Arena lights */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 100, background: "linear-gradient(180deg, #000 0%, transparent 100%)" }} />
              {/* Spotlights */}
              <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 150, height: 300, background: "linear-gradient(180deg, rgba(251,191,36,0.3) 0%, transparent 100%)", clipPath: "polygon(40% 0%, 60% 0%, 100% 100%, 0% 100%)" }} />
              {/* Stage edge */}
              <div style={{ position: "absolute", bottom: 80, left: 0, right: 0, height: 10, background: "linear-gradient(90deg, #fbbf24, #eab308, #fbbf24)", boxShadow: "0 0 20px #fbbf24" }} />
            </>
          )}

          {/* Stage/Ground */}
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 80,
            background: `linear-gradient(180deg, ${venue.groundColor} 0%, ${venue.groundColor}dd 100%)`,
          }} />

          {/* Crowd */}
          <div style={{ position: "absolute", bottom: 80, left: 0, right: 0, height: 50 }}>
            {crowdMembers.map((member, i) => (
              <CrowdMember key={i} x={member.x} delay={member.delay} isHappy={crowdHappy} />
            ))}
          </div>

          {/* Amp (if owned) */}
          {hasAmp && (
            <div style={{ position: "absolute", bottom: 90, left: "25%", transform: "translateX(-50%)" }}>
              <Amp level={ampLevel} />
            </div>
          )}

          {/* Musician */}
          <div style={{ position: "absolute", bottom: 90, left: "50%", transform: "translateX(-50%)" }}>
            <Musician isPlaying={isPlaying} hasElectric={hasElectric} hasMic={hasMic} outfit={outfit} />
          </div>

          {/* Tip Jar */}
          <div style={{ position: "absolute", bottom: 90, right: "25%", transform: "translateX(50%)" }}>
            <TipJar fillPercent={tipJarFill} onClick={() => {}} />
          </div>

          {/* Flying coins */}
          {flyingCoins.map(coin => (
            <FlyingCoin key={coin.id} x={coin.x} y={coin.y} amount={coin.amount} />
          ))}

          {/* Venue name */}
          <div style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "8px 20px",
            background: "rgba(0,0,0,0.6)",
            borderRadius: 20,
            color: "#fbbf24",
            fontSize: 14,
            fontWeight: 600,
          }}>
            📍 {venue.name}
          </div>

          {/* Click hint */}
          <div style={{
            position: "absolute",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            color: "rgba(255,255,255,0.4)",
            fontSize: 12,
          }}>
            Click to play music!
          </div>
        </div>

        {/* Upgrades Button */}
        <button
          onClick={() => setShowUpgrades(!showUpgrades)}
          style={{
            width: "100%",
            padding: "16px",
            background: showUpgrades ? "#eab308" : "rgba(234, 179, 8, 0.2)",
            border: "2px solid #eab308",
            borderRadius: 12,
            color: showUpgrades ? "#000" : "#eab308",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 16,
          }}
        >
          {showUpgrades ? "▼ Hide Upgrades" : "▲ Show Upgrades"}
        </button>

        {/* Upgrades Panel */}
        {showUpgrades && (
          <div style={{
            background: "rgba(0,0,0,0.6)",
            borderRadius: 16,
            border: "2px solid rgba(234, 179, 8, 0.3)",
            overflow: "hidden",
          }}>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              {(["skill", "instrument", "gear", "band", "venue"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  style={{
                    flex: 1,
                    padding: "12px 8px",
                    background: selectedTab === tab ? "rgba(234, 179, 8, 0.2)" : "transparent",
                    border: "none",
                    borderBottom: selectedTab === tab ? "2px solid #eab308" : "2px solid transparent",
                    color: selectedTab === tab ? "#eab308" : "#888",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {tab === "skill" ? "✋" : tab === "instrument" ? "🎸" : tab === "gear" ? "🔊" : tab === "band" ? "🧑‍🎤" : "📍"} {tab}
                </button>
              ))}
            </div>

            {/* Upgrade list */}
            <div style={{ maxHeight: 300, overflowY: "auto", padding: 8 }}>
              {selectedTab === "venue" ? (
                // Venue upgrades
                VENUES.map((v, i) => {
                  const isUnlocked = i <= currentVenue;
                  const canAfford = zc >= v.unlockCost;
                  const isCurrent = i === currentVenue;
                  
                  return (
                    <div key={v.id} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      background: isCurrent ? "rgba(234, 179, 8, 0.1)" : "transparent",
                      borderRadius: 8,
                      marginBottom: 4,
                    }}>
                      <div style={{ fontSize: 28 }}>📍</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: isUnlocked ? "#fff" : "#666", fontWeight: 600 }}>
                          {v.name}
                          {isCurrent && <span style={{ color: "#22c55e", marginLeft: 8 }}>✓ Current</span>}
                        </div>
                        <div style={{ color: "#888", fontSize: 12 }}>{v.description}</div>
                        <div style={{ color: "#22c55e", fontSize: 11, marginTop: 2 }}>+{v.crowdSize - (VENUES[i-1]?.crowdSize || 0)} crowd</div>
                      </div>
                      {!isUnlocked && (
                        <button
                          onClick={() => unlockVenue(i)}
                          disabled={!canAfford}
                          style={{
                            padding: "10px 16px",
                            borderRadius: 8,
                            border: "none",
                            background: canAfford ? "linear-gradient(135deg, #eab308, #ca8a04)" : "#333",
                            color: canAfford ? "#000" : "#666",
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: canAfford ? "pointer" : "default",
                          }}
                        >
                          {formatNumber(v.unlockCost)} ZC
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                // Regular upgrades
                UPGRADES.filter(u => u.category === selectedTab).map(upgrade => {
                  const level = upgradeLevels[upgrade.id] || 0;
                  const cost = getUpgradeCost(upgrade, level);
                  const canAfford = zc >= cost && level < upgrade.maxLevel;
                  const isMaxed = level >= upgrade.maxLevel;

                  return (
                    <div key={upgrade.id} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 4,
                    }}>
                      <div style={{ fontSize: 28 }}>
                        {upgrade.category === "instrument" ? "🎸" : upgrade.category === "gear" ? "🔊" : upgrade.category === "band" ? "🧑‍🎤" : "✋"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: "#fff", fontWeight: 600 }}>
                          {upgrade.name}
                          {level > 0 && <span style={{ color: "#eab308", marginLeft: 8 }}>Lv.{level}</span>}
                        </div>
                        <div style={{ color: "#888", fontSize: 12 }}>{upgrade.description}</div>
                        {!isMaxed && (
                          <div style={{ color: "#22c55e", fontSize: 11, marginTop: 2 }}>
                            +{upgrade.zpsBonus > 0 ? `${upgrade.zpsBonus}/sec` : `${upgrade.zpcBonus}/click`}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => buyUpgrade(upgrade.id)}
                        disabled={!canAfford}
                        style={{
                          padding: "10px 16px",
                          borderRadius: 8,
                          border: "none",
                          background: isMaxed ? "#22c55e" : canAfford ? "linear-gradient(135deg, #eab308, #ca8a04)" : "#333",
                          color: isMaxed || canAfford ? "#000" : "#666",
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: canAfford ? "pointer" : "default",
                          minWidth: 80,
                        }}
                      >
                        {isMaxed ? "MAX" : `${formatNumber(cost)} ZC`}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes coinFly {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-80px) scale(1.3); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
